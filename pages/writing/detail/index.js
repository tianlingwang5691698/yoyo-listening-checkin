const page = require('../../../utils/page');
const store = require('../../../utils/store');
const completed = require('../../../utils/completed');
const snapshotStore = require('../../../utils/snapshot');
const effects = require('../../../utils/effects');
const i18n = require('../../../utils/i18n');

const text = (key, fallback) => i18n.getPageText('writing', key, undefined, fallback);

const WRITING_PROMPT_SNAPSHOT_KEY = 'currentWritingPromptV4';

const LEGACY_REQUIREMENT_POINTS = {
  'sh-autumn-2009-writing': [
    '你感兴趣的课程',
    '你期望从这门课程中学到什么',
    '为什么想学这些内容'
  ]
};

function cleanPromptText(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function splitExplicitRequirements(value) {
  const normalized = String(value || '')
    .replace(/\r/g, '\n')
    .replace(/(?:^|\s)[●•▪◦]\s*/g, '\n')
    .replace(/(?:^|\s)(?:\d+[.、)]|[（(][一二三四五六七八九\d]+[）)])\s*/g, '\n');
  return normalized.split(/\n+/).map(cleanPromptText).filter(Boolean);
}

function buildPromptDisplay(prompt) {
  const raw = cleanPromptText(prompt && prompt.prompt);
  if (!raw) return { directions: '', scenario: '', requirementsTitle: '', requirements: [], promptTable: null, promptStarter: '' };
  const directionsMatch = raw.match(/^Directions\s*:\s*[^\u3400-\u9fff]*(?=[\u3400-\u9fff])/i);
  const directions = cleanPromptText((prompt && prompt.directions) || (directionsMatch && directionsMatch[0]));
  const body = cleanPromptText(directionsMatch ? raw.slice(directionsMatch[0].length) : raw);
  let scenario = cleanPromptText(prompt && prompt.scenario);
  let requirementsTitle = cleanPromptText(prompt && prompt.requirementsTitle);
  let requirements = Array.isArray(prompt && prompt.requirements)
    ? prompt.requirements.map(cleanPromptText).filter(Boolean)
    : [];
  if (!scenario) {
    const marker = body.match(/(?:信的)?内容(?:必须)?包括(?:如下)?\s*[:：]/);
    if (marker) {
      scenario = cleanPromptText(body.slice(0, marker.index));
      requirementsTitle = requirementsTitle || cleanPromptText(marker[0]);
      if (!requirements.length) requirements = splitExplicitRequirements(body.slice(marker.index + marker[0].length));
    } else {
      scenario = body;
    }
  }
  const legacy = LEGACY_REQUIREMENT_POINTS[String(prompt && prompt._id || '')] || [];
  if (legacy.length && requirements.length < 2) requirements = legacy.slice();
  if (legacy.length) {
    const firstPointIndex = scenario.indexOf(legacy[0]);
    if (firstPointIndex >= 0) scenario = cleanPromptText(scenario.slice(0, firstPointIndex));
  }
  return {
    directions,
    scenario,
    requirementsTitle: requirements.length ? (requirementsTitle || text('requirementsTitle', '写作要点：')) : '',
    requirements,
    promptTable: prompt && prompt.promptTable && Array.isArray(prompt.promptTable.headers) && Array.isArray(prompt.promptTable.rows)
      ? prompt.promptTable
      : null,
    promptStarter: cleanPromptText(prompt && prompt.promptStarter)
  };
}

function isTranslationTask(prompt) {
  return String(prompt && prompt.contentType || '') === 'translation';
}

function isWritingTaskReady(prompt) {
  return !!(prompt && (isTranslationTask(prompt)
    ? Array.isArray(prompt.questions) && prompt.questions.length
    : prompt.prompt));
}

function buildTranslationQuestions(prompt) {
  return (prompt && prompt.questions || []).map((question) => ({
    number: Number(question.number || 0),
    sourceText: cleanPromptText(question.sourceText),
    requiredWord: cleanPromptText(question.requiredWord),
    referenceAnswers: Array.isArray(question.referenceAnswers) ? question.referenceAnswers.map(cleanPromptText).filter(Boolean) : [],
    inputValue: '',
    analysis: null
  }));
}

function buildPromptImages(prompt) {
  return (prompt && Array.isArray(prompt.images) ? prompt.images : []).map((image) => ({
    cloudPath: cleanPromptText(image && image.cloudPath),
    alt: cleanPromptText(image && image.alt) || text('promptImageAlt', '作文题原图'),
    src: cleanPromptText(image && (image.src || image.url))
  })).filter((image) => image.cloudPath || image.src);
}

function findPrompt(materialIndex, promptId) {
  const all = [].concat((materialIndex || {}).writingEm2 || [], (materialIndex || {}).writingEm1 || [], (materialIndex || {}).writingSeniorSpring || [], (materialIndex || {}).writingSeniorAutumn || [], (materialIndex || {}).writingIelts || []);
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
    promptDisplay: null,
    promptImages: [],
    isTranslation: false,
    translationQuestions: [],
    translationSubmitted: false,
    translationAnalyzing: false,
    translationAnalysisSummary: '',
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
    this.writingPerf = page.startPagePerf('writing-detail');
    const promptId = decodeURIComponent((options && options.id) || '');
    let prompt = null;
    let source = 'cloud';
    const snapshot = promptId ? snapshotStore.read(WRITING_PROMPT_SNAPSHOT_KEY, {
      id: promptId,
      maxAgeMs: 5 * 60 * 1000
    }) : null;
    prompt = snapshot && snapshot.prompt ? snapshot.prompt : null;
    if (prompt) source = 'snapshot';
    try {
      const storedPrompt = wx.getStorageSync('currentWritingPromptV1') || null;
      if (!prompt && storedPrompt) source = 'storage';
      prompt = prompt || storedPrompt;
    } catch (error) {
      prompt = prompt || null;
    }
    const initialPromptReady = !!(prompt && (!promptId || prompt._id === promptId) && isWritingTaskReady(prompt));
    const initialTranslation = initialPromptReady && isTranslationTask(prompt);
    this.setData({
      prompt: initialPromptReady ? prompt : null,
      promptDisplay: initialPromptReady && !initialTranslation ? buildPromptDisplay(prompt) : null,
      promptImages: initialPromptReady && !initialTranslation ? buildPromptImages(prompt) : [],
      isTranslation: initialTranslation,
      translationQuestions: initialTranslation ? buildTranslationQuestions(prompt) : [],
      translationSubmitted: false,
      translationAnalyzing: false,
      translationAnalysisSummary: ''
    });
    await new Promise((resolve) => wx.nextTick(resolve));
    this.writingPerf.ready('pageReady', {
      source: initialPromptReady ? source : 'fallback',
      cacheHit: initialPromptReady,
      promptId,
      hasPrompt: initialPromptReady
    });
    if (!prompt || (promptId && prompt._id !== promptId) || !isWritingTaskReady(prompt)) {
      const result = await store.getMaterialItem({ moduleId: 'writing', itemId: promptId });
      prompt = (result && result.item) || null;
      source = result && result.__cacheHit ? 'cache' : 'cloud';
    }
    if (!prompt || (promptId && prompt._id !== promptId)) {
      const materialIndex = await store.getMaterialIndex({ moduleId: 'writing' });
      prompt = findPrompt(materialIndex, promptId);
      source = materialIndex && materialIndex.__cacheHit ? 'cache' : 'cloud';
    }
    const isTranslation = isTranslationTask(prompt);
    this.setData({
      prompt,
      promptDisplay: isTranslation ? null : buildPromptDisplay(prompt),
      promptImages: isTranslation ? [] : buildPromptImages(prompt),
      isTranslation,
      translationQuestions: isTranslation ? buildTranslationQuestions(prompt) : [],
      translationSubmitted: false,
      translationAnalyzing: false,
      translationAnalysisSummary: ''
    });
    if (!isTranslation) await this.resolvePromptImages(prompt);
    this.writingPerf.mark('cloudRefresh', {
      source,
      cacheHit: source === 'snapshot' || source === 'storage' || source === 'cache',
      promptId,
      hasPrompt: !!prompt
    });
    if (source === 'cloud') {
      this.writingPerf.mark('cloudRefresh', { promptId, hasPrompt: !!prompt });
    }
  },
  onShow() {
    page.syncTheme(this);
  },
  async resolvePromptImages(prompt) {
    const promptId = String(prompt && prompt._id || '');
    const images = buildPromptImages(prompt);
    if (!images.some((image) => image.cloudPath && !image.src)) return;
    const resolved = await Promise.all(images.map(async (image) => {
      if (image.src || !image.cloudPath) return image;
      try {
        return Object.assign({}, image, { src: await store.getTempFileURL(image.cloudPath) });
      } catch (error) {
        return image;
      }
    }));
    if (String(this.data.prompt && this.data.prompt._id || '') === promptId) {
      this.setData({ promptImages: resolved });
    }
  },
  previewPromptImage(event) {
    const current = String(event.currentTarget.dataset.src || '').trim();
    const urls = (this.data.promptImages || []).map((image) => image.src).filter(Boolean);
    if (!current || !urls.length) return;
    wx.previewImage({ current, urls });
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
  onTranslationInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    const translationQuestions = (this.data.translationQuestions || []).map((question, questionIndex) => (
      questionIndex === index ? Object.assign({}, question, { inputValue: event.detail.value || '', analysis: null }) : question
    ));
    this.setData({ translationQuestions, translationSubmitted: false, translationAnalysisSummary: '', errorText: '' });
  },
  async submitTranslation() {
    const questions = this.data.translationQuestions || [];
    if (!questions.length || questions.some((question) => !String(question.inputValue || '').trim())) {
      this.setData({ errorText: text('translationIncomplete', '请先完成全部翻译题。') });
      wx.showToast({ title: text('translationIncompleteToast', '请先完成全部翻译题'), icon: 'none' });
      return;
    }
    const prompt = this.data.prompt || {};
    this.setData({ translationAnalyzing: true, translationSubmitted: false, translationAnalysisSummary: '', errorText: '' });
    try {
      const result = await store.analyzeWritingTranslation({
        prompt: {
          _id: prompt._id || '',
          title: prompt.title || '',
          directions: prompt.directions || ''
        },
        questions: questions.map((question) => ({
          number: question.number,
          sourceText: question.sourceText,
          requiredWord: question.requiredWord,
          referenceAnswers: question.referenceAnswers,
          studentTranslation: question.inputValue
        }))
      });
      if (result && result.syncMode === 'cloud-error') {
        throw new Error((result.cloudError && result.cloudError.message) || '翻译分析失败');
      }
      const analyses = Array.isArray(result && result.analyses) ? result.analyses : [];
      if (!analyses.length) throw new Error('translation-analysis-missing');
      const byNumber = new Map(analyses.map((item) => [String(item.number), item]));
      this.setData({
        translationQuestions: questions.map((question) => Object.assign({}, question, {
          analysis: byNumber.get(String(question.number)) || null
        })),
        translationSubmitted: true,
        translationAnalysisSummary: result.summary || '',
        errorText: ''
      });
    } catch (error) {
      this.setData({ errorText: text('translationAnalysisFailed', '分析失败，可以再点一次提交。') });
      wx.showToast({ title: text('translationAnalysisFailedToast', '分析失败，可重试'), icon: 'none' });
    } finally {
      this.setData({ translationAnalyzing: false });
    }
  },
  async submitEssay() {
    const prompt = this.data.prompt;
    const essay = String(this.data.essayText || '').trim();
    if (!prompt) {
      this.setData({ errorText: text('loadFailed', '作文题加载失败。') });
      wx.showToast({ title: text('loadFailed', '作文题加载失败'), icon: 'none' });
      return;
    }
    if (essay.length < 20) {
      this.setData({ errorText: text('tooShort', '先写完整一点再提交。') });
      wx.showToast({ title: text('tooShort', '先写完整一点'), icon: 'none' });
      return;
    }
    const wordCount = countWords(essay);
    this.reviewEffectPlayed = false;
    this.setData({ submitting: true, wordCount, errorText: '', reviewCelebrating: false });
    try {
      const result = await store.submitWritingAttempt({ prompt, promptId: prompt._id, essay });
      if (result && result.syncMode === 'cloud-error') {
        throw new Error((result.cloudError && result.cloudError.message) || text('retryFailed', '批改失败'));
      }
      const attempt = result.attempt || null;
      const attemptId = (attempt && (attempt.attemptId || attempt._id)) || '';
      if (result.review && !result.pending) {
        const review = normalizeReview(result.review, prompt);
        this.setData({ review, grading: false, errorText: '' });
        this.playWritingReviewEffect();
        return;
      }
      this.setData({ grading: true, errorText: text('gradingStatus', '作文已提交，正在批改。') });
      if (!attemptId) {
        throw new Error('missing-writing-attempt-id');
      }
      store.gradeWritingAttempt(attemptId).then((graded) => {
        if (graded && graded.syncMode === 'cloud-error') {
          throw new Error((graded.cloudError && graded.cloudError.message) || text('retryFailed', '批改失败'));
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
          progressText: `${review.score}/${review.totalScore}${text('scoreUnit', ' 分')}`,
          latestAttempt: graded.attempt || attempt,
          prompt
        };
        completed.addCompletedItem(item);
      }).catch((error) => {
        this.setData({
          grading: false,
          errorText: text('gradingFailed', '批改失败，可以再点一次提交。')
        });
      });
      const item = {
        id: `${completed.todayString()}:writing:${prompt._id}`,
        type: 'writing',
        targetId: prompt._id,
        title: prompt.title || '写作',
        meta: [prompt.year, prompt.district, prompt.examType].filter(Boolean).join(' · '),
        progressText: text('grading', '批改中'),
        latestAttempt: attempt,
        prompt
      };
      completed.addCompletedItem(item);
    } catch (error) {
      this.setData({
        errorText: text('gradingFailed', '批改失败，可以再点一次提交。')
      });
      wx.showToast({ title: text('retryFailed', '批改失败，可重试'), icon: 'none' });
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
    const promptId = (this.data.prompt && this.data.prompt._id) || 'current';
    effects.playComplete({
      voiceKey: 'writingComplete',
      onceKey: `writing:${effects.todayKey()}:${promptId}`
    });
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
