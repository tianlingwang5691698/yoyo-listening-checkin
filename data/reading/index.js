const passages = require('./reading-passages');

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function summary(passage) {
  if (!passage) return null;
  return Object.assign({}, passage, {
    meta: `${passage.year || ''} · ${passage.district || ''} · ${passage.sectionLabel || `阅读 ${passage.section || ''}`}`,
    questionCount: (passage.questions || []).length,
    completed: false,
    latestAttempt: null
  });
}

function buildCategoryTree(items) {
  const root = {
    key: 'reading',
    label: '中考阅读',
    count: items.length,
    groups: []
  };
  const groups = {};
  items.forEach((passage) => {
    const examKey = passage.examType || '阅读';
    const districtKey = passage.district || '未分类';
    if (!groups[examKey]) {
      groups[examKey] = {
        key: examKey,
        label: examKey,
        count: 0,
        districts: []
      };
      root.groups.push(groups[examKey]);
    }
    let district = groups[examKey].districts.find((item) => item.key === districtKey);
    if (!district) {
      district = {
        key: districtKey,
        label: districtKey,
        count: 0,
        completedCount: 0,
        passages: []
      };
      groups[examKey].districts.push(district);
    }
    const item = summary(passage);
    groups[examKey].count += 1;
    district.count += 1;
    district.passages.push(item);
  });
  return [root];
}

function getReadingHome() {
  const summaries = passages.map(summary);
  return {
    today: todayString(),
    dailyCount: summaries.length,
    passage: summaries[0] || null,
    passages: summaries,
    categoryTree: buildCategoryTree(passages),
    memoryPlan: null,
    completedCount: 0,
    totalCount: summaries.length,
    completedToday: false,
    latestAttempt: null,
    syncMode: 'local'
  };
}

function getReadingPassage(passageId) {
  return {
    today: todayString(),
    passage: passages.find((item) => item._id === passageId) || passages[0] || null,
    latestAttempt: null,
    syncMode: 'local'
  };
}

module.exports = {
  passages,
  getReadingHome,
  getReadingPassage
};
