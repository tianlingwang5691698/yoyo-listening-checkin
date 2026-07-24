function normalizeCriterion(item) {
  const source = item || {};
  return Object.assign({}, source, {
    evidence: Array.isArray(source.evidence) ? source.evidence : [],
    limiters: Array.isArray(source.limiters) ? source.limiters : [],
    nextBandActions: Array.isArray(source.nextBandActions) ? source.nextBandActions : []
  });
}

function normalizeBandSample(item) {
  const source = item || {};
  return Object.assign({}, source, {
    upgradeNotes: Array.isArray(source.upgradeNotes) ? source.upgradeNotes : [],
    criterionTargets: (Array.isArray(source.criterionTargets) ? source.criterionTargets : []).map((target) => (
      Object.assign({}, target || {}, {
        changes: Array.isArray(target && target.changes) ? target.changes : []
      })
    ))
  });
}

function hasInternalScoringLanguage(value) {
  return /AI|模型|校准|预估|估计总分|评分依据|Band Descriptors|逐档证据|权重为/i.test(String(value || ''));
}

function uniqueList(value, limit) {
  const seen = new Set();
  return (Array.isArray(value) ? value : []).filter((item) => {
    const key = String(item || '').replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key) || hasInternalScoringLanguage(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function normalizeWritingReview(review, totalScore) {
  const source = review || {};
  const resolvedTotalScore = Number(source.totalScore || totalScore || 20);
  const isIelts = source.isIelts === true
    || resolvedTotalScore === 9
    || /IELTS\s*Band/i.test(String(source.level || ''));
  const polishedTargetBand = Number(source.polishedTargetBand);
  const hasPolishedTargetBand = source.polishedTargetBand !== undefined
    && source.polishedTargetBand !== null
    && String(source.polishedTargetBand).trim() !== ''
    && Number.isFinite(polishedTargetBand);
  return Object.assign({
    score: 0,
    totalScore: resolvedTotalScore,
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
    polishedTargetBand: null,
    polishedTitle: '',
    polishedStandard: '',
    polishedVersion: '',
    criterionDetails: [],
    bandSamples: [],
    isIelts: false,
    estimateLabel: '',
    weightingNote: '',
    rubricVersion: '',
    feedbackNotice: ''
  }, source, {
    totalScore: resolvedTotalScore,
    isIelts,
    summary: isIelts || hasInternalScoringLanguage(source.summary) ? '' : String(source.summary || ''),
    estimateLabel: '',
    weightingNote: '',
    rubricVersion: '',
    feedbackNotice: '',
    writingTestEstimate: null,
    polishedStandard: String(source.polishedStandard || (
      isIelts && source.polishedVersion && !hasPolishedTargetBand
        ? '生成标准：历史记录未保存目标 Band，仅作原题参考。'
        : ''
    )),
    strengths: uniqueList(source.strengths, 3),
    problems: uniqueList(source.problems, 4),
    suggestions: uniqueList(source.suggestions, 4),
    grammarCorrections: Array.isArray(source.grammarCorrections) ? source.grammarCorrections : [],
    criterionDetails: (Array.isArray(source.criterionDetails) ? source.criterionDetails : []).map(normalizeCriterion),
    bandSamples: (Array.isArray(source.bandSamples) ? source.bandSamples : []).map(normalizeBandSample)
  });
}

module.exports = {
  normalizeWritingReview,
  _test: {
    hasInternalScoringLanguage,
    uniqueList
  }
};
