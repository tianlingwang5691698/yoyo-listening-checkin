const store = require('../../../utils/store');
const page = require('../../../utils/page');

function buildOptionList(options) {
  return ['A', 'B', 'C', 'D'].filter((key) => options && options[key]).map((key) => ({
    key,
    text: options[key],
    selected: false
  }));
}

function normalizePassage(passage, answers) {
  if (!passage) {
    return null;
  }
  return Object.assign({}, passage, {
    questions: (passage.questions || []).map((question) => {
      const selected = answers[String(question.number)] || '';
      return Object.assign({}, question, {
        optionsList: buildOptionList(question.options).map((option) => Object.assign({}, option, {
          selected: option.key === selected
        }))
      });
    })
  });
}

Page({
  data: page.createCloudPageData({
    loading: true,
    submitting: false,
    passageId: '',
    passage: null,
    answers: {},
    attempt: null,
    review: null,
    submitted: false,
    hasScore: false
  }),
  async onLoad(options) {
    page.syncTheme(this);
    const passageId = options && options.passageId ? String(options.passageId) : '';
    this.setData({ passageId });
    await this.loadPassage(passageId);
  },
  async loadPassage(passageId) {
    const data = await store.getReadingPassage({ passageId }, (fresh) => this.applyPassage(fresh));
    this.applyPassage(data);
  },
  applyPassage(data) {
    const latestAttempt = data.latestAttempt || null;
    const answers = latestAttempt && latestAttempt.answers ? latestAttempt.answers : this.data.answers;
    this.setData(page.buildCloudPageData(this.data, {
      loading: false,
      passage: normalizePassage(data.passage, answers),
      answers,
      attempt: latestAttempt,
      review: latestAttempt && latestAttempt.review ? latestAttempt.review : null,
      submitted: !!latestAttempt,
      hasScore: !!latestAttempt && latestAttempt.score !== null && latestAttempt.score !== undefined
    }));
  },
  selectOption(event) {
    if (this.data.submitted) {
      return;
    }
    const number = String(event.currentTarget.dataset.number || '');
    const option = String(event.currentTarget.dataset.option || '');
    if (!number || !option) {
      return;
    }
    const answers = Object.assign({}, this.data.answers, { [number]: option });
    this.setData({
      answers,
      passage: normalizePassage(this.data.passage, answers)
    });
  },
  async submit() {
    if (this.data.submitting || !this.data.passage) {
      return;
    }
    const answerCount = Object.keys(this.data.answers || {}).length;
    if (!answerCount) {
      wx.showToast({ title: '先选择答案', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const result = await store.submitReadingAttempt({
        passageId: this.data.passage._id,
        answers: this.data.answers
      });
      this.setData({
        submitting: false,
        attempt: result.attempt || null,
        review: result.review || null,
        submitted: true,
        hasScore: !!result.attempt && result.attempt.score !== null && result.attempt.score !== undefined
      });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    }
  }
});
