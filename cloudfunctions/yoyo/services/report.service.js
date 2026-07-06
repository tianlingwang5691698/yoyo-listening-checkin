const study = require('../facades/study.facade');
const reportRepository = require('../repositories/report.repository');

function needsCompletionRefresh(report) {
  return !report || !Array.isArray(report.completionItems);
}

function getLatestAttempt(item) {
  return (item && item.latestAttempt) || {};
}

function getGrammarQuestionCount(item) {
  const attempt = getLatestAttempt(item);
  const answeredCount = Number(attempt.answeredCount || 0);
  if (answeredCount > 0) return answeredCount;
  if (Array.isArray(attempt.questions)) return attempt.questions.length;
  return 1;
}

function getVocabularyWordCount(item) {
  const attempt = getLatestAttempt(item);
  const reviewed = Number(attempt.reviewed || 0);
  return reviewed > 0 ? reviewed : 1;
}

function buildTodayLearningStats(report) {
  const stats = {
    listening: { value: Number((report && report.totalMinutes) || 0), unit: '分钟', label: '听力时长', copy: '今日听力用时' },
    reading: { value: 0, unit: '篇', label: '阅读完成', copy: '完成阅读' },
    grammar: { value: 0, unit: '题', label: '语法练习', copy: '完成练习' },
    writing: { value: 0, unit: '篇', label: '写作提交', copy: '完成作文' },
    vocabulary: { value: 0, unit: '个', label: '单词背诵', copy: '背诵单词' },
    speaking: { value: (report && report.speakingAttempts || []).length, unit: '次', label: '口语练习', copy: '完成录音' }
  };
  (report && report.completionItems || []).forEach((item) => {
    const type = item && item.type;
    if (type === 'reading') {
      stats.reading.value += 1;
    } else if (type === 'grammar') {
      stats.grammar.value += getGrammarQuestionCount(item);
    } else if (type === 'writing') {
      stats.writing.value += 1;
    } else if (type === 'vocabulary') {
      stats.vocabulary.value += getVocabularyWordCount(item);
    }
  });
  return stats;
}

async function getTodayListeningCompletion(ctx, today, records, progressRecords) {
  const activePlan = await study.getActiveListeningPlan(ctx);
  const useCustomListeningPlan = !!(activePlan && activePlan.active !== false);
  if (useCustomListeningPlan) {
    const planDayIndex = study.getCustomPlanDayIndex(records, today, activePlan);
    const todayPlan = study.buildListeningPlanForDay(activePlan, planDayIndex);
    const tasks = study.decorateListeningPlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
      planRunType: 'normal',
      listeningPlanId: activePlan.planId || activePlan._id || ''
    }).filter((item) => !item.isPendingAsset);
    return {
      dynamic: true,
      done: tasks.length > 0 && tasks.every((item) => item.completedToday)
    };
  }
  const todayPlan = study.buildPlanForDay(study.getPlanDayIndexForDate(records, today));
  const todayTasks = study.decoratePlanTasks(progressRecords, ctx.child.childId, today, todayPlan, {
    planRunType: 'normal'
  });
  const hasTodayCheckin = records.some((item) => item.date === today && String(item.planRunType || 'normal') === 'normal');
  return {
    dynamic: false,
    done: hasTodayCheckin || (todayTasks.length > 0 && todayTasks.every((item) => item.completedToday))
  };
}

function getHeatmapCount(date, today, rawCount, todayCompletion) {
  if (date === today && todayCompletion && todayCompletion.dynamic) {
    return todayCompletion.done ? Math.max(rawCount, 1) : 0;
  }
  return rawCount;
}

async function getHeatmap(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getHeatmap'
  }));
  const days = Number((event && event.payload && event.payload.days) || 28);
  const scope = study.getUserScope(ctx);
  let records = await study.getCheckins(scope);
  let progressRecords = await study.getChildProgressRecords(scope);
  if (study.reconcileCheckins) {
    const reconciled = await study.reconcileCheckins(scope, progressRecords, records, today);
    records = reconciled.checkins || records;
    progressRecords = reconciled.progressRecords || progressRecords;
  }
  const counts = {};
  records.forEach((item) => {
    counts[item.date] = (counts[item.date] || 0) + 1;
  });
  const todayCompletion = await getTodayListeningCompletion(ctx, today, records, progressRecords);
  const todayDone = todayCompletion.done;
  const catchupState = study.buildCatchupState(records, today, study.getPlanStartDate(ctx, today, records), todayDone);
  const catchupPlan = catchupState.canCatchup ? study.buildPlanForDay(catchupState.planDayIndex) : null;
  const catchupTasks = catchupPlan
    ? study.decoratePlanTasks(progressRecords, ctx.child.childId, catchupState.missedDate, catchupPlan, {
      planRunType: 'catchup'
    })
    : [];
  const heatmap = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = study.addDays(today, -i);
    const count = getHeatmapCount(date, today, counts[date] || 0, todayCompletion);
    heatmap.push({
      date,
      shortDate: date.slice(5),
      count,
      intensity: Math.min(count, 3),
      completed: count > 0,
      isCatchupTarget: catchupState.missedDate === date
    });
  }
  return {
    heatmap,
    catchupState,
    catchupTasks
  };
}

async function getMonthHeatmap(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getMonthHeatmap'
  }));
  const year = Number((event && event.payload && event.payload.year) || today.slice(0, 4));
  const month = Number((event && event.payload && event.payload.month) || today.slice(5, 7));
  const monthText = `${year}-${String(month).padStart(2, '0')}`;
  const scope = study.getUserScope(ctx);
  let records = await study.getCheckins(scope);
  let progressRecords = await study.getChildProgressRecords(scope);
  if (study.reconcileCheckins) {
    const reconciled = await study.reconcileCheckins(scope, progressRecords, records, today);
    records = reconciled.checkins || records;
    progressRecords = reconciled.progressRecords || progressRecords;
  }
  const counts = {};
  records.forEach((item) => {
    if (String(item.date || '').slice(0, 7) === monthText) {
      counts[item.date] = (counts[item.date] || 0) + 1;
    }
  });
  const todayCompletion = await getTodayListeningCompletion(ctx, today, records, progressRecords);
  const todayDone = todayCompletion.done;
  const catchupState = study.buildCatchupState(records, today, study.getPlanStartDate(ctx, today, records), todayDone);
  const daysInMonth = new Date(year, month, 0).getDate();
  const heatmap = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${monthText}-${String(day).padStart(2, '0')}`;
    const count = getHeatmapCount(date, today, counts[date] || 0, todayCompletion);
    heatmap.push({
      date,
      shortDate: date.slice(5),
      count,
      intensity: Math.min(count, 3),
      completed: count > 0,
      isToday: date === today,
      isCatchupTarget: catchupState.missedDate === date
    });
  }
  return {
    year,
    month,
    heatmap,
    catchupState
  };
}

async function getDailyReportByDate(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getDailyReportByDate'
  }));
  const payload = (event && event.payload) || {};
  const date = String(payload.date || today).slice(0, 10);
  const scope = study.getUserScope(ctx);
  if (date !== today && !payload.force) {
    const existing = await reportRepository.findByScopeAndDate(scope, date);
    if (existing && !needsCompletionRefresh(existing)) {
      return { report: existing };
    }
  }
  const report = await study.upsertDailyReport(scope, date);
  return { report };
}

async function getParentDashboard(event) {
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getParentDashboard'
  }));
  const days = Math.max(1, Math.min(Number((event && event.payload && event.payload.days) || 7), 30));
  const summaryOnly = !!(event && event.payload && event.payload.summaryOnly);
  const dashboard = summaryOnly ? { stats: {} } : await study.getDashboardData(ctx);
  const scope = study.getUserScope(ctx);
  const dates = [];
  for (let i = 0; i < days; i += 1) {
    const date = study.addDays(today, -i);
    dates.push(date);
  }
  const recentReports = summaryOnly
    ? await Promise.all(dates.map(async (date) => {
      if (date === today) {
        return await study.upsertDailyReport(scope, date);
      }
      const existing = await reportRepository.findByScopeAndDate(scope, date);
      return existing || { date };
    }))
    : [];
  if (!summaryOnly) {
    for (let i = 0; i < dates.length; i += 1) {
      const date = dates[i];
      const existing = await reportRepository.findByScopeAndDate(scope, date);
      recentReports.push(existing && !needsCompletionRefresh(existing) ? existing : await study.upsertDailyReport(scope, date));
    }
  }
  const summarizeReport = (report) => {
    if (!summaryOnly || !report) {
      return report;
    }
    const moduleStats = {
      listening: { count: 0, latestTitle: '暂无记录' },
      speaking: { count: 0, latestTitle: '暂无记录' },
      reading: { count: 0, latestTitle: '暂无记录' },
      grammar: { count: 0, latestTitle: '暂无记录' },
      writing: { count: 0, latestTitle: '暂无记录' },
      vocabulary: { count: 0, latestTitle: '暂无记录' }
    };
    (report.items || []).forEach((item) => {
      if (item && item.completedToday) {
        moduleStats.listening.count += 1;
        moduleStats.listening.latestTitle = item.title || item.categoryLabel || moduleStats.listening.latestTitle;
      }
    });
    (report.speakingAttempts || []).forEach((item) => {
      moduleStats.speaking.count += 1;
      moduleStats.speaking.latestTitle = item.questionText || '录音评分';
    });
    (report.completionItems || []).forEach((item) => {
      const type = item && item.type === 'reading-study' ? 'reading' : (item && item.type) || '';
      const key = type === 'vocabulary' ? 'vocabulary' : type;
      if (moduleStats[key]) {
        moduleStats[key].count += 1;
        moduleStats[key].latestTitle = item.title || item.meta || moduleStats[key].latestTitle;
      }
    });
    return {
      reportId: report.reportId || '',
      date: report.date || '',
      completedCategories: report.completedCategories || [],
      totalMinutes: Number(report.totalMinutes || 0),
      streakSnapshot: Number(report.streakSnapshot || 0),
      planDayIndex: Number(report.planDayIndex || 0),
      planPhase: report.planPhase || '',
      planSource: report.planSource || '',
      listeningPlanId: report.listeningPlanId || '',
      completedContentCount: (report.completionItems || []).length,
      speakingAttemptCount: (report.speakingAttempts || []).length,
      totalCompletedCount: (report.completedCategories || []).length + (report.completionItems || []).length,
      moduleStats,
      updatedAt: report.updatedAt || ''
    };
  };
  const mergeModuleStats = (reports) => {
    const merged = {};
    (reports || []).forEach((report) => {
      const stats = (report && report.moduleStats) || {};
      Object.keys(stats).forEach((key) => {
        if (!merged[key]) {
          merged[key] = { count: 0, latestTitle: '暂无记录' };
        }
        merged[key].count += Number((stats[key] && stats[key].count) || 0);
        if (stats[key] && stats[key].latestTitle && stats[key].latestTitle !== '暂无记录') {
          merged[key].latestTitle = stats[key].latestTitle;
        }
      });
    });
    return merged;
  };
  const summarizedReports = recentReports.map(summarizeReport);
  const todayLearningStats = buildTodayLearningStats(summarizedReports[0]);
  return {
    user: ctx.user,
    currentUser: ctx.user,
    currentMember: ctx.member,
    family: ctx.family,
    child: ctx.child,
    stats: dashboard.stats,
    todayReport: summarizedReports[0],
    recentReports: summarizedReports,
    moduleStats: summaryOnly ? todayLearningStats : null,
    todayLearningStats,
    members: ctx.members,
    studentLinks: ctx.studentLinks || [],
    subscriptionPreference: ctx.subscriptionPreference
  };
}

module.exports = {
  getHeatmap,
  getMonthHeatmap,
  getDailyReportByDate,
  getParentDashboard
};
