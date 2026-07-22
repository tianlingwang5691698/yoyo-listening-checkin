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
  const phase = (decoratedTasks[0] && decoratedTasks[0].phase) || 'workbook';
  return {
    active: true,
    category: 'speaking',
    title: phase === 'workbook' ? 'Unlock 1 听口练习册 第二版 · 每日跟读' : 'Unlock 1 听口课本 第二版 · 每日跟读',
    summary: phase === 'workbook'
      ? `${sentenceCount}句 · 约${wordCount}词 · 约8–12分钟`
      : `3段 · ${sentenceCount}句 · 约6–10分钟`,
    phase,
    sentenceCount,
    wordCount,
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
