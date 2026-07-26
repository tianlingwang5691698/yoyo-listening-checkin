const test = require('node:test');
const assert = require('node:assert/strict');

const completionRecords = require('../lib/completion-records');
const completionService = require('../services/completion.service');
const listeningService = require('../services/listening.service');
const dbAdapter = require('../adapters/db.adapter');
const study = require('../facades/study.facade');

test('completion records keep the latest row for each recordId', () => {
  const rows = completionRecords.dedupeCompletionItems([
    { _id: 'a', recordId: 'record-1', updatedAt: '2026-07-16T10:00:00.000Z' },
    { _id: 'b', recordId: 'record-1', updatedAt: '2026-07-16T10:00:01.000Z' },
    { _id: 'c', recordId: 'record-2', updatedAt: '2026-07-16T10:00:00.000Z' }
  ]);
  assert.deepEqual(rows.map((item) => item._id).sort(), ['b', 'c']);
  assert.equal(completionRecords.buildCompletionDocumentId('record-1'), completionRecords.buildCompletionDocumentId('record-1'));
});

test('concurrent completion writes use one deterministic document', async (t) => {
  const documents = new Map();
  let addCalls = 0;
  t.mock.method(study, 'isStudyWriteAllowed', () => true);
  t.mock.method(dbAdapter, 'collection', () => ({
    where: () => ({
      orderBy: () => ({
        limit: () => ({ get: async () => ({ data: [] }) })
      })
    }),
    add: async () => { addCalls += 1; },
    doc: (id) => ({
      set: async ({ data }) => { documents.set(id, data); },
      update: async ({ data }) => { documents.set(id, data); }
    })
  }));
  const ctx = {
    family: { familyId: 'family-1' },
    child: { childId: 'child-1' },
    user: { userId: 'user-1' },
    member: { memberId: 'member-1' }
  };
  await Promise.all(Array.from({ length: 7 }, () => completionService.upsertStudyCompletion(ctx, '2026-07-16', {
    type: 'listening',
    targetId: 'unlock1:unlock1-19',
    category: 'unlock1',
    taskId: 'unlock1-19',
    title: '听力学习包'
  })));
  assert.equal(documents.size, 1);
  assert.equal(addCalls, 0);
});

test('fixed-plan listening study pack can be restored by its audio title', async (t) => {
  const cachedPack = {
    listeningId: 'lesson-unlock1workbook-unlock1workbook-3__fixed_listening_round_1',
    title: 'UL2v2_L1_TST_LS_U03_Audio_3.1',
    source: 'model:gpt-5.6-luna',
    studyPack: {
      source: 'model:gpt-5.6-luna',
      vocabularyCards: [{ word: 'focus' }],
      phraseCards: [{ text: 'pay attention' }],
      sentencePatternCards: [{ pattern: 'It is important to...' }]
    }
  };
  t.mock.method(dbAdapter, 'collection', () => ({
    where: (filter) => ({
      orderBy: () => ({
        limit: () => ({
          get: async () => ({
            data: filter.title === cachedPack.title ? [cachedPack] : []
          })
        })
      })
    })
  }));

  const result = await listeningService._test.getCachedStudyPackByTitle(cachedPack.title);

  assert.equal(result.listeningId, cachedPack.listeningId);
  assert.equal(result.studyPack.phraseCards.length, 1);
});

test('existing completion is replaced with the final grading result', async (t) => {
  let saved = null;
  t.mock.method(study, 'isStudyWriteAllowed', () => true);
  t.mock.method(dbAdapter, 'collection', () => ({
    where: () => ({
      orderBy: () => ({
        limit: () => ({
          get: async () => ({
            data: [{
              _id: 'completion-existing',
              recordId: 'family-1_child-1_2026-07-23_writing_prompt-1',
              progressText: '批改中',
              createdAt: '2026-07-23T10:00:00.000Z',
              updatedAt: '2026-07-23T10:00:00.000Z'
            }]
          })
        })
      })
    }),
    doc: (id) => ({
      set: async ({ data }) => { saved = { id, data }; }
    })
  }));
  const result = await completionService.upsertStudyCompletion({
    family: { familyId: 'family-1' },
    child: { childId: 'child-1' },
    user: { userId: 'user-1' },
    member: { memberId: 'member-1' }
  }, '2026-07-23', {
    type: 'writing',
    targetId: 'prompt-1',
    title: 'IELTS Writing Task 1',
    progressText: '7.0/9 分',
    latestAttempt: { status: 'graded', score: 7, totalScore: 9 }
  });
  assert.equal(result.updated, true);
  assert.equal(saved.id, 'completion-existing');
  assert.equal(saved.data.createdAt, '2026-07-23T10:00:00.000Z');
  assert.equal(saved.data.progressText, '7.0/9 分');
  assert.equal(saved.data.latestAttempt.status, 'graded');
});

test('distributed listening study-pack job returns generating without calling the model again', async (t) => {
  t.mock.method(study, 'prepareRequestContext', async () => ({}));
  t.mock.method(dbAdapter, 'collection', () => ({
    doc: () => ({
      get: async () => { throw new Error('document not exist'); }
    }),
    where: () => ({
      orderBy: () => ({
        limit: () => ({ get: async () => ({ data: [] }) })
      })
    })
  }));
  t.mock.method(dbAdapter.db, 'runTransaction', async (callback) => callback({
    collection: () => ({
      doc: () => ({
        get: async () => ({
          data: {
            status: 'generating',
            generationStartedAt: new Date().toISOString()
          }
        }),
        set: async () => { throw new Error('should not acquire active job'); }
      })
    })
  }));
  const result = await listeningService.getListeningStudyPack({
    payload: {
      listeningId: 'lesson-unlock1-unlock1-19',
      transcript: 'A short transcript.',
      item: { title: '7.3' }
    }
  });
  assert.equal(result.generating, true);
  assert.equal(result.studyPack, null);
  assert.equal(result.retryAfterMs, 3000);
});
