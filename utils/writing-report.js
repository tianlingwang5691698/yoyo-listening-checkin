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

function normalizeWritingReview(review, totalScore) {
  const source = review || {};
  const resolvedTotalScore = Number(source.totalScore || totalScore || 20);
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
    strengths: Array.isArray(source.strengths) ? source.strengths : [],
    problems: Array.isArray(source.problems) ? source.problems : [],
    suggestions: Array.isArray(source.suggestions) ? source.suggestions : [],
    grammarCorrections: Array.isArray(source.grammarCorrections) ? source.grammarCorrections : [],
    criterionDetails: (Array.isArray(source.criterionDetails) ? source.criterionDetails : []).map(normalizeCriterion),
    bandSamples: (Array.isArray(source.bandSamples) ? source.bandSamples : []).map(normalizeBandSample)
  });
}

module.exports = {
  normalizeWritingReview
};
