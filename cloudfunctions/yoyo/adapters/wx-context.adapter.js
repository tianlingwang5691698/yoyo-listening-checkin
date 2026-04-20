const { cloud } = require('./db.adapter');

function getWXContext() {
  return cloud.getWXContext();
}

module.exports = {
  getWXContext
};
