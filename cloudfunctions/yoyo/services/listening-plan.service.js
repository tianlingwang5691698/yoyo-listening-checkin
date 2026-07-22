const study = require('../facades/study.facade');
const listeningPlanEngine = require('../lib/listening-plan-engine');
const listeningMaterialCatalog = require('../lib/listening-material-catalog');

function getPlanMaterial(plan, category) {
  return ((plan && plan.materials) || []).find((item) => item.category === category) || null;
}

function decorateActivePlan(plan, options = {}) {
  if (options.summaryOnly) {
    return listeningPlanEngine.decoratePlanSummary(plan, {
      getCatalogSummary: study.getCatalogSummary
    });
  }
  return listeningPlanEngine.decoratePlan(plan, {
    getCatalog: study.getPlanCatalog
  });
}

async function getListeningPlanOverview(event) {
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getListeningPlanOverview'
  }));
  const payload = (event && event.payload) || {};
  const selectedLevel = listeningPlanEngine.normalizeLevelId(payload.levelId || 'A1');
  const activePlan = decorateActivePlan(await study.getActiveListeningPlan(ctx), { summaryOnly: true });
  const materials = study.buildListeningPlanMaterials(selectedLevel).map((item) => Object.assign({}, item, {
    selected: !!getPlanMaterial(activePlan, item.category)
  }));
  return {
    currentMember: ctx.member,
    child: ctx.child,
    stats: {},
    selectedLevel,
    levelTabs: listeningPlanEngine.buildLevelTabs(selectedLevel),
    materials,
    activePlan,
    planSource: activePlan ? 'custom-listening' : 'fixed-yoyo',
    isYoyoFixedPlan: !activePlan && study.isYoyoChild(ctx.child),
    fixedPlan: {
      planDayIndex: 1,
      planPhase: 'round-2',
      planPhaseLabel: '阶段二'
    }
  };
}

async function getListeningMaterialDetail(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getListeningMaterialDetail'
  }));
  const payload = (event && event.payload) || {};
  const category = String(payload.category || '').trim();
  const levelId = listeningPlanEngine.normalizeMaterialLevelId(category, payload.levelId || 'A1');
  const [tasks, activePlanRecord] = await Promise.all([
    study.resolveStandaloneCategoryTasks(category, ctx.child.childId, today),
    study.getActiveListeningPlan(ctx)
  ]);
  const activePlan = decorateActivePlan(activePlanRecord, { summaryOnly: true });
  const selectedMaterial = getPlanMaterial(activePlan, category);
  return {
    currentMember: ctx.member,
    child: ctx.child,
    category,
    levelId,
    categoryLabel: study.getCategoryLabel(category),
    totalCount: tasks.length,
    tasks: tasks.map((task, index) => Object.assign({}, study.decorateTask(Object.assign({}, task, {
      planRunType: 'preview',
      planDayIndex: 1
    }), study.buildEmptyProgress(), category), {
      itemNo: index + 1
    })),
    activePlan,
    selectedMaterial
  };
}

async function getListeningMaterialCatalog(event) {
  const payload = (event && event.payload) || {};
  const category = String(payload.category || '').trim();
  const material = listeningPlanEngine.MATERIALS.find((item) => item.category === category);
  const levelId = listeningPlanEngine.normalizeMaterialLevelId(category, payload.levelId || 'A1');
  if (!material) {
    return {
      category,
      levelId,
      categoryLabel: '',
      totalCount: 0,
      tasks: [],
      publicResource: true,
      catalogVersion: 'public-v1'
    };
  }
  if (!study.getCatalog(category).length) {
    await study.refreshRuntimeCatalogs(false, [category]);
  }
  const tasks = await study.resolveStandaloneCategoryTasks(category, '', study.getTodayString());
  return {
    category,
    levelId,
    categoryLabel: study.getCategoryLabel(category),
    totalCount: tasks.length,
    tasks: listeningMaterialCatalog.buildPublicCatalog(tasks),
    publicResource: true,
    catalogVersion: 'public-v1'
  };
}

async function saveListeningPlanMaterial(event) {
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'saveListeningPlanMaterial'
  }));
  const payload = (event && event.payload) || {};
  const plan = decorateActivePlan(await study.saveListeningPlanMaterial(ctx, payload));
  return {
    saved: true,
    activePlan: plan
  };
}

async function removeListeningPlanMaterial(event) {
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'removeListeningPlanMaterial'
  }));
  const payload = (event && event.payload) || {};
  const plan = decorateActivePlan(await study.removeListeningPlanMaterial(ctx, payload));
  return {
    removed: true,
    activePlan: plan && plan.active !== false ? plan : null
  };
}

module.exports = {
  getListeningPlanOverview,
  getListeningMaterialCatalog,
  getListeningMaterialDetail,
  saveListeningPlanMaterial,
  removeListeningPlanMaterial
};
