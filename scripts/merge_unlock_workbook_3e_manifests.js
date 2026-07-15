#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET = path.join(ROOT, 'cloudfunctions/yoyo/data/unlock-series-manifests.json');
const EXPECTED = [
  ['A1', 1, 12], ['A2', 2, 16], ['B1', 3, 13], ['B2', 4, 15]
];
const manifest = JSON.parse(fs.readFileSync(TARGET, 'utf8'));
for (const [level, number, count] of EXPECTED) {
  const category = `unlock${number}workbookthirdedition`;
  const buildRoot = path.join(ROOT, `data/transcript-build/unlock${number}-workbook-third-edition`, level, `unlock${number}`);
  const section = JSON.parse(fs.readFileSync(path.join(buildRoot, 'manifest-section.json'), 'utf8'))[category];
  const report = JSON.parse(fs.readFileSync(path.join(buildRoot, 'clean-report.json'), 'utf8'));
  if (!section || section.tracks.length !== count || report.validationErrorCount !== 0) {
    throw new Error(`${category} manifest is not ready`);
  }
  manifest[category] = section;
}
fs.writeFileSync(TARGET, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(Object.fromEntries(EXPECTED.map(([level, number]) => {
  const category = `unlock${number}workbookthirdedition`;
  return [category, manifest[category].tracks.length];
})), null, 2));
