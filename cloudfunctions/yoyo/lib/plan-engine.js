const PEPPA_REVIEW_DAILY_COUNT = 2;

function getPlanCatalog(category, deps) {
  const { getCatalog, planSlotCount } = deps;
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

function getPeppaReviewIndices(dayIndex, catalogLength) {
  if (!catalogLength) {
    return [];
  }
  const learnedCount = Math.min(catalogLength, Math.max(0, dayIndex - 1));
  if (!learnedCount) {
    return [];
  }
  const reviewCount = Math.min(PEPPA_REVIEW_DAILY_COUNT, learnedCount);
  const startIndex = (Math.max(0, dayIndex - 2) * PEPPA_REVIEW_DAILY_COUNT) % learnedCount;
  const indices = [];
  for (let step = 0; step < learnedCount && indices.length < reviewCount; step += 1) {
    indices.push((startIndex + step) % learnedCount);
  }
  return indices;
}

function buildPeppaReviewTasks(dayIndex, catalog, currentTasks) {
  const currentTaskIds = new Set(currentTasks.map((task) => task.taskId).filter(Boolean));
  const reviewTasks = [];
  getPeppaReviewIndices(dayIndex, catalog.length).some((index) => {
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
      title: `复听 ${source.title || source.name || source.taskId}`.trim()
    }));
    return reviewTasks.length >= PEPPA_REVIEW_DAILY_COUNT;
  });
  return reviewTasks;
}

function buildPlanForDay(dayIndex, deps) {
  const { getPlanPhase, getPlanCategoryOrder } = deps.planLib;
  const phase = getPlanPhase(dayIndex);
  const byCategory = {};
  const flatTasks = [];
  getPlanCategoryOrder(dayIndex).forEach((category) => {
    const { indices, batchSize } = getPlanIndicesForDay(dayIndex, category, deps);
    const catalog = getPlanCatalog(category, deps);
    const tasks = indices.map((index) => catalog[index] || null).filter(Boolean);
    const plannedTasks = category === 'peppa'
      ? tasks.concat(buildPeppaReviewTasks(dayIndex, catalog, tasks))
      : tasks;
    byCategory[category] = plannedTasks;
    plannedTasks.forEach((task, slotIndex) => {
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
  decoratePlanTasks
};
