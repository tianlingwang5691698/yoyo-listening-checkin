const LEVEL_TABS = ['Pre A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const MATERIALS = [
  { category: 'song', levelIds: ['Pre A1'], title: 'Songs' },
  { category: 'littlebear', levelIds: ['Pre A1'], title: 'Little Bear' },
  { category: 'peppa', levelIds: ['A1'], title: 'Peppa' },
  { category: 'newconcept1', levelIds: ['A1'], title: 'New Concept 1' },
  { category: 'unlock1', levelIds: ['A1'], title: 'Unlock 1 听口 第二版' },
  { category: 'unlock1thirdedition', levelIds: ['A1'], title: 'Unlock 1 听口 第三版' },
  { category: 'unlock1workbook', levelIds: ['A1'], title: 'Unlock 1 听口 练习册 第二版' },
  { category: 'newconcept2', levelIds: ['A2'], title: 'New Concept 2' },
  { category: 'petethecat', levelIds: ['A2'], title: 'Pete the Cat' },
  { category: 'magictreehouse', levelIds: ['A2'], title: 'Magic Tree House' },
  { category: 'unlock2', levelIds: ['A2'], title: 'Unlock 2 课本' },
  { category: 'unlock2thirdedition', levelIds: ['A2'], title: 'Unlock 2 听口 第三版' },
  { category: 'unlock2workbook', levelIds: ['A2'], title: 'Unlock 2 练习册' },
  { category: 'newconcept3', levelIds: ['B1'], title: 'New Concept 3' },
  { category: 'magictreehouseb1', levelIds: ['B1'], title: 'Magic Tree House' },
  { category: 'unlock3textbook', levelIds: ['B1'], title: 'Unlock3 听口 第二版' },
  { category: 'unlock3thirdedition', levelIds: ['B1'], title: 'Unlock3 听口 第三版' },
  { category: 'unlock3', levelIds: ['B1'], title: 'Unlock3 听口练习册 第二版' },
  { category: 'newconcept4', levelIds: ['B2'], title: 'New Concept 4' },
  { category: 'unlock4', levelIds: ['B2'], title: 'Unlock 4 课本' },
  { category: 'unlock4thirdedition', levelIds: ['B2'], title: 'Unlock 4 听口 第三版' },
  { category: 'unlock4workbook', levelIds: ['B2'], title: 'Unlock 4 练习册' }
];

function normalizeLevelId(value) {
  const raw = String(value || '').trim();
  return LEVEL_TABS.includes(raw) ? raw : 'A1';
}

function getMaterial(category) {
  return MATERIALS.find((item) => item.category === category) || null;
}

function normalizeMaterialLevelId(category, value) {
  const requestedLevel = normalizeLevelId(value);
  const material = getMaterial(category);
  return material && !material.levelIds.includes(requestedLevel)
    ? material.levelIds[0]
    : requestedLevel;
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
    const summary = deps.getCatalogSummary
      ? deps.getCatalogSummary(item.category)
      : { totalCount: (deps.getCatalog(item.category) || []).length };
    const totalCount = Number(summary && summary.totalCount || 0);
    return {
      levelId: targetLevel,
      category: item.category,
      title: item.title,
      totalCount,
      enabled: summary && Object.prototype.hasOwnProperty.call(summary, 'enabled') ? !!summary.enabled : totalCount > 0
    };
  });
}

function normalizePlanMaterialSummary(input, deps) {
  const category = String(input && input.category || '').trim();
  const definition = getMaterial(category);
  if (!definition) {
    return null;
  }
  const summary = deps.getCatalogSummary ? deps.getCatalogSummary(category) : {};
  const totalCount = Number((summary && summary.totalCount) || input.totalCount || 0);
  if (!totalCount) {
    return null;
  }
  const startNo = Math.max(1, Math.min(totalCount, Number(input.startNo || 1)));
  const endNo = Math.max(startNo, Math.min(totalCount, Number(input.endNo || totalCount)));
  return {
    levelId: normalizeLevelId(input.levelId || definition.levelIds[0]),
    category,
    title: input.title || definition.title,
    startNo,
    endNo,
    dailyCount: Math.max(1, Math.min(20, Number(input.dailyCount || 1))),
    repeatTarget: Math.max(1, Math.min(10, Number(input.repeatTarget || 3))),
    totalCount,
    enabled: input.enabled !== false,
    rangeCount: Number(input.rangeCount || Math.max(0, endNo - startNo + 1)),
    knownDurationCount: Number(input.knownDurationCount || 0),
    durationReady: !!input.durationReady,
    rangeDurationSec: Number(input.rangeDurationSec || 0),
    estimatedDailyDurationSec: Number(input.estimatedDailyDurationSec || 0),
    progressStartedAt: String(input.progressStartedAt || '')
  };
}

function getPlanMaterialDuration(catalog, startNo, endNo, dailyCount, repeatTarget) {
  const rangeTasks = (catalog || []).slice(Math.max(0, startNo - 1), Math.max(startNo, endNo));
  const knownDurations = rangeTasks
    .map((item) => Number(item && item.durationSec || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const rangeDurationSec = Math.round(knownDurations.reduce((sum, value) => sum + value, 0));
  const effectiveDailyCount = Math.min(Math.max(1, Number(dailyCount || 1)), rangeTasks.length || 1);
  const averageDurationSec = knownDurations.length ? rangeDurationSec / knownDurations.length : 0;
  return {
    rangeCount: rangeTasks.length,
    knownDurationCount: knownDurations.length,
    durationReady: !!rangeTasks.length && knownDurations.length === rangeTasks.length,
    rangeDurationSec,
    estimatedDailyDurationSec: averageDurationSec
      ? Math.round(averageDurationSec * effectiveDailyCount * Math.max(1, Number(repeatTarget || 1)))
      : 0
  };
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
  const dailyCount = Math.max(1, Math.min(20, Number(input.dailyCount || 1)));
  const repeatTarget = Math.max(1, Math.min(10, Number(input.repeatTarget || 3)));
  return Object.assign({
    levelId: normalizeLevelId(input.levelId || definition.levelIds[0]),
    category,
    title: definition.title,
    startNo,
    endNo,
    dailyCount,
    repeatTarget,
    totalCount,
    enabled: true,
    progressStartedAt: String(input.progressStartedAt || '')
  }, getPlanMaterialDuration(catalog, startNo, endNo, dailyCount, repeatTarget));
}

function decoratePlan(plan, deps) {
  if (!plan) {
    return null;
  }
  return Object.assign({}, plan, {
    materials: (Array.isArray(plan.materials) ? plan.materials : [])
      .map((item) => normalizePlanMaterial(item, deps))
      .filter(Boolean)
  });
}

function decoratePlanSummary(plan, deps) {
  if (!plan) {
    return null;
  }
  return Object.assign({}, plan, {
    materials: (Array.isArray(plan.materials) ? plan.materials : [])
      .map((item) => normalizePlanMaterialSummary(item, deps))
      .filter(Boolean)
  });
}

function mergePlanMaterial(plan, material) {
  const existing = Array.isArray(plan && plan.materials) ? plan.materials : [];
  return existing.filter((item) => item.category !== material.category).concat([material]);
}

function removePlanMaterial(plan, category) {
  const targetCategory = String(category || '').trim();
  const existing = Array.isArray(plan && plan.materials) ? plan.materials : [];
  return existing.filter((item) => item && item.category !== targetCategory);
}

function isCompletedPlanProgress(item) {
  return !!(item && (item.completedToday || Number(item.playCount || 0) >= Number(item.repeatTarget || 1)));
}

function isCurrentPlanProgress(item, date, plan, material) {
  const planId = String(plan.planId || plan._id || '').trim();
  const progressStartedAt = String(material.progressStartedAt || plan.progressStartedAt || plan.createdAt || '').trim();
  const updatedAt = String((item && (item.updatedAt || item.completedAt)) || '').trim();
  return !!planId
    && String((item && item.planSource) || '') === 'custom-listening'
    && String((item && item.planRunType) || 'normal') === 'normal'
    && String((item && item.listeningPlanId) || '') === planId
    && String((item && item.category) || '') === material.category
    && String((item && item.date) || '') < date
    && (!progressStartedAt || updatedAt >= progressStartedAt);
}

function getCustomPlanDayIndex(progressRecords, date, plan = {}) {
  const materials = (Array.isArray(plan.materials) ? plan.materials : []).filter(Boolean);
  const completedDates = new Set((Array.isArray(progressRecords) ? progressRecords : [])
    .filter((item) => materials.some((material) => isCurrentPlanProgress(item, date, plan, material)))
    .filter(isCompletedPlanProgress)
    .map((item) => String(item.date || ''))
    .filter(Boolean));
  return completedDates.size + 1;
}

function buildPlanWithIndices(plan, dayIndex, deps, resolveIndices) {
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
    const tasks = resolveIndices(normalized, catalog).map((index) => {
      const source = catalog[index];
      if (source) {
        return Object.assign({}, source, {
          category: normalized.category,
          repeatTarget: normalized.repeatTarget,
          planSource: 'custom-listening',
          listeningPlanId: plan.planId || plan._id || '',
          progressStartedAt: normalized.progressStartedAt || plan.progressStartedAt || plan.createdAt || ''
        });
      }
      return null;
    }).filter(Boolean);
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

function buildPlanForDay(plan, dayIndex, deps) {
  return buildPlanWithIndices(plan, dayIndex, deps, (normalized) => {
    const startIndex = normalized.startNo - 1 + (Math.max(1, Number(dayIndex || 1)) - 1) * normalized.dailyCount;
    return Array.from({ length: normalized.dailyCount }, (_, offset) => startIndex + offset)
      .filter((index) => index <= normalized.endNo - 1);
  });
}

function buildPlanForDate(plan, date, progressRecords, deps) {
  const dayIndex = getCustomPlanDayIndex(progressRecords, date, plan);
  return buildPlanWithIndices(plan, dayIndex, deps, (normalized, catalog) => {
    const slotCount = Math.min(normalized.dailyCount, normalized.endNo - normalized.startNo + 1);
    const completedTaskIds = new Set((Array.isArray(progressRecords) ? progressRecords : [])
      .filter((item) => isCurrentPlanProgress(item, date, plan, normalized))
      .filter(isCompletedPlanProgress)
      .map((item) => String(item.taskId || ''))
      .filter(Boolean));
    return Array.from({ length: slotCount }, (_, slotIndex) => {
      let index = normalized.startNo - 1 + slotIndex;
      while (index <= normalized.endNo - 1 && catalog[index] && completedTaskIds.has(String(catalog[index].taskId || ''))) {
        index += slotCount;
      }
      return index;
    }).filter((index) => index <= normalized.endNo - 1);
  });
}

function decoratePlanTasks(progressRecords, childId, date, plan, options = {}, deps) {
  return (plan.categoryOrder || Object.keys(plan.byCategory || {})).flatMap((category) => {
    const tasks = plan.byCategory[category] || [];
    const carriedProgress = tasks.reduce((records, task) => {
      const hasTodayRecord = records.some((item) => item.childId === childId
        && item.category === category && item.taskId === task.taskId && item.date === date);
      if (hasTodayRecord) return records;
      const latest = (progressRecords || []).filter((item) => item.childId === childId
        && item.category === category
        && item.taskId === task.taskId
        && String(item.planSource || '') === 'custom-listening'
        && String(item.listeningPlanId || '') === String(options.listeningPlanId || '')
        && String(item.updatedAt || '') >= String(task.progressStartedAt || ''))
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0];
      return latest ? records.concat([Object.assign({}, latest, { date })]) : records;
    }, (progressRecords || []).slice());
    return deps.decoratePlannedTasks(carriedProgress, childId, category, date, tasks, {
      planRunType: options.planRunType || 'normal',
      targetDate: date,
      planDayIndex: plan.dayIndex,
      planSource: 'custom-listening',
      listeningPlanId: options.listeningPlanId || ''
    });
  });
}

module.exports = {
  LEVEL_TABS,
  MATERIALS,
  normalizeLevelId,
  normalizeMaterialLevelId,
  buildLevelTabs,
  buildMaterialEntries,
  normalizePlanMaterial,
  decoratePlan,
  decoratePlanSummary,
  mergePlanMaterial,
  removePlanMaterial,
  getCustomPlanDayIndex,
  buildPlanForDay,
  buildPlanForDate,
  decoratePlanTasks
};
