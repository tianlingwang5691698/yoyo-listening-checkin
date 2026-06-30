const COMPLETED_KEY = 'studyCompletedItemsV1';

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readAll() {
  try {
    return wx.getStorageSync(COMPLETED_KEY) || [];
  } catch (error) {
    return [];
  }
}

function writeAll(items) {
  try {
    wx.setStorageSync(COMPLETED_KEY, items || []);
  } catch (error) {}
}

function addCompletedItem(item) {
  const date = item && item.date ? item.date : todayString();
  const id = item && item.id ? item.id : `${date}:${item.type || 'item'}:${Date.now()}`;
  const all = readAll();
  const existingIndex = all.findIndex((entry) => entry && entry.id === id && entry.date === date);
  const current = existingIndex >= 0 ? all[existingIndex] : {};
  const next = Object.assign({}, current, item, {
    id,
    date,
    completedToday: true,
    updatedAt: new Date().toISOString(),
    createdAt: current.createdAt || new Date().toISOString()
  });
  if (existingIndex >= 0) {
    all.splice(existingIndex, 1, next);
  } else {
    all.push(next);
  }
  writeAll(all.slice(-200));
  return next;
}

function getTodayCompletedItems() {
  const today = todayString();
  return readAll().filter((item) => item && item.date === today);
}

module.exports = {
  addCompletedItem,
  getTodayCompletedItems,
  todayString
};
