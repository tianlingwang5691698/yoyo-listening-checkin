const PEPPA_REVIEW_DAILY_COUNT = 2;

function normalizePlannedTask(task, category, dayIndex, deps) {
  if (deps.planLib.getPlanPhase(dayIndex).key === 'round-2') {
    return Object.assign({}, task, { repeatTarget: 1 });
  }
  if (category === 'unlock1' && dayIndex > deps.planSlotCount) {
    return Object.assign({}, task, { repeatTarget: 1 });
  }
  return task;
}

function getPlanCatalog(category, deps) {
  const { getCatalog, planSlotCount } = deps;
  if (category === 'grammar') {
    return deps.planLib.buildGrammarCatalog();
  }
  if (category === 'newconcept1') {
    return getCatalog(category).slice(0, 76);
  }
  if (category === 'unlock1') {
    return getCatalog(category).slice(0, planSlotCount);
  }
  return getCatalog(category);
}

function getPlanIndicesForDay(dayIndex, category, deps) {
  const { getPlanPhase, getPlanIndicesForCategory } = deps.planLib;
  const catalogLength = getPlanCatalog(category, deps).length;
  const indices = getPlanIndicesForCategory(dayIndex, category, catalogLength);
  return {
    phase: getPlanPhase(dayIndex),
    indices,
    batchSize: indices.length
  };
}

function getPeppaReviewIndices(dayIndex, catalogLength, cursor = 0) {
  if (!catalogLength) {
    return [];
  }
  const learnedCount = Math.min(catalogLength, Math.max(0, dayIndex - 1));
  if (!learnedCount) {
    return [];
  }
  const reviewCount = Math.min(PEPPA_REVIEW_DAILY_COUNT, learnedCount);
  const startIndex = Math.max(0, Number(cursor || 0)) % learnedCount;
  const indices = [];
  for (let step = 0; step < learnedCount && indices.length < reviewCount; step += 1) {
    indices.push((startIndex + step) % learnedCount);
  }
  return indices;
}

function buildPeppaReviewTasks(dayIndex, catalog, currentTasks, cursor = 0) {
  const currentTaskIds = new Set(currentTasks.map((task) => task.taskId).filter(Boolean));
  const reviewTasks = [];
  getPeppaReviewIndices(dayIndex, catalog.length, cursor).some((index) => {
    const source = catalog[index];
    if (!source || currentTaskIds.has(source.taskId)) {
      return false;
    }
    reviewTasks.push(Object.assign({}, source, {
      taskId: `${source.taskId}__review_${dayIndex}_${reviewTasks.length + 1}`,
      originalTaskId: source.taskId,
      isReviewTask: true,
      reviewType: 'peppa-old-listening',
      repeatTarget: 1,
      transcriptTrackId: null,
      textSource: null,
      syncGranularity: 'none',
      subtitle: 'Peppa 旧集裸听',
      title: source.title || source.name || source.taskId
    }));
    return reviewTasks.length >= PEPPA_REVIEW_DAILY_COUNT;
  });
  return reviewTasks;
}

function buildPlanForDay(dayIndex, deps, options = {}) {
  const { getPlanPhase, getPlanCategoryOrder } = deps.planLib;
  const phase = getPlanPhase(dayIndex);
  const byCategory = {};
  const flatTasks = [];
  getPlanCategoryOrder(dayIndex).forEach((category) => {
    const { indices, batchSize } = getPlanIndicesForDay(dayIndex, category, deps);
    const catalog = getPlanCatalog(category, deps);
    const tasks = indices
      .map((index) => catalog[index] || null)
      .filter(Boolean)
      .map((task) => normalizePlannedTask(task, category, dayIndex, deps));
    const plannedTasks = category === 'peppa' && options.includePeppaReview && phase.key !== 'round-2'
      ? tasks.concat(buildPeppaReviewTasks(dayIndex, catalog, tasks, options.peppaReviewCursor))
      : tasks;
    byCategory[category] = plannedTasks.map((task, slotIndex) => Object.assign({}, task, {
      planSlotIndex: slotIndex + 1,
      planSlotCount: plannedTasks.length
    }));
    byCategory[category].forEach((task, slotIndex) => {
      flatTasks.push(Object.assign({}, task, {
        planDayIndex: dayIndex,
        planPhase: phase.key,
        planPhaseLabel: phase.label,
        planBatchSize: batchSize,
        planSlotIndex: slotIndex + 1,
        planSlotCount: plannedTasks.length
      }));
    });
  });
  return {
    dayIndex,
    phase,
    byCategory,
    flatTasks
  };
}

function buildFixedPlanBySlots(progressRecords, childId, date, deps) {
  const dayIndex = deps.planLib.FIXED_SLOT_PLAN_DAY;
  const basePlan = buildPlanForDay(dayIndex, deps);
  const byCategory = {};
  const flatTasks = [];
  deps.planLib.getPlanCategoryOrder(dayIndex).forEach((category) => {
    const catalog = getPlanCatalog(category, deps);
    const baseTasks = basePlan.byCategory[category] || [];
    const slotCount = baseTasks.length;
    byCategory[category] = baseTasks.map((baseTask, slotOffset) => {
      const slotIndex = slotOffset + 1;
      const completedCount = deps.fixedPlanSummary && deps.getCompletedCountBeforeDate
        ? deps.getCompletedCountBeforeDate(deps.fixedPlanSummary, category, slotIndex, date)
        : (progressRecords || []).filter((item) => (
          item.childId === childId
            && item.category === category
            && String(item.planSource || 'fixed-yoyo') === 'fixed-yoyo'
            && String(item.planRunType || 'normal') === 'normal'
            && String(item.date || '') >= deps.planLib.FIXED_SLOT_PLAN_STARTED_AT
            && String(item.date || '') < date
            && Number(item.planSlotIndex || 0) === slotIndex
            && (item.completedToday || Number(item.playCount || 0) >= Number(item.repeatTarget || 1))
        )).length;
      const baseIndex = catalog.findIndex((task) => task.taskId === baseTask.taskId);
      const nextIndex = baseIndex < 0 ? -1 : baseIndex + completedCount * slotCount;
      const source = category === 'grammar'
        ? catalog[nextIndex]
        : catalog.length ? catalog[nextIndex % catalog.length] : null;
      return source ? Object.assign({}, source, {
        repeatTarget: 1,
        planSlotIndex: slotIndex,
        planSlotCount: slotCount
      }) : null;
    }).filter(Boolean);
    byCategory[category].forEach((task) => flatTasks.push(Object.assign({}, task, {
      planDayIndex: dayIndex,
      planPhase: basePlan.phase.key,
      planPhaseLabel: basePlan.phase.label,
      planBatchSize: slotCount
    })));
  });
  return {
    dayIndex,
    phase: basePlan.phase,
    byCategory,
    flatTasks
  };
}

function decoratePlanTasks(progressRecords, childId, date, plan, options = {}, deps) {
  const { getPlanCategoryOrder } = deps.planLib;
  return getPlanCategoryOrder(plan.dayIndex).flatMap((category) => (
    deps.decoratePlannedTasks(progressRecords, childId, category, date, plan.byCategory[category] || [], {
      planRunType: options.planRunType || 'normal',
      targetDate: date,
      planDayIndex: plan.dayIndex
    })
  ));
}

module.exports = {
  getPlanCatalog,
  getPlanIndicesForDay,
  getPeppaReviewIndices,
  buildPeppaReviewTasks,
  buildPlanForDay,
  buildFixedPlanBySlots,
  decoratePlanTasks
};
