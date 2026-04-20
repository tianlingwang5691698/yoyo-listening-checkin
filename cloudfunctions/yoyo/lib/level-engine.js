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
  if (!['newconcept2', 'newconcept3', 'newconcept4'].includes(category)) {
    return [];
  }
  const tasks = await listDirectAudioTasksForCategory(category, deps);
  return tasks.map((task) => Object.assign({}, task, {
    planDayIndex: 1,
    planPhase: 'level',
    planPhaseLabel: 'A2',
    targetDate: date,
    planRunType: 'level'
  }));
}

module.exports = {
  buildLevelCatalogEntry,
  listDirectAudioTasksForCategory,
  resolveStandaloneCategoryTasks
};
