const study = require('../facades/study.facade');
const attemptRepository = require('../repositories/attempt.repository');
const speakingPlan = require('../lib/unlock1-speaking-plan');

async function getDailyPlanSummary(ctx, today, planDayIndex) {
  const roundDay = speakingPlan.getRoundDayForDate(today);
  if (!roundDay) return null;
  const tasks = speakingPlan.buildPlanTasks(72 + roundDay, study.getCatalog('unlock1'));
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
  return {
    active: true,
    category: 'speaking',
    title: 'Unlock 1 听口 第二版 · 每日跟读',
    summary: `${decoratedTasks.length}段 · ${decoratedTasks.reduce((sum, task) => sum + task.sentenceCount, 0)}句 · 约5–8分钟`,
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
