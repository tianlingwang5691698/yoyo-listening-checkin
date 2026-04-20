const { collection } = require('../adapters/db.adapter');

function users() {
  return collection('users');
}

async function findByOpenId(openId) {
  const res = await users().where({ openId }).limit(1).get();
  return res.data[0] || null;
}

async function updateById(id, data) {
  return users().doc(id).update({ data });
}

async function create(data) {
  return users().add({ data });
}

module.exports = {
  users,
  findByOpenId,
  updateById,
  create
};
