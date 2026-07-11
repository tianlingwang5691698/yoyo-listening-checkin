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
    values: ['dictionary-book-junior', 'dictionary-book-senior']
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
