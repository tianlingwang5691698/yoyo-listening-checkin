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
  const { getPlanPhase, getRound1IndicesForCategory } = deps.planLib;
  const catalogLength = getPlanCatalog(category, deps).length;
  const indices = getRound1IndicesForCategory(dayIndex, category, catalogLength);
  return {
    phase: getPlanPhase(dayIndex),
    indices,
    batchSize: indices.length
  };
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
    byCategory[category] = tasks;
    tasks.forEach((task, slotIndex) => {
      flatTasks.push(Object.assign({}, task, {
        planDayIndex: dayIndex,
        planPhase: phase.key,
        planPhaseLabel: phase.label,
        planBatchSize: batchSize,
        planSlotIndex: slotIndex + 1,
        planSlotCount: tasks.length
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
  buildPlanForDay,
  decoratePlanTasks
};
