const LEVEL_TABS = ['Pre A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const MATERIALS = [
  { category: 'song', levelIds: ['Pre A1'], title: 'Songs' },
  { category: 'newconcept1', levelIds: ['A1'], title: 'New Concept 1' },
  { category: 'unlock1', levelIds: ['A1'], title: 'Unlock 1' },
  { category: 'peppa', levelIds: ['A1', 'A2'], title: 'Peppa' },
  { category: 'newconcept2', levelIds: ['A2'], title: 'New Concept 2' },
  { category: 'unlock2', levelIds: ['A2'], title: 'Unlock 2' },
  { category: 'newconcept3', levelIds: ['B1'], title: 'New Concept 3' },
  { category: 'unlock3', levelIds: ['B1'], title: 'Unlock 3' },
  { category: 'newconcept4', levelIds: ['B2'], title: 'New Concept 4' },
  { category: 'unlock4', levelIds: ['B2'], title: 'Unlock 4' }
];

function normalizeLevelId(value) {
  const raw = String(value || '').trim();
  return LEVEL_TABS.includes(raw) ? raw : 'A1';
}

function getMaterial(category) {
  return MATERIALS.find((item) => item.category === category) || null;
}

function buildLevelTabs(selectedLevel) {
  const activeLevel = normalizeLevelId(selectedLevel);
  return LEVEL_TABS.map((levelId) => ({
    levelId,
    enabled: levelId !== 'C1' && levelId !== 'C2',
    active: levelId === activeLevel,
    stateText: levelId === 'C1' || levelId === 'C2' ? '未开放' : ''
  }));
}

function buildMaterialEntries(levelId, deps) {
  const targetLevel = normalizeLevelId(levelId);
  return MATERIALS.filter((item) => item.levelIds.includes(targetLevel)).map((item) => {
    const catalog = deps.getCatalog(item.category) || [];
    return {
      levelId: targetLevel,
      category: item.category,
      title: item.title,
      totalCount: catalog.length,
      enabled: catalog.length > 0
    };
  });
}

function normalizePlanMaterial(input, deps) {
  const category = String(input && input.category || '').trim();
  const definition = getMaterial(category);
  if (!definition) {
    return null;
  }
  const catalog = deps.getCatalog(category) || [];
  const totalCount = catalog.length;
  if (!totalCount) {
    return null;
  }
  const startNo = Math.max(1, Math.min(totalCount, Number(input.startNo || 1)));
  const endNo = Math.max(startNo, Math.min(totalCount, Number(input.endNo || totalCount)));
  return {
    levelId: normalizeLevelId(input.levelId || definition.levelIds[0]),
    category,
    title: definition.title,
    startNo,
    endNo,
    dailyCount: Math.max(1, Math.min(20, Number(input.dailyCount || 1))),
    repeatTarget: Math.max(1, Math.min(10, Number(input.repeatTarget || 3))),
    totalCount,
    enabled: true
  };
}

function mergePlanMaterial(plan, material) {
  const existing = Array.isArray(plan && plan.materials) ? plan.materials : [];
  return existing.filter((item) => item.category !== material.category).concat([material]);
}

function getCustomPlanDayIndex(checkins, date, planId) {
  const records = (Array.isArray(checkins) ? checkins : [])
    .filter((item) => String(item.planSource || '') === 'custom-listening' && (!planId || item.listeningPlanId === planId));
  const sameDay = records.find((item) => item.date === date && item.planDayIndex);
  if (sameDay) {
    return Number(sameDay.planDayIndex || 1) || 1;
  }
  return records.filter((item) => String(item.date || '') < date).length + 1;
}

function buildPlanForDay(plan, dayIndex, deps) {
  const byCategory = {};
  const flatTasks = [];
  const categoryOrder = [];
  const materials = (plan && Array.isArray(plan.materials) ? plan.materials : []).filter((item) => item && item.enabled !== false);
  materials.forEach((material) => {
    const normalized = normalizePlanMaterial(material, deps);
    if (!normalized) {
      return;
    }
    const catalog = deps.getCatalog(normalized.category) || [];
    const startIndex = normalized.startNo - 1 + (Math.max(1, Number(dayIndex || 1)) - 1) * normalized.dailyCount;
    const tasks = [];
    for (let offset = 0; offset < normalized.dailyCount; offset += 1) {
      const index = startIndex + offset;
      if (index > normalized.endNo - 1 || index >= catalog.length) {
        break;
      }
      const source = catalog[index];
      if (source) {
        tasks.push(Object.assign({}, source, {
          category: normalized.category,
          repeatTarget: normalized.repeatTarget,
          planSource: 'custom-listening',
          listeningPlanId: plan.planId || plan._id || ''
        }));
      }
    }
    if (!tasks.length) {
      return;
    }
    categoryOrder.push(normalized.category);
    byCategory[normalized.category] = tasks;
    tasks.forEach((task, slotIndex) => {
      flatTasks.push(Object.assign({}, task, {
        planDayIndex: dayIndex,
        planPhase: 'custom',
        planPhaseLabel: '自定义',
        planBatchSize: tasks.length,
        planSlotIndex: slotIndex + 1,
        planSlotCount: tasks.length
      }));
    });
  });
  return {
    dayIndex,
    phase: { key: 'custom', label: '自定义' },
    byCategory,
    flatTasks,
    categoryOrder
  };
}

function decoratePlanTasks(progressRecords, childId, date, plan, options = {}, deps) {
  return (plan.categoryOrder || Object.keys(plan.byCategory || {})).flatMap((category) => (
    deps.decoratePlannedTasks(progressRecords, childId, category, date, plan.byCategory[category] || [], {
      planRunType: options.planRunType || 'normal',
      targetDate: date,
      planDayIndex: plan.dayIndex,
      planSource: 'custom-listening',
      listeningPlanId: options.listeningPlanId || ''
    })
  ));
}

module.exports = {
  LEVEL_TABS,
  MATERIALS,
  normalizeLevelId,
  buildLevelTabs,
  buildMaterialEntries,
  normalizePlanMaterial,
  mergePlanMaterial,
  getCustomPlanDayIndex,
  buildPlanForDay,
  decoratePlanTasks
};
