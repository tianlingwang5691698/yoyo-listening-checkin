const peppaSegmentBuild = {
  'track-peppa-s101': {
    mode: 'per-line',
    prefix: 's101-line',
    paddingBeforeMs: 700,
    paddingAfterMs: 900
  },
  'track-peppa-s102': {
    mode: 'grouped-per-line',
    prefix: 's102-line',
    paddingBeforeMs: 500,
    paddingAfterMs: 700,
    groups: [
      { lineStart: 0, lineEnd: 8, groupPaddingBeforeMs: 900, groupPaddingAfterMs: 1000 },
      { lineStart: 9, lineEnd: 18, groupPaddingBeforeMs: 800, groupPaddingAfterMs: 1000 },
      { lineStart: 19, lineEnd: 27, groupPaddingBeforeMs: 800, groupPaddingAfterMs: 1000 },
      { lineStart: 28, lineEnd: 37, groupPaddingBeforeMs: 800, groupPaddingAfterMs: 1000 },
      { lineStart: 38, lineEnd: 47, groupPaddingBeforeMs: 800, groupPaddingAfterMs: 1000 },
      { lineStart: 48, lineEnd: 57, groupPaddingBeforeMs: 800, groupPaddingAfterMs: 1000 },
      { lineStart: 58, lineEnd: 68, groupPaddingBeforeMs: 800, groupPaddingAfterMs: 1200 }
    ]
  }
};

module.exports = {
  peppaSegmentBuild
};
