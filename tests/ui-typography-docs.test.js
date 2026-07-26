const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('题干与解析规范按模块分门别类', () => {
  const index = read('docs/design/typography/README.md');
  const files = [
    'reading-listening.md',
    'grammar.md',
    'writing-translation.md',
    'speaking.md'
  ];

  files.forEach((file) => {
    assert.match(index, new RegExp(`\\./${file.replace('.', '\\.')}`));
    assert.ok(read(`docs/design/typography/${file}`).length > 500);
  });
});

test('总规范锁定五主题结果字号与字体角色', () => {
  const spec = read('docs/design/typography/README.md');
  const themes = [
    read('styles/themes/warm.wxss'),
    read('styles/themes/library.wxss'),
    read('styles/themes/voyage.wxss'),
    read('styles/themes/dragon.wxss'),
    read('styles/themes/tactical.wxss')
  ];
  const tokens = [
    ['--result-score-size', '48rpx'],
    ['--result-title-size', '32rpx'],
    ['--result-section-size', '28rpx'],
    ['--result-body-size', '26rpx'],
    ['--result-support-size', '23rpx'],
    ['--result-meta-size', '21rpx']
  ];

  tokens.forEach(([name, value]) => {
    assert.match(spec, new RegExp(`${name}[^\\n]*${value}`));
    themes.forEach((theme) => assert.match(theme, new RegExp(`${name}: ${value}`)));
  });
  [
    '--font-body-family',
    '--font-title-family',
    '--font-number-family',
    '--font-english-serif-family',
    '--font-english-sans-family'
  ].forEach((role) => assert.match(spec, new RegExp(role)));
});

test('总设计规范与 UI 日志已接入专项规范', () => {
  const design = read('docs/DESIGN_STYLE_REQUIREMENTS.md');
  const log = read('docs/UI_DESIGN_LANGUAGE_LOG.md');

  assert.match(design, /design\/typography\/README\.md/);
  assert.match(log, /题干与解析字体层级规范/);
  assert.match(log, /48\/32\/28\/26\/23\/21rpx/);
});
