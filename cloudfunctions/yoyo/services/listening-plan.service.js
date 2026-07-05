const study = require('../facades/study.facade');
const listeningPlanEngine = require('../lib/listening-plan-engine');

function getPlanMaterial(plan, category) {
  return ((plan && plan.materials) || []).find((item) => item.category === category) || null;
}

function decorateActivePlan(plan) {
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
  const activePlan = decorateActivePlan(await study.getActiveListeningPlan(ctx));
  const materials = study.buildListeningPlanMaterials(selectedLevel).map((item) => Object.assign({}, item, {
    selected: !!getPlanMaterial(activePlan, item.category)
  }));
  const dashboard = await study.getDashboardData(ctx, {
    includeDailyTasks: false,
    includeHomeTaskGroups: false,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: false,
    includeUser: false,
    includeFamily: false,
    includeStats: true
  });
  return {
    currentMember: ctx.member,
    child: ctx.child,
    stats: dashboard.stats,
    selectedLevel,
    levelTabs: listeningPlanEngine.buildLevelTabs(selectedLevel),
    materials,
    activePlan,
    planSource: dashboard.planSource || 'fixed-yoyo',
    isYoyoFixedPlan: !!dashboard.isYoyoFixedPlan,
    fixedPlan: {
      planDayIndex: dashboard.planDayIndex,
      planPhase: dashboard.planPhase,
      planPhaseLabel: dashboard.planPhaseLabel
    }
  };
}

async function getListeningMaterialDetail(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getListeningMaterialDetail'
  }));
  const payload = (event && event.payload) || {};
  const category = String(payload.category || '').trim();
  const levelId = listeningPlanEngine.normalizeLevelId(payload.levelId || 'A1');
  const tasks = await study.resolveStandaloneCategoryTasks(category, ctx.child.childId, today);
  const activePlan = decorateActivePlan(await study.getActiveListeningPlan(ctx));
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
  getListeningMaterialDetail,
  saveListeningPlanMaterial,
  removeListeningPlanMaterial
};
