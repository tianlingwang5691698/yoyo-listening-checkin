const CLOUD_PAGE_DEFAULTS = {
  syncMode: 'cloud-error',
  isReviewBuild: false,
  showCloudDebug: false,
  syncDebug: null
};

function createCloudPageData(defaults) {
  return Object.assign({}, CLOUD_PAGE_DEFAULTS, defaults || {});
}

function normalizeCloudPageData(data) {
  const nextData = Object.assign({}, data || {});
  nextData.syncMode = nextData.syncMode || 'cloud-error';
  nextData.isReviewBuild = !!nextData.isReviewBuild;
  nextData.showCloudDebug = !!nextData.showCloudDebug;
  nextData.syncDebug = nextData.syncDebug || null;
  return nextData;
}

function buildCloudPageData(defaults, data) {
  return Object.assign({}, createCloudPageData(defaults), normalizeCloudPageData(data));
}

module.exports = {
  createCloudPageData,
  buildCloudPageData
};
