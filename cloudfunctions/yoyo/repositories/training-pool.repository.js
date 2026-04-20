const { collection } = require('../adapters/db.adapter');

function unlock1AudioTrainingPool() {
  return collection('unlock1AudioTrainingPool');
}

async function listAll(limit = 500) {
  const res = await unlock1AudioTrainingPool().limit(limit).get();
  return res.data || [];
}

module.exports = {
  unlock1AudioTrainingPool,
  listAll
};
