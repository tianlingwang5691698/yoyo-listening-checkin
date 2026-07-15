#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TARGET_PATH = path.join(ROOT, 'cloudfunctions', 'yoyo', 'data', 'static-catalog-manifests.json');

const target = JSON.parse(fs.readFileSync(TARGET_PATH, 'utf8'));
const categories = target.categories || (target.categories = {});
const configs = [
  { level: 'A2', category: 'magictreehouse', start: 1, count: 28 },
  { level: 'B1', category: 'magictreehouseb1', start: 29, count: 24 }
];

for (const config of configs) {
  const sourcePath = path.join(ROOT, 'data', 'transcript-build', 'magic-tree-house', config.level, 'magic-tree-house', 'catalog-items.json');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  if (!Array.isArray(source) || source.length !== config.count) {
    throw new Error(`expected ${config.count} Magic Tree House ${config.level} items`);
  }
  if (!source.every((item, offset) => item.category === config.category
    && item.taskId === `magic-tree-house-${String(config.start + offset).padStart(3, '0')}`
    && String(item.audioCloudPath || '').startsWith(`${config.level}/Magic Tree House/Audio/`))) {
    throw new Error(`Magic Tree House ${config.level} catalog structure is invalid`);
  }
  if (categories[config.category] && JSON.stringify(categories[config.category]) !== JSON.stringify(source)) {
    const stable = (item) => {
      const copy = Object.assign({}, item);
      delete copy.textSource;
      delete copy.validationStatus;
      return copy;
    };
    const current = categories[config.category];
    const onlyTextRouteChanged = current.length === source.length
      && current.every((item, index) => JSON.stringify(stable(item)) === JSON.stringify(stable(source[index])));
    if (!onlyTextRouteChanged) {
      throw new Error(`existing ${config.category} audio manifest differs; refusing overwrite`);
    }
  }
  categories[config.category] = source;
}
fs.writeFileSync(TARGET_PATH, `${JSON.stringify(target, null, 2)}\n`);
console.log(JSON.stringify({ categories: configs.map(({ level, category, count }) => ({ level, category, count })), target: TARGET_PATH }, null, 2));
