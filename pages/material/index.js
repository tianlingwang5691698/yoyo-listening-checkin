const page = require('../../utils/page');
const store = require('../../utils/store');
const snapshotStore = require('../../utils/snapshot');
const i18n = require('../../utils/i18n');

const text = (key, fallback) => i18n.getPageText('material', key, undefined, fallback);

const LISTENING_SET_SNAPSHOT_KEY = 'currentListeningSetV1';
const WRITING_PROMPT_SNAPSHOT_KEY = 'currentWritingPromptV1';
const MATERIAL_HOME_SNAPSHOT_KEY = 'materialHomeSnapshotV1';
const MATERIAL_HOME_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getMaterialHomeSnapshotKey(moduleId) {
  return `${MATERIAL_HOME_SNAPSHOT_KEY}:${moduleId}`;
}

function buildMaterials(materialIndex) {
  return {
    writing: {
      title: text('writingTitle', '写作'),
      eyebrow: text('writingEyebrow', '英语写作'),
      copy: text('writingCopy', '按学段和模考类型选择作文题。'),
      itemUnit: text('questionUnit', '题'),
      exams: [
        { examId: 'em2', exam: text('em2', '二模'), items: materialIndex.writingEm2 || [] },
        { examId: 'em1', exam: text('em1', '一模'), items: materialIndex.writingEm1 || [] }
      ]
    },
    listening: {
      title: text('listeningTitle', '听力'),
      eyebrow: text('listeningEyebrow', '英语听力'),
      copy: text('listeningCopy', '按学段和模考类型选择听力音频。'),
      itemUnit: text('setUnit', '套'),
      exams: [
        { examId: 'em2', exam: text('em2', '二模'), items: materialIndex.listeningEm2 || [] },
        { examId: 'em1', exam: text('em1', '一模'), items: materialIndex.listeningEm1 || [] }
      ]
    }
  };
}

function groupByDistrict(items) {
  const map = {};
  (items || []).forEach((item) => {
    const district = item.district || text('other', '其他');
    if (!map[district]) {
      map[district] = {
        district,
        count: 0,
        items: []
      };
    }
    map[district].count += 1;
    const materialItemId = getMaterialItemId(item) || `${district}:${map[district].count}`;
    map[district].items.push(Object.assign({}, item, {
      stableId: materialItemId,
      materialItemId
    }));
  });
  return Object.keys(map).sort().map((key) => map[key]);
}

function getMaterialItemId(item) {
  return String(item && (item._id || item.id || item.stableId || item.audioCloudPath || item.title) || '').trim();
}

function buildStages(config) {
  const exams = (config.exams || []).map((exam) => ({
    examId: exam.examId,
    exam: exam.exam,
    count: (exam.items || []).length,
    districts: groupByDistrict(exam.items || [])
  }));
  const juniorCount = exams.reduce((sum, exam) => sum + exam.count, 0);
  return [
    {
      stageId: 'junior',
      stage: text('junior', '初中'),
      count: juniorCount,
      exams
    },
    {
      stageId: 'senior',
      stage: text('senior', '高中'),
      count: 0,
      exams: []
    }
  ];
}

function applyMaterialConfig(pageInstance, moduleId, materialIndex, extraData) {
  const config = buildMaterials(materialIndex)[moduleId];
  const debugLines = buildMaterialDebug(moduleId, materialIndex);
  pageInstance.setData(Object.assign({
    title: config.title,
    eyebrow: config.eyebrow,
    copy: config.copy,
    itemUnit: config.itemUnit,
    showCefrEntry: moduleId === 'listening',
    stages: buildStages(config),
    debugLines
  }, extraData || {}));
}

function hasMaterialContent(moduleId, materialIndex) {
  const index = materialIndex || {};
  if (moduleId === 'listening') {
    return !!((index.listeningEm1 || []).length || (index.listeningEm2 || []).length);
  }
  return !!((index.writingEm1 || []).length || (index.writingEm2 || []).length);
}

function countMaterialItems(moduleId, materialIndex) {
  const index = materialIndex || {};
  if (moduleId === 'listening') {
    return (index.listeningEm1 || []).length + (index.listeningEm2 || []).length;
  }
  return (index.writingEm1 || []).length + (index.writingEm2 || []).length;
}

function buildMaterialDebug(moduleId, materialIndex) {
  const index = materialIndex || {};
  const counts = {
    listeningEm1: (index.listeningEm1 || []).length,
    listeningEm2: (index.listeningEm2 || []).length,
    writingEm1: (index.writingEm1 || []).length,
    writingEm2: (index.writingEm2 || []).length
  };
  const targetCounts = moduleId === 'listening'
    ? counts.listeningEm1 + counts.listeningEm2
    : counts.writingEm1 + counts.writingEm2;
  if (targetCounts > 0 && index.syncMode !== 'cloud-error') {
    return [];
  }
  const syncDebug = index.syncDebug || {};
  const lines = [
    `DEBUG: pages/material.onLoad -> store.getMaterialIndex -> cloud.getMaterialIndex -> moduleId=${moduleId}`,
    `DEBUG: pages/material.applyMaterialConfig -> materialIndex.listeningEm1=${counts.listeningEm1}, listeningEm2=${counts.listeningEm2}, writingEm1=${counts.writingEm1}, writingEm2=${counts.writingEm2}`,
    `DEBUG: pages/material.applyMaterialConfig -> syncMode=${index.syncMode || 'missing'}, envId=${(syncDebug && syncDebug.envId) || 'missing'}, targetChildId=N/A`
  ];
  if (index.cloudError || syncDebug.reason) {
    lines.push(`DEBUG: pages/material.onLoad -> cloudError.message=${(index.cloudError && index.cloudError.message) || ''}, syncDebug.reason=${syncDebug.reason || ''}`);
  }
  console.warn(lines.join('\n'));
  return lines;
}

Page({
  data: page.createCloudPageData({
    moduleId: 'listening',
    title: text('listeningTitle', '听力'),
    eyebrow: text('listeningEyebrow', '英语听力'),
    copy: '',
    itemUnit: text('setUnit', '套'),
    showCefrEntry: true,
    stages: [],
    selectedStageId: '',
    selectedStage: null,
    exams: [],
    selectedExamId: '',
    selectedExam: null,
    districts: [],
    selectedDistrict: '',
    selectedDistrictNode: null,
    items: [],
    expandedItemId: '',
    debugLines: [],
    loading: true,
    pageReady: false
  }),
  async onLoad(options) {
    const moduleId = options && options.module === 'writing' ? 'writing' : 'listening';
    this.materialPerf = page.startPagePerf(`material-${moduleId}`);
    const baseConfig = buildMaterials({})[moduleId];
    const snapshot = snapshotStore.read(getMaterialHomeSnapshotKey(moduleId), {
      id: moduleId,
      maxAgeMs: MATERIAL_HOME_SNAPSHOT_MAX_AGE_MS
    }) || snapshotStore.read(MATERIAL_HOME_SNAPSHOT_KEY, {
      id: moduleId,
      maxAgeMs: MATERIAL_HOME_SNAPSHOT_MAX_AGE_MS
    });
    const snapshotIndex = snapshot && hasMaterialContent(moduleId, snapshot.materialIndex) ? snapshot.materialIndex : null;
    const cachedMaterialIndex = !snapshotIndex && store.getCachedReadResult
      ? store.getCachedReadResult('getMaterialIndex', { moduleId })
      : null;
    const firstMaterialIndex = snapshotIndex || (hasMaterialContent(moduleId, cachedMaterialIndex) ? cachedMaterialIndex : null);
    if (firstMaterialIndex) {
      applyMaterialConfig(this, moduleId, firstMaterialIndex, {
        moduleId,
        loading: false,
        pageReady: true
      });
      this.materialPerf.ready('pageReady', {
        source: snapshotIndex ? 'snapshot' : 'cache',
        cacheHit: true,
        items: countMaterialItems(moduleId, firstMaterialIndex)
      });
    } else {
      this.setData({
        moduleId,
        title: baseConfig.title,
        eyebrow: baseConfig.eyebrow,
        copy: baseConfig.copy,
        itemUnit: baseConfig.itemUnit,
        showCefrEntry: moduleId === 'listening',
        loading: true,
        pageReady: true
      });
      await new Promise((resolve) => wx.nextTick(resolve));
      this.materialPerf.ready('pageReady', {
        source: 'fallback',
        cacheHit: false,
        items: 0
      });
    }
    const hasSnapshot = !!firstMaterialIndex;
    const materialIndex = await store.getMaterialIndex({ moduleId }, (freshIndex) => {
      if (freshIndex && freshIndex.syncMode !== 'cloud-error' && hasMaterialContent(moduleId, freshIndex)) {
        applyMaterialConfig(this, moduleId, freshIndex);
        snapshotStore.write(getMaterialHomeSnapshotKey(moduleId), moduleId, { materialIndex: freshIndex }, { source: `material-${moduleId}` });
        if (this.materialPerf) {
          this.materialPerf.mark('cloudRefresh', {
            items: countMaterialItems(moduleId, freshIndex)
          });
        }
      }
    });
    if (materialIndex && materialIndex.syncMode !== 'cloud-error' && hasMaterialContent(moduleId, materialIndex)) {
      applyMaterialConfig(this, moduleId, materialIndex, {
        loading: false
      });
    } else if (!hasSnapshot) {
      applyMaterialConfig(this, moduleId, materialIndex, {
        loading: false
      });
    }
    if (materialIndex && materialIndex.syncMode !== 'cloud-error' && hasMaterialContent(moduleId, materialIndex)) {
      snapshotStore.write(getMaterialHomeSnapshotKey(moduleId), moduleId, { materialIndex }, { source: `material-${moduleId}` });
    }
    if (this.materialPerf && !firstMaterialIndex) {
      this.materialPerf.mark('cloudRefresh', {
        source: materialIndex && materialIndex.__cacheHit ? 'cache' : (materialIndex && materialIndex.syncMode === 'cloud-error' ? 'error' : 'cloud'),
        cacheHit: !!(materialIndex && materialIndex.__cacheHit),
        items: countMaterialItems(moduleId, materialIndex)
      });
      if (materialIndex && !materialIndex.__cacheHit && materialIndex.syncMode !== 'cloud-error') {
        this.materialPerf.mark('cloudRefresh', {
          items: countMaterialItems(moduleId, materialIndex)
        });
      }
    }
  },
  onShow() {
    page.syncTheme(this);
    const config = buildMaterials({})[this.data.moduleId] || buildMaterials({}).listening;
    const stages = (this.data.stages || []).map((stage) => Object.assign({}, stage, {
      stage: stage.stageId === 'senior' ? text('senior', '高中') : text('junior', '初中'),
      exams: (stage.exams || []).map((exam) => Object.assign({}, exam, {
        exam: exam.examId === 'em1' ? text('em1', '一模') : text('em2', '二模')
      }))
    }));
    this.setData({
      title: config.title,
      eyebrow: config.eyebrow,
      copy: config.copy,
      itemUnit: config.itemUnit,
      stages,
      exams: (this.data.exams || []).map((exam) => Object.assign({}, exam, {
        exam: exam.examId === 'em1' ? text('em1', '一模') : text('em2', '二模')
      }))
    });
  },
  openCefrListening() {
    wx.switchTab({
      url: '/pages/level/index'
    });
  },
  openPracticeHistory() {
    if (this.data.moduleId !== 'writing') return;
    wx.navigateTo({
      url: '/pages/practice-history/index?type=writing'
    });
  },
  selectStage(event) {
    const stageId = event.currentTarget.dataset.stageId;
    const selectedStage = (this.data.stages || []).find((item) => item.stageId === stageId) || null;
    this.setData({
      selectedStageId: stageId,
      selectedStage,
      exams: selectedStage ? selectedStage.exams || [] : [],
      selectedExamId: '',
      selectedExam: null,
      districts: [],
      selectedDistrict: '',
      selectedDistrictNode: null,
      items: [],
      expandedItemId: ''
    });
  },
  selectExam(event) {
    const examId = event.currentTarget.dataset.examId;
    const selectedExam = (this.data.exams || []).find((item) => item.examId === examId) || null;
    this.setData({
      selectedExamId: examId,
      selectedExam,
      districts: selectedExam ? selectedExam.districts || [] : [],
      selectedDistrict: '',
      selectedDistrictNode: null,
      items: [],
      expandedItemId: ''
    });
  },
  selectDistrict(event) {
    const district = event.currentTarget.dataset.district;
    const selectedDistrictNode = (this.data.districts || []).find((item) => item.district === district) || null;
    this.setData({
      selectedDistrict: district,
      selectedDistrictNode,
      items: selectedDistrictNode ? selectedDistrictNode.items || [] : [],
      expandedItemId: ''
    });
  },
  backToStages() {
    this.setData({
      selectedStageId: '',
      selectedStage: null,
      exams: [],
      selectedExamId: '',
      selectedExam: null,
      districts: [],
      selectedDistrict: '',
      selectedDistrictNode: null,
      items: [],
      expandedItemId: ''
    });
  },
  backToExams() {
    this.setData({
      selectedExamId: '',
      selectedExam: null,
      districts: [],
      selectedDistrict: '',
      selectedDistrictNode: null,
      items: [],
      expandedItemId: ''
    });
  },
  backToDistricts() {
    this.setData({
      selectedDistrict: '',
      selectedDistrictNode: null,
      items: [],
      expandedItemId: ''
    });
  },
  async openItem(event) {
    const itemId = event.currentTarget.dataset.itemId || '';
    const item = (this.data.items || []).find((row) => getMaterialItemId(row) === String(itemId));
    if (this.data.moduleId === 'listening') {
      if (item) {
        const targetId = getMaterialItemId(item);
        wx.setStorageSync('currentListeningSetV1', item);
        snapshotStore.write(LISTENING_SET_SNAPSHOT_KEY, targetId, { item }, { source: 'material-listening' });
        wx.navigateTo({
          url: `/pages/material/detail/index?itemId=${encodeURIComponent(targetId)}`
        });
      }
      return;
    }
    if (item) {
      wx.setStorageSync('currentWritingPromptV1', item);
      snapshotStore.write(WRITING_PROMPT_SNAPSHOT_KEY, item._id || item.id || '', { prompt: item }, { source: 'material-writing' });
      wx.navigateTo({
        url: `/pages/writing/detail/index?id=${encodeURIComponent(item._id || item.id || '')}`
      });
      return;
    }
    this.setData({
      expandedItemId: this.data.expandedItemId === itemId ? '' : itemId
    });
  }
});
