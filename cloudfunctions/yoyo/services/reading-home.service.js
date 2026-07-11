const dateLib = require('../lib/date');

let directory = null;

function normalizeExamType(value) {
  if (value === '一模' || value === '二模' || value === '真题') return value;
  return value && String(value).includes('真题') ? '真题' : String(value || '二模');
}

function loadDirectory() {
  if (directory) return directory;
  const raw = require('../data/reading-directory.json');
  directory = (Array.isArray(raw) ? raw : []).filter((item) => item && item._id && item.title && item.questionCount);
  return directory;
}

function createPassageSummary(passage) {
  return {
    _id: passage._id,
    title: passage.title,
    meta: [passage.year, passage.district, passage.examType, passage.sectionLabel || passage.section, passage.difficultyLabel].filter(Boolean).join(' · '),
    questionCount: Number(passage.questionCount || 0),
    status: passage.status || 'sample'
  };
}

function buildCategoryTree(passages) {
  const groups = ['一模', '二模', '真题'].map((examType) => {
    const districtMap = {};
    passages.forEach((passage) => {
      if (normalizeExamType(passage.examType) !== examType) return;
      const district = passage.district || '未分区';
      if (!districtMap[district]) districtMap[district] = { count: 0, passages: [] };
      districtMap[district].count += 1;
      districtMap[district].passages.push(Object.assign(createPassageSummary(passage), {
        completionReady: false,
        completed: false,
        latestAttempt: null
      }));
    });
    return {
      key: examType,
      label: examType === '真题' ? '真题卷' : examType,
      count: Object.values(districtMap).reduce((sum, item) => sum + item.count, 0),
      districts: Object.keys(districtMap).sort().map((district) => ({
        key: district,
        label: district,
        count: districtMap[district].count,
        completionReady: false,
        completedCount: 0,
        passages: districtMap[district].passages
      }))
    };
  });
  return [{ key: 'middle-school-reading', label: '中考阅读', count: passages.length, groups }];
}

async function getReadingHome(event) {
  const payload = (event && event.payload) || {};
  if (!payload.directoryOnly) {
    return require('./reading.service').getReadingHome(event);
  }
  const passages = loadDirectory();
  return {
    today: dateLib.getTodayString(),
    dailyCount: 0,
    passage: null,
    passages: [],
    categoryTree: buildCategoryTree(passages),
    memoryPlan: null,
    completedCount: 0,
    totalCount: 0,
    completedToday: false,
    latestAttempt: null
  };
}

module.exports = { getReadingHome };
