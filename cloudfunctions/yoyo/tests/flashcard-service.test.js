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

test('初中词汇 List 计划完成 List 32 后进入下一轮 List 1', () => {
  const helpers = flashcardService._test;
  const next = helpers.advanceJuniorListPlanState({ round: 1, currentList: 32 }, '2026-08-20');
  assert.equal(next.round, 2);
  assert.equal(next.currentList, 1);
  assert.equal(next.lastCompletedRound, 1);
  assert.equal(next.lastCompletedList, 32);
});

test('初中词汇 List 计划同一天保持已完成轮次与 List', () => {
  const helpers = flashcardService._test;
  const descriptor = helpers.getJuniorListPlanDescriptor({
    round: 2,
    currentList: 2,
    lastCompletedDate: '2026-08-21',
    lastCompletedRound: 2,
    lastCompletedList: 1
  }, '2026-08-21');
  assert.equal(descriptor.completedToday, true);
  assert.equal(descriptor.round, 2);
  assert.equal(descriptor.currentList, 1);
  assert.equal(descriptor.practiceLevel, 'junior-list-1');
});

test('初中词汇 List 计划累计当天多次进入的有效用时', () => {
  const helpers = flashcardService._test;
  const today = '2026-08-21';
  const state = helpers.mergeJuniorListPlanDuration({
    round: 2,
    currentList: 3,
    activeDurationDate: today,
    activeDurationRound: 2,
    activeDurationList: 3,
    activeDurationSec: 75
  }, {
    round: 2,
    currentList: 3
  }, today, 128);
  assert.equal(state.activeDurationSec, 128);
  assert.equal(helpers.getJuniorListPlanDescriptor(state, today).durationSec, 128);

  const stale = helpers.mergeJuniorListPlanDuration(state, {
    round: 2,
    currentList: 4
  }, '2026-08-22', 16);
  assert.equal(stale.activeDurationSec, 16);
});

test('初中词汇 List 完成后保留当天累计用时并清空进行中计时', () => {
  const helpers = flashcardService._test;
  const completed = helpers.advanceJuniorListPlanState({
    round: 1,
    currentList: 4,
    activeDurationDate: '2026-08-21',
    activeDurationRound: 1,
    activeDurationList: 4,
    activeDurationSec: 320,
    lastDurationSec: 320
  }, '2026-08-21');
  assert.equal(completed.activeDurationSec, 0);
  assert.equal(completed.activeDurationDate, '');
});

test('初中词汇第 2 轮从 List 1 开始完整重背当前 List', () => {
  const helpers = flashcardService._test;
  const today = '2026-08-21';
  const rows = [
    { flashcardKey: 'a', status: 'mastered', lastReviewDate: '2026-08-20' },
    { flashcardKey: 'b', status: 'reviewing', nextReviewDate: '2026-09-01', lastReviewDate: '2026-08-20' }
  ];

  assert.deepEqual(helpers.selectJuniorCurrentCards(rows, 2, today).map((item) => item.flashcardKey), ['a', 'b']);
  assert.equal(helpers.isJuniorCurrentListComplete(rows, 2, 2, today), false);
  assert.equal(helpers.isJuniorCurrentListComplete(rows.map((item) => Object.assign({}, item, { lastReviewDate: today })), 2, 2, today), true);
});

test('佑佑计划只复习尚未掌握的不熟词', () => {
  const helpers = flashcardService._test;
  const today = '2026-08-21';
  assert.equal(helpers.isJuniorUnfamiliarReviewDue({ status: 'reviewing', lastUnfamiliarDate: '2026-08-20', lastReviewDate: '2026-08-20' }, today), true);
  assert.equal(helpers.isJuniorUnfamiliarReviewDue({ status: 'reviewing', lastUnfamiliarDate: '2026-08-19', lastReviewDate: '2026-08-20' }, today), false);
  assert.equal(helpers.isJuniorUnfamiliarReviewDue({ status: 'reviewing', lastUnfamiliarDate: today, lastReviewDate: today }, today), false);
});
