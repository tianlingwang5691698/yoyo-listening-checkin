const store = require('../../../utils/store');
const page = require('../../../utils/page');
const labels = require('../../../utils/labels');
const appConfig = require('../../../app-config');
const snapshotStore = require('../../../utils/snapshot');
const i18n = require('../../../utils/i18n');
const accountCatalog = require('../../../utils/i18n-catalog-account');
const LESSON_TASK_SNAPSHOT_KEY = 'lessonTaskSnapshotV1';
const LESSON_STUDY_PACK_SNAPSHOT_KEY = 'lessonStudyPackSnapshotV1';
function tr(key) { return i18n.getPageText('parentDetail', key); }
function buildTexts() { return Object.keys(accountCatalog.parentDetail['zh-CN']).reduce((texts, key) => { texts[key] = tr(key); return texts; }, {}); }
function formatText(text, values) { return Object.keys(values || {}).reduce((result, key) => result.replace(new RegExp(`\\{${key}\\}`, 'g'), values[key]), String(text || '')); }

function buildCloudFileId(cloudPath) {
  const normalizedPath = String(cloudPath || '').replace(/^\/+/, '');
  if (!normalizedPath || !appConfig.cloudEnvId || !appConfig.cloudBucket) {
    return '';
  }
  return `cloud://${appConfig.cloudEnvId}.${appConfig.cloudBucket}/${normalizedPath}`;
}

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

function getTodayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateLabel(dateKey) {
  const parts = String(dateKey || '').split('-').map(Number);
  const month = parts[1] || 0;
  const day = parts[2] || 0;
  return month && day ? formatText(tr('dateLabel'), { month, day }) : tr('detailTitle');
}

function formatClock(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildTimeLines(item) {
  const playMoments = Array.isArray(item.playMoments) ? item.playMoments : [];
  const lines = playMoments
    .map((value, index) => ({
      key: `${item.category}-${item.taskId || 'task'}-${index}`,
      label: formatText(tr('passNumber'), { count: index + 1 }),
      timeText: formatClock(value)
    }))
    .filter((entry) => entry.timeText);
  if (lines.length) {
    return lines;
  }
  if ((item.playCount || 0) > 0 && item.updatedAt) {
    const timeText = formatClock(item.updatedAt);
    if (timeText) {
      return [{
        key: `${item.category}-${item.taskId || 'task'}-latest`,
        label: tr('latestAttempt'),
        timeText
      }];
    }
  }
  return [];
}

function getProgressPercent(playCount, repeatTarget) {
  const total = Number(repeatTarget || 0);
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(playCount || 0) * 100) / total)));
}

function formatDuration(ms) {
  const seconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  return seconds ? formatText(tr('seconds'), { count: seconds }) : '';
}

function normalizeSpeakingAttempt(item, index) {
  const safeItem = item || {};
  const score = Number(safeItem.score || 0);
  const pronunciationScore = Number(safeItem.pronunciationFluencyScore || 0);
  const contentScore = Number(safeItem.contentGrammarScore || 0);
  return {
    key: safeItem.attemptId || `${safeItem.taskId || 'task'}-${safeItem.attemptIndex || index}-${safeItem.createdAt || index}`,
    title: safeItem.attemptType === 'unlock_sentence_repeat' ? tr('followRecording') : tr('answerRecording'),
    questionText: safeItem.questionText || tr('thisRecording'),
    studentTranscript: safeItem.studentTranscript || '',
    feedback: safeItem.feedback || '',
    score,
    pronunciationScore,
    contentScore,
    status: safeItem.status || '',
    scoreText: safeItem.status === 'score-pending' ? tr('scorePending') : (score ? formatText(tr('score'), { score }) : tr('saved')),
    scoreDetailText: (pronunciationScore || contentScore) ? formatText(tr('pronunciationContent'), { pronunciation: pronunciationScore || 0, content: contentScore || 0 }) : '',
    answerDurationText: formatDuration(safeItem.answerDurationMs),
    createdTimeText: formatClock(safeItem.createdAt),
    answerAudioFileId: safeItem.answerAudioFileId || '',
    answerCloudPath: safeItem.answerCloudPath || ''
  };
}

function buildSpeakingSummary(attempts) {
  const scored = (attempts || []).filter((item) => Number(item.score || 0) > 0);
  const total = scored.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const averageScore = scored.length ? Math.round(total / scored.length) : 0;
  return {
    totalCount: (attempts || []).length,
    scoredCount: scored.length,
    averageScore,
    latestScore: scored.length ? Number(scored[scored.length - 1].score || 0) : 0
  };
}

function getCompletionTypeLabel(type) {
  if (type === 'reading' || type === 'reading-study') return tr('reading');
  if (type === 'listening' || type === 'listening-study') return tr('listening');
  if (type === 'grammar') return tr('grammar');
  if (type === 'writing') return tr('writing');
  if (type === 'vocabulary') return tr('vocabulary');
  return tr('complete');
}

function getArchiveModuleLabel(key) {
  if (key === 'speaking') return tr('speaking');
  return getCompletionTypeLabel(key);
}

function isListeningStudyCompletion(item) {
  const source = item || {};
  const id = String(source.id || source.recordId || '').trim();
  return source.type === 'listening-study'
    || id.indexOf('listening-study:') === 0
    || source.title === '听力学习包';
}

function getArchiveModuleKey(item) {
  const type = String((item && item.type) || '');
  if (isListeningStudyCompletion(item)) return 'listening';
  if (type === 'reading' || type === 'reading-study') return 'reading';
  if (['vocabulary', 'grammar', 'writing'].includes(type)) return type;
  return '';
}

function getArchiveModuleTypes(key) {
  if (key === 'listening') return ['listening', 'listening-study'];
  if (key === 'reading') return ['reading', 'reading-study'];
  return [key];
}

function buildArchiveModules(report) {
  const safeReport = report || {};
  const counts = {};
  (safeReport.completionItems || []).forEach((item) => {
    const key = getArchiveModuleKey(item);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  if ((safeReport.speakingAttempts || []).length) {
    counts.speaking = safeReport.speakingAttempts.length;
  }
  return ['listening', 'speaking', 'vocabulary', 'reading', 'grammar', 'writing']
    .filter((key) => counts[key] > 0)
    .map((key) => ({
      key,
      label: getArchiveModuleLabel(key),
      count: counts[key],
      countText: formatText(tr('recordCount'), { count: counts[key] })
    }));
}

function parseListeningStudyTarget(item) {
  const source = item || {};
  const rawId = String(source.id || source.recordId || '').replace(/^listening-study:/, '');
  const targetId = String(source.targetId || rawId || '').trim();
  const parts = targetId.split(':').filter(Boolean);
  return {
    category: source.category || parts[0] || '',
    taskId: source.taskId || parts[1] || ''
  };
}

function writeListeningStudySnapshot(item) {
  const source = item || {};
  const target = parseListeningStudyTarget(source);
  const category = String(source.category || target.category || '').trim();
  const taskId = String(source.taskId || target.taskId || '').trim();
  if (!category || !taskId) return false;
  const task = Object.assign({}, source.taskSnapshot || {}, {
    category,
    taskId,
    title: source.meta || source.title || source.targetId || tr('listeningCourse'),
    displayTitle: source.meta || source.title || source.targetId || tr('listeningCourse'),
    audioTitle: source.meta || source.title || source.targetId || tr('listeningCourse'),
    audioUrl: source.audioUrl || (source.taskSnapshot && source.taskSnapshot.audioUrl) || '',
    audioCloudPath: source.audioCloudPath || (source.taskSnapshot && source.taskSnapshot.audioCloudPath) || '',
    audioFileId: source.audioFileId || (source.taskSnapshot && source.taskSnapshot.audioFileId) || buildCloudFileId(source.audioCloudPath || (source.taskSnapshot && source.taskSnapshot.audioCloudPath) || ''),
    audioSource: source.audioSource || (source.taskSnapshot && source.taskSnapshot.audioSource) || '',
    completedToday: true,
    playCount: 1,
    repeatTarget: 1,
    currentPass: 1,
    textUnlocked: true,
    transcriptVisible: true
  });
  return snapshotStore.write(LESSON_TASK_SNAPSHOT_KEY, `${category}:${taskId}`, {
    category,
    taskId,
    task
  }, { source: 'parent-detail-listening-study' });
}

function hasCompleteStudyPackCards(studyPack) {
  return studyPack
    && (studyPack.vocabularyCards || []).length
    && (studyPack.phraseCards || []).length
    && (studyPack.sentencePatternCards || []).length;
}

function itemHasCompleteStudyPack(item) {
  const review = item && item.latestAttempt && item.latestAttempt.review || {};
  return hasCompleteStudyPackCards(review);
}

function getListeningStudyCacheIds(item) {
  const source = item || {};
  const target = parseListeningStudyTarget(source);
  const ids = [
    target.category && target.taskId ? `lesson-${target.category}-${target.taskId}` : '',
    source.targetId,
    String(source.id || source.recordId || '').replace(/^listening-study:/, '')
  ].map((value) => String(value || '').trim()).filter(Boolean);
  return Array.from(new Set(ids));
}

async function writeListeningStudyPackSnapshot(item) {
  const source = item || {};
  const target = parseListeningStudyTarget(source);
  const category = String(source.category || target.category || '').trim();
  const taskId = String(source.taskId || target.taskId || '').trim();
  if (!category || !taskId) return false;
  const cacheIds = getListeningStudyCacheIds(source);
  for (let index = 0; index < cacheIds.length; index += 1) {
    const cacheId = cacheIds[index];
    try {
      const result = await store.getListeningStudyPack({
        _id: cacheId,
        id: cacheId,
        title: source.meta || source.title || source.targetId || tr('listeningCourse')
      }, { cacheOnly: true, useCache: false });
      const studyPack = result && result.studyPack;
      if (hasCompleteStudyPackCards(studyPack)) {
        return snapshotStore.write(LESSON_STUDY_PACK_SNAPSHOT_KEY, `${category}:${taskId}`, {
          studyPack,
          listeningId: cacheId
        }, { source: 'parent-detail-listening-study-pack' });
      }
    } catch (error) {}
  }
  return false;
}

function normalizePhraseCards(cards) {
  return (cards || []).map((card, index) => ({
    key: card.id || card.phrase || card.text || `phrase-${index}`,
    phrase: card.phrase || card.text || '',
    meaning: card.meaning || card.translation || '',
    example: card.example || '',
    exampleMeaning: card.exampleMeaning || card.exampleTranslation || ''
  }));
}

function normalizeArchiveTitle(item) {
  const safeItem = item || {};
  const title = String(safeItem.title || safeItem.meta || tr('completionRecord')).trim();
  if (safeItem.type !== 'vocabulary') return title;
  if (title === '词汇复习') return tr('dailyReview');
  return title.replace(/\s*词汇表\s*$/, '').trim() || tr('dailyReview');
}

function getArchiveRecordLabel(item, isListeningStudyPack) {
  const safeItem = item || {};
  if (safeItem.type === 'grammar' && safeItem.section === 'micro-lesson') {
    return tr('grammarMicroLesson');
  }
  if (safeItem.type === 'vocabulary') {
    return safeItem.section === 'dictation' ? tr('dictation') : tr('memorization');
  }
  if (isListeningStudyPack || safeItem.type === 'reading-study') return tr('studyPack');
  return '';
}

function getArchiveMeta(item, recordLabel) {
  const safeItem = item || {};
  const meta = String(safeItem.meta || '').trim();
  const generic = [
    getCompletionTypeLabel(safeItem.type),
    tr('vocabulary'),
    '词汇听写',
    recordLabel
  ].filter(Boolean);
  return generic.includes(meta) ? '' : meta;
}

function getVocabularyProgressText(item, latestAttempt) {
  const safeItem = item || {};
  const attempt = latestAttempt || {};
  if (safeItem.section === 'dictation') {
    const total = Number(attempt.totalCount || attempt.answeredCount || 0);
    const correct = Number(attempt.correctCount || 0);
    const wrong = Number(attempt.wrongCount || Math.max(0, total - correct));
    return formatText(tr('dictationProgress'), { correct, total, wrong });
  }
  return formatText(tr('memorizationProgress'), {
    reviewed: Number(attempt.reviewed || 0),
    unfamiliar: Number(attempt.unfamiliar || 0)
  });
}

function isPlaceholderAnalysis(value) {
  return !String(value || '').trim() || String(value || '').includes('生成解析中');
}

function readingCompletionNeedsHydration(item) {
  if (!item || item.type !== 'reading') return false;
  const questions = Array.isArray(item.readingQuestions) ? item.readingQuestions : [];
  const analysesReady = questions.length > 0
    && questions.every((question) => !isPlaceholderAnalysis(question.analysis));
  return !item.passage
    || !analysesReady
    || !(Array.isArray(item.phraseCards) && item.phraseCards.length);
}

function mergeStudyPackIntoAttempt(attempt, studyPack) {
  const nextAttempt = Object.assign({}, attempt || {});
  const review = Object.assign({}, nextAttempt.review || {});
  const pack = studyPack || {};
  const analyses = pack.questionAnalyses || pack.analysis || [];
  const answerSentenceByNumber = analyses.reduce((map, item) => {
    if (item && item.number !== undefined && item.answerSentence) {
      map[String(item.number)] = {
        number: item.number,
        text: item.answerSentence,
        translation: item.answerSentenceTranslation || ''
      };
    }
    return map;
  }, {});
  const analysisByNumber = analyses.reduce((map, item) => {
    if (item && item.number !== undefined && item.number !== null) {
      map[String(item.number)] = item;
    }
    return map;
  }, {});
  const currentAnalysis = Array.isArray(review.analysis) ? review.analysis : [];
  review.analysis = currentAnalysis.length ? currentAnalysis.map((item) => {
    const model = analysisByNumber[String(item.number)] || {};
    return Object.assign({}, item, {
      answer: item.answer || model.answer || '',
      answerSentence: answerSentenceByNumber[String(item.number)] || item.answerSentence || null,
      text: isPlaceholderAnalysis(item.text || item.analysis || item.explanation) && model.analysis ? model.analysis : (item.text || item.analysis || item.explanation || '')
    });
  }) : analyses.map((item) => ({
    number: item.number,
    answer: item.answer || '',
    selected: item.selected || '',
    correct: item.correct,
    answerSentence: answerSentenceByNumber[String(item.number)] || null,
    text: item.analysis || ''
  }));
  review.phraseCards = pack.phraseCards || review.phraseCards || [];
  review.vocabularyCards = pack.vocabularyCards || review.vocabularyCards || [];
  review.sentencePatternCards = pack.sentencePatternCards || review.sentencePatternCards || [];
  nextAttempt.review = review;
  return nextAttempt;
}

function normalizeCompletionItem(item, index) {
  const safeItem = item || {};
  const isGrammarMicroLesson = safeItem.type === 'grammar' && safeItem.section === 'micro-lesson';
  const isListeningStudyPack = isListeningStudyCompletion(safeItem);
  const listeningTarget = isListeningStudyPack ? parseListeningStudyTarget(safeItem) : {};
  const latestAttempt = safeItem.latestAttempt || {};
  const review = latestAttempt.review || {};
  const questionResults = Array.isArray(latestAttempt.questionResults) ? latestAttempt.questionResults : [];
  const correctCount = Number(latestAttempt.correctCount || 0);
  const totalCount = Number(latestAttempt.totalCount || questionResults.length || 0);
  const score = Number(latestAttempt.score || review.score || 0);
  const totalScore = Number(latestAttempt.totalScore || review.totalScore || 0);
  const reviewProblems = Array.isArray(review.problems) ? review.problems : [];
  const reviewSuggestions = Array.isArray(review.suggestions) ? review.suggestions : [];
  const grammarQuestions = Array.isArray(latestAttempt.questions) ? latestAttempt.questions : [];
  const passage = latestAttempt.passage || null;
  const phraseCards = normalizePhraseCards(review.phraseCards || review.phrases || []);
  const readingAnalysisByNumber = (Array.isArray(review.analysis) ? review.analysis : []).reduce((map, analysis) => {
    if (analysis && analysis.number !== undefined && analysis.number !== null) {
      map[String(analysis.number)] = analysis;
    }
    return map;
  }, {});
  const readingResultByNumber = questionResults.reduce((map, result) => {
    if (result && result.number !== undefined && result.number !== null) {
      map[String(result.number)] = result;
    }
    return map;
  }, {});
  const passageQuestions = passage && Array.isArray(passage.questions) ? passage.questions : [];
  const readingQuestions = (passageQuestions.length ? passageQuestions : questionResults).map((question, questionIndex) => {
    const number = question.number || questionIndex + 1;
    const result = readingResultByNumber[String(number)] || {};
    const analysis = readingAnalysisByNumber[String(number)] || result || {};
    const analysisText = analysis.text || analysis.analysis || analysis.explanation || '';
    return {
      key: `${safeItem.id || safeItem.recordId || index}-reading-${number}`,
      number,
      prompt: question.prompt || result.prompt || '',
      optionsList: Object.keys(question.options || {}).map((key) => ({
        key,
        text: question.options[key]
      })),
      selectedAnswer: result.selected || result.userAnswer || '',
      answer: result.answer || question.answer || '',
      correct: result.correct,
      analysis: isPlaceholderAnalysis(analysisText) ? '' : analysisText,
      answerSentence: analysis.answerSentence || null
    };
  });
  const isVocabulary = safeItem.type === 'vocabulary';
  const recordLabel = getArchiveRecordLabel(safeItem, isListeningStudyPack);
  return Object.assign({}, safeItem, {
    key: safeItem.id || safeItem.recordId || `${safeItem.type || 'item'}-${index}`,
    typeLabel: getCompletionTypeLabel(safeItem.type),
    recordLabel,
    isVocabulary,
    isGrammarMicroLesson,
    isListeningStudyPack,
    category: safeItem.category || listeningTarget.category || '',
    taskId: safeItem.taskId || listeningTarget.taskId || '',
    title: normalizeArchiveTitle(safeItem),
    displayMeta: getArchiveMeta(safeItem, recordLabel),
    progressText: isVocabulary
      ? getVocabularyProgressText(safeItem, latestAttempt)
      : (safeItem.progressText || (totalScore ? formatText(tr('scoreFraction'), { score, total: totalScore }) : tr('complete'))),
    detailActionText: isListeningStudyPack ? tr('viewStudyPack') : tr('viewOriginalAnalysis'),
    scoreText: totalScore ? formatText(tr('scoreFraction'), { score, total: totalScore }) : '',
    correctText: !isVocabulary && !isGrammarMicroLesson && totalCount
      ? formatText(tr('questionCount'), { correct: correctCount, total: totalCount })
      : '',
    reviewSummary: review.summary || review.feedback || '',
    reviewContent: review.content || '',
    reviewLanguage: review.language || '',
    reviewStructure: review.structure || '',
    reviewSpelling: review.spelling || '',
    reviewProblems,
    reviewProblemsText: reviewProblems.join('；'),
    reviewSuggestions,
    reviewSuggestionsText: reviewSuggestions.join('；'),
    phraseCards,
    grammarCorrections: Array.isArray(review.grammarCorrections) ? review.grammarCorrections : [],
    polishedVersion: review.polishedVersion || '',
    passage,
    writingPrompt: latestAttempt.prompt || safeItem.prompt || null,
    essay: latestAttempt.essay || '',
    readingQuestions,
    grammarQuestions: grammarQuestions.map((question, questionIndex) => ({
      key: question._id || `${safeItem.id || index}-${questionIndex}`,
      number: question.number || questionIndex + 1,
      prompt: question.prompt || '',
      optionsList: Object.keys(question.options || {}).map((key) => ({
        key,
        text: question.options[key]
      })),
      selectedAnswer: question.selectedAnswer || '',
      answer: question.answer || '',
      isCorrect: !!question.isCorrect,
      explanation: question.explanation || null
    })),
    questionResults: questionResults.slice(0, 8).map((result, resultIndex) => ({
      key: `${safeItem.id || safeItem.recordId || index}-${resultIndex}`,
      number: result.number || resultIndex + 1,
      correct: !!result.correct,
      answer: result.answer || '',
      userAnswer: result.userAnswer || '',
      analysis: result.analysis || result.explanation || '',
      answerSentence: result.answerSentence || null
    }))
  });
}

function shouldShowCompletionItem(item) {
  const type = String((item && item.type) || '');
  if (isListeningStudyCompletion(item)) return itemHasCompleteStudyPack(item);
  return ['reading', 'reading-study', 'grammar', 'writing', 'vocabulary'].includes(type);
}

async function listeningStudyHasCompletePack(item) {
  if (!isListeningStudyCompletion(item)) return false;
  if (itemHasCompleteStudyPack(item)) return true;
  const cacheIds = getListeningStudyCacheIds(item);
  for (let index = 0; index < cacheIds.length; index += 1) {
    const cacheId = cacheIds[index];
    try {
      const result = await store.getListeningStudyPack({
        _id: cacheId,
        id: cacheId,
        title: item.meta || item.title || item.targetId || tr('listeningCourse')
      }, { cacheOnly: true, useCache: false });
      if (hasCompleteStudyPackCards(result && result.studyPack)) return true;
    } catch (error) {}
  }
  return false;
}

async function filterVisibleCompletionItems(items) {
  const checks = await Promise.all((items || []).map(async (item) => {
    if (isListeningStudyCompletion(item)) {
      return await listeningStudyHasCompletePack(item);
    }
    return shouldShowCompletionItem(item);
  }));
  return (items || []).filter((item, index) => checks[index]);
}

async function hydrateReadingItems(items) {
  const nextItems = await Promise.all((items || []).map(async (item) => {
    if (!readingCompletionNeedsHydration(item) || !item.passageId) {
      return item;
    }
    try {
      const attemptId = item.latestAttempt && (item.latestAttempt.attemptId || item.latestAttempt._id) || '';
      const [passageData, packData] = await Promise.all([
        store.getReadingPassage({ passageId: item.passageId, attemptId }),
        store.getReadingStudyPack({ passageId: item.passageId, section: 'questions', cacheOnly: false, attemptId, useCache: false })
      ]);
      const baseAttempt = item.latestAttempt || (passageData && passageData.latestAttempt) || {};
      const latestAttempt = packData && packData.studyPack
        ? mergeStudyPackIntoAttempt(baseAttempt, packData.studyPack)
        : baseAttempt;
      return normalizeCompletionItem(Object.assign({}, item, {
        latestAttempt: Object.assign({}, latestAttempt, {
          passage: (passageData && passageData.passage) || null
        })
      }), 0);
    } catch (error) {
      return item;
    }
  }));
  return nextItems;
}

async function hydrateReadingStudyItems(items) {
  const nextItems = await Promise.all((items || []).map(async (item) => {
    if (item.type !== 'reading-study' || item.phraseCards && item.phraseCards.length || !item.passageId) {
      return item;
    }
    try {
      const section = item.section || 'phrases';
      const data = await store.getReadingStudyPack({ passageId: item.passageId, section, cacheOnly: true, useCache: false });
      const latestAttempt = mergeStudyPackIntoAttempt(item.latestAttempt || {}, data.studyPack || {});
      return normalizeCompletionItem(Object.assign({}, item, { latestAttempt }), 0);
    } catch (error) {
      return item;
    }
  }));
  return nextItems;
}

async function hydrateGrammarItems(items) {
  const nextItems = await Promise.all((items || []).map(async (item) => {
    if (item.type !== 'grammar' || !item.topicId) {
      return item;
    }
    try {
      let questions = (item.latestAttempt && item.latestAttempt.questions) || [];
      let totalCount = Number((item.latestAttempt && item.latestAttempt.totalCount) || questions.length);
      if (!questions.length) {
        const data = await store.getGrammarTopic(item.topicId);
        const count = Number((item.latestAttempt && item.latestAttempt.answeredCount) || 3);
        totalCount = (data.questions || []).length;
        questions = (data.questions || []).slice(0, count).map((question, index) => ({
          _id: question._id || '',
          number: question.number || index + 1,
          prompt: question.prompt || '',
          options: question.options || {},
          selectedAnswer: '',
          answer: question.answer || '',
          isCorrect: false,
          explanation: null
        }));
      }
      const hydratedQuestions = await Promise.all(questions.map(async (question) => {
        if (question.explanation && question.explanation.explanation && question.explanation.source !== 'fallback') {
          return question;
        }
        const result = await store.explainGrammarQuestion(question, { cacheOnly: false });
        const explanation = result && result.explanation;
        return explanation && explanation.explanation && String(result.source || '').indexOf('fallback') !== 0
          ? Object.assign({}, question, { explanation })
          : question;
      }));
      return normalizeCompletionItem(Object.assign({}, item, {
        latestAttempt: Object.assign({}, item.latestAttempt || {}, {
          questions: hydratedQuestions,
          totalCount
        })
      }), 0);
    } catch (error) {
      return item;
    }
  }));
  return nextItems;
}

function findWritingPrompt(materialIndex, promptId) {
  const all = [].concat((materialIndex || {}).writingEm2 || [], (materialIndex || {}).writingEm1 || []);
  return all.find((item) => item && item._id === promptId) || null;
}

async function hydrateWritingItems(items) {
  const needsPrompt = (items || []).some((item) => item.type === 'writing' && !item.writingPrompt && item.targetId);
  try {
    const materialIndex = needsPrompt ? await store.getMaterialIndex({ moduleId: 'writing' }) : null;
    return await Promise.all((items || []).map(async (item) => {
      if (item.type !== 'writing') {
        return item;
      }
      const baseAttempt = item.latestAttempt || {};
      const attemptId = baseAttempt.attemptId || baseAttempt._id || '';
      const needsReview = attemptId && (!baseAttempt.review || !baseAttempt.review.summary
        || ['grading-pending', 'grading', 'grading-failed'].includes(baseAttempt.status));
      const detail = needsReview ? await store.getWritingAttemptDetail(attemptId) : null;
      const latestAttempt = detail && detail.attempt ? detail.attempt : baseAttempt;
      const prompt = item.writingPrompt || (materialIndex ? findWritingPrompt(materialIndex, item.targetId) : null);
      return normalizeCompletionItem(Object.assign({}, item, {
        latestAttempt: Object.assign({}, latestAttempt, { prompt: latestAttempt.prompt || prompt })
      }), 0);
    }));
  } catch (error) {
    return items;
  }
}

function needsCompletionHydration(item) {
  if (!item) return false;
  if (item.type === 'reading' && item.passageId) return readingCompletionNeedsHydration(item);
  if (item.type === 'reading-study' && !(item.phraseCards && item.phraseCards.length) && item.passageId) return true;
  if (item.type === 'grammar' && item.topicId && !item.isGrammarMicroLesson) {
    return !(item.grammarQuestions && item.grammarQuestions.length)
      || item.grammarQuestions.some((question) => !question.explanation || !question.explanation.explanation || question.explanation.source === 'fallback');
  }
  if (item.type === 'writing' && item.targetId) {
    return !item.writingPrompt || !item.latestAttempt || !item.latestAttempt.review || !item.latestAttempt.review.summary
      || ['grading-pending', 'grading', 'grading-failed'].includes(item.latestAttempt.status);
  }
  return false;
}

async function hydrateCompletionItem(item) {
  const items = await hydrateWritingItems(await hydrateGrammarItems(await hydrateReadingStudyItems(await hydrateReadingItems([item]))));
  return items[0] || item;
}

function normalizeReport(report) {
  const safeReport = report || {};
  const completionItems = (safeReport.completionItems || []).filter(shouldShowCompletionItem).map(normalizeCompletionItem);
  const grammarMicroLessonTaskIds = new Set(completionItems
    .filter((item) => item.isGrammarMicroLesson)
    .map((item) => item.taskId)
    .filter(Boolean));
  const items = (safeReport.items || [])
    .filter((item) => !(item.category === 'grammar' && grammarMicroLessonTaskIds.has(item.taskId)))
    .map((item) => Object.assign({}, labels.normalizeReportItem(item), {
    timeLines: buildTimeLines(item),
    progressPercent: getProgressPercent(item.playCount, item.repeatTarget)
  }));
  const speakingAttempts = (safeReport.speakingAttempts || []).map(normalizeSpeakingAttempt);
  const speakingSummary = buildSpeakingSummary(speakingAttempts);
  const completedCount = items.filter((item) => item.completedToday).length;
  const completionItemCount = Number(safeReport.completionItemCount || completionItems.length);
  return {
    date: safeReport.date || '',
    dateLabel: formatDateLabel(safeReport.date),
    totalMinutes: safeReport.totalMinutes || 0,
    completedCount: completedCount + completionItemCount,
    totalCount: items.length + completionItemCount,
    items,
    speakingAttempts,
    speakingSummary,
    archiveModules: buildArchiveModules(safeReport),
    completionItems
  };
}

Page({
  data: page.createCloudPageData({
    date: '',
    report: {
      date: '',
      dateLabel: '',
      totalMinutes: 0,
      completedCount: 0,
      totalCount: 0,
      items: [],
      speakingAttempts: [],
      speakingSummary: {
        totalCount: 0,
        scoredCount: 0,
        averageScore: 0,
        latestScore: 0
      },
      archiveModules: [],
      completionItems: []
    },
    playingAttemptKey: '',
    pausedAttemptKey: '',
    loadingAttemptKey: '',
    activeArchiveModule: '',
    activeArchiveModuleLabel: '',
    archiveModuleLoading: false,
    texts: buildTexts(),
    language: i18n.getLanguage()
  }),
  onLoad(options) {
    this.audioContext = wx.createInnerAudioContext();
    this.audioContext.obeyMuteSwitch = false;
    this.audioContext.onPlay(() => {
      this.setData({ loadingAttemptKey: '', pausedAttemptKey: '' });
    });
    this.audioContext.onCanplay(() => {
      this.setData({ loadingAttemptKey: '' });
    });
    this.audioContext.onWaiting(() => {
      if (this.data.playingAttemptKey) {
        this.setData({ loadingAttemptKey: this.data.playingAttemptKey });
      }
    });
    this.audioContext.onPause(() => {
      this.setData({
        pausedAttemptKey: this.data.playingAttemptKey,
        loadingAttemptKey: ''
      });
    });
    this.audioContext.onEnded(() => {
      this.setData({ playingAttemptKey: '', pausedAttemptKey: '', loadingAttemptKey: '' });
    });
    this.audioContext.onStop(() => {
      this.setData({ playingAttemptKey: '', pausedAttemptKey: '', loadingAttemptKey: '' });
    });
    this.audioContext.onError(() => {
      this.setData({ playingAttemptKey: '', pausedAttemptKey: '', loadingAttemptKey: '' });
      wx.showToast({ title: this.data.texts.recordingPlaybackFailed, icon: 'none' });
    });
    const date = String((options && options.date) || '').slice(0, 10) || getTodayKey();
    this.setData({ date });
    wx.setNavigationBarTitle({
      title: formatDateLabel(date)
    });
  },
  onUnload() {
    if (this.audioContext) {
      this.audioContext.destroy();
      this.audioContext = null;
    }
  },
  applyReportData(reportData) {
    const report = normalizeReport(reportData && reportData.report);
    const currentCompletionItems = this.data.report.completionItems || [];
    const currentSpeakingAttempts = this.data.report.speakingAttempts || [];
    const currentSpeakingSummary = this.data.report.speakingSummary || {};
    this.setData(page.buildCloudPageData(this.data, {
      date: this.data.date,
      report: Object.assign({}, report, {
        speakingAttempts: this.data.activeArchiveModule === 'speaking' ? currentSpeakingAttempts : report.speakingAttempts,
        speakingSummary: this.data.activeArchiveModule === 'speaking' ? currentSpeakingSummary : report.speakingSummary,
        completionItems: this.data.activeArchiveModule && this.data.activeArchiveModule !== 'speaking' ? currentCompletionItems : []
      })
    }));
  },
  onShow() {
    this.parentDetailPerf = page.startPagePerf('parent-detail');
    page.syncTheme(this);
    const texts = buildTexts();
    this.setData({ texts, language: i18n.getLanguage() });
    wx.setNavigationBarTitle({ title: this.data.date ? formatDateLabel(this.data.date) : texts.navTitle });
    if (!page.requireIdentityConfirmed()) {
      wx.nextTick(() => {
        if (!this.parentDetailPerf) return;
        this.parentDetailPerf.ready('pageReady', {
          source: 'identity-blocked',
          cacheHit: true,
          date: this.data.date
        });
      });
      return;
    }
    const target = store.getSelectedStudentTarget ? store.getSelectedStudentTarget() : {};
    const cached = store.getCachedReadResult
      ? store.getCachedReadResult('getDailyReportByDate', Object.assign({ date: this.data.date, summaryOnly: true }, target))
      : null;
    if (cached) {
      this.applyReportData(cached);
      this.parentDetailPerf.ready('pageReady', {
        source: 'cache',
        cacheHit: true,
        date: this.data.date
      });
    } else {
      wx.nextTick(() => {
        if (!this.parentDetailPerf) return;
        this.parentDetailPerf.ready('pageReady', {
          source: 'fallback',
          cacheHit: false,
          date: this.data.date
        });
      });
    }
    store.getDailyReportByDate(this.data.date, (fresh) => {
      this.applyReportData(fresh);
      if (this.parentDetailPerf) {
        this.parentDetailPerf.mark('cloudRefresh', { date: this.data.date });
      }
    }, { summaryOnly: true }).then((reportData) => {
      this.applyReportData(reportData);
      if (!cached && this.parentDetailPerf) {
        this.parentDetailPerf.mark('cloudRefresh', {
          source: reportData && reportData.__cacheHit ? 'cache' : (reportData && reportData.syncMode === 'cloud-error' ? 'error' : 'cloud'),
          cacheHit: !!(reportData && reportData.__cacheHit),
          date: this.data.date
        });
      }
      if (reportData && !reportData.__cacheHit && reportData.syncMode !== 'cloud-error' && this.parentDetailPerf) {
        this.parentDetailPerf.mark('cloudRefresh', { date: this.data.date });
      }
    }).catch(() => {});
  },
  async loadArchiveModule(event) {
    const key = String((event && event.currentTarget && event.currentTarget.dataset.key) || '');
    if (!key) return;
    if (this.data.activeArchiveModule === key) {
      this.archiveModuleRequestKey = '';
      this.setData({
        activeArchiveModule: '',
        activeArchiveModuleLabel: '',
        archiveModuleLoading: false,
        'report.completionItems': []
      });
      return;
    }
    const targetModule = (this.data.report.archiveModules || []).find((item) => item.key === key);
    const label = targetModule ? targetModule.label : getArchiveModuleLabel(key);
    this.setData({
      activeArchiveModule: key,
      activeArchiveModuleLabel: label,
      archiveModuleLoading: true,
      'report.completionItems': []
    });
    const requestKey = `${this.data.date}:${key}:${Date.now()}`;
    this.archiveModuleRequestKey = requestKey;
    if (key === 'speaking') {
      const applySpeakingAttempts = (data) => {
        if (this.archiveModuleRequestKey !== requestKey || this.data.activeArchiveModule !== key) return;
        const speakingAttempts = ((data && data.attempts) || []).map(normalizeSpeakingAttempt);
        this.setData({
          archiveModuleLoading: false,
          'report.speakingAttempts': speakingAttempts,
          'report.speakingSummary': buildSpeakingSummary(speakingAttempts)
        });
      };
      try {
        const data = await store.getSpeakingAttempts({ targetDate: this.data.date }, applySpeakingAttempts);
        applySpeakingAttempts(data);
      } catch (error) {
        if (this.archiveModuleRequestKey !== requestKey) return;
        this.setData({ archiveModuleLoading: false });
        wx.showToast({ title: this.data.texts.recordLoadFailed, icon: 'none' });
      }
      return;
    }
    const applyCompletionItems = async (items) => {
      const visibleItems = (await filterVisibleCompletionItems(items || []))
        .filter((item) => getArchiveModuleKey(item) === key);
      if (this.archiveModuleRequestKey !== requestKey || this.data.activeArchiveModule !== key) return;
      const report = this.data.report || {};
      this.setData(page.buildCloudPageData(this.data, {
        archiveModuleLoading: false,
        report: Object.assign({}, report, {
          completionItems: visibleItems.map(normalizeCompletionItem)
        })
      }));
    };
    try {
      const data = await store.getStudyCompletions({
        date: this.data.date,
        types: getArchiveModuleTypes(key)
      }, (fresh) => applyCompletionItems(fresh.items || []));
      await applyCompletionItems((data && data.items) || []);
    } catch (error) {
      if (this.archiveModuleRequestKey !== requestKey) return;
      this.setData({ archiveModuleLoading: false });
      wx.showToast({ title: this.data.texts.recordLoadFailed, icon: 'none' });
    }
  },
  async toggleCompletionDetail(event) {
    const key = event.currentTarget.dataset.key || '';
    if (!key) return;
    const current = (this.data.report.completionItems || []).find((item) => item.key === key);
    if (current && current.isListeningStudyPack) {
      if (!current.category || !current.taskId) {
        wx.showToast({ title: this.data.texts.taskLocationMissing, icon: 'none' });
        return;
      }
      writeListeningStudySnapshot(current);
      await writeListeningStudyPackSnapshot(current);
      wx.navigateTo({
        url: `/pages/lesson/index?category=${encodeURIComponent(current.category)}&taskId=${encodeURIComponent(current.taskId)}&focus=study&studyPackDone=1&targetDate=${encodeURIComponent(this.data.date || '')}`
      });
      return;
    }
    const willExpand = current ? !current.expanded : false;
    const shouldHydrate = willExpand && needsCompletionHydration(current);
    const items = (this.data.report.completionItems || []).map((item) => Object.assign({}, item, {
      expanded: item.key === key ? willExpand : item.expanded,
      detailLoading: item.key === key ? shouldHydrate : false
    }));
    this.setData({
      report: Object.assign({}, this.data.report, { completionItems: items })
    });
    if (!shouldHydrate) return;
    const hydrated = Object.assign({}, await hydrateCompletionItem(current), {
      expanded: true,
      detailLoading: false
    });
    const latest = (this.data.report.completionItems || []).find((item) => item.key === key);
    if (!latest || !latest.expanded) return;
    this.setData({
      report: Object.assign({}, this.data.report, {
        completionItems: (this.data.report.completionItems || []).map((item) => (
          item.key === key ? hydrated : item
        ))
      })
    });
  },
  async playSpeakingAttempt(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const attempt = (this.data.report.speakingAttempts || [])[index] || null;
    if (!attempt || !this.audioContext) {
      return;
    }
    if (this.data.playingAttemptKey === attempt.key) {
      if (this.data.pausedAttemptKey === attempt.key) {
        this.setData({ loadingAttemptKey: attempt.key });
        this.audioContext.play();
      } else {
        this.setData({ loadingAttemptKey: '' });
        this.audioContext.pause();
      }
      return;
    }
    const fileId = String(attempt.answerAudioFileId || buildCloudFileId(attempt.answerCloudPath)).trim();
    if (!fileId) {
      wx.showToast({ title: this.data.texts.recordingUnavailable, icon: 'none' });
      return;
    }
    this.setData({ loadingAttemptKey: attempt.key, pausedAttemptKey: '' });
    try {
      const src = await store.getTempFileURL(fileId);
      if (!src) {
        throw new Error('empty-temp-url');
      }
      this.audioContext.stop();
      this.audioContext.src = src;
      this.setData({ playingAttemptKey: attempt.key, loadingAttemptKey: attempt.key });
      this.audioContext.play();
    } catch (error) {
      this.setData({ playingAttemptKey: '', pausedAttemptKey: '', loadingAttemptKey: '' });
      wx.showToast({ title: this.data.texts.recordingLoadFailed, icon: 'none' });
    }
  }
});
