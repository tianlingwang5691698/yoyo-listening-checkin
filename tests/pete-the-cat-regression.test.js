const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'pete-the-cat', 'A2', 'pete-the-cat');

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(BUILD_ROOT, fileName), 'utf8'));
}

test('Pete the Cat 40 册本地数据与句级时间轴完整', () => {
  const manifest = readJson('manifest.json');
  const bundle = readJson('bundle-draft.json');
  const report = readJson('clean-report.json');

  assert.equal(manifest.tracks.length, 40);
  assert.equal(Object.keys(bundle).length, 40);
  assert.equal(report.validationErrorCount, 0);
  assert.equal(report.asrDoneCount, 40);
  assert.equal(new Set(manifest.tracks.map((item) => item.id)).size, 40);
  assert.equal(new Set(manifest.tracks.map((item) => item.audioCloudPath)).size, 40);
  assert.equal(new Set(manifest.tracks.map((item) => item.coverCloudPath)).size, 40);

  manifest.tracks.forEach((item) => {
    assert.match(item.audioCloudPath, /^A2\/Pete the Cat\/Audio\/\d{3}-[a-z0-9-]+-[a-f0-9]{10}\.mp3$/);
    assert.match(item.coverCloudPath, /^A2\/Pete the Cat\/Covers\/\d{3}-[a-z0-9-]+-[a-f0-9]{10}\.jpg$/);
    assert.equal(fs.existsSync(item.sourcePath), true);
    assert.equal(fs.existsSync(item.coverSourcePath), true);
    const track = bundle[item.trackId];
    assert.ok(track);
    assert.equal(track.syncGranularity, 'line');
    assert.match(track.source, /^whisper-small\.en-word-timestamps$/);
    assert.ok(track.lines.length > 0);
    let previousEnd = -1;
    track.lines.forEach((line) => {
      assert.ok(line.text.trim());
      assert.ok(line.startMs >= previousEnd);
      assert.ok(line.endMs > line.startMs);
      previousEnd = line.endMs;
    });
    assert.equal(track.lines.at(-1).endMs, Math.round(track.durationSec * 1000));
  });
});

test('Pete the Cat 只在 A2 显示，首屏只返回轻量摘要', () => {
  const catalogEngine = require('../cloudfunctions/yoyo/lib/catalog-engine');
  const listeningPlanEngine = require('../cloudfunctions/yoyo/lib/listening-plan-engine');
  const startedAt = performance.now();
  const preA1 = listeningPlanEngine.buildMaterialEntries('Pre A1', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const a1 = listeningPlanEngine.buildMaterialEntries('A1', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const a2 = listeningPlanEngine.buildMaterialEntries('A2', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const elapsedMs = performance.now() - startedAt;
  const material = a2.find((item) => item.category === 'petethecat');

  assert.deepEqual(material, {
    levelId: 'A2',
    category: 'petethecat',
    title: 'Pete the Cat',
    totalCount: 40,
    enabled: true
  });
  assert.equal(preA1.some((item) => item.category === 'petethecat'), false);
  assert.equal(a1.some((item) => item.category === 'petethecat'), false);
  assert.equal(JSON.stringify(material).includes('audioUrl'), false);
  assert.equal(JSON.stringify(material).includes('lines'), false);
  assert.ok(elapsedMs < 300, `A2 摘要构建耗时 ${elapsedMs}ms`);
});

test('Pete the Cat 标题清洗后不重复系列名', () => {
  const catalogEngine = require('../cloudfunctions/yoyo/lib/catalog-engine');
  const presenter = require('../cloudfunctions/yoyo/lib/task-presenter');
  const tasks = catalogEngine.getStaticCatalogMap().petethecat;

  assert.equal(tasks.length, 40);
  tasks.forEach((task) => {
    const presentation = presenter.getTaskPresentation(task);
    assert.equal(/^Pete the (?:Cat|Kitty)/i.test(presentation.displayTitle), false);
    assert.equal(presentation.displaySubtitle, 'Pete the Cat');
    assert.equal((`${presentation.displaySubtitle} ${presentation.displayTitle}`.match(/Pete the Cat/gi) || []).length, 1);
  });
});
