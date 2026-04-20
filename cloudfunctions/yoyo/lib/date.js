const CHINA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

function parseDate(date) {
  const [year, month, day] = String(date || '').slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1));
}

function formatChinaDateFromDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const chinaDate = new Date(date.getTime() + CHINA_UTC_OFFSET_MS);
  return `${chinaDate.getUTCFullYear()}-${pad(chinaDate.getUTCMonth() + 1)}-${pad(chinaDate.getUTCDate())}`;
}

function getTodayString() {
  return formatChinaDateFromDate(new Date());
}

function addDays(date, delta) {
  const next = parseDate(date);
  next.setUTCDate(next.getUTCDate() + delta);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function diffDays(a, b) {
  const left = parseDate(a).getTime();
  const right = parseDate(b).getTime();
  return Math.round((left - right) / (24 * 60 * 60 * 1000));
}

function getUniqueDates(records) {
  return Array.from(new Set((records || []).map((item) => item.date))).sort((a, b) => b.localeCompare(a));
}

function computeStreak(records, today) {
  const uniqueDates = getUniqueDates(records);
  if (!uniqueDates.length) {
    return 0;
  }
  if (uniqueDates[0] !== today && diffDays(today, uniqueDates[0]) > 1) {
    return 0;
  }
  let streak = uniqueDates[0] === today ? 1 : 0;
  let cursor = uniqueDates[0] === today ? today : addDays(today, -1);
  if (uniqueDates[0] !== today && uniqueDates[0] === addDays(today, -1)) {
    streak = 1;
    cursor = uniqueDates[0];
  }
  for (let i = 1; i < uniqueDates.length; i += 1) {
    const expected = addDays(cursor, -1);
    if (uniqueDates[i] === expected) {
      streak += 1;
      cursor = uniqueDates[i];
    } else {
      break;
    }
  }
  return streak;
}

module.exports = {
  addDays,
  diffDays,
  formatChinaDateFromDate,
  getTodayString,
  getUniqueDates,
  computeStreak
};
