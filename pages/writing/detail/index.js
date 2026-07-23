const page = require('../../../utils/page');
const store = require('../../../utils/store');
const completed = require('../../../utils/completed');
const snapshotStore = require('../../../utils/snapshot');
const effects = require('../../../utils/effects');
const i18n = require('../../../utils/i18n');
const promptDisplay = require('../../../utils/writing-prompt-display');
const { tokenizeScopedText, splitScopedSentences, toggleScopedTokenMark, toggleScopedSentenceMark, countScopedMarks, buildManualMarks } = require('../../../utils/scoped-manual-marks');

const text = (key, fallback) => i18n.getPageText('writing', key, undefined, fallback);

const WRITING_PROMPT_SNAPSHOT_KEY = 'currentWritingPromptV4';

function buildPromptDisplay(prompt) {
  return promptDisplay.buildPromptDisplay(prompt, {
    taskTitle: text('taskTitle', '写作任务'),
    referenceTitle: text('referenceTitle', '参考问题'),
    requirementsTitle: text('requirementsTitle', '写作要点'),
    noticeTitle: text('noticeTitle', '注意事项')
  });
}

const cleanPromptText = promptDisplay.cleanPromptText;

function isTranslationTask(prompt) {
  return String(prompt && prompt.contentType || '') === 'translation';
}

function isWritingTaskReady(prompt) {
  return !!(prompt && (isTranslationTask(prompt)
    ? Array.isArray(prompt.questions) && prompt.questions.length
    : prompt.prompt));
}

function buildTranslationQuestions(prompt) {
  return (prompt && prompt.questions || []).map((question, index) => {
    const markScope = `writing-translation-${Number(question.number || index + 1)}`;
    return {
    number: Number(question.number || 0),
    sourceText: cleanPromptText(question.sourceText),
    markScope,
    sourceTokens: tokenizeScopedText(cleanPromptText(question.sourceText), markScope),
    requiredWord: cleanPromptText(question.requiredWord),
    referenceAnswers: Array.isArray(question.referenceAnswers) ? question.referenceAnswers.map(cleanPromptText).filter(Boolean) : [],
    inputValue: '',
    analysis: null
    };
  });
}

function buildWritingMarkLines(display) {
  const source = display || {};
  const entries = [];
  const add = (textValue, label, options) => {
    const value = cleanPromptText(textValue);
    if (!value) return;
    splitScopedSentences(value).forEach((sentence, sentenceIndex) => {
      const scope = `writing-prompt-${entries.length}`;
      entries.push({
        key: scope,
        scope,
        label: sentenceIndex === 0 ? (label || '') : '',
        isParagraphStart: !!(options && options.isParagraphStart && sentenceIndex === 0),
        text: sentence,
        tokens: tokenizeScopedText(sentence, scope)
      });
    });
  };
  add(source.directions, '');
  if (source.articleTitle) {
    entries.push({
      key: 'writing-article-title',
      scope: '',
      label: source.scenarioTitle,
      isArticleTitle: true,
      isParagraphStart: false,
      text: source.articleTitle,
      tokens: []
    });
  }
  const articleParagraphs = Array.isArray(source.articleParagraphs) && source.articleParagraphs.length
    ? source.articleParagraphs
    : [source.scenario];
  articleParagraphs.forEach((paragraph, index) => add(
    paragraph,
    index === 0 && !source.articleTitle ? source.scenarioTitle : '',
    { isParagraphStart: index > 0 }
  ));
  (source.requirements || []).forEach((item, index) => add(item, index === 0 ? source.requirementsTitle : ''));
  (source.notices || []).forEach((item, index) => add(item, index === 0 ? source.noticeTitle : ''));
  add(source.promptStarter, '');
  return entries;
}

function getWritingMarkSources(state) {
  return [].concat(state.writingMarkLines || [], state.translationQuestions || []).reduce((map, item) => {
    const scope = item.scope || item.markScope;
    const value = item.text || item.sourceText;
    if (scope && value) map[scope] = value;
    return map;
  }, {});
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

function createWritingCloudError(result, action) {
  const cloudError = result && result.cloudError || {};
  const syncDebug = result && result.syncDebug || {};
  const error = new Error(cloudError.message || `${action}-failed`);
  error.writingDebug = {
    action,
    reason: syncDebug.reason || '',
    envId: syncDebug.envId || ''
  };
  return error;
}

function buildWritingSubmitError(error, fallbackAction) {
  const debug = error && error.writingDebug || {};
  const action = debug.action || fallbackAction || 'submitWritingAttempt';
  const target = typeof store.getSelectedStudentTarget === 'function' ? store.getSelectedStudentTarget() : {};
  const message = String(error && error.message || 'unknown-error');
  return [
    text('gradingFailed', '批改失败，可以再点一次提交。'),
    `DEBUG: pages/writing/detail.submitEssay -> store.${action} -> cloud.${action} -> cloudError.message=${message}, syncDebug.reason=${debug.reason || 'missing'}, syncDebug.envId=${debug.envId || 'missing'}, targetChildId=${target.targetChildId || 'self'}`
  ].join('\n');
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
    strengths: [],
    problems: [],
    suggestions: [],
    grammarCorrections: [],
    polishedVersion: '',
    criterionDetails: [],
    bandSamples: [],
    isIelts: false,
    estimateLabel: '',
    weightingNote: '',
    rubricVersion: ''
  }, review || {}, {
    totalScore,
    strengths: Array.isArray(review && review.strengths) ? review.strengths : [],
    problems: Array.isArray(review && review.problems) ? review.problems : [],
    suggestions: Array.isArray(review && review.suggestions) ? review.suggestions : [],
    grammarCorrections: Array.isArray(review && review.grammarCorrections) ? review.grammarCorrections : [],
    criterionDetails: Array.isArray(review && review.criterionDetails) ? review.criterionDetails : [],
    bandSamples: Array.isArray(review && review.bandSamples) ? review.bandSamples : []
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
    writingMarkLines: [],
    writingTokenMarks: {},
    writingSentenceMarks: {},
    writingMarkCount: 0,
    essayText: '',
    submittedEssayText: '',
    wordCount: 0,
    editorFocused: false,
    submitting: false,
    grading: false,
    review: null,
    currentAttemptId: '',
    bandSampleGeneratingDelta: 0,
    bandSampleError: '',
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
    const initialDisplay = initialPromptReady && !initialTranslation ? buildPromptDisplay(prompt) : null;
    this.setData({
      prompt: initialPromptReady ? prompt : null,
      promptDisplay: initialDisplay,
      writingMarkLines: buildWritingMarkLines(initialDisplay),
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
    const nextPromptDisplay = isTranslation ? null : buildPromptDisplay(prompt);
    this.setData({
      prompt,
      promptDisplay: nextPromptDisplay,
      writingMarkLines: buildWritingMarkLines(nextPromptDisplay),
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
  handleWritingTokenTap(event) {
    if (this.data.submitting || this.data.translationSubmitted) return;
    const dataset = event.currentTarget.dataset || {};
    if (!dataset.word || !dataset.markScope) return;
    const writingTokenMarks = toggleScopedTokenMark(this.data.writingTokenMarks, dataset.markScope, Number(dataset.wordIndex));
    this.setData({
      writingTokenMarks,
      writingMarkCount: countScopedMarks(writingTokenMarks, this.data.writingSentenceMarks)
    });
  },
  handleWritingSentenceMark(event) {
    if (this.data.submitting || this.data.translationSubmitted) return;
    const scope = String((event.currentTarget.dataset || {}).markScope || '');
    if (!scope) return;
    const writingSentenceMarks = toggleScopedSentenceMark(this.data.writingSentenceMarks, scope);
    this.setData({
      writingSentenceMarks,
      writingMarkCount: countScopedMarks(this.data.writingTokenMarks, writingSentenceMarks)
    });
  },
  clearWritingMarks() {
    if (this.data.submitting || this.data.translationSubmitted) return;
    this.setData({ writingTokenMarks: {}, writingSentenceMarks: {}, writingMarkCount: 0 });
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
        })),
        manualMarks: buildManualMarks(getWritingMarkSources(this.data), this.data.writingTokenMarks, this.data.writingSentenceMarks)
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
    this.setData({
      submitting: true,
      submittedEssayText: essay,
      wordCount,
      errorText: '',
      reviewCelebrating: false,
      currentAttemptId: '',
      bandSampleGeneratingDelta: 0,
      bandSampleError: ''
    });
    try {
      const result = await store.submitWritingAttempt({
        prompt,
        promptId: prompt._id,
        essay,
        manualMarks: buildManualMarks(getWritingMarkSources(this.data), this.data.writingTokenMarks, this.data.writingSentenceMarks)
      });
      if (result && result.syncMode === 'cloud-error') {
        throw createWritingCloudError(result, 'submitWritingAttempt');
      }
      const attempt = result.attempt || null;
      const attemptId = (attempt && (attempt.attemptId || attempt._id)) || '';
      if (result.review && !result.pending) {
        const review = normalizeReview(result.review, prompt);
        this.setData({ review, currentAttemptId: attemptId, grading: false, errorText: '' });
        this.playWritingReviewEffect();
        return;
      }
      this.setData({ currentAttemptId: attemptId, grading: true, errorText: text('gradingStatus', '作文已提交，正在批改。') });
      if (!attemptId) {
        throw new Error('missing-writing-attempt-id');
      }
      store.gradeWritingAttempt(attemptId).then((graded) => {
        if (graded && graded.syncMode === 'cloud-error') {
          throw createWritingCloudError(graded, 'gradeWritingAttempt');
        }
        const review = normalizeReview(graded.review, prompt);
        this.setData({ review, currentAttemptId: attemptId, grading: false, errorText: '' });
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
        const errorText = buildWritingSubmitError(error, 'gradeWritingAttempt');
        console.error(errorText);
        this.setData({
          grading: false,
          errorText
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
      const errorText = buildWritingSubmitError(error, 'submitWritingAttempt');
      console.error(errorText);
      this.setData({
        errorText
      });
      wx.showToast({ title: text('retryFailed', '批改失败，可重试'), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
  async generateBandSample(event) {
    const delta = Number(event.currentTarget.dataset.delta) === 2 ? 2 : 1;
    const review = this.data.review;
    const prompt = this.data.prompt;
    if (!review || !review.isIelts || this.data.bandSampleGeneratingDelta) return;
    this.setData({ bandSampleGeneratingDelta: delta, bandSampleError: '' });
    try {
      const attemptId = String(this.data.currentAttemptId || '');
      const result = await store.generateWritingBandSample({
        attemptId,
        delta,
        prompt: attemptId ? null : prompt,
        essay: attemptId ? '' : (this.data.submittedEssayText || this.data.essayText),
        review: attemptId ? null : review
      });
      if (result && result.syncMode === 'cloud-error') {
        throw new Error((result.cloudError && result.cloudError.message) || '升档范文生成失败');
      }
      const bandSamples = Array.isArray(result && result.bandSamples) && result.bandSamples.length
        ? result.bandSamples
        : [].concat(review.bandSamples || [], result && result.sample || []).filter(Boolean);
      this.setData({
        review: normalizeReview(Object.assign({}, review, { bandSamples }), prompt),
        bandSampleError: ''
      });
    } catch (error) {
      this.setData({ bandSampleError: '升档范文生成失败，可以再试一次。' });
      wx.showToast({ title: '生成失败，可重试', icon: 'none' });
    } finally {
      this.setData({ bandSampleGeneratingDelta: 0 });
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
