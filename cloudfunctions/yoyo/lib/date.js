function addDays(date, delta) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + delta);
  return next.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  const left = new Date(`${a}T00:00:00`).getTime();
  const right = new Date(`${b}T00:00:00`).getTime();
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
  getUniqueDates,
  computeStreak
};
