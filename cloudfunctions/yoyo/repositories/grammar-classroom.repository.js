const { collection } = require('../adapters/db.adapter');

const RELEASE_COLLECTION = 'grammarClassroomReleases';

function releaseTimestamp(item) {
  const value = item.releasedAt || item.publishedAt || item.updatedAt || item.createdAt || '';
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function findLatestReleased() {
  let result;
  try {
    result = await collection(RELEASE_COLLECTION)
      .where({ active: true, status: 'released' })
      .orderBy('releasedAt', 'desc')
      .limit(1)
      .get();
  } catch (error) {
    result = await collection(RELEASE_COLLECTION)
      .where({ active: true, status: 'released' })
      .limit(100)
      .get();
  }
  return ((result && result.data) || [])
    .filter((item) => item && item.releaseId)
    .sort((left, right) => (
      releaseTimestamp(right) - releaseTimestamp(left)
      || String(right.releaseId).localeCompare(String(left.releaseId))
    ))[0] || null;
}

module.exports = {
  findLatestReleased
};
