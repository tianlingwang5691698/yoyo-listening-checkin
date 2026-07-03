const page = require('../../utils/page');
const store = require('../../utils/store');
const snapshotStore = require('../../utils/snapshot');

const LISTENING_SET_SNAPSHOT_KEY = 'currentListeningSetV1';
const WRITING_PROMPT_SNAPSHOT_KEY = 'currentWritingPromptV1';
const MATERIAL_HOME_SNAPSHOT_KEY = 'materialHomeSnapshotV1';

function buildMaterials(materialIndex) {
  return {
    writing: {
      title: '写作',
      eyebrow: '英语写作',
      copy: '按学段和模考类型选择作文题。',
      itemUnit: '题',
      exams: [
        { examId: 'em2', exam: '二模', items: materialIndex.writingEm2 || [] },
        { examId: 'em1', exam: '一模', items: materialIndex.writingEm1 || [] }
      ]
    },
    listening: {
      title: '听力',
      eyebrow: '英语听力',
      copy: '按学段和模考类型选择听力音频。',
      itemUnit: '套',
      exams: [
        { examId: 'em2', exam: '二模', items: materialIndex.listeningEm2 || [] },
        { examId: 'em1', exam: '一模', items: materialIndex.listeningEm1 || [] }
      ]
    }
  };
}

function groupByDistrict(items) {
  const map = {};
  (items || []).forEach((item) => {
    const district = item.district || '其他';
    if (!map[district]) {
      map[district] = {
        district,
        count: 0,
        items: []
      };
    }
    map[district].count += 1;
    map[district].items.push(item);
  });
  return Object.keys(map).sort().map((key) => map[key]);
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
      stage: '初中',
      count: juniorCount,
      exams
    },
    {
      stageId: 'senior',
      stage: '高中',
      count: 0,
      exams: []
    }
  ];
}

function applyMaterialConfig(pageInstance, moduleId, materialIndex, extraData) {
  const config = buildMaterials(materialIndex)[moduleId];
  pageInstance.setData(Object.assign({
    title: config.title,
    eyebrow: config.eyebrow,
    copy: config.copy,
    itemUnit: config.itemUnit,
    showCefrEntry: moduleId === 'listening',
    stages: buildStages(config)
  }, extraData || {}));
}

Page({
  data: page.createCloudPageData({
    moduleId: 'listening',
    title: '听力',
    eyebrow: '英语听力',
    copy: '',
    itemUnit: '套',
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
    loading: true
  }),
  async onLoad(options) {
    const moduleId = options && options.module === 'writing' ? 'writing' : 'listening';
    const baseConfig = buildMaterials({})[moduleId];
    this.setData({
      moduleId,
      title: baseConfig.title,
      eyebrow: baseConfig.eyebrow,
      copy: baseConfig.copy,
      itemUnit: baseConfig.itemUnit,
      showCefrEntry: moduleId === 'listening'
    });
    const snapshot = snapshotStore.read(MATERIAL_HOME_SNAPSHOT_KEY, {
      id: moduleId,
      maxAgeMs: 10 * 60 * 1000
    });
    if (snapshot && snapshot.materialIndex) {
      applyMaterialConfig(this, moduleId, snapshot.materialIndex, {
        loading: false
      });
    }
    const materialIndex = await store.getMaterialIndex({ moduleId }, (freshIndex) => {
      applyMaterialConfig(this, moduleId, freshIndex);
      snapshotStore.write(MATERIAL_HOME_SNAPSHOT_KEY, moduleId, { materialIndex: freshIndex }, { source: `material-${moduleId}` });
    });
    applyMaterialConfig(this, moduleId, materialIndex, {
      loading: false
    });
    if (materialIndex && materialIndex.syncMode !== 'cloud-error') {
      snapshotStore.write(MATERIAL_HOME_SNAPSHOT_KEY, moduleId, { materialIndex }, { source: `material-${moduleId}` });
    }
  },
  onShow() {
    page.syncTheme(this);
  },
  openCefrListening() {
    wx.switchTab({
      url: '/pages/level/index'
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
  openItem(event) {
    const itemId = event.currentTarget.dataset.itemId || '';
    const item = (this.data.items || []).find((row) => row._id === itemId);
    if (this.data.moduleId === 'listening') {
      if (item) {
        wx.setStorageSync('currentListeningSetV1', item);
        snapshotStore.write(LISTENING_SET_SNAPSHOT_KEY, item._id || item.id || '', { item }, { source: 'material-listening' });
        wx.navigateTo({
          url: '/pages/material/detail/index'
        });
      }
      return;
    }
    if (item) {
      wx.setStorageSync('currentWritingPromptV1', item);
      snapshotStore.write(WRITING_PROMPT_SNAPSHOT_KEY, item._id || item.id || '', { prompt: item }, { source: 'material-writing' });
      wx.navigateTo({
        url: `/pages/writing/detail/index?id=${encodeURIComponent(item._id || '')}`
      });
      return;
    }
    this.setData({
      expandedItemId: this.data.expandedItemId === itemId ? '' : itemId
    });
  }
});
