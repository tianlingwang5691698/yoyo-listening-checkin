const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const ROOT = path.join(__dirname, '..');
const BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'A2', 'magic-tree-house');
const B1_BUILD_ROOT = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', 'B1', 'magic-tree-house');

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(BUILD_ROOT, fileName), 'utf8'));
}

test('Magic Tree House A2 本地 28 集与真实句级时间轴完整', () => {
  const manifest = readJson('manifest.json');
  const bundle = readJson('bundle-sentence-v3.json');
  const report = readJson('clean-report.json');
  assert.equal(manifest.meta.level, 'A2');
  assert.equal(manifest.meta.category, 'magictreehouse');
  assert.equal(manifest.meta.transcriptVersion, 'sentence-v3');
  assert.equal(manifest.tracks.length, 28);
  assert.equal(Object.keys(bundle).length, 28);
  assert.equal(report.validationErrorCount, 0);
  assert.equal(report.officialPdfTrackCount, 0);
  assert.equal(report.asrPrimaryTrackCount, 28);
  assert.equal(new Set(manifest.tracks.map((item) => item.id)).size, 28);
  assert.equal(new Set(manifest.tracks.map((item) => item.audioCloudPath)).size, 28);
  manifest.tracks.forEach((item, index) => {
    assert.equal(item.index, index + 1);
    assert.match(item.audioCloudPath, /^A2\/Magic Tree House\/Audio\/\d{3}-[a-z0-9-]+-[a-f0-9]{10}\.mp3$/);
    assert.equal(fs.existsSync(item.sourcePath), true);
    const track = bundle[item.trackId];
    assert.ok(track);
    assert.equal(track.source, 'whisper-small.en-segment-timestamps-primary');
    assert.equal(track.syncGranularity, 'line');
    assert.ok(track.lines.length > 100);
    let previousEnd = -1;
    track.lines.forEach((line) => {
      assert.ok(line.text.trim());
      assert.ok(line.startMs >= previousEnd);
      assert.ok(line.endMs > line.startMs);
      assert.ok(line.endMs - line.startMs <= 45 * 1000);
      if (previousEnd >= 0) assert.ok(line.startMs - previousEnd <= 30 * 1000);
      previousEnd = line.endMs;
    });
    assert.equal(track.lines.at(-1).endMs, Math.round(track.durationSec * 1000));
  });
});

test('Magic Tree House B1 本地 24 集与真实句级时间轴完整', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(B1_BUILD_ROOT, 'manifest.json'), 'utf8'));
  const report = JSON.parse(fs.readFileSync(path.join(B1_BUILD_ROOT, 'clean-report.json'), 'utf8'));
  assert.equal(manifest.meta.level, 'B1');
  assert.equal(manifest.meta.category, 'magictreehouseb1');
  assert.equal(manifest.meta.transcriptVersion, 'sentence-v3');
  assert.equal(manifest.tracks.length, 24);
  assert.equal(report.validationErrorCount, 0);
  assert.equal(report.officialPdfTrackCount, 0);
  assert.equal(report.asrPrimaryTrackCount, 24);
  manifest.tracks.forEach((item, offset) => {
    assert.equal(item.index, offset + 29);
    assert.match(item.audioCloudPath, /^B1\/Magic Tree House\/Audio\/\d{3}-[a-z0-9-]+-[a-f0-9]{10}\.mp3$/);
    assert.match(item.transcriptTrackCloudPath, /^_transcripts\/B1\/magic-tree-house\/tracks-v3\/track-magic-tree-house-\d{3}\.json$/);
    const trackPath = path.join(B1_BUILD_ROOT, 'tracks-v3', `${item.trackId}.json`);
    const track = JSON.parse(fs.readFileSync(trackPath, 'utf8'));
    assert.ok(track.lines.length > 900);
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
  const filePath = path.join(B1_BUILD_ROOT, 'tracks-v3', 'track-magic-tree-house-050.json');
  const text = fs.readFileSync(filePath, 'utf8');
  const startedAt = performance.now();
  const track = JSON.parse(text);
  const parseMs = performance.now() - startedAt;
  assert.ok(Buffer.byteLength(text) < 550 * 1024);
  assert.ok(parseMs < 30, `single track parse took ${parseMs}ms`);
  assert.ok(track.lines.length > 1500);
});

test('Magic Tree House bundle 解析与单集读取性能稳定', () => {
  const bundleText = fs.readFileSync(path.join(BUILD_ROOT, 'bundle-sentence-v3.json'), 'utf8');
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
