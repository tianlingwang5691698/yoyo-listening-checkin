const study = require('../facades/study.facade');

async function getLevelOverview(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getLevelOverview'
  }));
  const dashboard = await study.getDashboardData(ctx);
  const progressRecords = await study.getChildProgressRecords(study.getUserScope(ctx));
  const standaloneCategoryIds = ['newconcept2', 'newconcept3', 'newconcept4'];
  const standaloneOverviews = Object.fromEntries(await Promise.all(standaloneCategoryIds.map(async (categoryId) => {
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
  return {
    user: ctx.user,
    currentUser: ctx.user,
    currentMember: ctx.member,
    child: ctx.child,
    level: study.level,
    stats: dashboard.stats,
    categories: ['newconcept1', 'peppa', 'unlock1', 'song'].map((category) => {
      const task = dashboard.categorySummaries.find((item) => item.category === category);
      const fallbackTask = study.buildCategorySummary([], category);
      const todayTask = task || fallbackTask;
      return {
        category,
        categoryLabel: study.getCategoryLabel(category),
        totalCount: study.getPlanCatalog(category).length,
        completedCount: (dashboard.stats.completedTasks || 0),
        todayTask,
        isPendingAsset: todayTask.isPendingAsset,
        todayTaskCount: todayTask.plannedTaskCount || 0
      };
    }),
    a2Categories: standaloneOverviews.newconcept2.overview,
    b1Categories: standaloneOverviews.newconcept3.overview,
    b2Categories: standaloneOverviews.newconcept4.overview,
    levelDebug: {
      newconcept2CatalogCount: study.getCatalog('newconcept2').length,
      newconcept2DirectCount: standaloneOverviews.newconcept2.directTasks.length,
      newconcept3CatalogCount: study.getCatalog('newconcept3').length,
      newconcept3DirectCount: standaloneOverviews.newconcept3.directTasks.length,
      newconcept4CatalogCount: study.getCatalog('newconcept4').length,
      newconcept4DirectCount: standaloneOverviews.newconcept4.directTasks.length,
      resourceDebug: study.getResourceDebugSnapshot()
    },
    planDayIndex: dashboard.planDayIndex,
    planPhaseLabel: dashboard.planPhaseLabel
  };
}

module.exports = {
  getLevelOverview
};
