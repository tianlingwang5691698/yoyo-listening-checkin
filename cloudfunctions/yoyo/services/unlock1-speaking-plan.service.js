const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');
const speakingPlan = require('../lib/unlock1-speaking-plan');

async function getDailyPlanSummary(ctx, today, planDayIndex) {
  const roundDay = speakingPlan.getRoundDayForDate(today);
  if (!roundDay) return null;
  const tasks = speakingPlan.buildPlanTasks(72 + roundDay, {
    workbook: study.getCatalog('unlock1workbook'),
    textbook: study.getCatalog('unlock1')
  });
  if (!tasks.length) return null;
  const attempts = await attemptRepository.findByDate(study.getUserScope(ctx), today);
  const completedSentenceIds = new Set((attempts || [])
    .filter((item) => item.category === 'speaking' && item.attemptType === 'standalone_sentence_repeat')
    .map((item) => String(item.taskId || ''))
    .filter(Boolean));
  const decoratedTasks = tasks.map((task) => {
    const completedSentenceCount = task.sentenceTaskIds.filter((taskId) => completedSentenceIds.has(taskId)).length;
    return Object.assign({}, task, {
      completedSentenceCount,
      completedToday: completedSentenceCount >= task.sentenceCount,
      progressText: `${completedSentenceCount}/${task.sentenceCount}句`
    });
  });
  const completedCount = decoratedTasks.filter((task) => task.completedToday).length;
  const sentenceCount = decoratedTasks.reduce((sum, task) => sum + task.sentenceCount, 0);
  const wordCount = decoratedTasks.reduce((sum, task) => sum + task.wordCount, 0);
  const phases = new Set(decoratedTasks.map((task) => task.phase).filter(Boolean));
  const phase = phases.size === 1 ? decoratedTasks[0].phase : 'mixed';
  const durationSec = decoratedTasks.reduce((sum, task) => sum + Number(task.durationSec || 0), 0);
  const estimatedMinutes = Math.max(1, Math.round(durationSec / 60));
  return {
    active: true,
    category: 'speaking',
    title: phase === 'workbook'
      ? 'Unlock 1 听口练习册 第二版 · 每日跟读'
      : (phase === 'textbook' ? 'Unlock 1 听口课本 第二版 · 每日跟读' : 'Unlock 1 听口第二版 · 每日跟读'),
    summary: `${sentenceCount}句 · 约${Math.max(1, estimatedMinutes - 2)}–${estimatedMinutes + 2}分钟`,
    phase,
    sentenceCount,
    wordCount,
    dailySentenceCount: speakingPlan.DAILY_SENTENCE_COUNT,
    curriculumSentenceCount: speakingPlan.TOTAL_SENTENCES,
    roundDay,
    dashboardPlanDayIndex: Number(planDayIndex || 0),
    completedCount,
    totalCount: decoratedTasks.length,
    completedToday: completedCount >= decoratedTasks.length,
    tasks: decoratedTasks
  };
}

module.exports = {
  getDailyPlanSummary
};
