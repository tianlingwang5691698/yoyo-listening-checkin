const { collection } = require('../adapters/db.adapter');

function children() {
  return collection('children');
}

async function findByFamilyId(familyId) {
  const res = await children().where({ familyId }).limit(1).get();
  return res.data[0] || null;
}

async function findByLoginCode(childLoginCode) {
  const res = await children().where({ childLoginCode }).limit(1).get();
  return res.data[0] || null;
}

async function updateById(id, data) {
  return children().doc(id).update({ data });
}

async function create(data) {
  return children().add({ data });
}

module.exports = {
  children,
  findByFamilyId,
  findByLoginCode,
  updateById,
  create
};
