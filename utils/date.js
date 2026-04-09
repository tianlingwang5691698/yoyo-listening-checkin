function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
}

function parseDate(dateString) {
  const parts = dateString.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function getTodayString() {
  return formatDate(new Date());
}

function addDays(dateString, offset) {
  const next = parseDate(dateString);
  next.setDate(next.getDate() + offset);
  return formatDate(next);
}

function diffInDays(lateDateString, earlyDateString) {
  const late = parseDate(lateDateString).getTime();
  const early = parseDate(earlyDateString).getTime();
  return Math.round((late - early) / (24 * 60 * 60 * 1000));
}

function getWeekLabel(dateString) {
  const labels = ['日', '一', '二', '三', '四', '五', '六'];
  return labels[parseDate(dateString).getDay()];
}

module.exports = {
  addDays,
  diffInDays,
  formatDate,
  getTodayString,
  getWeekLabel
};
