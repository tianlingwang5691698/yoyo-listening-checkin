function hasTaskAudioSource(task) {
  return !!(task && (
    task.isPendingAsset
    || task.audioUrl
    || task.audioCloudPath
    || task.audioFileId
  ));
}

function resolveCatalogCategories(action, requestedCategory, payload = {}) {
  let catalogCategories = ['newconcept1', 'song'];
  const knownAudioCategories = ['newconcept1', 'newconcept2', 'unlock2', 'unlock2thirdedition', 'unlock2workbook', 'newconcept3', 'unlock3textbook', 'unlock3thirdedition', 'unlock3', 'newconcept4', 'unlock4', 'unlock4thirdedition', 'unlock4workbook', 'peppa', 'song', 'unlock1', 'unlock1thirdedition', 'unlock1workbook'];
  const view = String((payload && payload.view) || '').trim();
  if (action === 'getDashboard') {
    return [];
  }
  if (action === 'getLevelOverview') {
    const phase = String((payload && payload.phase) || '').trim();
    if (phase === 'round-1' || phase === 'round-2') {
      return [];
    }
    return knownAudioCategories;
  }
  if (action === 'getListeningPlanOverview') {
    return [];
  }
  if (action === 'getListeningMaterialDetail') {
    return knownAudioCategories.includes(requestedCategory) ? [requestedCategory] : [];
  }
  if (action === 'getTaskDetail' || action === 'markTaskListened') {
    if (action === 'getTaskDetail' && view === 'lesson' && payload && hasTaskAudioSource(payload.taskSnapshot)) {
      return [];
    }
    if (knownAudioCategories.includes(requestedCategory)) {
      return [requestedCategory];
    }
    return [];
  }
  if (action === 'getTaskTranscript') {
    return [];
  }
  if (['getFamilyPage', 'refreshInviteCode', 'joinFamily', 'joinFamilyByChildCode', 'updateBindingProfile', 'leaveFamily', 'updateChildProfile', 'setStudyRole', 'updateSubscription', 'bootstrap', 'getReadingHome', 'getReadingPassage', 'getReadingStudyPack', 'synthesizeReadingAudio', 'submitReadingAttempt', 'lookupWord', 'getFlashcardReview', 'getFlashcardDue', 'getDictionaryBook', 'submitWritingAttempt', 'gradeWritingAttempt', 'getWritingAttempts', 'getWritingAttemptDetail', 'recordStudyCompletion', 'getStudyCompletions', 'getStudyCompletionDetail', 'addPracticeWrongQuestion', 'getPracticeWrongQuestions'].includes(action)) {
    return [];
  }
  return catalogCategories;
}

async function prepareRequestContext(event, deps) {
  const action = String((event && event.action) || '').trim();
  const requestedCategory = String((event && event.payload && event.payload.category) || '').trim();
  const catalogCategories = resolveCatalogCategories(action, requestedCategory, (event && event.payload) || {});
  if (catalogCategories.length) {
    await deps.refreshRuntimeCatalogs(false, catalogCategories);
  }
  const { OPENID } = deps.getWXContext();
  const payload = (event && event.payload) || {};
  const view = String(payload.view || '').trim();
  const target = {
    targetFamilyId: String(payload.targetFamilyId || '').trim(),
    targetChildId: String(payload.targetChildId || '').trim(),
    forceSelf: !!payload.forceSelf
  };
  const useLightweightContext = (
    (action === 'getDashboard' && (view === 'home' || view === 'record'))
    || action === 'getListeningPlanOverview'
    || action === 'getListeningMaterialDetail'
    || action === 'getMonthHeatmap'
    || action === 'getFlashcardReview'
    || action === 'getDictionaryBook'
    || action === 'getReadingHome'
    || action === 'getReadingPassage'
    || action === 'getReadingStudyPack'
  );
  const lightweightCtx = useLightweightContext && deps.getLightweightContext
    ? await deps.getLightweightContext(OPENID, target)
    : null;
  let ctx = lightweightCtx || await deps.ensureBootstrap(OPENID, target);
  if (deps.applyDeviceStudyRole) {
    ctx = await deps.applyDeviceStudyRole(ctx, payload, action);
  }
  return {
    action,
    requestedCategory,
    ctx,
    today: deps.getTodayString()
  };
}

module.exports = {
  resolveCatalogCategories,
  prepareRequestContext
};
