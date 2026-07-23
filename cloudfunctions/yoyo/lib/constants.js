const CLOUD_ASSET_BASE_URL = 'https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la';
const CLOUD_BUCKET = '796f-youshengenglish-6glk12rd6c6e719b-1419984942';
const TRANSCRIPT_BUNDLE_TTL_MS = 5 * 60 * 1000;
const STATIC_MANIFEST_ONLY_CATEGORIES = ['magictreehouse', 'magictreehouseb1', 'unlock1workbookthirdedition', 'unlock2workbookthirdedition', 'unlock3workbookthirdedition', 'unlock4workbookthirdedition'];
const TRANSCRIPT_BUNDLE_PATHS = {
  newconcept1: ['_transcripts/A1/new-concept-1-us-line/bundle.json', '_transcripts/A1/new-concept-1-us/bundle.json', '_transcripts/A1/newconcept1-us/bundle.json'],
  newconcept2: ['_transcripts/A2/new-concept-2-us-line/bundle.json', '_transcripts/A2/new-concept-2-us/bundle.json', '_transcripts/A2/new-concept-2/bundle.json', '_transcripts/A2/newconcept2/bundle.json'],
  newconcept3: ['_transcripts/B1/new-concept-3-us-line/bundle.json', '_transcripts/B1/new-concept-3-us/bundle.json', '_transcripts/B1/newconcept3/bundle.json'],
  newconcept4: ['_transcripts/B2/new-concept-4-us-line/bundle.json', '_transcripts/B2/new-concept-4-us/bundle.json', '_transcripts/B2/newconcept4/bundle.json'],
  peppa: ['_transcripts/A1/peppa/bundle.json', '_transcripts/A1/peppa/S2/bundle.json', '_transcripts/A1/peppa/S3/bundle.json'],
  littlebear: ['_transcripts/Pre A1/little-bear/bundle-sentence-v1.json'],
  petethecat: ['_transcripts/A2/pete-the-cat/bundle-sentence-v1.json'],
  magictreehouse: ['_transcripts/A2/magic-tree-house/bundle-sentence-v1.json'],
  magictreehouseb1: ['_transcripts/B1/magic-tree-house/bundle-sentence-v1.json'],
  unlock1: ['_transcripts/A1/unlock1/bundle-wordaligned-v2.json', '_transcripts/A1/unlock1/bundle.json'],
  unlock1thirdedition: ['_transcripts/A1/unlock1-third-edition/bundle-wordaligned-v1.json'],
  unlock1workbook: ['_transcripts/A1/unlock1/workbook-bundle-wordaligned-v2.json'],
  unlock1workbookthirdedition: ['_transcripts/A1/unlock1-workbook-third-edition/bundle-wordaligned-v2.json', '_transcripts/A1/unlock1-workbook-third-edition/bundle-wordaligned-v1.json'],
  unlock2: ['_transcripts/A2/unlock2/bundle.json'],
  unlock2thirdedition: ['_transcripts/A2/unlock2-third-edition/bundle-wordaligned-v1.json'],
  unlock2workbook: ['_transcripts/A2/unlock2/workbook-bundle-wordaligned-v1.json'],
  unlock2workbookthirdedition: ['_transcripts/A2/unlock2-workbook-third-edition/bundle-wordaligned-v1.json'],
  unlock3textbook: ['_transcripts/B1/unlock3-textbook/bundle.json'],
  unlock3thirdedition: ['_transcripts/B1/unlock3-third-edition/bundle-wordaligned-v1.json'],
  unlock3: ['_transcripts/B1/unlock3/bundle.json'],
  unlock3workbookthirdedition: ['_transcripts/B1/unlock3-workbook-third-edition/bundle-wordaligned-v1.json'],
  unlock4: ['_transcripts/B2/unlock4/bundle.json'],
  unlock4thirdedition: ['_transcripts/B2/unlock4-third-edition/bundle-wordaligned-v1.json'],
  unlock4workbook: ['_transcripts/B2/unlock4/workbook-bundle-wordaligned-v1.json'],
  unlock4workbookthirdedition: ['_transcripts/B2/unlock4-workbook-third-edition/bundle-wordaligned-v1.json'],
  song: ['_transcripts/A1/songs/bundle.json']
};
const STORAGE_ROOTS = {
  newconcept1: 'A1/NewConcept1-US',
  newconcept2: 'A2/NewConcept2-US',
  newconcept3: 'B1/NewConcept3-US',
  newconcept4: 'B2/NewConcept4-US',
  peppa: 'A1/Peppa',
  littlebear: 'Pre A1/Little Bear/Audio',
  petethecat: 'A2/Pete the Cat/Audio',
  magictreehouse: 'A2/Magic Tree House/Audio',
  magictreehouseb1: 'B1/Magic Tree House/Audio',
  unlock1: 'A1/Unlock1/Unlock1 听口音频Class Audio',
  unlock1thirdedition: 'A1/unlock1 第三版/Audio',
  unlock1workbook: 'A1/unlock1 练习册/Audio',
  unlock1workbookthirdedition: 'A1/unlock1 练习册 第三版/Audio',
  unlock2: 'A2/Unlock2/Class Audio',
  unlock2thirdedition: 'A2/unlock2 第三版/Audio',
  unlock2workbook: 'A2/unlock2 练习册/Audio',
  unlock2workbookthirdedition: 'A2/unlock2 练习册 第三版/Audio',
  unlock3textbook: 'B1/Unlock3/Textbook Audio',
  unlock3thirdedition: 'B1/unlock3 第三版/Audio',
  unlock3: 'B1/Unlock3/Class Audio',
  unlock3workbookthirdedition: 'B1/unlock3 练习册 第三版/Audio',
  unlock4: 'B2/Unlock4/Class Audio',
  unlock4thirdedition: 'B2/unlock4 第三版/Audio',
  unlock4workbook: 'B2/unlock4 练习册/Audio',
  unlock4workbookthirdedition: 'B2/unlock4 练习册 第三版/Audio',
  song: 'A1/Super simple songs'
};
const REQUIRED_COLLECTIONS = [
  'users',
  'families',
  'familyMembers',
  'children',
  'dailyTaskProgress',
  'dailyCheckins',
  'dailyReports',
  'subscriptionPreferences',
  'writingPreviewAttempts'
];

module.exports = {
  CLOUD_ASSET_BASE_URL,
  CLOUD_BUCKET,
  TRANSCRIPT_BUNDLE_TTL_MS,
  STATIC_MANIFEST_ONLY_CATEGORIES,
  TRANSCRIPT_BUNDLE_PATHS,
  STORAGE_ROOTS,
  REQUIRED_COLLECTIONS
};
