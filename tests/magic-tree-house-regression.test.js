const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const ROOT = path.join(__dirname, '..');
const catalogEngine = require('../cloudfunctions/yoyo/lib/catalog-engine');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'A2', 'magic-tree-house');
const B1_BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'B1', 'magic-tree-house');

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(BUILD_ROOT, fileName), 'utf8'));
}

test('Magic Tree House A2 本地 28 集与真实句级时间轴完整', () => {
  const manifest = readJson('manifest.json');
  const bundle = readJson('bundle-sentence-v4.json');
  const progress = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'whisperx-v4-progress.json'), 'utf8'));
  assert.equal(manifest.meta.level, 'A2');
  assert.equal(manifest.meta.category, 'magictreehouse');
  assert.equal(manifest.tracks.length, 28);
  assert.equal(Object.keys(bundle).length, 28);
  assert.equal(progress.completedCount, 52);
  assert.equal(progress.failures.length, 0);
  assert.equal(progress.tracks.filter((item) => item.level === 'A2').length, 28);
  assert.equal(new Set(manifest.tracks.map((item) => item.id)).size, 28);
  assert.equal(new Set(manifest.tracks.map((item) => item.audioCloudPath)).size, 28);
  manifest.tracks.forEach((item, index) => {
    assert.equal(item.index, index + 1);
    assert.match(item.audioCloudPath, /^A2\/Magic Tree House\/Audio\/\d{3}-[a-z0-9-]+-[a-f0-9]{10}\.mp3$/);
    assert.equal(fs.existsSync(item.sourcePath), true);
    const track = bundle[item.trackId];
    assert.ok(track);
    assert.equal(track.source, 'whisperx-wav2vec2-forced-alignment-asr-primary');
    assert.equal(track.syncGranularity, 'line');
    assert.ok(track.lines.length > 100);
    let previousEnd = -1;
    track.lines.forEach((line, lineIndex) => {
      assert.ok(line.text.trim());
      assert.ok(line.startMs >= previousEnd);
      assert.ok(line.endMs > line.startMs);
      const maxLineDurationMs = lineIndex === track.lines.length - 1 ? 60 * 1000 : 45 * 1000;
      assert.ok(line.endMs - line.startMs <= maxLineDurationMs);
      if (previousEnd >= 0) assert.ok(line.startMs - previousEnd <= 30 * 1000);
      previousEnd = line.endMs;
    });
    assert.equal(track.lines.at(-1).endMs, Math.round(track.durationSec * 1000));
  });
});

test('Magic Tree House B1 本地 24 集与真实句级时间轴完整', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(B1_BUILD_ROOT, 'manifest.json'), 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(path.join(B1_BUILD_ROOT, 'bundle-sentence-v4.json'), 'utf8'));
  assert.equal(manifest.meta.level, 'B1');
  assert.equal(manifest.meta.category, 'magictreehouseb1');
  assert.equal(manifest.tracks.length, 24);
  assert.equal(Object.keys(bundle).length, 24);
  manifest.tracks.forEach((item, offset) => {
    assert.equal(item.index, offset + 29);
    assert.match(item.audioCloudPath, /^B1\/Magic Tree House\/Audio\/\d{3}-[a-z0-9-]+-[a-f0-9]{10}\.mp3$/);
    const trackPath = path.join(B1_BUILD_ROOT, 'tracks-v4', `${item.trackId}.json`);
    const track = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    assert.equal(track.source, 'whisperx-wav2vec2-forced-alignment-asr-primary');
    assert.ok(track.lines.length > 300);
    assert.equal(track.lines.at(-1).endMs, Math.round(track.durationSec * 1000));
  });
});

test('Magic Tree House 分别在 A2、B1 显示且首屏为轻量摘要', () => {
  const catalogEngine = require('../cloudfunctions/yoyo/lib/catalog-engine');
  const listeningPlanEngine = require('../cloudfunctions/yoyo/lib/listening-plan-engine');
  const startedAt = performance.now();
  const preA1 = listeningPlanEngine.buildMaterialEntries('Pre A1', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const a1 = listeningPlanEngine.buildMaterialEntries('A1', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const a2 = listeningPlanEngine.buildMaterialEntries('A2', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const b1 = listeningPlanEngine.buildMaterialEntries('B1', { getCatalogSummary: catalogEngine.getCatalogSummary });
  const elapsedMs = performance.now() - startedAt;
  const material = a2.find((item) => item.category === 'magictreehouse');
  const b1Material = b1.find((item) => item.category === 'magictreehouseb1');
  assert.deepEqual(material, {
    levelId: 'A2',
    category: 'magictreehouse',
    title: 'Magic Tree House',
    totalCount: 28,
    enabled: true
  });
  assert.equal(preA1.some((item) => item.category === 'magictreehouse'), false);
  assert.equal(a1.some((item) => item.category === 'magictreehouse'), false);
  assert.equal(b1.some((item) => item.category === 'magictreehouse'), false);
  assert.deepEqual(b1Material, {
    levelId: 'B1',
    category: 'magictreehouseb1',
    title: 'Magic Tree House',
    totalCount: 24,
    enabled: true
  });
  assert.equal(JSON.stringify(material).includes('audioUrl'), false);
  assert.equal(JSON.stringify(material).includes('lines'), false);
  assert.ok(elapsedMs < 300, `A2 summary build took ${elapsedMs}ms`);
});

test('Magic Tree House 单集文本按需加载，避免下载 B1 整包', () => {
  const filePath = path.join(B1_BUILD_ROOT, 'tracks-v4', 'track-magic-tree-house-050.json');
  const text = fs.readFileSync(filePath, 'utf8');
  const startedAt = performance.now();
  const track = JSON.parse(text);
  const parseMs = performance.now() - startedAt;
  assert.ok(Buffer.byteLength(text) < 550 * 1024);
  assert.ok(parseMs < 30, `single track parse took ${parseMs}ms`);
  assert.ok(track.lines.length > 1500);
});

test('Magic Tree House bundle 解析与单集读取性能稳定', () => {
  const bundleText = fs.readFileSync(path.join(BUILD_ROOT, 'bundle-sentence-v4.json'), 'utf8');
  const startedAt = performance.now();
  const bundle = JSON.parse(bundleText);
  const parseMs = performance.now() - startedAt;
  const readStartedAt = performance.now();
  const track = bundle['track-magic-tree-house-014'];
  const serialized = JSON.stringify(track);
  const readMs = performance.now() - readStartedAt;
  assert.ok(Buffer.byteLength(bundleText) < 7 * 1024 * 1024);
  assert.ok(parseMs < 100, `bundle parse took ${parseMs}ms`);
  assert.ok(readMs < 30, `single track read took ${readMs}ms`);
  assert.ok(Buffer.byteLength(serialized) < 300 * 1024);
});

test('Magic Tree House 云端目录只读静态 manifest，不扫描云存储', async () => {
  const startedAt = Date.now();
  await catalogEngine.refreshRuntimeCatalogs(true, ['magictreehouse', 'magictreehouseb1']);
  const elapsedMs = Date.now() - startedAt;
  assert.equal(catalogEngine.getCatalog('magictreehouse').length, 28);
  assert.equal(catalogEngine.getCatalog('magictreehouseb1').length, 24);
  assert.match(catalogEngine.getCatalog('magictreehouse')[0].textSource.filePath, /tracks-v6/);
  assert.ok(elapsedMs < 50, `static manifest refresh took ${elapsedMs}ms`);
});
