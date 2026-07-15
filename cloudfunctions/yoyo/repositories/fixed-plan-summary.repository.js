const { collection, getCommand } = require('../adapters/db.adapter');
const { isMissingDocumentError } = require('../lib/errors');
const fixedPlanSummary = require('../lib/fixed-plan-summary');

const COLLECTION_NAME = 'fixedPlanProgressSummaries';

function summaries() {
  return collection(COLLECTION_NAME);
}

async function findByScope(scope) {
  try {
    const result = await summaries().doc(fixedPlanSummary.buildSummaryId(scope)).get();
    return result && result.data ? result.data : null;
  } catch (error) {
    if (isMissingDocumentError(error)) return null;
    throw error;
  }
}

async function replace(scope, summary) {
  await summaries().doc(fixedPlanSummary.buildSummaryId(scope)).set({ data: summary });
  return summary;
}

async function updateSlot(scope, slotKey, slot) {
  const command = getCommand();
  const updatedAt = new Date().toISOString();
  await summaries().doc(fixedPlanSummary.buildSummaryId(scope)).update({
    data: {
      [`slots.${slotKey}`]: command.set(slot),
      lastSlotSyncAt: updatedAt,
      updatedAt
    }
  });
  return slot;
}

module.exports = {
  COLLECTION_NAME,
  summaries,
  findByScope,
  replace,
  updateSlot
};
