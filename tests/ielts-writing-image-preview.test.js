const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('IELTS Writing Task 1 使用高清指纹图并支持系统预览', () => {
  const root = path.join(__dirname, '..');
  const pageSource = fs.readFileSync(path.join(root, 'pages', 'writing', 'detail', 'index.js'), 'utf8');
  const templateSource = fs.readFileSync(path.join(root, 'pages', 'writing', 'detail', 'index.wxml'), 'utf8');
  const items = [16, 17, 18, 19, 20, 21].flatMap((book) => {
    const itemsDir = path.join(root, 'data', 'ielts-academic', `cambridge-${book}`, 'writing', 'items-v3');
    return fs.readdirSync(itemsDir).filter((name) => name.endsWith('.json')).map((name) => JSON.parse(fs.readFileSync(path.join(itemsDir, name), 'utf8')));
  });
  const task1 = items.filter((item) => Number(item.paperOrder) === 1);
  const task2 = items.filter((item) => Number(item.paperOrder) === 2);

  assert.equal(items.length, 48);
  assert.equal(task1.length, 24);
  assert.equal(task2.length, 24);
  assert.ok(task1.every((item) => item.contentRevision === 3 && item.dataFormat === 'structured-text-v3'));
  assert.ok(task1.every((item) => item.images.length === 1 && /\/writing\/visuals-v3\/.*-[a-f0-9]{10}\.jpg$/.test(item.images[0].cloudPath)));
  assert.ok(task2.every((item) => item.images.length === 0));
  assert.match(pageSource, /wx\.previewImage\(\{ current, urls \}\)/);
  assert.match(templateSource, /bindtap="previewPromptImage"/);
});
