const assert = require('node:assert/strict');
const test = require('node:test');

const writing = require('../services/writing.service')._test;
const officialDescriptors = require('../lib/ielts-writing-band-descriptors');

function buildFeatureChecks(taskType, key, band, evidence = 'Student evidence') {
  return officialDescriptors.getOfficialCriterionFeatures(taskType, key, band).map((feature) => ({
    feature,
    met: true,
    evidence: [evidence]
  }));
}

function buildCompleteDecision(taskType, key, band, evidence = 'Student evidence') {
  return {
    key,
    awardedBand: band,
    checkedFromBand9: true,
    awardedBandFullyMet: true,
    awardedBandEvidence: [evidence],
    awardedBandFeatureChecks: buildFeatureChecks(taskType, key, band, evidence),
    nextHigherBand: band === 9 ? null : band + 1,
    nextHigherBandFullyMet: band === 9 ? null : false,
    unmetHigherBandFeatures: band === 9 ? [] : [`Band ${band + 1} is not fully met.`],
    decisionReason: `Band ${band} is the highest fully met band.`
  };
}

test('雅思 Task 1 和 Task 2 按9分制与四项标准评分', () => {
  const task1 = {
    title: 'Cambridge IELTS 21 Test 1 Writing Task 1',
    examType: 'IELTS Academic',
    contentType: 'ielts-writing-task-1',
    prompt: 'The graph below gives information about jobs.',
    requirements: ['Summarise the main features.'],
    visualData: { type: 'line graph', labels: ['1960', '2020'] },
    minWords: 150,
    score: 9
  };
  const task2 = Object.assign({}, task1, {
    title: 'Cambridge IELTS 21 Test 1 Writing Task 2',
    contentType: 'ielts-writing-task-2',
    minWords: 250
  });

  assert.equal(writing.getWritingTaskType(task1), 'ielts-task-1');
  assert.equal(writing.getWritingTaskType(task2), 'ielts-task-2');
  assert.equal(writing.resolveTotalScore(task1), 9);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /Task Achievement/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /visualData/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /原题参考范文/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /public Writing Band Descriptors, updated May 2023/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /四项分别只能给0–9整数Band/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /A script must fully fit the positive features/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /Official band-selection protocol/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /officialBandDecisions/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /从 Band 9 向下/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /不得使用程序自定义封顶/);
  assert.match(writing.WRITING_SCORING_VERSION, /^writing-score-v9-terra-midband-/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /criterionFeedback/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /awardedBandFeatureChecks/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /仅有常规图表词、准确但重复的趋势词不能自动满足/);
  assert.match(require('node:fs').readFileSync(require.resolve('../services/writing.service'), 'utf8'), /selectIeltsReviewAfterRepair/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /原文证据/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /原题图片为最终事实来源/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /task1FactCheck/);
  assert.match(writing.buildGradingPrompt(task1, 'Essay'), /不得使用程序自定义封顶/);
  assert.match(writing.buildGradingPrompt(task2, 'Essay'), /Task Response/);
  assert.doesNotMatch(writing.buildGradingPrompt(task1, 'Essay'), /"totalScore":20/);
});

test('Task 1 和 Task 2 完整加载官方 0–9 Band 四项描述', () => {
  const task1Guide = officialDescriptors.buildOfficialWritingBandGuide('ielts-task-1');
  const task2Guide = officialDescriptors.buildOfficialWritingBandGuide('ielts-task-2');
  for (let band = 0; band <= 9; band += 1) {
    assert.match(task1Guide, new RegExp(`Band ${band}(?:\\n|$)`));
    assert.match(task2Guide, new RegExp(`Band ${band}(?:\\n|$)`));
  }
  ['Task Achievement', 'Task Response', 'Coherence and Cohesion', 'Lexical Resource', 'Grammatical Range and Accuracy']
    .forEach((label) => assert.match(`${task1Guide}\n${task2Guide}`, new RegExp(label)));
  assert.match(task1Guide, /key features are skilfully selected/);
  assert.match(task1Guide, /clear overview/);
  assert.match(task2Guide, /well-developed position/);
  assert.match(task2Guide, /Paragraphing may be inadequate or missing/);
  assert.match(task1Guide, /20 words or fewer/);
  assert.match(task2Guide, /totally memorised/);
  assert.match(task1Guide, /ielts-writing-band-descriptors\.pdf/);
  assert.match(task1Guide, /ielts-writing-key-assessment-criteria\.pdf/);
});

test('雅思总分由四项平均并归入半分档', () => {
  const prompt = { contentType: 'ielts-writing-task-1', score: 9 };
  const review = writing.normalizeReview({
    score: 9,
    totalScore: 20,
    dimensionScores: {
      taskAchievement: 6,
      coherenceCohesion: 6.5,
      lexicalResource: 7,
      grammaticalRangeAccuracy: 6.5
    },
    content: 'content',
    structure: 'structure',
    language: 'language',
    spelling: 'grammar',
    criterionFeedback: {
      taskAchievement: {
        evidence: ['The overview identifies the main trend.'],
        descriptorMatch: '主要特征已覆盖，但比较不够充分。',
        limiters: ['遗漏一个关键转折点。'],
        nextBandActions: ['补充关键阶段之间的直接比较。']
      },
      coherenceCohesion: {},
      lexicalResource: {},
      grammaticalRangeAccuracy: {}
    },
    polishedVersion: 'model answer'
  }, prompt);

  assert.equal(review.score, 7);
  assert.equal(review.totalScore, 9);
  assert.equal(review.level, 'IELTS Band 7.0');
  assert.equal(review.contentLabel, 'Task Achievement · 6.0');
  assert.equal(review.polishedTitle, '原题参考范文');
  assert.equal(review.isIelts, true);
  assert.match(review.weightingNote, /Task 2 权重为 Task 1 的两倍/);
  assert.equal(review.criterionDetails.length, 4);
  assert.deepEqual(review.criterionDetails[0].evidence, ['The overview identifies the main trend.']);
  assert.deepEqual(review.criterionDetails[0].nextBandActions, ['补充关键阶段之间的直接比较。']);
  assert.equal(writing.hasCompleteIeltsCriterionDetails(review), false);
  const normalizedAgain = writing.normalizeReview(review, prompt);
  assert.deepEqual(normalizedAgain.criterionDetails[0].evidence, review.criterionDetails[0].evidence);
});

test('雅思证据化评分必须四项字段完整', () => {
  const complete = {
    criterionDetails: ['task', 'coherence', 'lexical', 'grammar'].map((key) => ({
      key,
      comment: '具体评语',
      evidence: ['学生原文证据'],
      descriptorMatch: '符合当前档描述',
      limiters: ['限制更高分的原因'],
      nextBandActions: ['下一档动作']
    }))
  };
  assert.equal(writing.hasCompleteIeltsCriterionDetails(complete), true);
  complete.criterionDetails[2].evidence = [];
  assert.equal(writing.hasCompleteIeltsCriterionDetails(complete), false);
});

test('雅思四项按官方逐档决策确定档位', () => {
  const decision = (key, awardedBand, evidence, unmet) => ({
    awardedBand,
    checkedFromBand9: true,
    awardedBandFullyMet: true,
    awardedBandEvidence: [evidence],
    awardedBandFeatureChecks: buildFeatureChecks('ielts-task-1', key, awardedBand, evidence),
    nextHigherBand: awardedBand === 9 ? null : awardedBand + 1,
    nextHigherBandFullyMet: awardedBand === 9 ? null : false,
    unmetHigherBandFeatures: awardedBand === 9 ? [] : [unmet],
    decisionReason: `完整符合 Band ${awardedBand}，但未完整符合更高档。`
  });
  const review = writing.normalizeReview({
    dimensionScores: {
      taskAchievement: 8,
      coherenceCohesion: 8,
      lexicalResource: 8,
      grammaticalRangeAccuracy: 8
    },
    officialBandDecisions: {
      taskAchievement: decision('task', 7, 'A clear overview is present.', 'Key features are not skilfully illustrated.'),
      coherenceCohesion: decision('coherenceCohesion', 7, 'Ideas progress clearly.', 'Cohesion is not consistently well managed.'),
      lexicalResource: decision('lexicalResource', 7, 'Some less common items are used.', 'Word choice is not consistently precise.'),
      grammaticalRangeAccuracy: decision('grammaticalRangeAccuracy', 8, 'Most sentences are error-free.', 'The range is not fully controlled.')
    }
  }, { contentType: 'ielts-writing-task-1', score: 9 });

  assert.deepEqual(review.dimensionScores, {
    task: 7,
    coherenceCohesion: 7,
    lexicalResource: 7,
    grammaticalRangeAccuracy: 8
  });
  assert.equal(review.score, 7.5);
  assert.equal(review.officialBandDecisionsComplete, true);
  assert.equal(writing.hasCompleteOfficialBandDecisions(review), true);
});

test('雅思官方逐档决策覆盖 Band 0–9 全部档位', () => {
  for (let band = 0; band <= 9; band += 1) {
    const decision = (key) => ({
      awardedBand: band,
      checkedFromBand9: true,
      awardedBandFullyMet: true,
      awardedBandEvidence: [`Band ${band} evidence`],
      awardedBandFeatureChecks: buildFeatureChecks('ielts-task-2', key, band, `Band ${band} evidence`),
      nextHigherBand: band === 9 ? null : band + 1,
      nextHigherBandFullyMet: band === 9 ? null : false,
      unmetHigherBandFeatures: band === 9 ? [] : [`Band ${band + 1} feature not fully met`],
      decisionReason: `Band ${band} is the highest fully met band.`
    });
    const review = writing.normalizeReview({
      dimensionScores: {
        taskResponse: band,
        coherenceCohesion: band,
        lexicalResource: band,
        grammaticalRangeAccuracy: band
      },
      officialBandDecisions: {
        taskResponse: decision('task'),
        coherenceCohesion: decision('coherenceCohesion'),
        lexicalResource: decision('lexicalResource'),
        grammaticalRangeAccuracy: decision('grammaticalRangeAccuracy')
      }
    }, { contentType: 'ielts-writing-task-2', score: 9 });

    assert.deepEqual(Object.values(review.dimensionScores), [band, band, band, band]);
    assert.equal(review.score, band);
    assert.equal(writing.hasCompleteOfficialBandDecisions(review), true);
  }
});

test('Band 8 逐档决策缺少任一官方正向特征证据时不得覆盖维度分', () => {
  const checks = buildFeatureChecks('ielts-task-1', 'lexicalResource', 8);
  checks.pop();
  const review = writing.normalizeReview({
    dimensionScores: {
      taskAchievement: 7,
      coherenceCohesion: 7,
      lexicalResource: 7,
      grammaticalRangeAccuracy: 7
    },
    officialBandDecisions: {
      lexicalResource: {
        awardedBand: 8,
        checkedFromBand9: true,
        awardedBandFullyMet: true,
        awardedBandEvidence: ['Accurate trend vocabulary.'],
        awardedBandFeatureChecks: checks,
        nextHigherBand: 9,
        nextHigherBandFullyMet: false,
        unmetHigherBandFeatures: ['Not fully flexible.'],
        decisionReason: 'Claims Band 8 without complete feature evidence.'
      }
    }
  }, { contentType: 'ielts-writing-task-1', score: 9 });

  assert.equal(review.dimensionScores.lexicalResource, 7);
  assert.equal(review.officialBandDecisionsComplete, false);
});

test('不完整的逐档决策不能覆盖有效维度分', () => {
  const review = writing.normalizeReview({
    dimensionScores: {
      taskResponse: 6,
      coherenceCohesion: 6,
      lexicalResource: 6,
      grammaticalRangeAccuracy: 6
    },
    officialBandDecisions: {
      taskResponse: {
        awardedBand: 8,
        checkedFromBand9: true,
        awardedBandFullyMet: true
      }
    }
  }, { contentType: 'ielts-writing-task-2', score: 9 });

  assert.equal(review.dimensionScores.task, 6);
  assert.equal(review.score, 6);
  assert.equal(review.officialBandDecisionsComplete, false);
});

test('雅思评分兼容官方维度名称与常见讲解字段变体', () => {
  const prompt = { contentType: 'ielts-writing-task-1', score: 9 };
  const review = writing.normalizeReview({
    dimensionScores: {
      'Task Achievement': 6,
      'Coherence and Cohesion': 6.5,
      'Lexical Resource': 7,
      'Grammatical Range and Accuracy': 6.5
    },
    summary: '评分有效。',
    criterionDetails: [
      { label: 'Task Achievement', feedback: '任务完成评语', quotes: 'The chart rose steadily.', bandDescriptor: '符合 Band 6', weaknesses: '比较不足', nextSteps: '补充关键比较' },
      { label: 'Coherence and Cohesion', analysis: '衔接评语', examples: ['Overall, ...'], descriptor: '符合 Band 6.5', limitations: ['衔接略机械'], improvements: ['使用自然指代'] },
      { label: 'Lexical Resource', commentary: '词汇评语', studentEvidence: ['a significant increase'], match: '符合 Band 7', scoreLimiters: ['搭配偶有错误'], recommendations: ['提高搭配准确度'] },
      { label: 'Grammatical Range and Accuracy', comment: '语法评语', evidence: ['while sales increased'], bandReason: '符合 Band 6.5', limiters: ['复杂句错误'], actions: ['检查从句结构'] }
    ]
  }, prompt);

  assert.equal(review.score, 7);
  assert.equal(review.criterionDetailsComplete, true);
  assert.equal(review.officialBandDecisionsComplete, false);
  assert.match(review.feedbackNotice, /官方逐档匹配证据/);
  assert.equal(writing.hasUsableIeltsReview(review), true);
  assert.deepEqual(review.criterionDetails[0].evidence, ['The chart rose steadily.']);
  assert.deepEqual(review.criterionDetails[0].nextBandActions, ['补充关键比较']);
});

test('雅思四项分有效时保留评分，不因部分讲解缺失判整次失败', () => {
  const review = writing.normalizeReview({
    dimensionScores: {
      taskResponse: 6,
      coherenceCohesion: 6,
      lexicalResource: 6,
      grammaticalRangeAccuracy: 6
    },
    summary: '有效评分。',
    criterionFeedback: {
      taskResponse: { comment: '回应了题目。' }
    }
  }, { contentType: 'ielts-writing-task-2', score: 9 });

  assert.equal(writing.hasUsableIeltsReview(review), true);
  assert.equal(writing.hasCompleteIeltsCriterionDetails(review), false);
  assert.equal(review.criterionDetailsComplete, false);
  assert.match(review.feedbackNotice, /四项 Band 分已保留/);
});

test('雅思校准超时或逐档证据不完整时保留有效四项评分', () => {
  const prompt = { contentType: 'ielts-writing-task-1', score: 9 };
  const firstReview = writing.normalizeReview({
    dimensionScores: {
      taskAchievement: 7,
      coherenceCohesion: 8,
      lexicalResource: 7,
      grammaticalRangeAccuracy: 7
    },
    summary: '首次评分有效。'
  }, prompt);
  const repairedReview = writing.normalizeReview({
    dimensionScores: {
      taskAchievement: 7,
      coherenceCohesion: 7,
      lexicalResource: 7,
      grammaticalRangeAccuracy: 7
    },
    summary: '校准评分有效，但逐档证据不完整。'
  }, prompt);

  const repairedFallback = writing.selectIeltsReviewAfterRepair(firstReview, repairedReview, null);
  assert.equal(repairedFallback.score, 7);
  assert.equal(repairedFallback.summary, '校准评分有效，但逐档证据不完整。');
  assert.equal(repairedFallback.gradingDegraded, true);
  assert.match(repairedFallback.feedbackNotice, /分数和有效反馈已保留/);

  const timeoutFallback = writing.selectIeltsReviewAfterRepair(firstReview, null, new Error('writing-timeout'));
  assert.equal(timeoutFallback.score, 7.5);
  assert.equal(timeoutFallback.gradingDegradedReason, 'writing-timeout');
  assert.match(timeoutFallback.feedbackNotice, /分数和有效反馈已保留/);
});

test('雅思 3.5–7.5 强制独立校准且完整高分不重复校准', () => {
  const midBandReview = {
    isIelts: true,
    taskType: 'ielts-task-1',
    score: 7.5,
    dimensionScores: {
      task: 7,
      coherenceCohesion: 8,
      lexicalResource: 7,
      grammaticalRangeAccuracy: 7
    },
    officialBandDecisions: [
      buildCompleteDecision('ielts-task-1', 'task', 7),
      buildCompleteDecision('ielts-task-1', 'coherenceCohesion', 8),
      buildCompleteDecision('ielts-task-1', 'lexicalResource', 7),
      buildCompleteDecision('ielts-task-1', 'grammaticalRangeAccuracy', 7)
    ]
  };
  const highBandReview = Object.assign({}, midBandReview, {
    score: 8,
    dimensionScores: {
      task: 8,
      coherenceCohesion: 8,
      lexicalResource: 8,
      grammaticalRangeAccuracy: 8
    },
    officialBandDecisions: [
      buildCompleteDecision('ielts-task-1', 'task', 8),
      buildCompleteDecision('ielts-task-1', 'coherenceCohesion', 8),
      buildCompleteDecision('ielts-task-1', 'lexicalResource', 8),
      buildCompleteDecision('ielts-task-1', 'grammaticalRangeAccuracy', 8)
    ]
  });

  for (let score = 3.5; score <= 7.5; score += 0.5) {
    assert.equal(writing.shouldRunIeltsCalibration(Object.assign({}, midBandReview, { score })), true);
  }
  assert.equal(writing.shouldRunIeltsCalibration(highBandReview), false);
});

test('雅思独立校准不携带首轮分数并强化 Band 4–7 边界', () => {
  const prompt = {
    title: 'Cambridge IELTS 19 Test 1 Writing Task 1',
    contentType: 'ielts-writing-task-1',
    prompt: 'Summarise the information.'
  };
  const calibrationPrompt = writing.buildIeltsCalibrationPrompt(prompt, 'The figure increased.');

  assert.match(calibrationPrompt, /盲校准/);
  assert.match(calibrationPrompt, /3\.5–7\.5/);
  assert.match(calibrationPrompt, /明确区分 Band 4、5、6、7/);
  assert.match(calibrationPrompt, /不得作为 Band 7 的 less common or idiomatic items/);
  assert.match(calibrationPrompt, /不足以证明 Band 7 的 a variety of complex structures/);
  assert.doesNotMatch(calibrationPrompt, /上一次输出/);
});

test('雅思独立校准覆盖首轮分数但保留有效参考范文', () => {
  const prompt = { contentType: 'ielts-writing-task-1', score: 9 };
  const firstReview = writing.normalizeReview({
    dimensionScores: {
      taskAchievement: 7,
      coherenceCohesion: 8,
      lexicalResource: 7,
      grammaticalRangeAccuracy: 7
    },
    summary: '首轮 Band 7.5。',
    polishedVersion: 'First model answer.'
  }, prompt);
  const calibratedReview = writing.normalizeReview({
    dimensionScores: {
      taskAchievement: 7,
      coherenceCohesion: 8,
      lexicalResource: 6,
      grammaticalRangeAccuracy: 6
    },
    summary: '独立校准为 Band 7.0。'
  }, prompt);
  const merged = writing.mergeIeltsCalibrationReview(firstReview, calibratedReview);

  assert.equal(merged.score, 7);
  assert.equal(merged.summary, '独立校准为 Band 7.0。');
  assert.equal(merged.polishedVersion, 'First model answer.');
  assert.equal(merged.calibrationApplied, true);
  assert.equal(merged.calibrationPreviousScore, 7.5);
});

test('雅思四项评分均不可恢复时才判定失败', () => {
  const invalidReview = writing.normalizeReview({
    dimensionScores: { taskAchievement: 7 }
  }, { contentType: 'ielts-writing-task-1', score: 9 });

  assert.throws(
    () => writing.selectIeltsReviewAfterRepair(invalidReview, null, null),
    /writing-ielts-score-invalid/
  );
});

test('Task 1 事实核对只提供证据，不机械改写官方维度分', () => {
  const prompt = { _id: 'ielts-task-1', contentType: 'ielts-writing-task-1', score: 9 };
  const base = {
    dimensionScores: {
      taskAchievement: 8,
      coherenceCohesion: 8,
      lexicalResource: 8,
      grammaticalRangeAccuracy: 8
    },
    summary: '评分。',
    criterionFeedback: {}
  };
  const major = writing.normalizeReview(Object.assign({}, base, {
    task1FactCheck: {
      chartFacts: ['Retail and healthcare are joint highest in 2020.'],
      majorMissingFeatures: ['The overview omits the final joint-highest ranking.'],
      minorMissingDetails: [],
      dataErrors: []
    }
  }), prompt);
  const minor = writing.normalizeReview(Object.assign({}, base, {
    task1FactCheck: {
      chartFacts: ['Retail reaches about 15 million in 2000.'],
      majorMissingFeatures: [],
      minorMissingDetails: ['The 2000 retail value is not reported.'],
      dataErrors: []
    }
  }), prompt);

  assert.equal(major.dimensionScores.task, 8);
  assert.equal(major.score, 8);
  assert.equal(major.taskAchievementCapApplied, false);
  assert.equal(minor.dimensionScores.task, 8);
  assert.equal(minor.taskAchievementCapApplied, false);
});

test('雅思四项维度按官方整数 Band 归一，总分按最近 0.5 报告', () => {
  const review = writing.normalizeReview({
    dimensionScores: {
      taskAchievement: 6.5,
      coherenceCohesion: 7.6,
      lexicalResource: 7.4,
      grammaticalRangeAccuracy: 6.5
    }
  }, { contentType: 'ielts-writing-task-1', score: 9 });
  assert.deepEqual(review.dimensionScores, {
    task: 7,
    coherenceCohesion: 8,
    lexicalResource: 7,
    grammaticalRangeAccuracy: 7
  });
  assert.equal(review.score, 7.5);
});

test('雅思官方最低作答长度规则覆盖 Band 0 与 Band 1', () => {
  const prompt = { contentType: 'ielts-writing-task-2', score: 9 };
  const base = writing.normalizeReview({
    dimensionScores: {
      taskResponse: 8,
      coherenceCohesion: 8,
      lexicalResource: 8,
      grammaticalRangeAccuracy: 8
    }
  }, prompt);
  const short = writing.applyOfficialMinimumResponseRule(base, 'This response contains fewer than twenty one English words.');
  const empty = writing.applyOfficialMinimumResponseRule(base, '');

  assert.deepEqual(short.dimensionScores, {
    task: 1,
    coherenceCohesion: 1,
    lexicalResource: 1,
    grammaticalRangeAccuracy: 1
  });
  assert.equal(short.score, 1);
  assert.equal(short.officialBandDecisionsComplete, true);
  assert.equal(empty.score, 0);
});

test('同一题目和作文生成稳定评分指纹并复用内存结果', () => {
  const prompt = {
    _id: 'ielts-academic-21-test-1-writing-task-1',
    contentType: 'ielts-writing-task-1',
    contentRevision: 3,
    prompt: 'The graph below gives information about jobs.'
  };
  const first = writing.buildWritingScoreFingerprint(prompt, 'First paragraph.\n\nSecond paragraph.');
  const same = writing.buildWritingScoreFingerprint(prompt, 'First paragraph.\n\nSecond paragraph.');
  const whitespaceOnly = writing.buildWritingScoreFingerprint(prompt, '  First   paragraph. Second paragraph.  ');
  const punctuationChanged = writing.buildWritingScoreFingerprint(prompt, 'First paragraph! Second paragraph.');
  const spellingChanged = writing.buildWritingScoreFingerprint(prompt, 'First paragraf. Second paragraph.');
  const changed = writing.buildWritingScoreFingerprint(prompt, 'A different essay.');
  assert.equal(first, same);
  assert.equal(first, whitespaceOnly);
  assert.notEqual(first, punctuationChanged);
  assert.notEqual(first, spellingChanged);
  assert.notEqual(first, changed);

  writing.setMemoryCachedWritingReview(first, { score: 7.5, summary: '稳定结果' });
  assert.deepEqual(writing.getMemoryCachedWritingReview(first), { score: 7.5, summary: '稳定结果' });
});

test('空格换行归一后仍兼容历史评分指纹', () => {
  const prompt = {
    _id: 'ielts-academic-21-test-1-writing-task-1',
    contentType: 'ielts-writing-task-1',
    contentRevision: 3,
    prompt: 'The graph below gives information about jobs.'
  };
  const oldEssay = 'First paragraph.\n\nSecond paragraph.';
  const whitespaceChangedEssay = '  First   paragraph. Second paragraph.  ';
  const currentFingerprint = writing.buildWritingScoreFingerprint(prompt, whitespaceChangedEssay);
  const incomingLegacyFingerprint = writing.buildLegacyWritingScoreFingerprint(prompt, whitespaceChangedEssay);
  const storedLegacyFingerprint = writing.buildLegacyWritingScoreFingerprint(prompt, oldEssay);
  const records = [{
    _id: 'legacy-result',
    essay: oldEssay,
    scoreFingerprint: storedLegacyFingerprint,
    gradingVersion: writing.WRITING_SCORING_VERSION,
    status: 'graded',
    review: { score: 7 },
    updatedAt: '2026-07-24T00:00:00.000Z'
  }];
  const compatibleFingerprints = writing.collectReusableWritingFingerprints(
    records,
    prompt,
    whitespaceChangedEssay,
    [currentFingerprint, incomingLegacyFingerprint]
  );
  const selected = writing.selectReusableWritingAttempt(records, compatibleFingerprints);
  assert.notEqual(storedLegacyFingerprint, incomingLegacyFingerprint);
  assert.equal(selected._id, 'legacy-result');
  const changedPrompt = Object.assign({}, prompt, { contentRevision: 4 });
  const changedPromptFingerprints = writing.collectReusableWritingFingerprints(
    records,
    changedPrompt,
    whitespaceChangedEssay,
    [writing.buildWritingScoreFingerprint(changedPrompt, whitespaceChangedEssay)]
  );
  assert.equal(writing.selectReusableWritingAttempt(records, changedPromptFingerprints), null);
});

test('同题同文优先复用当前版本原批改任务', () => {
  const fingerprint = 'same-writing';
  const base = {
    scoreFingerprint: fingerprint,
    gradingVersion: writing.WRITING_SCORING_VERSION
  };
  const selected = writing.selectReusableWritingAttempt([
    Object.assign({}, base, { _id: 'older', status: 'graded', review: { score: 7 }, updatedAt: '2026-07-23T10:00:00.000Z' }),
    Object.assign({}, base, { _id: 'latest', status: 'grading', updatedAt: '2026-07-23T10:01:00.000Z' }),
    Object.assign({}, base, { _id: 'wrong-version', status: 'grading', gradingVersion: 'old', updatedAt: '2026-07-23T10:02:00.000Z' })
  ], fingerprint);
  assert.equal(selected._id, 'latest');
  assert.equal(writing.selectReusableWritingAttempt([
    Object.assign({}, base, { status: 'graded', review: null })
  ], fingerprint), null);
});

test('家长写作预览使用独立且受归属保护的任务引用', () => {
  const ctx = {
    user: { userId: 'user-parent' },
    member: { memberId: 'member-parent' },
    family: { familyId: 'family-1' },
    child: { childId: 'child-1' }
  };
  const documentId = writing.buildPreviewAttemptDocumentId(ctx, 'fingerprint-1');
  const attemptId = writing.formatWritingAttemptId(documentId, true);
  const ref = writing.resolveWritingAttemptRef(attemptId);
  const attempt = {
    isPreview: true,
    userId: 'user-parent',
    memberId: 'member-parent',
    familyId: 'family-1',
    childId: 'child-1'
  };

  assert.equal(documentId.length, 32);
  assert.equal(ref.collectionName, 'writingPreviewAttempts');
  assert.equal(ref.documentId, documentId);
  assert.equal(ref.isPreview, true);
  assert.equal(writing.isWritingAttemptAccessible(ctx, attempt, true), true);
  assert.equal(writing.isWritingAttemptAccessible(Object.assign({}, ctx, {
    user: { userId: 'other-parent' }
  }), attempt, true), false);
});

test('雅思按需生成高 1 与高 2 Band 教学范文协议', () => {
  const prompt = {
    title: 'Cambridge IELTS 21 Test 1 Writing Task 2',
    examType: 'IELTS Academic',
    contentType: 'ielts-writing-task-2',
    prompt: 'Discuss both views and give your opinion.',
    minWords: 250
  };
  const review = { score: 6, dimensionScores: { task: 6 } };
  const plusOne = writing.buildBandSamplePrompt(prompt, 'Student essay.', review, 1);
  const plusTwo = writing.buildBandSamplePrompt(prompt, 'Student essay.', review, 2);
  assert.match(plusOne, /目标 Band 7\.0/);
  assert.match(plusOne, /保留学生原有观点/);
  assert.match(plusTwo, /目标 Band 8\.0/);
  assert.match(plusTwo, /重组论证/);

  const sample = writing.normalizeBandSample({
    delta: 1,
    targetBand: 7,
    essay: 'This is a short model answer.',
    upgradeNotes: ['Ideas are developed more clearly.'],
    criterionTargets: [{ label: 'Task Response', changes: ['Support each claim.'] }]
  }, 1, 6);
  assert.equal(sample.delta, 1);
  assert.equal(sample.targetBand, 7);
  assert.equal(sample.wordCount, 6);
  assert.equal(sample.criterionTargets[0].label, 'Task Response');
});

test('整套 Writing 按 Task 1 一份、Task 2 两份计算', () => {
  assert.equal(writing.calculateIeltsWritingTestEstimate(6, 7), 6.5);
  assert.equal(writing.calculateIeltsWritingTestEstimate(6.5, 7.5), 7);
  assert.equal(writing.normalizeBandScore(7.125), 7);
  assert.equal(writing.normalizeBandScore(7.25), 7.5);
  assert.equal(writing.normalizeBandScore(7.75), 8);
  assert.deepEqual(writing.getIeltsWritingPair('ielts-academic-21-test-3-writing-task-2'), {
    paperId: 'ielts-academic-21-test-3',
    taskNumber: 2,
    task1PromptId: 'ielts-academic-21-test-3-writing-task-1',
    task2PromptId: 'ielts-academic-21-test-3-writing-task-2'
  });
});

test('上海高中概要和指导性写作使用独立规则', () => {
  const summary = { contentType: 'summary-writing', stage: '高中', score: 10, maxWords: 60 };
  const guided = { contentType: 'guided-writing', stage: '高中', score: 25, requirements: ['明确态度', '说明理由'] };

  assert.equal(writing.getWritingTaskType(summary), 'senior-summary');
  assert.equal(writing.getWritingTaskType(guided), 'senior-guided');
  assert.equal(writing.resolveTotalScore(summary), 10);
  assert.equal(writing.resolveTotalScore(guided), 25);
  assert.match(writing.buildGradingPrompt(summary, 'Summary'), /不超过规定字数/);
  assert.match(writing.buildGradingPrompt(guided, 'Essay'), /内容和任务完成10分/);
});

test('中考作文保留 8+8+4 和字数限分规则', () => {
  const prompt = { contentType: '', stage: '初中', score: 20, minWords: 60 };
  const gradingPrompt = writing.buildGradingPrompt(prompt, 'Essay');
  assert.equal(writing.getWritingTaskType(prompt), 'junior-essay');
  assert.match(gradingPrompt, /内容8分、语言8分、组织结构4分/);
  assert.match(gradingPrompt, /不足30词时总分最高9分/);
});
