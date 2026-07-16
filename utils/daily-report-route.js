function buildDailyReportDetailUrl(date) {
  const dateText = String(date || '').slice(0, 10);
  return `/pages/parent/detail/index?date=${encodeURIComponent(dateText)}`;
}

module.exports = {
  buildDailyReportDetailUrl
};
