const dateLib = require('../lib/date');

let directory = null;

function normalizeExamType(value) {
  if (value === '一模' || value === '二模' || value === '真题' || value === '春考' || value === '秋考') return value;
  return value && String(value).includes('真题') ? '真题' : String(value || '二模');
}

function loadDirectory() {
  if (directory) return directory;
  const raw = require('../data/reading-directory.json');
  directory = (Array.isArray(raw) ? raw : []).filter((item) => item && item._id && item.title && item.questionCount);
  return directory;
}

function createPassageSummary(passage) {
  const meta = [passage.year, passage.district, passage.examType, passage.sectionLabel || passage.section, passage.difficultyLabel]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' · ');
  return {
    _id: passage._id,
    title: passage.title,
    meta,
    questionCount: Number(passage.questionCount || 0),
    paperOrder: Number(passage.paperOrder || 0),
    status: passage.status || 'sample'
  };
}

function buildCategoryTree(passages) {
  const groups = ['一模', '二模', '真题', '春考', '秋考'].map((examType) => {
    const districtMap = {};
    passages.forEach((passage) => {
      if (normalizeExamType(passage.examType) !== examType) return;
      const isSeniorPaper = examType === '春考' || examType === '秋考';
      const district = passage.district || '未分区';
      const nodeKey = isSeniorPaper ? (passage.paperId || `${examType}-${passage.year}`) : district;
      const nodeLabel = isSeniorPaper ? (passage.paperTitle || `${passage.year} 上海高考${examType}英语真题`) : district;
      if (!districtMap[nodeKey]) districtMap[nodeKey] = { label: nodeLabel, count: 0, passages: [] };
      districtMap[nodeKey].count += 1;
      districtMap[nodeKey].passages.push(Object.assign(createPassageSummary(passage), {
        completionReady: false,
        completed: false,
        latestAttempt: null
      }));
    });
    return {
      key: examType,
      label: examType === '真题' ? '真题卷' : (examType === '春考' || examType === '秋考' ? `高中${examType}` : examType),
      count: Object.values(districtMap).reduce((sum, item) => sum + item.count, 0),
      nodeUnit: examType === '春考' || examType === '秋考' ? '份卷' : '',
      districts: Object.keys(districtMap).sort((left, right) => String(districtMap[right].label).localeCompare(String(districtMap[left].label), 'zh-CN')).map((district) => ({
        key: district,
        label: districtMap[district].label,
        count: districtMap[district].count,
        completionReady: false,
        completedCount: 0,
        passages: districtMap[district].passages.sort((left, right) => Number(left.paperOrder || 0) - Number(right.paperOrder || 0) || String(left._id).localeCompare(String(right._id)))
      }))
    };
  });
  return [{ key: 'exam-reading', label: '英语真题阅读', count: passages.length, groups }];
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
