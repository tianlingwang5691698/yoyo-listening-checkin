const test = require('node:test');
const assert = require('node:assert/strict');

const flashcardService = require('../services/flashcard.service');

test('词库请求按个人词库和词书来源拆分', () => {
  const command = {
    nin(values) {
      return { operator: 'nin', values };
    }
  };
  const ctx = {
    family: { familyId: 'family-1' },
    child: { childId: 'child-1' }
  };
  const personal = flashcardService._test.buildFlashcardWhere(ctx, { scope: 'personal' }, command);
  const junior = flashcardService._test.buildFlashcardWhere(ctx, { sourceId: 'dictionary-book-junior' }, command);

  assert.deepEqual(personal.sourceId, {
    operator: 'nin',
    values: flashcardService._test.DICTIONARY_SOURCE_IDS
  });
  assert.equal(junior.sourceId, 'dictionary-book-junior');
});

test('词库返回字段排除时间表和身份大字段', () => {
  const fields = flashcardService._test.CLIENT_CARD_FIELDS;
  assert.equal(fields.flashcardKey, true);
  assert.equal(fields.meaning, true);
  assert.equal(fields.reviewSchedule, undefined);
  assert.equal(fields.familyId, undefined);
  assert.equal(fields.childId, undefined);
  assert.equal(fields.createdAt, undefined);
});

test('家长试背被识别为只读写入', () => {
  assert.equal(flashcardService._test.isPreviewWrite({ member: { studyRole: 'parent' } }), true);
  assert.equal(flashcardService._test.isPreviewWrite({ member: { studyRole: 'student' } }), false);
});

test('当日词汇额度按学生进度累计，加量后只补差额', () => {
  const today = '2026-07-11';
  const cards = [
    { _id: 'new-done', status: 'reviewing', firstLearnedDate: today, lastReviewDate: today, nextReviewDate: today },
    { _id: 'review-done', status: 'reviewing', firstLearnedDate: '2026-07-01', lastReviewDate: today, nextReviewDate: today },
    { _id: 'new-next', status: 'new', nextReviewDate: today },
    { _id: 'new-extra', status: 'new', nextReviewDate: today },
    { _id: 'review-next', status: 'reviewing', firstLearnedDate: '2026-07-01', nextReviewDate: today }
  ];

  const completed = flashcardService._test.summarizeFlashcards(cards, [], today, { newLimit: 1, reviewLimit: 1 });
  assert.deepEqual(completed.cards, []);

  const increased = flashcardService._test.summarizeFlashcards(cards, [], today, { newLimit: 2, reviewLimit: 2 });
  assert.deepEqual(increased.cards.map((item) => item._id), ['review-next', 'new-next']);
});

test('听写拼写兼容大小写、多空格和备选词', () => {
  const helpers = flashcardService._test;
  assert.equal(helpers.normalizeSpelling('  New   York  '), 'new york');
  assert.deepEqual(helpers.acceptedSpellings('autumn / fall'), ['autumn', 'fall']);
  assert.equal(helpers.normalizeDictationQuestion({ word: 'autumn / fall', input: 'Fall' }).correct, true);
  assert.equal(helpers.normalizeDictationQuestion({ word: 'environment', input: 'enviroment' }).correct, false);
});

test('听写词源只包含已进入复习或已掌握的单词', () => {
  const isLearned = flashcardService._test.isLearnedFlashcard;
  assert.equal(isLearned({ status: 'reviewing' }), true);
  assert.equal(isLearned({ status: 'mastered' }), true);
  assert.equal(isLearned({ status: 'new', firstLearnedDate: '2026-07-12' }), false);
  assert.equal(isLearned({ firstLearnedDate: '2026-07-12' }), false);
});

test('听写专用词源只返回拼写必需字段', () => {
  const fields = flashcardService._test.DICTATION_CARD_FIELDS;
  assert.equal(fields.word, true);
  assert.equal(fields.phonetic, true);
  assert.equal(fields.meaning, true);
  assert.equal(fields.status, true);
  assert.equal(fields.reviewSchedule, undefined);
  assert.equal(fields.example, undefined);
});
