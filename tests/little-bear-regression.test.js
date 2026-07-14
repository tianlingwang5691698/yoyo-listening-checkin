const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BUILD_ROOT = path.join(__dirname, '..', 'data', 'transcript-build', 'little-bear', 'Pre A1', 'little-bear');

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(BUILD_ROOT, fileName), 'utf8'));
}

test('Little Bear 本地安全 bundle 使用 Pre A1 真实词时间轴', () => {
  const manifest = readJson('manifest.json');
  const bundle = readJson('bundle-sentence-v1.json');
  const catalog = readJson('catalog-items.json');
  const report = readJson('clean-report.json');

  assert.equal(manifest.meta.level, 'Pre A1');
  assert.equal(manifest.meta.category, 'littlebear');
  assert.equal(manifest.tracks.length, 17);
  assert.equal(Object.keys(bundle).length, 17);
  assert.equal(catalog.length, 17);
  assert.equal(report.readyLineCount, 1786);
  assert.equal(report.validationErrorCount, 0);
  assert.ok(report.minimumLineDurationMs >= 20);
  assert.equal(new Set(catalog.map((item) => item.audioCloudPath)).size, 17);

  manifest.tracks.forEach((item) => {
    assert.match(item.audioCloudPath, /^Pre A1\/Little Bear\/Audio\/\d{3}-[a-z0-9-]+-[a-f0-9]{10}\.mp3$/);
    assert.equal(fs.existsSync(item.sourcePath), true);
    assert.equal(fs.existsSync(item.transcriptSourcePath), true);
    const track = bundle[item.trackId];
    assert.ok(track);
    assert.equal(track.syncGranularity, 'line');
    assert.match(track.source, /^official-doc-plus-whisper-base-word-timestamps$/);
    let previousEnd = -1;
    track.lines.forEach((line) => {
      assert.ok(line.text.trim());
      assert.ok(line.startMs >= previousEnd);
      assert.ok(line.endMs > line.startMs);
      assert.ok(line.sourceLineIndex > 0);
      previousEnd = line.endMs;
    });
    assert.equal(track.lines.at(-1).endMs, Math.round(track.durationSec * 1000));
  });
});

test('Little Bear 错配音频不会进入可上传目录', () => {
  const catalog = readJson('catalog-items.json');
  const rejected = readJson('rejected-mappings.json');
  const readyTitles = new Set(catalog.map((item) => item.title));

  assert.equal(Object.keys(rejected).length, 7);
  Object.values(rejected).forEach((item) => assert.equal(readyTitles.has(item.title), false));
  catalog.forEach((item) => {
    assert.equal(item.category, 'littlebear');
    assert.equal(item.transcriptStatus, 'ready');
    assert.equal(item.validationStatus, 'official-transcript-aligned');
  });
});

test('Little Bear 只在 Pre A1 使用静态轻量目录', () => {
  const catalogEngine = require('../cloudfunctions/yoyo/lib/catalog-engine');
  const listeningPlanEngine = require('../cloudfunctions/yoyo/lib/listening-plan-engine');
  const presenter = require('../cloudfunctions/yoyo/lib/task-presenter');
  const tasks = catalogEngine.getStaticCatalogMap().littlebear;
  const preA1 = listeningPlanEngine.buildMaterialEntries('Pre A1', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const a1 = listeningPlanEngine.buildMaterialEntries('A1', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const a2 = listeningPlanEngine.buildMaterialEntries('A2', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const material = preA1.find((item) => item.category === 'littlebear');

  assert.equal(tasks.length, 17);
  assert.deepEqual(material, {
    levelId: 'Pre A1',
    category: 'littlebear',
    title: 'Little Bear',
    totalCount: 17,
    enabled: true,
  });
  assert.equal(a1.some((item) => item.category === 'littlebear'), false);
  assert.equal(a2.some((item) => item.category === 'littlebear'), false);
  assert.equal(JSON.stringify(material).includes('audioUrl'), false);
  assert.equal(JSON.stringify(material).includes('lines'), false);
  assert.equal(presenter.getTaskPresentation(tasks[0]).displaySubtitle, 'Little Bear');
  assert.equal(listeningPlanEngine.normalizeMaterialLevelId('littlebear', 'A1'), 'Pre A1');
});
