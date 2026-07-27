const study = require('../facades/study.facade');
const flashcardService = require('./flashcard.service');
const unlock1SpeakingPlanService = require('./unlock1-speaking-plan.service');
const unlock1SpeakingPlan = require('../lib/unlock1-speaking-plan');

const LEVEL_CATEGORY_GROUPS = {
  A2: ['newconcept2', 'petethecat', 'magictreehouse', 'unlock2', 'unlock2thirdedition', 'unlock2workbookthirdedition', 'unlock2workbook'],
  B1: ['newconcept3', 'magictreehouseb1', 'unlock3textbook', 'unlock3thirdedition', 'unlock3workbookthirdedition', 'unlock3'],
  B2: ['newconcept4', 'unlock4', 'unlock4thirdedition', 'unlock4workbookthirdedition', 'unlock4workbook']
};

const STANDALONE_CATEGORY_IDS = [].concat(LEVEL_CATEGORY_GROUPS.A2, LEVEL_CATEGORY_GROUPS.B1, LEVEL_CATEGORY_GROUPS.B2);

function buildFixedDashboardCategories(groupedDailyTasks, planDayIndex) {
  return (groupedDailyTasks || []).map((group) => {
    const tasks = Array.isArray(group.tasks) ? group.tasks : [];
    const todayTask = group.nextTask || tasks.find((task) => !task.completedToday) || tasks[0] || {};
    return {
      category: group.category || todayTask.category || '',
      categoryLabel: group.categoryLabel || todayTask.categoryLabel || '',
      totalCount: Number(group.totalCount || tasks.length),
      completedCount: Number(group.completedCount || 0),
      todayTask,
      tasks,
      isPendingAsset: !!(group.isPendingAsset || todayTask.isPendingAsset),
      todayTaskCount: tasks.length,
      plannedDurationSec: Number(group.durationSec || 0),
      planRunType: todayTask.planRunType || 'normal',
      planDayIndex
    };
  }).filter((group) => group.category && group.tasks.length);
}

async function getLevelOverview(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getLevelOverview'
  }));
  const payload = (event && event.payload) || {};
  const requestedPhase = String(payload.phase || '').trim();
  const isA1PhaseOverview = requestedPhase === 'round-1' || requestedPhase === 'round-2';
  const vocabularyPlan = isA1PhaseOverview && study.isYoyoChild(ctx.child)
    ? await flashcardService.getJuniorListPlanSummary(ctx, today)
    : null;
  const dashboard = await study.getDashboardData(ctx, {
    includeDailyTasks: requestedPhase === 'custom',
    includeHomeTaskGroups: true,
    includeCategorySummaries: false,
    includeCatchupState: false,
    includePlanDebug: false,
    includeTaskProgressSummary: true,
    includeUser: false,
    includeFamily: false,
    includeStats: true,
    progressScope: 'home',
    reconcileCheckins: false
  });
  const useDashboardFixedPlan = isA1PhaseOverview && dashboard.planSource === 'fixed-yoyo';
  const progressRecords = useDashboardFixedPlan
    ? []
    : await study.getChildProgressRecords(study.getUserScope(ctx));
  const speakingPlan = isA1PhaseOverview
    && requestedPhase === 'round-2'
    && dashboard.planSource === 'fixed-yoyo'
    && study.isYoyoChild(ctx.child)
    ? await unlock1SpeakingPlanService.getDailyPlanSummary(ctx, today, dashboard.planDayIndex)
    : null;
  if (requestedPhase === 'custom') {
    const dailyTasks = dashboard.planSource === 'custom-listening' ? (dashboard.dailyTasks || []) : [];
    const categoryIds = [];
    dailyTasks.forEach((task) => {
      if (task.category && !categoryIds.includes(task.category)) {
        categoryIds.push(task.category);
      }
    });
    return {
      user: ctx.user,
      currentUser: ctx.user,
      currentMember: ctx.member,
      child: ctx.child,
      level: study.level,
      stats: dashboard.stats,
      categories: categoryIds.map((category) => {
        const categoryTasks = dailyTasks.filter((item) => item.category === category);
        const todayTask = study.buildCategorySummary(categoryTasks, category);
        return {
          category,
          categoryLabel: study.getCategoryLabel(category),
          totalCount: study.getPlanCatalog(category).length,
          completedCount: categoryTasks.filter((item) => item.completedToday).length,
          todayTask,
          tasks: categoryTasks,
          isPendingAsset: todayTask.isPendingAsset,
          todayTaskCount: todayTask.plannedTaskCount || categoryTasks.length,
          plannedDurationSec: categoryTasks.reduce((sum, item) => (
            sum + (Number(item.durationSec || 0) * Number(item.repeatTarget || 1))
          ), 0),
          planRunType: 'normal',
          planDayIndex: dashboard.planDayIndex
        };
      }),
      a2Categories: [],
      b1Categories: [],
      b2Categories: [],
      levelDebug: {
        resourceDebug: study.getResourceDebugSnapshot()
      },
      planDayIndex: dashboard.planDayIndex,
      planPhase: dashboard.planPhase,
      planPhaseLabel: dashboard.planPhaseLabel
    };
  }
  const todayPlan = useDashboardFixedPlan
    ? {
      dayIndex: dashboard.planDayIndex,
      phase: { key: dashboard.planPhase, label: dashboard.planPhaseLabel },
      byCategory: {}
    }
    : study.buildPlanForDay(dashboard.planDayIndex);
  const todayTasks = isA1PhaseOverview && !useDashboardFixedPlan
    ? study.decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
      planRunType: 'normal',
      targetDate: today,
      planDayIndex: dashboard.planDayIndex
    })
    : [];
  const standaloneCategoryIds = STANDALONE_CATEGORY_IDS;
  const standaloneOverviews = isA1PhaseOverview ? {
    newconcept2: { directTasks: [], overview: [] },
    petethecat: { directTasks: [], overview: [] },
    magictreehouse: { directTasks: [], overview: [] },
    unlock2: { directTasks: [], overview: [] },
    unlock2thirdedition: { directTasks: [], overview: [] },
    unlock2workbookthirdedition: { directTasks: [], overview: [] },
    unlock2workbook: { directTasks: [], overview: [] },
    newconcept3: { directTasks: [], overview: [] },
    magictreehouseb1: { directTasks: [], overview: [] },
    unlock3textbook: { directTasks: [], overview: [] },
    unlock3thirdedition: { directTasks: [], overview: [] },
    unlock3workbookthirdedition: { directTasks: [], overview: [] },
    unlock3: { directTasks: [], overview: [] },
    newconcept4: { directTasks: [], overview: [] },
    unlock4: { directTasks: [], overview: [] },
    unlock4thirdedition: { directTasks: [], overview: [] },
    unlock4workbookthirdedition: { directTasks: [], overview: [] },
    unlock4workbook: { directTasks: [], overview: [] }
  } : Object.fromEntries(await Promise.all(standaloneCategoryIds.map(async (categoryId) => {
    const directTasks = await study.resolveStandaloneCategoryTasks(categoryId, ctx.child.childId, today);
    const overview = directTasks.length
      ? [{
        category: categoryId,
        categoryLabel: study.getCategoryLabel(categoryId),
        totalCount: directTasks.length,
        completedCount: 0,
        todayTask: study.decorateTask(directTasks[0], study.buildEmptyProgress(), categoryId),
        isPendingAsset: false,
        todayTaskCount: 1
      }]
      : [study.buildLevelCatalogEntry(categoryId, { limit: 1 })];
    return [categoryId, { directTasks, overview }];
  })));
  const overviewCategoryIds = isA1PhaseOverview
    ? Object.keys(todayPlan.byCategory || {})
    : ['newconcept1', 'peppa', 'unlock1', 'song'];
  const fixedPlanOutline = dashboard.planSource === 'fixed-yoyo' && requestedPhase === 'round-2'
    ? {
      cycleDays: 72,
      progression: 'independent-slots',
      items: [
        {
          category: 'grammar',
          slotCount: 5,
          startNo: 1,
          endNo: study.getPlanCatalog('grammar').length,
          totalCount: study.getPlanCatalog('grammar').length,
          syntaxTotalCount: 106,
          scheduleText: '词法第1轮每天5课；词法第2轮每天10课；句法每天5课'
        },
        { category: 'newconcept1', slotCount: 3, startNo: 1, endNo: 76, totalCount: 76 },
        { category: 'juniebjones', slotCount: 1, startNo: 1, endNo: study.getPlanCatalog('juniebjones').length, totalCount: study.getPlanCatalog('juniebjones').length },
        { category: 'peppa', slotCount: 5, startNo: 73, endNo: study.getPlanCatalog('peppa').length, totalCount: Math.max(0, study.getPlanCatalog('peppa').length - 72) },
        { category: 'unlock1', slotCount: 3, startNo: 1, endNo: study.getPlanCatalog('unlock1').length, totalCount: study.getPlanCatalog('unlock1').length, workbookCount: study.getPlanCatalog('unlock1workbook').length },
        {
          category: 'speaking',
          slotCount: 1,
          startNo: 1,
          endNo: speakingPlan ? speakingPlan.curriculumSentenceCount : unlock1SpeakingPlan.TOTAL_SENTENCES,
          totalCount: speakingPlan ? speakingPlan.curriculumSentenceCount : unlock1SpeakingPlan.TOTAL_SENTENCES,
          dailySentenceCount: speakingPlan ? speakingPlan.dailySentenceCount : unlock1SpeakingPlan.DAILY_SENTENCE_COUNT,
          scheduleText: '练习册与课本连续循环，每天20句'
        },
        { category: 'vocabulary', slotCount: 1, startNo: 1, endNo: 32, totalCount: 1690, round: vocabularyPlan && vocabularyPlan.round, currentList: vocabularyPlan && vocabularyPlan.currentList }
      ]
    }
    : null;
  const overviewCategories = useDashboardFixedPlan
    ? buildFixedDashboardCategories(dashboard.groupedDailyTasks, dashboard.planDayIndex)
    : overviewCategoryIds.map((category) => {
      const categoryTasks = isA1PhaseOverview
        ? todayTasks.filter((item) => item.category === category)
        : [];
      const task = isA1PhaseOverview
        ? study.buildCategorySummary(categoryTasks, category)
        : (dashboard.categorySummaries || []).find((item) => item.category === category);
      const fallbackTask = study.buildCategorySummary([], category);
      const todayTask = task || fallbackTask;
      return {
        category,
        categoryLabel: study.getCategoryLabel(category),
        totalCount: study.getPlanCatalog(category).length,
        completedCount: (dashboard.stats.completedTasks || 0),
        todayTask,
        tasks: categoryTasks,
        isPendingAsset: todayTask.isPendingAsset,
        todayTaskCount: todayTask.plannedTaskCount || 0,
        plannedDurationSec: categoryTasks.reduce((sum, item) => (
          sum + (Number(item.durationSec || 0) * Number(item.repeatTarget || 1))
        ), 0),
        planRunType: 'normal',
        planDayIndex: dashboard.planDayIndex
      };
    });
  return {
    user: ctx.user,
    currentUser: ctx.user,
    currentMember: ctx.member,
    child: ctx.child,
    level: study.level,
    stats: dashboard.stats,
    categories: overviewCategories.concat(speakingPlan ? [{
      category: 'speaking',
      categoryLabel: '口语跟读',
      totalCount: speakingPlan.curriculumSentenceCount,
      completedCount: speakingPlan.completedCount,
      todayTask: speakingPlan.tasks.find((item) => !item.completedToday) || speakingPlan.tasks[0],
      tasks: speakingPlan.tasks,
      isPendingAsset: false,
      todayTaskCount: speakingPlan.totalCount,
      plannedDurationSec: speakingPlan.tasks.reduce((sum, item) => sum + Number(item.durationSec || 0), 0),
      planRunType: 'normal',
      planDayIndex: dashboard.planDayIndex
    }] : []).concat(vocabularyPlan ? [{
      category: 'vocabulary',
      categoryLabel: '词汇',
      totalCount: 1690,
      completedCount: vocabularyPlan.completedToday ? 1 : 0,
      todayTask: {
        category: 'vocabulary',
        taskId: vocabularyPlan.planId,
        title: vocabularyPlan.summary,
        displayTitle: vocabularyPlan.title,
        completedToday: vocabularyPlan.completedToday,
        repeatTarget: 1,
        playCount: vocabularyPlan.completedToday ? 1 : 0,
        planSlotIndex: 1,
        planSlotCount: 1
      },
      tasks: [{
        category: 'vocabulary',
        taskId: vocabularyPlan.planId,
        title: vocabularyPlan.summary,
        displayTitle: vocabularyPlan.title,
        completedToday: vocabularyPlan.completedToday,
        repeatTarget: 1,
        playCount: vocabularyPlan.completedToday ? 1 : 0,
        planSlotIndex: 1,
        planSlotCount: 1
      }],
      isPendingAsset: false,
      todayTaskCount: 1,
      plannedDurationSec: 0,
      planRunType: 'normal',
      planDayIndex: dashboard.planDayIndex
    }] : []),
    a2Categories: LEVEL_CATEGORY_GROUPS.A2.flatMap((categoryId) => standaloneOverviews[categoryId].overview),
    b1Categories: LEVEL_CATEGORY_GROUPS.B1.flatMap((categoryId) => standaloneOverviews[categoryId].overview),
    b2Categories: LEVEL_CATEGORY_GROUPS.B2.flatMap((categoryId) => standaloneOverviews[categoryId].overview),
    levelDebug: {
      newconcept2CatalogCount: study.getCatalog('newconcept2').length,
      newconcept2DirectCount: standaloneOverviews.newconcept2.directTasks.length,
      peteTheCatCatalogCount: study.getCatalog('petethecat').length,
      peteTheCatDirectCount: standaloneOverviews.petethecat.directTasks.length,
      magicTreeHouseCatalogCount: study.getCatalog('magictreehouse').length,
      magicTreeHouseDirectCount: standaloneOverviews.magictreehouse.directTasks.length,
      unlock2CatalogCount: study.getCatalog('unlock2').length,
      unlock2DirectCount: standaloneOverviews.unlock2.directTasks.length,
      unlock2ThirdEditionCatalogCount: study.getCatalog('unlock2thirdedition').length,
      unlock2ThirdEditionDirectCount: standaloneOverviews.unlock2thirdedition.directTasks.length,
      unlock2WorkbookCatalogCount: study.getCatalog('unlock2workbook').length,
      unlock2WorkbookDirectCount: standaloneOverviews.unlock2workbook.directTasks.length,
      newconcept3CatalogCount: study.getCatalog('newconcept3').length,
      newconcept3DirectCount: standaloneOverviews.newconcept3.directTasks.length,
      magicTreeHouseB1CatalogCount: study.getCatalog('magictreehouseb1').length,
      magicTreeHouseB1DirectCount: standaloneOverviews.magictreehouseb1.directTasks.length,
      unlock3TextbookCatalogCount: study.getCatalog('unlock3textbook').length,
      unlock3TextbookDirectCount: standaloneOverviews.unlock3textbook.directTasks.length,
      unlock3ThirdEditionCatalogCount: study.getCatalog('unlock3thirdedition').length,
      unlock3ThirdEditionDirectCount: standaloneOverviews.unlock3thirdedition.directTasks.length,
      unlock3CatalogCount: study.getCatalog('unlock3').length,
      unlock3DirectCount: standaloneOverviews.unlock3.directTasks.length,
      newconcept4CatalogCount: study.getCatalog('newconcept4').length,
      newconcept4DirectCount: standaloneOverviews.newconcept4.directTasks.length,
      unlock4CatalogCount: study.getCatalog('unlock4').length,
      unlock4DirectCount: standaloneOverviews.unlock4.directTasks.length,
      unlock4ThirdEditionCatalogCount: study.getCatalog('unlock4thirdedition').length,
      unlock4ThirdEditionDirectCount: standaloneOverviews.unlock4thirdedition.directTasks.length,
      unlock4WorkbookCatalogCount: study.getCatalog('unlock4workbook').length,
      unlock4WorkbookDirectCount: standaloneOverviews.unlock4workbook.directTasks.length,
      resourceDebug: study.getResourceDebugSnapshot()
    },
    fixedPlanOutline,
    planDayIndex: dashboard.planDayIndex,
    planPhase: useDashboardFixedPlan ? dashboard.planPhase : todayPlan.phase.key,
    planPhaseLabel: useDashboardFixedPlan ? dashboard.planPhaseLabel : (todayPlan.phase.label || dashboard.planPhaseLabel)
  };
}

module.exports = {
  getLevelOverview
};
