const study = require('../facades/study.facade');

async function getDashboard(event) {
  const { ctx } = await study.prepareRequestContext(Object.assign({}, event, {
    action: 'getDashboard'
  }));
  return study.getDashboardData(ctx);
}

module.exports = {
  getDashboard
};
