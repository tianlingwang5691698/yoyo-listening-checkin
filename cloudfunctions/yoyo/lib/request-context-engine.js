function resolveCatalogCategories(action, requestedCategory) {
  let catalogCategories = ['newconcept1', 'song'];
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
  if (['getFamilyPage', 'refreshInviteCode', 'joinFamily', 'joinFamilyByChildCode', 'updateChildProfile', 'setStudyRole', 'updateSubscription', 'bootstrap'].includes(action)) {
    return [];
  }
  return catalogCategories;
}

module.exports = {
  resolveCatalogCategories
};
