const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

function collection(name) {
  return db.collection(name);
}

function getCommand() {
  return db.command;
}

function getEnvId() {
  const raw = process.env.TCB_ENV || process.env.SCF_NAMESPACE || cloud.DYNAMIC_CURRENT_ENV;
  return typeof raw === 'string' ? raw : '';
}

module.exports = {
  cloud,
  db,
  collection,
  getCommand,
  getEnvId
};
