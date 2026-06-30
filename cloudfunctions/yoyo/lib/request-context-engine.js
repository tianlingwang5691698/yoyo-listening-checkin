function resolveCatalogCategories(action, requestedCategory, payload = {}) {
  let catalogCategories = ['newconcept1', 'song'];
  const view = String((payload && payload.view) || '').trim();
  if (action === 'getDashboard') {
    return [];
  }
  if (action === 'getLevelOverview') {
    const phase = String((payload && payload.phase) || '').trim();
    if (phase === 'round-1' || phase === 'round-2') {
      return ['newconcept1', 'peppa', 'unlock1', 'song'];
    }
    return ['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4', 'peppa', 'unlock1', 'song'];
  }
  if (action === 'getTaskDetail' || action === 'markTaskListened') {
    if (['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4', 'peppa', 'song', 'unlock1'].includes(requestedCategory)) {
      return [requestedCategory];
    }
    return [];
  }
  if (action === 'getTaskTranscript') {
    return [];
  }
  if (['getFamilyPage', 'refreshInviteCode', 'joinFamily', 'joinFamilyByChildCode', 'leaveFamily', 'updateChildProfile', 'setStudyRole', 'updateSubscription', 'bootstrap', 'getReadingHome', 'getReadingPassage', 'getReadingStudyPack', 'synthesizeReadingAudio', 'submitReadingAttempt', 'submitWritingAttempt', 'recordStudyCompletion', 'getStudyCompletions'].includes(action)) {
    return [];
  }
  return catalogCategories;
}

async function prepareRequestContext(event, deps) {
  const action = String((event && event.action) || '').trim();
  const requestedCategory = String((event && event.payload && event.payload.category) || '').trim();
  const catalogCategories = resolveCatalogCategories(action, requestedCategory, (event && event.payload) || {});
  await deps.refreshRuntimeCatalogs(false, catalogCategories);
  const { OPENID } = deps.getWXContext();
  const view = String((event && event.payload && event.payload.view) || '').trim();
  const lightweightCtx = action === 'getDashboard' && view === 'home' && deps.getLightweightContext
    ? await deps.getLightweightContext(OPENID)
    : null;
  const ctx = lightweightCtx || await deps.ensureBootstrap(OPENID);
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
