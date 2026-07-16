const TASK_FIELDS = [
  'taskId',
  'category',
  'categoryLabel',
  'title',
  'subtitle',
  'displayTitle',
  'displaySubtitle',
  'audioTitle',
  'audioCompactTitle',
  'durationSec',
  'repeatTarget',
  'coverBadge',
  'coverTone',
  'audioUrl',
  'audioCloudPath',
  'audioFileId',
  'audioSource',
  'audioSegmentVersion',
  'isPendingAsset'
];

function buildPublicTaskSummary(task, index) {
  const source = task || {};
  const summary = {
    itemNo: index + 1,
    catalogSummary: true
  };
  TASK_FIELDS.forEach((field) => {
    if (source[field] !== undefined && source[field] !== null && source[field] !== '') {
      summary[field] = source[field];
    }
  });
  const segments = Array.isArray(source.audioSegments) ? source.audioSegments : [];
  if (segments.length) {
    summary.audioSegments = [segments[0]];
    summary.audioSegmentCount = segments.length;
  }
  return summary;
}

function buildPublicCatalog(tasks) {
  return (tasks || []).map(buildPublicTaskSummary);
}

module.exports = {
  TASK_FIELDS,
  buildPublicTaskSummary,
  buildPublicCatalog
};
