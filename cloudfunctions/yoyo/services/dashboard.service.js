const shared = require('./shared.service');

async function getDashboard(event) {
  const { ctx } = await shared.prepareRequestContext(Object.assign({}, event, {
    action: 'getDashboard'
  }));
  return shared.getDashboardData(ctx);
}

module.exports = {
  getDashboard
};
