const study = require('../facades/study.facade');
const dbAdapter = require('../adapters/db.adapter');
const completionRecords = require('../lib/completion-records');
const { sanitizeManualMarks } = require('../lib/manual-mark-engine');

const COLLECTION = 'studyCompletedItems';

async function upsertStudyCompletion(ctx, today, payload) {
  if (!study.isStudyWriteAllowed(ctx)) {
    return { saved: false, reason: 'preview-role' };
  }
  const type = String(payload.type || '').trim();
  const targetId = String(payload.targetId || payload.passageId || payload.topicId || '').trim();
  const targetParts = targetId.split(':').filter(Boolean);
  const taskSnapshot = payload.taskSnapshot && typeof payload.taskSnapshot === 'object'
    ? payload.taskSnapshot
    : null;
  if (!type || !targetId) {
    return { saved: false, reason: 'missing-target' };
  }
  const date = String(payload.date || today);
  const section = String(payload.section || '');
  const recordId = [
    ctx.family.familyId,
    ctx.child.childId,
    date,
    type,
    targetId,
    section
  ].filter(Boolean).join('_');
  const now = new Date().toISOString();
  const latestAttempt = payload.latestAttempt && typeof payload.latestAttempt === 'object'
    ? Object.assign({}, payload.latestAttempt)
    : null;
  if (latestAttempt && latestAttempt.manualMarks) {
    latestAttempt.manualMarks = sanitizeManualMarks(latestAttempt.manualMarks);
  }
  const record = {
    recordId,
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    userId: ctx.user.userId,
    memberId: ctx.member.memberId,
    date,
    type,
    targetId,
    category: String(payload.category || (taskSnapshot && taskSnapshot.category) || targetParts[0] || ''),
    taskId: String(payload.taskId || (taskSnapshot && taskSnapshot.taskId) || targetParts[1] || ''),
    passageId: String(payload.passageId || ''),
    topicId: String(payload.topicId || ''),
    section,
    title: String(payload.title || ''),
    meta: String(payload.meta || ''),
    progressText: String(payload.progressText || ''),
    audioUrl: String(payload.audioUrl || (taskSnapshot && taskSnapshot.audioUrl) || ''),
    audioCloudPath: String(payload.audioCloudPath || (taskSnapshot && taskSnapshot.audioCloudPath) || ''),
    audioFileId: String(payload.audioFileId || (taskSnapshot && taskSnapshot.audioFileId) || ''),
    audioSource: String(payload.audioSource || (taskSnapshot && taskSnapshot.audioSource) || ''),
    taskSnapshot,
    latestAttempt,
    completedToday: true,
    updatedAt: now
  };
  const result = await dbAdapter.collection(COLLECTION).where({
    familyId: record.familyId,
    childId: record.childId,
    recordId
  }).orderBy('updatedAt', 'desc').limit(20).get();
  const current = completionRecords.dedupeCompletionItems(result && result.data || [])[0];
  const documentId = current && current._id
    ? current._id
    : completionRecords.buildCompletionDocumentId(recordId);
  await dbAdapter.collection(COLLECTION).doc(documentId).set({
    data: Object.assign({}, record, {
      createdAt: current && current.createdAt || now
    })
  });
  return {
    saved: true,
    updated: !!(current && current._id),
    item: Object.assign({}, record, { _id: documentId })
  };
}

async function recordStudyCompletion(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'recordStudyCompletion'
  }));
  return upsertStudyCompletion(ctx, today, payload);
}

async function getStudyCompletions(event) {
  const payload = (event && event.payload) || {};
  const { ctx, today } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getStudyCompletions'
  }));
  const date = String(payload.date || today);
  const days = Math.max(1, Math.min(Number(payload.days || 1), 3650));
  const command = dbAdapter.getCommand();
  const types = (Array.isArray(payload.types) ? payload.types : [payload.type])
    .map((type) => String(type || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  const dateFilter = days > 1
    ? command.gte(study.addDays(date, 1 - days)).and(command.lte(date))
    : date;
  const where = {
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    date: dateFilter
  };
  if (types.length === 1) where.type = types[0];
  if (types.length > 1) where.type = command.in(types);
  const result = await dbAdapter.collection(COLLECTION).where(where).orderBy('date', 'desc').limit(300).get();
  const items = completionRecords.dedupeCompletionItems(result && result.data || []);
  return {
    date,
    days,
    items: items.map((item) => {
      const normalized = Object.assign({}, item, { id: item.recordId || item._id || '' });
      if (!payload.summaryOnly) return normalized;
      const attempt = item.latestAttempt || {};
      const questions = Array.isArray(attempt.questions) ? attempt.questions : [];
      normalized.latestAttempt = {
        _id: attempt._id || '',
        passageId: attempt.passageId || item.passageId || '',
        correctCount: Number(attempt.correctCount || questions.filter((question) => question.isCorrect).length || 0),
        totalCount: Number(attempt.totalCount || questions.length || attempt.answeredCount || 0),
        answeredCount: Number(attempt.answeredCount || questions.length || 0),
        score: attempt.score,
        totalScore: attempt.totalScore,
        status: attempt.status || ''
      };
      return normalized;
    })
  };
}

async function getStudyCompletionDetail(event) {
  const payload = (event && event.payload) || {};
  const recordId = String(payload.recordId || '').trim();
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getStudyCompletionDetail'
  }));
  if (!recordId) return { item: null };
  const result = await dbAdapter.collection(COLLECTION).where({
    familyId: ctx.family.familyId,
    childId: ctx.child.childId,
    recordId
  }).orderBy('updatedAt', 'desc').limit(20).get();
  const item = completionRecords.dedupeCompletionItems(result && result.data || [])[0];
  return { item: item ? Object.assign({}, item, { id: item.recordId || item._id || '' }) : null };
}

module.exports = {
  upsertStudyCompletion,
  recordStudyCompletion,
  getStudyCompletions,
  getStudyCompletionDetail
};
