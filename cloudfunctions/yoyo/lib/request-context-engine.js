function resolveCatalogCategories(action, requestedCategory, payload = {}) {
  let catalogCategories = ['newconcept1', 'song'];
  const view = String((payload && payload.view) || '').trim();
  if (action === 'getDashboard' && view === 'record') {
    return [];
  }
  if (action === 'getLevelOverview') {
    return ['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4', 'song'];
  }
  if (action === 'getTaskDetail' || action === 'markTaskListened') {
    if (['newconcept1', 'newconcept2', 'newconcept3', 'newconcept4', 'song', 'unlock1'].includes(requestedCategory)) {
      return [requestedCategory];
    }
    return [];
  }
  if (action === 'getTaskTranscript') {
    return [];
  }
  if (['getFamilyPage', 'refreshInviteCode', 'joinFamily', 'joinFamilyByChildCode', 'leaveFamily', 'updateChildProfile', 'setStudyRole', 'updateSubscription', 'bootstrap'].includes(action)) {
    return [];
  }
  return catalogCategories;
}

async function prepareRequestContext(event, deps) {
  const action = String((event && event.action) || '').trim();
  const requestedCategory = String((event && event.payload && event.payload.category) || '').trim();
  const catalogCategories = resolveCatalogCategories(action, requestedCategory, (event && event.payload) || {});
  await deps.refreshRuntimeCatalogs(false, catalogCategories);
  await deps.ensureRequiredCollectionsReady();
  const { OPENID } = deps.getWXContext();
  const ctx = await deps.ensureBootstrap(OPENID);
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
