const page = require('../../../utils/page');
const store = require('../../../utils/store');
const completed = require('../../../utils/completed');
const snapshotStore = require('../../../utils/snapshot');
const effects = require('../../../utils/effects');
const i18n = require('../../../utils/i18n');
const promptDisplay = require('../../../utils/writing-prompt-display');
const { normalizeWritingReview } = require('../../../utils/writing-report');
const { openWritingReportPdf } = require('../../../utils/writing-report-download');
const { tokenizeScopedText, splitScopedSentences, toggleScopedTokenMark, toggleScopedSentenceMark, countScopedMarks, buildManualMarks } = require('../../../utils/scoped-manual-marks');

const text = (key, fallback) => i18n.getPageText('writing', key, undefined, fallback);

const WRITING_PROMPT_SNAPSHOT_KEY = 'currentWritingPromptV4';
const WRITING_SESSION_STORAGE_PREFIX = 'writingDetailSessionV1';
const WRITING_PENDING_STATUSES = ['grading-pending', 'grading'];

function getWritingSessionStorageKey(promptId) {
  const target = typeof store.getSelectedStudentTarget === 'function' ? store.getSelectedStudentTarget() : {};
  const role = typeof store.getDeviceStudyRole === 'function' ? store.getDeviceStudyRole() : 'student';
  return [
    WRITING_SESSION_STORAGE_PREFIX,
    role,
    target.targetFamilyId || 'self',
    target.targetChildId || 'self',
    String(promptId || '')
  ].map((item) => encodeURIComponent(String(item))).join(':');
}

function readWritingSession(promptId) {
  if (!promptId) return null;
  try {
    const session = wx.getStorageSync(getWritingSessionStorageKey(promptId));
    return session && session.promptId === promptId ? session : null;
  } catch (error) {
    return null;
  }
}

function writeWritingSession(promptId, session) {
  if (!promptId) return;
  try {
    wx.setStorageSync(getWritingSessionStorageKey(promptId), Object.assign({}, session || {}, {
      promptId,
      updatedAt: Date.now()
    }));
  } catch (error) {}
}

function buildPromptDisplay(prompt) {
  return promptDisplay.buildPromptDisplay(prompt, {
    taskTitle: text('taskTitle', '写作任务'),
    referenceTitle: text('referenceTitle', '参考问题'),
    requirementsTitle: text('requirementsTitle', '写作要点'),
    noticeTitle: text('noticeTitle', '注意事项'),
    directionsTitle: text('directionsTitle', '作答说明'),
    starterTitle: text('starterTitle', '开头提示')
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

function buildWritingPromptStructure(display) {
  const sourceSections = promptDisplay.buildPromptSections(display, {
    taskTitle: text('taskTitle', '写作任务'),
    requirementsTitle: text('requirementsTitle', '写作要点'),
    noticeTitle: text('noticeTitle', '注意事项'),
    directionsTitle: text('directionsTitle', '作答说明'),
    starterTitle: text('starterTitle', '开头提示')
  });
  const entries = [];
  const sections = sourceSections.map((section) => {
    if (section.articleTitle) {
      entries.push({
        key: 'writing-article-title',
        scope: '',
        sectionKey: section.key,
        isArticleTitle: true,
        text: section.articleTitle,
        tokens: []
      });
    }
    const lines = [];
    section.items.forEach((item, itemIndex) => {
      splitScopedSentences(item.text).forEach((sentence, sentenceIndex) => {
        const scope = `writing-prompt-${entries.length}`;
        const line = {
          key: scope,
          scope,
          sectionKey: section.key,
          marker: sentenceIndex === 0 ? item.marker : '',
          isParagraphStart: section.type === 'task' && itemIndex > 0 && sentenceIndex === 0,
          text: sentence,
          tokens: tokenizeScopedText(sentence, scope)
        };
        entries.push(line);
        lines.push(line);
      });
    });
    return Object.assign({}, section, { lines });
  });
  return { sections, lines: entries };
}

function buildWritingMarkLines(display) {
  return buildWritingPromptStructure(display).lines;
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

function normalizeEssayIdentityText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function hasEssayContentChanged(currentEssay, submittedEssay) {
  return normalizeEssayIdentityText(currentEssay) !== normalizeEssayIdentityText(submittedEssay);
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
    text('gradingFailed', '批改未完成，系统会续查原任务，请勿重复提交。'),
    `DEBUG: pages/writing/detail.submitEssay -> store.${action} -> cloud.${action} -> cloudError.message=${message}, syncDebug.reason=${debug.reason || 'missing'}, syncDebug.envId=${debug.envId || 'missing'}, targetChildId=${target.targetChildId || 'self'}`
  ].join('\n');
}

function normalizeReview(review, prompt) {
  return normalizeWritingReview(review, Number(prompt && prompt.score) || 20);
}

function getWritingGradeFailureText(gradeError) {
  const errorCode = String(gradeError || '');
  if (errorCode.includes('writing-timeout') || errorCode.includes('writing-total-budget-exhausted')) {
    return text('gradingTimeoutRetry', '批改请求超时，可直接重试原任务。');
  }
  if (/official-decision|score-invalid|json|parse|structure|invalid/i.test(errorCode)) {
    return text('gradingStructureRetry', '批改结果结构未完整返回，可直接重试原任务。');
  }
  return text('gradingFailedRetry', '批改未完成，可直接重试原任务。');
}

Page({
  data: page.createCloudPageData({
    prompt: null,
    promptDisplay: null,
    writingPromptSections: [],
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
    gradingFailed: false,
    review: null,
    currentAttemptId: '',
    essayDirty: false,
    submitLocked: false,
    restoringAttempt: false,
    bandSampleGeneratingDelta: 0,
    bandSampleError: '',
    pdfGenerating: false,
    reviewCelebrating: false,
    errorText: ''
  }),
  async onLoad(options) {
    this.writingPageActive = true;
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
    const initialPromptStructure = buildWritingPromptStructure(initialDisplay);
    this.setData({
      prompt: initialPromptReady ? prompt : null,
      promptDisplay: initialDisplay,
      writingPromptSections: initialPromptStructure.sections,
      writingMarkLines: initialPromptStructure.lines,
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
    const nextPromptStructure = buildWritingPromptStructure(nextPromptDisplay);
    this.setData({
      prompt,
      promptDisplay: nextPromptDisplay,
      writingPromptSections: nextPromptStructure.sections,
      writingMarkLines: nextPromptStructure.lines,
      promptImages: isTranslation ? [] : buildPromptImages(prompt),
      isTranslation,
      translationQuestions: isTranslation ? buildTranslationQuestions(prompt) : [],
      translationSubmitted: false,
      translationAnalyzing: false,
      translationAnalysisSummary: ''
    });
    if (!isTranslation) await this.resolvePromptImages(prompt);
    if (!isTranslation && prompt) await this.restoreLatestWritingAttempt(prompt);
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
    this.writingPageActive = true;
    page.syncTheme(this);
    const attemptId = String(this.data.currentAttemptId || '');
    if (attemptId && this.data.grading && this.data.prompt) {
      this.scheduleWritingResultPoll(attemptId, this.data.prompt, null, 1000);
    }
  },
  saveWritingSession(status, patch) {
    const promptId = String(this.data.prompt && this.data.prompt._id || '');
    if (!promptId) return;
    writeWritingSession(promptId, Object.assign({
      attemptId: this.data.currentAttemptId || '',
      essayText: this.data.essayText || '',
      submittedEssayText: this.data.submittedEssayText || '',
      essayDirty: !!this.data.essayDirty,
      status: status || (this.data.grading ? 'grading' : (this.data.review ? 'graded' : 'draft'))
    }, patch || {}));
  },
  scheduleWritingDraftSave() {
    if (this.writingDraftSaveTimer) clearTimeout(this.writingDraftSaveTimer);
    this.writingDraftSaveTimer = setTimeout(() => {
      this.writingDraftSaveTimer = null;
      this.saveWritingSession(this.data.grading ? 'grading' : 'draft');
    }, 250);
  },
  applyRestoredWritingAttempt(attempt, prompt, session) {
    if (!attempt || !prompt) return false;
    const attemptId = String(attempt.attemptId || attempt._id || '');
    const status = String(attempt.status || '');
    const pending = WRITING_PENDING_STATUSES.includes(status);
    const failed = status === 'grading-failed';
    const submittedEssayText = String(attempt.essay || session && session.submittedEssayText || '');
    const sessionEssayText = String(session && session.essayText || '');
    const preserveDraft = !!(session
      && sessionEssayText.trim() !== submittedEssayText.trim()
      && (session.essayDirty || !hasEssayContentChanged(sessionEssayText, submittedEssayText)));
    const essayText = preserveDraft ? String(session.essayText || '') : submittedEssayText;
    const review = status === 'graded' && attempt.review ? normalizeReview(attempt.review, prompt) : null;
    const essayDirty = preserveDraft && hasEssayContentChanged(essayText, submittedEssayText);
    this.setData({
      essayText,
      submittedEssayText,
      wordCount: countWords(essayText),
      currentAttemptId: attemptId,
      essayDirty,
      submitLocked: pending || (!failed && !essayDirty),
      grading: pending,
      gradingFailed: failed,
      review,
      errorText: pending
        ? text('gradingStatus', '作文已提交，正在批改。')
        : failed
          ? getWritingGradeFailureText(attempt.gradeError)
          : ''
    });
    this.saveWritingSession(status || (review ? 'graded' : 'draft'));
    if (pending) {
      if (status !== 'grading') {
        this.startWritingGradeAttemptOnce(attemptId, prompt, attempt);
      }
      this.scheduleWritingResultPoll(attemptId, prompt, attempt, 500);
    }
    return true;
  },
  async restoreLatestWritingAttempt(prompt) {
    const promptId = String(prompt && prompt._id || '');
    if (!promptId || this.restoredWritingPromptId === promptId) return;
    this.restoredWritingPromptId = promptId;
    const session = readWritingSession(promptId);
    if (session && session.essayText) {
      const essayText = String(session.essayText || '');
      this.setData({
        essayText,
        submittedEssayText: String(session.submittedEssayText || ''),
        wordCount: countWords(essayText),
        currentAttemptId: String(session.attemptId || ''),
        essayDirty: !!session.essayDirty,
        submitLocked: WRITING_PENDING_STATUSES.includes(session.status)
          || (session.status !== 'grading-failed' && !!session.attemptId && !session.essayDirty),
        grading: WRITING_PENDING_STATUSES.includes(session.status),
        gradingFailed: session.status === 'grading-failed',
        restoringAttempt: true
      });
    } else {
      this.setData({ restoringAttempt: true });
    }
    try {
      const result = await store.getWritingAttempts({
        promptId,
        limit: 10,
        summaryOnly: false,
        forceRefresh: true
      });
      const role = typeof store.getDeviceStudyRole === 'function' ? store.getDeviceStudyRole() : 'student';
      const attempts = Array.isArray(result && result.attempts) ? result.attempts : [];
      const latest = attempts.find((attempt) => (
        role === 'parent' ? attempt && attempt.isPreview : attempt && !attempt.isPreview
      )) || null;
      if (latest) {
        this.applyRestoredWritingAttempt(latest, prompt, session);
      } else if (session && session.attemptId) {
        this.scheduleWritingResultPoll(session.attemptId, prompt, null, 500);
      }
    } catch (error) {
      if (session && session.attemptId) {
        this.scheduleWritingResultPoll(session.attemptId, prompt, null, 1000);
      }
    } finally {
      this.setData({ restoringAttempt: false });
    }
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
    const submittedEssayText = String(this.data.submittedEssayText || '');
    const essayDirty = !!this.data.currentAttemptId
      ? hasEssayContentChanged(essayText, submittedEssayText)
      : !!essayText.trim();
    this.setData({
      essayText,
      wordCount: countWords(essayText),
      essayDirty,
      submitLocked: !!this.data.grading
        || (!!this.data.currentAttemptId && !this.data.gradingFailed && !essayDirty),
      gradingFailed: !!this.data.gradingFailed,
      errorText: essayDirty && this.data.currentAttemptId
        ? text('essayChanged', '内容已修改，需重新批改。')
        : ''
    });
    this.scheduleWritingDraftSave();
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
  finishWritingGrade(graded, prompt, fallbackAttempt) {
    const gradedAttempt = graded && graded.attempt || fallbackAttempt || {};
    const reviewSource = graded && graded.review || gradedAttempt.review;
    if (!reviewSource) {
      throw new Error('writing-review-missing');
    }
    const review = normalizeReview(reviewSource, prompt);
    const attemptId = gradedAttempt.attemptId || gradedAttempt._id || this.data.currentAttemptId || '';
    const submittedEssayText = String(gradedAttempt.essay || this.data.submittedEssayText || this.data.essayText || '');
    const essayDirty = !!this.data.essayDirty
      && hasEssayContentChanged(this.data.essayText, submittedEssayText);
    this.writingGradeResumeAttemptId = '';
    this.writingGradeResumeStartedAt = 0;
    this.setData({
      review,
      currentAttemptId: attemptId,
      submittedEssayText,
      grading: false,
      gradingFailed: false,
      essayDirty,
      submitLocked: !essayDirty,
      errorText: ''
    });
    this.saveWritingSession('graded', {
      attemptId,
      submittedEssayText,
      essayDirty
    });
    this.playWritingReviewEffect();
    if (!gradedAttempt.isPreview) {
      completed.addCompletedItem({
        id: `${completed.todayString()}:writing:${prompt._id}`,
        type: 'writing',
        targetId: prompt._id,
        title: prompt.title || '写作',
        meta: [prompt.year, prompt.district, prompt.examType].filter(Boolean).join(' · '),
        progressText: `${review.score}/${review.totalScore}${text('scoreUnit', ' 分')}`,
        latestAttempt: gradedAttempt,
        prompt
      });
    }
  },
  startWritingGradeAttemptOnce(attemptId, prompt, fallbackAttempt) {
    const id = String(attemptId || '');
    const activeAgeMs = Date.now() - Number(this.writingGradeResumeStartedAt || 0);
    if (!id || (this.writingGradeResumeAttemptId === id && activeAgeMs < 330000)) return;
    this.writingGradeResumeAttemptId = id;
    this.writingGradeResumeStartedAt = Date.now();
    store.gradeWritingAttempt(id).then((graded) => {
      if (!this.writingPageActive) return;
      if (graded && graded.syncMode === 'cloud-error') {
        throw createWritingCloudError(graded, 'gradeWritingAttempt');
      }
      if (graded && graded.attempt && graded.attempt.status === 'graded' && (graded.review || graded.attempt.review)) {
        this.finishWritingGrade(graded, prompt, fallbackAttempt);
        return;
      }
      this.scheduleWritingResultPoll(id, prompt, graded && graded.attempt || fallbackAttempt, 3000);
    }).catch((error) => {
      if (!this.writingPageActive) return;
      this.continueWritingResultPolling(id, prompt, fallbackAttempt, error);
    });
  },
  scheduleWritingResultPoll(attemptId, prompt, fallbackAttempt, delayMs = 10000) {
    if (this.writingResultPollTimer) clearTimeout(this.writingResultPollTimer);
    this.writingResultPollTimer = setTimeout(async () => {
      this.writingResultPollTimer = null;
      if (!this.writingPageActive) return;
      const result = await store.getWritingAttemptDetail(attemptId);
      if (!this.writingPageActive) return;
      if (result && result.syncMode !== 'cloud-error' && result.attempt) {
        if (result.attempt.status === 'graded' && result.attempt.review) {
          this.finishWritingGrade(result, prompt, fallbackAttempt);
          return;
        }
        if (result.attempt.status === 'grading-failed') {
          const error = new Error(result.attempt.gradeError || 'writing-grading-failed');
          const errorText = buildWritingSubmitError(error, 'getWritingAttemptDetail');
          console.error(errorText);
          this.writingGradeResumeAttemptId = '';
          this.writingGradeResumeStartedAt = 0;
          this.setData({
            grading: false,
            gradingFailed: true,
            submitLocked: false,
            errorText: getWritingGradeFailureText(result.attempt.gradeError)
          });
          this.saveWritingSession('grading-failed', { attemptId });
          return;
        }
        if (result.resumable) {
          this.setData({ grading: true, gradingFailed: false, submitLocked: true });
          this.saveWritingSession('grading', { attemptId });
          this.startWritingGradeAttemptOnce(attemptId, prompt, result.attempt || fallbackAttempt);
          this.scheduleWritingResultPoll(attemptId, prompt, result.attempt || fallbackAttempt, 3000);
          return;
        }
      }
      this.scheduleWritingResultPoll(attemptId, prompt, result && result.attempt || fallbackAttempt);
    }, delayMs);
  },
  continueWritingResultPolling(attemptId, prompt, fallbackAttempt, error) {
    console.error(buildWritingSubmitError(error, 'gradeWritingAttempt'));
    this.setData({
      grading: true,
      gradingFailed: false,
      submitLocked: true,
      errorText: text('gradingResumeStatus', '云端仍在批改。可以返回，完成后会出现在写作记录中。')
    });
    this.saveWritingSession('grading', { attemptId });
    this.scheduleWritingResultPoll(attemptId, prompt, fallbackAttempt, 5000);
  },
  async submitEssay() {
    const prompt = this.data.prompt;
    const essay = String(this.data.essayText || '').trim();
    if (this.writingSubmitInFlight || this.data.submitting) return;
    if (this.data.restoringAttempt) {
      wx.showToast({ title: text('restoringAttempt', '正在恢复上次批改'), icon: 'none' });
      return;
    }
    if (this.data.grading) {
      wx.showToast({ title: text('grading', '正在批改'), icon: 'none' });
      return;
    }
    if (this.data.currentAttemptId
      && !this.data.gradingFailed
      && !hasEssayContentChanged(essay, this.data.submittedEssayText)) {
      wx.showToast({ title: text('sameEssayResult', '内容未变化，保留上次结果'), icon: 'none' });
      return;
    }
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
    this.writingSubmitInFlight = true;
    this.reviewEffectPlayed = false;
    this.setData({
      submitting: true,
      submittedEssayText: essay,
      wordCount,
      essayDirty: false,
      submitLocked: true,
      gradingFailed: false,
      errorText: '',
      review: null,
      reviewCelebrating: false,
      currentAttemptId: '',
      bandSampleGeneratingDelta: 0,
      bandSampleError: ''
    });
    this.saveWritingSession('submitting', {
      attemptId: '',
      essayText: essay,
      submittedEssayText: essay,
      essayDirty: false
    });
    try {
      const result = await store.submitWritingAttempt({
        prompt,
        promptDisplay: this.data.promptDisplay,
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
        this.finishWritingGrade(result, prompt, attempt);
        return;
      }
      this.setData({
        currentAttemptId: attemptId,
        grading: true,
        gradingFailed: false,
        submitLocked: true,
        errorText: text('gradingStatus', '作文已提交，正在批改。')
      });
      this.saveWritingSession('grading', {
        attemptId,
        essayText: essay,
        submittedEssayText: essay,
        essayDirty: false
      });
      if (!attemptId) {
        throw new Error('missing-writing-attempt-id');
      }
      this.startWritingGradeAttemptOnce(attemptId, prompt, attempt);
      if (!attempt.isPreview) {
        completed.addCompletedItem({
          id: `${completed.todayString()}:writing:${prompt._id}`,
          type: 'writing',
          targetId: prompt._id,
          title: prompt.title || '写作',
          meta: [prompt.year, prompt.district, prompt.examType].filter(Boolean).join(' · '),
          progressText: text('grading', '批改中'),
          latestAttempt: attempt,
          prompt
        });
      }
    } catch (error) {
      const errorText = buildWritingSubmitError(error, 'submitWritingAttempt');
      console.error(errorText);
      this.setData({
        submitLocked: !!this.data.currentAttemptId,
        errorText
      });
      wx.showToast({ title: text('gradingSaved', '批改任务已保留'), icon: 'none' });
    } finally {
      this.writingSubmitInFlight = false;
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
      wx.showToast({ title: text('bandSampleFailedToast', '生成失败，可重试'), icon: 'none' });
    } finally {
      this.setData({ bandSampleGeneratingDelta: 0 });
    }
  },
  async downloadWritingReportPdf(event) {
    const attemptId = String(
      event && event.currentTarget && event.currentTarget.dataset.attemptId
      || this.data.currentAttemptId
      || ''
    );
    if (!attemptId || this.data.pdfGenerating) return;
    this.setData({ pdfGenerating: true });
    try {
      const result = await store.generateWritingReportPdf(attemptId);
      if (result && result.syncMode === 'cloud-error') {
        throw new Error(result.cloudError && result.cloudError.message || 'writing-report-generate-failed');
      }
      await openWritingReportPdf(result);
    } catch (error) {
      console.error('writing-report-pdf-failed', String(error && error.message || error || ''));
      wx.showToast({ title: text('pdfFailedToast', 'PDF 生成失败，请重试'), icon: 'none' });
    } finally {
      this.setData({ pdfGenerating: false });
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
    this.writingPageActive = false;
    if (this.writingDraftSaveTimer) {
      clearTimeout(this.writingDraftSaveTimer);
      this.writingDraftSaveTimer = null;
    }
    if (!this.data.isTranslation) this.saveWritingSession();
    if (this.writingResultPollTimer) {
      clearTimeout(this.writingResultPollTimer);
      this.writingResultPollTimer = null;
    }
    if (this.reviewEffectTimer) {
      clearTimeout(this.reviewEffectTimer);
      this.reviewEffectTimer = null;
    }
  }
});
