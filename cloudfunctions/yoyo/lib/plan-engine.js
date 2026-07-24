const PEPPA_REVIEW_DAILY_COUNT = 2;
const UNLOCK1_WORKBOOK_CATEGORY = 'unlock1workbook';
const UNLOCK1_WORKBOOK_FIRST_ROUND_REPEAT_TARGET = 3;
const UNLOCK1_WORKBOOK_FAST_ROUNDS = 2;
const UNLOCK2_TEXTBOOK_CATEGORY = 'unlock2';
const UNLOCK2_TEXTBOOK_REPEAT_TARGET = 3;
const UNLOCK2_TEXTBOOK_FAST_SLOT_COUNT = 3;
const NEWCONCEPT1_CATEGORY = 'newconcept1';
const NEWCONCEPT2_CATEGORY = 'newconcept2';
const NEWCONCEPT2_LESSON_COUNT = 96;
const NEWCONCEPT2_REPEAT_TARGET = 3;
const NEWCONCEPT2_FAST_SLOT_COUNT = 3;
const GRAMMAR_LEXICAL_FIRST_DAILY_COUNT = 5;
const GRAMMAR_LEXICAL_SECOND_DAILY_COUNT = 10;
const GRAMMAR_SYNTAX_DAILY_COUNT = 5;

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

function getFixedCompletedCount(progressRecords, childId, category, slotIndex, date, deps) {
  if (deps.fixedPlanSummary && deps.getCompletedCountBeforeDate) {
    return deps.getCompletedCountBeforeDate(deps.fixedPlanSummary, category, slotIndex, date);
  }
  return (progressRecords || []).filter((item) => (
    item.childId === childId
      && item.category === category
      && String(item.planSource || 'fixed-yoyo') === 'fixed-yoyo'
      && String(item.planRunType || 'normal') === 'normal'
      && String(item.date || '') >= deps.planLib.FIXED_SLOT_PLAN_STARTED_AT
      && String(item.date || '') < date
      && Number(item.planSlotIndex || 0) === slotIndex
      && (item.completedToday || Number(item.playCount || 0) >= Number(item.repeatTarget || 1))
  )).length;
}

function getCompletedGrammarTaskIds(progressRecords, childId, date, deps) {
  return new Set((progressRecords || [])
    .filter((item) => (
      item.childId === childId
        && item.category === 'grammar'
        && String(item.planSource || 'fixed-yoyo') === 'fixed-yoyo'
        && String(item.planRunType || 'normal') === 'normal'
        && String(item.date || '') >= deps.planLib.FIXED_SLOT_PLAN_STARTED_AT
        && String(item.date || '') < date
        && (item.completedToday || Number(item.playCount || 0) >= Number(item.repeatTarget || 1))
    ))
    .map((item) => item.taskId)
    .filter(Boolean));
}

function decorateGrammarTasks(tasks, stage, round, dailyCount) {
  return tasks.map((source, slotOffset) => {
    const isSecondLexicalRound = stage === 'lexical-round-2';
    return Object.assign({}, source, {
      taskId: isSecondLexicalRound ? `${source.taskId}__fixed_grammar_round_2` : source.taskId,
      originalTaskId: isSecondLexicalRound ? source.taskId : String(source.originalTaskId || ''),
      repeatTarget: 1,
      planSlotIndex: slotOffset + 1,
      planSlotCount: tasks.length,
      grammarStage: stage,
      grammarRound: round,
      grammarDomain: source.domain || (stage === 'syntax-round-1' ? 'syntax' : 'lexical'),
      grammarDomainLabel: source.domainLabel || (stage === 'syntax-round-1' ? '句法' : '词法'),
      grammarDailyCount: dailyCount
    });
  });
}

function buildFixedGrammarTasks(progressRecords, childId, date, deps) {
  const completedTaskIds = getCompletedGrammarTaskIds(progressRecords, childId, date, deps);
  const lexicalCatalog = deps.planLib.buildGrammarCatalog();
  const firstRoundPending = lexicalCatalog.filter((task) => !completedTaskIds.has(task.taskId));
  if (firstRoundPending.length) {
    return decorateGrammarTasks(
      firstRoundPending.slice(0, GRAMMAR_LEXICAL_FIRST_DAILY_COUNT),
      'lexical-round-1',
      1,
      GRAMMAR_LEXICAL_FIRST_DAILY_COUNT
    );
  }

  const secondRoundCatalog = lexicalCatalog.map((task) => Object.assign({}, task, {
    taskId: `${task.taskId}__fixed_grammar_round_2`,
    originalTaskId: task.taskId
  }));
  const secondRoundPending = secondRoundCatalog.filter((task) => !completedTaskIds.has(task.taskId));
  if (secondRoundPending.length) {
    return decorateGrammarTasks(
      secondRoundPending.slice(0, GRAMMAR_LEXICAL_SECOND_DAILY_COUNT).map((task) => Object.assign({}, task, {
        taskId: task.originalTaskId
      })),
      'lexical-round-2',
      2,
      GRAMMAR_LEXICAL_SECOND_DAILY_COUNT
    );
  }

  const syntaxCatalog = deps.planLib.buildGrammarSyntaxCatalog();
  const syntaxPending = syntaxCatalog.filter((task) => !completedTaskIds.has(task.taskId));
  return decorateGrammarTasks(
    syntaxPending.slice(0, GRAMMAR_SYNTAX_DAILY_COUNT),
    'syntax-round-1',
    1,
    GRAMMAR_SYNTAX_DAILY_COUNT
  );
}

function getNewConceptLessonNumber(task) {
  const match = String(task && task.title || '').trim().match(/^(\d{1,3})\s*[－-]/);
  return match ? Number(match[1]) : 0;
}

function buildNewConcept2LessonCatalog(deps) {
  const lessons = new Map();
  (deps.getCatalog(NEWCONCEPT2_CATEGORY) || []).forEach((task) => {
    const lessonNumber = getNewConceptLessonNumber(task);
    if (lessonNumber < 1 || lessonNumber > NEWCONCEPT2_LESSON_COUNT) return;
    const current = lessons.get(lessonNumber);
    const title = String(task.title || '');
    if (!current || /_\d{8}_\d{6}$/.test(String(current.title || '')) && !/_\d{8}_\d{6}$/.test(title)) {
      lessons.set(lessonNumber, task);
    }
  });
  return Array.from({ length: NEWCONCEPT2_LESSON_COUNT }, (_, index) => lessons.get(index + 1) || null)
    .filter(Boolean);
}

function buildFixedNewConcept2Task(source, stage, slotIndex, slotCount, repeatTarget, cycle = 0) {
  if (!source) return null;
  const suffix = cycle > 0 ? `cycle_${cycle}` : 'round_1';
  return Object.assign({}, source, {
    taskId: `${source.taskId}__fixed_listening_${suffix}`,
    originalTaskId: source.taskId,
    category: NEWCONCEPT2_CATEGORY,
    repeatTarget,
    planSlotIndex: slotIndex,
    planSlotCount: slotCount,
    listeningStage: stage
  });
}

function buildFixedNewConceptTasks(progressRecords, childId, date, baseTasks, deps) {
  const newConcept1Catalog = getPlanCatalog(NEWCONCEPT1_CATEGORY, deps);
  const slotCount = baseTasks.length;
  const newConcept1Tasks = baseTasks.map((baseTask, slotOffset) => {
    const slotIndex = slotOffset + 1;
    const completedCount = getFixedCompletedCount(
      progressRecords,
      childId,
      NEWCONCEPT1_CATEGORY,
      slotIndex,
      date,
      deps
    );
    const baseIndex = newConcept1Catalog.findIndex((task) => task.taskId === baseTask.taskId);
    const nextIndex = baseIndex < 0 ? -1 : baseIndex + completedCount * slotCount;
    const source = nextIndex >= 0 && nextIndex < newConcept1Catalog.length
      ? newConcept1Catalog[nextIndex]
      : null;
    return source ? Object.assign({}, source, {
      repeatTarget: 1,
      planSlotIndex: slotIndex,
      planSlotCount: slotCount,
      listeningStage: 'newconcept1-current-round'
    }) : null;
  }).filter(Boolean);
  if (newConcept1Tasks.length) return newConcept1Tasks;

  const newConcept2Catalog = buildNewConcept2LessonCatalog(deps);
  const firstSlotCompletedCount = getFixedCompletedCount(
    progressRecords,
    childId,
    NEWCONCEPT2_CATEGORY,
    1,
    date,
    deps
  );
  if (firstSlotCompletedCount < newConcept2Catalog.length) {
    return [buildFixedNewConcept2Task(
      newConcept2Catalog[firstSlotCompletedCount],
      'newconcept2-first-round',
      1,
      1,
      NEWCONCEPT2_REPEAT_TARGET
    )].filter(Boolean);
  }

  const completedCounts = [1, 2, 3].map((slotIndex) => getFixedCompletedCount(
    progressRecords,
    childId,
    NEWCONCEPT2_CATEGORY,
    slotIndex,
    date,
    deps
  ));
  const fastCompletedCounts = completedCounts.map((count, offset) => (
    offset === 0 ? Math.max(0, count - newConcept2Catalog.length) : count
  ));
  return fastCompletedCounts.map((completedCount, offset) => {
    const absoluteIndex = offset + completedCount * NEWCONCEPT2_FAST_SLOT_COUNT;
    const source = newConcept2Catalog[absoluteIndex % newConcept2Catalog.length];
    const cycle = Math.floor(absoluteIndex / newConcept2Catalog.length) + 1;
    return buildFixedNewConcept2Task(
      source,
      'newconcept2-fast-cycle',
      offset + 1,
      NEWCONCEPT2_FAST_SLOT_COUNT,
      1,
      cycle
    );
  }).filter(Boolean);
}

function buildUnlock1WorkbookTask(source, round, slotIndex, slotCount, repeatTarget) {
  if (!source) return null;
  return Object.assign({}, source, {
    taskId: `${source.taskId}__fixed_listening_round_${round}`,
    originalTaskId: source.taskId,
    category: UNLOCK1_WORKBOOK_CATEGORY,
    repeatTarget,
    planSlotIndex: slotIndex,
    planSlotCount: slotCount,
    listeningStage: `workbook-round-${round}`
  });
}

function buildUnlock2TextbookTask(source, stage, slotIndex, slotCount, repeatTarget, cycle = 0) {
  if (!source) return null;
  const suffix = cycle > 0 ? `cycle_${cycle}` : 'round_1';
  return Object.assign({}, source, {
    taskId: `${source.taskId}__fixed_listening_${suffix}`,
    originalTaskId: source.taskId,
    category: UNLOCK2_TEXTBOOK_CATEGORY,
    repeatTarget,
    planSlotIndex: slotIndex,
    planSlotCount: slotCount,
    listeningStage: stage
  });
}

function buildFixedUnlock1Tasks(progressRecords, childId, date, deps) {
  const textbookCatalog = getPlanCatalog('unlock1', deps);
  const textbookSlotCount = Math.min(3, textbookCatalog.length);
  const textbookCounts = Array.from({ length: textbookSlotCount }, (_, offset) => (
    getFixedCompletedCount(progressRecords, childId, 'unlock1', offset + 1, date, deps)
  ));
  const textbookTargetPerSlot = textbookSlotCount
    ? Math.ceil(textbookCatalog.length / textbookSlotCount)
    : 0;
  const textbookPending = textbookCounts.some((count, offset) => (
    offset + count * textbookSlotCount < textbookCatalog.length
  ));
  if (textbookPending) {
    return textbookCounts.map((count, offset) => {
      const source = textbookCatalog[offset + count * textbookSlotCount];
      return source ? Object.assign({}, source, {
        repeatTarget: 1,
        planSlotIndex: offset + 1,
        planSlotCount: textbookSlotCount,
        listeningStage: 'textbook-current-round'
      }) : null;
    }).filter(Boolean);
  }
  if (!textbookTargetPerSlot) return [];

  const workbookCatalog = deps.getCatalog(UNLOCK1_WORKBOOK_CATEGORY) || [];
  const workbookCounts = [1, 2, 3].map((slotIndex) => (
    getFixedCompletedCount(progressRecords, childId, UNLOCK1_WORKBOOK_CATEGORY, slotIndex, date, deps)
  ));
  if (workbookCounts[0] < workbookCatalog.length) {
    return [buildUnlock1WorkbookTask(
      workbookCatalog[workbookCounts[0]],
      1,
      1,
      1,
      UNLOCK1_WORKBOOK_FIRST_ROUND_REPEAT_TARGET
    )].filter(Boolean);
  }

  const fastTasksPerSlot = Math.ceil(workbookCatalog.length / 3);
  for (let roundOffset = 0; roundOffset < UNLOCK1_WORKBOOK_FAST_ROUNDS; roundOffset += 1) {
    const round = roundOffset + 2;
    const baselines = [
      workbookCatalog.length + roundOffset * fastTasksPerSlot,
      roundOffset * fastTasksPerSlot,
      roundOffset * fastTasksPerSlot
    ];
    const roundPending = workbookCounts.some((count, offset) => count < baselines[offset] + fastTasksPerSlot);
    if (!roundPending) continue;
    return workbookCounts.map((count, offset) => {
      const completedInRound = Math.max(0, count - baselines[offset]);
      if (completedInRound >= fastTasksPerSlot) return null;
      const source = workbookCatalog[offset + completedInRound * 3];
      return buildUnlock1WorkbookTask(source, round, offset + 1, 3, 1);
    }).filter(Boolean);
  }
  const unlock2Catalog = deps.getCatalog(UNLOCK2_TEXTBOOK_CATEGORY) || [];
  const unlock2CompletedCount = getFixedCompletedCount(
    progressRecords,
    childId,
    UNLOCK2_TEXTBOOK_CATEGORY,
    1,
    date,
    deps
  );
  if (unlock2CompletedCount < unlock2Catalog.length) {
    return [buildUnlock2TextbookTask(
      unlock2Catalog[unlock2CompletedCount],
      'unlock2-textbook-round-1',
      1,
      1,
      UNLOCK2_TEXTBOOK_REPEAT_TARGET
    )].filter(Boolean);
  }

  const completedCounts = [1, 2, 3].map((slotIndex) => getFixedCompletedCount(
    progressRecords,
    childId,
    UNLOCK2_TEXTBOOK_CATEGORY,
    slotIndex,
    date,
    deps
  ));
  const fastCompletedCounts = completedCounts.map((count, offset) => (
    offset === 0 ? Math.max(0, count - unlock2Catalog.length) : count
  ));
  return fastCompletedCounts.map((completedCount, offset) => {
    const absoluteIndex = offset + completedCount * UNLOCK2_TEXTBOOK_FAST_SLOT_COUNT;
    const source = unlock2Catalog[absoluteIndex % unlock2Catalog.length];
    const cycle = Math.floor(absoluteIndex / unlock2Catalog.length) + 1;
    return buildUnlock2TextbookTask(
      source,
      'unlock2-textbook-fast-cycle',
      offset + 1,
      UNLOCK2_TEXTBOOK_FAST_SLOT_COUNT,
      1,
      cycle
    );
  }).filter(Boolean);
}

function buildFixedPlanBySlots(progressRecords, childId, date, deps) {
  const dayIndex = deps.planLib.FIXED_SLOT_PLAN_DAY;
  const basePlan = buildPlanForDay(dayIndex, deps);
  const byCategory = {};
  const flatTasks = [];
  deps.planLib.getPlanCategoryOrder(dayIndex).forEach((category) => {
    if (category === 'unlock1') {
      const tasks = buildFixedUnlock1Tasks(progressRecords, childId, date, deps);
      byCategory[category] = tasks;
      tasks.forEach((task) => flatTasks.push(Object.assign({}, task, {
        planDayIndex: dayIndex,
        planPhase: basePlan.phase.key,
        planPhaseLabel: basePlan.phase.label,
        planBatchSize: tasks.length
      })));
      return;
    }
    if (category === NEWCONCEPT1_CATEGORY) {
      const tasks = buildFixedNewConceptTasks(
        progressRecords,
        childId,
        date,
        basePlan.byCategory[category] || [],
        deps
      );
      byCategory[category] = tasks;
      tasks.forEach((task) => flatTasks.push(Object.assign({}, task, {
        planDayIndex: dayIndex,
        planPhase: basePlan.phase.key,
        planPhaseLabel: basePlan.phase.label,
        planBatchSize: tasks.length
      })));
      return;
    }
    const catalog = getPlanCatalog(category, deps);
    const baseTasks = basePlan.byCategory[category] || [];
    const slotCount = baseTasks.length;
    if (category === 'grammar') {
      const tasks = buildFixedGrammarTasks(progressRecords, childId, date, deps);
      byCategory[category] = tasks;
      byCategory[category].forEach((task) => flatTasks.push(Object.assign({}, task, {
        planDayIndex: dayIndex,
        planPhase: basePlan.phase.key,
        planPhaseLabel: basePlan.phase.label,
        planBatchSize: tasks.length
      })));
      return;
    }
    byCategory[category] = baseTasks.map((baseTask, slotOffset) => {
      const slotIndex = slotOffset + 1;
      const completedCount = getFixedCompletedCount(progressRecords, childId, category, slotIndex, date, deps);
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
    flatTasks,
    displayCategoryOrder: deps.planLib.getPlanCategoryOrder(dayIndex).flatMap((category) => {
      if (category !== 'unlock1' && category !== NEWCONCEPT1_CATEGORY) return [category];
      const tasks = byCategory[category] || [];
      if (!tasks.length) return [];
      return [tasks[0].category || category];
    })
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
  buildFixedGrammarTasks,
  buildNewConcept2LessonCatalog,
  buildPlanForDay,
  buildFixedPlanBySlots,
  decoratePlanTasks
};
