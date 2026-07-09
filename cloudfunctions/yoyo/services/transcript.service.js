const study = require('../facades/study.facade');

const STANDALONE_LEVEL_CATEGORIES = ['unlock1workbook', 'newconcept2', 'unlock2', 'newconcept3', 'unlock3textbook', 'unlock3', 'newconcept4', 'unlock4'];

async function getTaskTranscript(event) {
  const { ctx, requestedCategory, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getTaskTranscript'
  }));
  const payload = (event && event.payload) || {};
  let task = Object.assign({}, payload.taskSnapshot || {}, {
    category: requestedCategory || ((payload.taskSnapshot && payload.taskSnapshot.category) || ''),
    taskId: String(payload.taskId || ((payload.taskSnapshot && payload.taskSnapshot.taskId) || '')).trim()
  });
  if (STANDALONE_LEVEL_CATEGORIES.includes(requestedCategory)) {
    const standaloneTasks = await study.resolveStandaloneCategoryTasks(requestedCategory, ctx.child.childId, today);
    task = standaloneTasks.find((item) => item.taskId === task.taskId) || standaloneTasks[0] || task;
  }
  task = task.taskId ? task : study.decorateTask(null, study.buildEmptyProgress(), requestedCategory);
  const transcriptBundle = await study.getTranscriptBundle(task);
  return {
    task,
    scriptSource: task.textSource || null,
    transcriptTrack: transcriptBundle.transcriptTrack,
    transcriptLines: transcriptBundle.transcriptLines,
    transcriptPendingLoad: false
  };
}

module.exports = {
  getTaskTranscript
};
