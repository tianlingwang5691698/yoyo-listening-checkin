const { collection } = require('../adapters/db.adapter');

function subscriptionPreferences() {
  return collection('subscriptionPreferences');
}

async function findByMemberId(memberId) {
  const res = await subscriptionPreferences().where({ memberId }).limit(1).get();
  return res.data[0] || null;
}

async function create(data) {
  return subscriptionPreferences().add({ data });
}

async function updateById(id, data) {
  return subscriptionPreferences().doc(id).update({ data });
}

async function deleteById(id) {
  return subscriptionPreferences().doc(id).remove();
}

module.exports = {
  subscriptionPreferences,
  findByMemberId,
  create,
  updateById,
  deleteById
};
