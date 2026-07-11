async function getDashboard(event) {
  const view = String((((event && event.payload) || {}).view) || '').trim();
  if (view === 'record') {
    return require('./record-home.service').getRecordDashboard(event);
  }
  return require('./dashboard.service').getDashboard(event);
}

module.exports = {
  getDashboard
};
