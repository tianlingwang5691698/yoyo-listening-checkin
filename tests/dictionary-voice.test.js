const assert = require('node:assert/strict');
const test = require('node:test');
const voice = require('../utils/dictionary-voice');

test('词典发音自动修复截断词并展开语法占位符', () => {
  assert.equal(voice.normalizeDictionaryVoiceText('on the outskir'), 'on the outskirts');
  assert.equal(voice.normalizeDictionaryVoiceText('prevent sb. from doing sth.'), 'prevent somebody from doing something');
  assert.equal(voice.normalizeDictionaryVoiceText('help s.b. with s.th.'), 'help somebody with something');
  assert.equal(voice.normalizeDictionaryVoiceText("look after one's health"), "look after someone's health");
});

test('双复数短语增加可朗读单数候选且按美英默认音回退', () => {
  const urls = voice.buildDictionaryVoiceUrls('solutions to problems');
  assert.equal(voice.buildNaturalPhraseVariant('solutions to problems'), 'solution to a problem');
  assert.deepEqual(urls.map((url) => Number(new URL(url).searchParams.get('type'))), [2, 1, 0, 2, 1, 0]);
  assert.match(decodeURIComponent(urls[3]), /solution to a problem/);
});

test('整条短语无音源时可按原顺序逐词回退', () => {
  assert.deepEqual(
    voice.buildDictionaryVoiceSegments('somebody does sth.'),
    ['somebody', 'does', 'something']
  );
  assert.deepEqual(
    voice.buildDictionaryVoiceSegmentUrls('something').map((url) => Number(new URL(url).searchParams.get('type'))),
    [2, 1, 0]
  );
});

test('我的词库长结构清洗为有道可接收的朗读副本', () => {
  const raw = 'It is adj. for sb. to do sth. → help sb./sth.';
  const cleaned = voice.normalizeDictionaryVoiceText(raw);
  assert.equal(cleaned, 'It is adjective for somebody to do something to help somebody or something');
  assert.equal(voice.canUseDictionaryVoice(cleaned), true);
  assert.equal(voice.buildDictionaryVoiceSegments(cleaned).length, 13);
});
