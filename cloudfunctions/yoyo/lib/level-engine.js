function buildLevelCatalogEntry(category, options = {}, deps) {
  const tasks = deps.getCatalog(category).slice(0, options.limit || 1);
  const task = tasks[0]
    ? deps.decorateTask(tasks[0], deps.buildEmptyProgress(), category)
    : deps.buildCategorySummary([], category);
  return {
    category,
    categoryLabel: deps.getCategoryLabel(category),
    totalCount: deps.getCatalog(category).length,
    completedCount: 0,
    todayTask: task,
    isPendingAsset: !tasks.length || task.isPendingAsset,
    todayTaskCount: tasks.length ? 1 : 0
  };
}

async function listDirectAudioTasksForCategory(category, deps) {
  const catalogTasks = deps.getCatalog(category);
  if (catalogTasks.length) {
    return catalogTasks;
  }
  const roots = deps.storageRootCandidates[category] || [deps.storageRoots[category]];
  for (const rootPath of roots.filter(Boolean)) {
    try {
      const files = await deps.listDirectoryFiles(rootPath);
      const audioFiles = files.filter((item) => deps.audioFilePattern.test(item.cloudPath)).sort(deps.sortFilesByPath);
      if (!audioFiles.length) {
        continue;
      }
      return audioFiles.map((file, index) => {
        const audioBaseName = deps.getBaseName(file.cloudPath);
        const inferred = deps.inferNewConceptTaskMeta(category, audioBaseName, index);
        return deps.buildCloudTask(null, {
          taskId: inferred.taskId,
          category,
          title: inferred.title,
          subtitle: inferred.subtitle,
          repeatTarget: 3,
          durationSec: 180,
          coverTone: inferred.coverTone,
          transcriptTrackId: inferred.transcriptTrackId,
          transcriptTrackCandidates: inferred.transcriptTrackCandidates,
          transcriptStatus: 'ready',
          transcriptBatch: inferred.transcriptBatch,
          syncGranularity: inferred.syncGranularity,
          audioTitle: audioBaseName,
          audioUrl: deps.buildCloudAssetUrl(file.cloudPath),
          audioCloudPath: file.cloudPath,
          audioFileId: file.fileId,
          audioSource: 'static-cloud-url',
          textSource: inferred.textSource
        });
      });
    } catch (error) {
      // try next candidate root
    }
  }
  return [];
}

async function resolveStandaloneCategoryTasks(category, childId, date, deps) {
  if (!['newconcept1', 'littlebear', 'juniebjones', 'petethecat', 'magictreehouse', 'magictreehouseb1', 'unlock1', 'unlock1thirdedition', 'unlock1workbookthirdedition', 'unlock1workbook', 'peppa', 'song', 'newconcept2', 'unlock2', 'unlock2thirdedition', 'unlock2workbookthirdedition', 'unlock2workbook', 'newconcept3', 'unlock3textbook', 'unlock3thirdedition', 'unlock3workbookthirdedition', 'unlock3', 'newconcept4', 'unlock4', 'unlock4thirdedition', 'unlock4workbookthirdedition', 'unlock4workbook'].includes(category)) {
    return [];
  }
  const tasks = await listDirectAudioTasksForCategory(category, deps);
  const planPhaseLabel = ['littlebear'].includes(category) ? 'Pre A1'
    : ['newconcept1', 'juniebjones', 'unlock1', 'unlock1thirdedition', 'unlock1workbookthirdedition', 'unlock1workbook', 'peppa', 'song'].includes(category) ? 'A1'
      : category === 'magictreehouseb1' || category.startsWith('unlock3') || category === 'newconcept3' ? 'B1'
        : category.startsWith('unlock4') || category === 'newconcept4' ? 'B2'
          : 'A2';
  return tasks.map((task) => Object.assign({}, task, {
    planDayIndex: 1,
    planPhase: 'level',
    planPhaseLabel,
    targetDate: date,
    planRunType: 'level'
  }));
}

module.exports = {
  buildLevelCatalogEntry,
  listDirectAudioTasksForCategory,
  resolveStandaloneCategoryTasks
};
