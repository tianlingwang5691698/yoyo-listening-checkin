const CLOUD_ASSET_BASE_URL = 'https://796f-youshengenglish-6glk12rd6c6e719b-1419984942.tcb.qcloud.la';
const CLOUD_BUCKET = '796f-youshengenglish-6glk12rd6c6e719b-1419984942';
const TRANSCRIPT_BUNDLE_TTL_MS = 5 * 60 * 1000;
const TRANSCRIPT_BUNDLE_PATHS = {
  newconcept1: ['_transcripts/A1/new-concept-1-us-line/bundle.json', '_transcripts/A1/new-concept-1-us/bundle.json', '_transcripts/A1/newconcept1-us/bundle.json'],
  newconcept2: ['_transcripts/A2/new-concept-2-us-line/bundle.json', '_transcripts/A2/new-concept-2-us/bundle.json', '_transcripts/A2/new-concept-2/bundle.json', '_transcripts/A2/newconcept2/bundle.json'],
  newconcept3: ['_transcripts/B1/new-concept-3-us-line/bundle.json', '_transcripts/B1/new-concept-3-us/bundle.json', '_transcripts/B1/newconcept3/bundle.json'],
  newconcept4: ['_transcripts/B2/new-concept-4-us-line/bundle.json', '_transcripts/B2/new-concept-4-us/bundle.json', '_transcripts/B2/newconcept4/bundle.json'],
  peppa: ['_transcripts/A1/peppa/bundle.json'],
  unlock1: ['_transcripts/A1/unlock1/bundle.json'],
  song: ['_transcripts/A1/songs/bundle.json']
};
const STORAGE_ROOTS = {
  newconcept1: 'A1/NewConcept1-US',
  newconcept2: 'A2/NewConcept2-US',
  newconcept3: 'B1/NewConcept3-US',
  newconcept4: 'B2/NewConcept4-US',
  peppa: 'A1/Peppa',
  unlock1: 'A1/Unlock1/Unlock1 听口音频Class Audio',
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
  'subscriptionPreferences'
];

module.exports = {
  CLOUD_ASSET_BASE_URL,
  CLOUD_BUCKET,
  TRANSCRIPT_BUNDLE_TTL_MS,
  TRANSCRIPT_BUNDLE_PATHS,
  STORAGE_ROOTS,
  REQUIRED_COLLECTIONS
};
