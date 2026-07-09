const page = require('../../../utils/page');
const store = require('../../../utils/store');
const completed = require('../../../utils/completed');
const snapshotStore = require('../../../utils/snapshot');
const effects = require('../../../utils/effects');

const WRITING_PROMPT_SNAPSHOT_KEY = 'currentWritingPromptV1';

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
    editorFocused: false,
    submitting: false,
    grading: false,
    review: null,
    reviewCelebrating: false,
    errorText: ''
  }),
  async onLoad(options) {
    const promptId = decodeURIComponent((options && options.id) || '');
    let prompt = null;
    const snapshot = promptId ? snapshotStore.read(WRITING_PROMPT_SNAPSHOT_KEY, {
      id: promptId,
      maxAgeMs: 5 * 60 * 1000
    }) : null;
    prompt = snapshot && snapshot.prompt ? snapshot.prompt : null;
    try {
      prompt = prompt || wx.getStorageSync('currentWritingPromptV1') || null;
    } catch (error) {
      prompt = prompt || null;
    }
    if (!prompt || (promptId && prompt._id !== promptId) || !prompt.prompt) {
      const result = await store.getMaterialItem({ moduleId: 'writing', itemId: promptId });
      prompt = (result && result.item) || null;
    }
    if (!prompt || (promptId && prompt._id !== promptId)) {
      const materialIndex = await store.getMaterialIndex({ moduleId: 'writing' });
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
  onEditorFocus() {
    this.setData({ editorFocused: true });
  },
  onEditorBlur() {
    this.setData({ editorFocused: false });
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
    this.reviewEffectPlayed = false;
    this.setData({ submitting: true, errorText: '', reviewCelebrating: false });
    try {
      const result = await store.submitWritingAttempt({ prompt, promptId: prompt._id, essay });
      if (result && result.syncMode === 'cloud-error') {
        throw new Error((result.cloudError && result.cloudError.message) || '批改失败');
      }
      const attempt = result.attempt || null;
      const attemptId = (attempt && (attempt.attemptId || attempt._id)) || '';
      if (result.review && !result.pending) {
        const review = normalizeReview(result.review, prompt);
        this.setData({ review, grading: false, errorText: '' });
        this.playWritingReviewEffect();
        return;
      }
      this.setData({ grading: true, errorText: '作文已提交，正在批改。' });
      if (!attemptId) {
        throw new Error('missing-writing-attempt-id');
      }
      store.gradeWritingAttempt(attemptId).then((graded) => {
        if (graded && graded.syncMode === 'cloud-error') {
          throw new Error((graded.cloudError && graded.cloudError.message) || '批改失败');
        }
        const review = normalizeReview(graded.review, prompt);
        this.setData({ review, grading: false, errorText: '' });
        this.playWritingReviewEffect();
        const item = {
          id: `${completed.todayString()}:writing:${prompt._id}`,
          type: 'writing',
          targetId: prompt._id,
          title: prompt.title || '写作',
          meta: [prompt.year, prompt.district, prompt.examType].filter(Boolean).join(' · '),
          progressText: `${review.score}/${review.totalScore} 分`,
          latestAttempt: graded.attempt || attempt,
          prompt
        };
        completed.addCompletedItem(item);
      }).catch(() => {
        this.setData({ grading: false, errorText: '批改失败，可以稍后在记录里查看或重新提交。' });
      });
      const item = {
        id: `${completed.todayString()}:writing:${prompt._id}`,
        type: 'writing',
        targetId: prompt._id,
        title: prompt.title || '写作',
        meta: [prompt.year, prompt.district, prompt.examType].filter(Boolean).join(' · '),
        progressText: '批改中',
        latestAttempt: attempt,
        prompt
      };
      completed.addCompletedItem(item);
    } catch (error) {
      this.setData({ errorText: '批改失败，可以再点一次提交。' });
      wx.showToast({ title: '批改失败，可重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
  playWritingReviewEffect() {
    if (this.reviewEffectPlayed) return;
    this.reviewEffectPlayed = true;
    if (this.reviewEffectTimer) {
      clearTimeout(this.reviewEffectTimer);
    }
    effects.playComplete({ voiceKey: 'writingComplete' });
    this.setData({ reviewCelebrating: true });
    this.reviewEffectTimer = setTimeout(() => {
      this.reviewEffectTimer = null;
      this.setData({ reviewCelebrating: false });
    }, 1600);
  },
  onUnload() {
    if (this.reviewEffectTimer) {
      clearTimeout(this.reviewEffectTimer);
      this.reviewEffectTimer = null;
    }
  }
});
