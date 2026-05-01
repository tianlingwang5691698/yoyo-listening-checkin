const {
  childProfiles,
  levels,
  peppaTasks,
  unlockTasks,
  songTasks,
  songPlaceholder,
  transcriptTracks,
  peppaTranscriptBuildStatus,
  unlockTranscriptBuildStatus
} = require('./mock');

let generatedCatalog = null;
try {
  generatedCatalog = require('./cloud-catalog.generated');
} catch (error) {
  generatedCatalog = null;
}

function getGeneratedTasks(category, fallback) {
  const tasks = generatedCatalog && generatedCatalog.tasks && generatedCatalog.tasks[category];
  return Array.isArray(tasks) && tasks.length ? tasks : fallback;
}

module.exports = {
  childProfiles,
  levels,
  peppaTasks: getGeneratedTasks('peppa', peppaTasks),
  unlockTasks: getGeneratedTasks('unlock1', unlockTasks),
  songTasks: getGeneratedTasks('song', songTasks),
  newConcept1Tasks: getGeneratedTasks('newconcept1', []),
  songPlaceholder,
  transcriptTracks,
  peppaTranscriptBuildStatus,
  unlockTranscriptBuildStatus
};
