const page = require('../../../utils/page');
const store = require('../../../utils/store');
const completed = require('../../../utils/completed');

function findPrompt(materialIndex, promptId) {
  const all = [].concat((materialIndex || {}).writingEm2 || [], (materialIndex || {}).writingEm1 || []);
  return all.find((item) => item && item._id === promptId) || null;
}

function countWords(text) {
  const matches = String(text || '').trim().match(/[A-Za-z]+(?:[-'][A-Za-z]+)?/g);
  return matches ? matches.length : 0;
}

function normalizeReview(review, prompt) {
  const totalScore = Number(review && review.totalScore) || Number(prompt && prompt.score) || 20;
  return Object.assign({
    score: 0,
    totalScore,
    level: '',
    summary: '',
    content: '',
    structure: '',
    language: '',
    spelling: '',
    problems: [],
    suggestions: [],
    grammarCorrections: [],
    polishedVersion: ''
  }, review || {}, {
    totalScore,
    problems: Array.isArray(review && review.problems) ? review.problems : [],
    suggestions: Array.isArray(review && review.suggestions) ? review.suggestions : [],
    grammarCorrections: Array.isArray(review && review.grammarCorrections) ? review.grammarCorrections : []
  });
}

Page({
  data: page.createCloudPageData({
    prompt: null,
    essayText: '',
    wordCount: 0,
    submitting: false,
    review: null,
    errorText: ''
  }),
  async onLoad(options) {
    const promptId = decodeURIComponent((options && options.id) || '');
    let prompt = null;
    try {
      prompt = wx.getStorageSync('currentWritingPromptV1') || null;
    } catch (error) {
      prompt = null;
    }
    if (!prompt || (promptId && prompt._id !== promptId)) {
      const materialIndex = await store.getMaterialIndex();
      prompt = findPrompt(materialIndex, promptId);
    }
    this.setData({ prompt });
  },
  onShow() {
    page.syncTheme(this);
  },
  onEssayInput(event) {
    const essayText = event.detail.value || '';
    this.setData({
      essayText,
      wordCount: countWords(essayText),
      errorText: ''
    });
  },
  async submitEssay() {
    const prompt = this.data.prompt;
    const essay = String(this.data.essayText || '').trim();
    if (!prompt) {
      this.setData({ errorText: '作文题加载失败。' });
      wx.showToast({ title: '作文题加载失败', icon: 'none' });
      return;
    }
    if (essay.length < 20) {
      this.setData({ errorText: '先写完整一点再提交。' });
      wx.showToast({ title: '先写完整一点', icon: 'none' });
      return;
    }
    this.setData({ submitting: true, errorText: '' });
    try {
      const result = await store.submitWritingAttempt({ prompt, promptId: prompt._id, essay });
      if (result && result.syncMode === 'cloud-error') {
        throw new Error((result.cloudError && result.cloudError.message) || '批改失败');
      }
      const review = normalizeReview(result.review, prompt);
      this.setData({ review });
      const item = {
        id: `${completed.todayString()}:writing:${prompt._id}`,
        type: 'writing',
        targetId: prompt._id,
        title: prompt.title || '写作',
        meta: [prompt.year, prompt.district, prompt.examType].filter(Boolean).join(' · '),
        progressText: `${review.score}/${review.totalScore} 分`,
        latestAttempt: result.attempt || null,
        prompt
      };
      completed.addCompletedItem(item);
      store.recordStudyCompletion(item);
    } catch (error) {
      this.setData({ errorText: '批改失败，可以再点一次提交。' });
      wx.showToast({ title: '批改失败，可重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
