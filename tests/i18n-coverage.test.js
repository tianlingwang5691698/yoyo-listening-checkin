const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function walk(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath, extension);
    return entry.isFile() && fullPath.endsWith(extension) ? [fullPath] : [];
  });
}

test('WXML contains no hard-coded Chinese product copy', () => {
  const files = walk(path.join(root, 'pages'), '.wxml').concat(walk(path.join(root, 'custom-tab-bar'), '.wxml'));
  const failures = files.flatMap((file) => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    return lines.flatMap((line, index) => /[\u3400-\u9fff]/.test(line)
      ? [`${path.relative(root, file)}:${index + 1}: ${line.trim()}`]
      : []);
  });
  assert.deepEqual(failures, [], `Hard-coded Chinese remains in WXML:\n${failures.join('\n')}`);
});

test('navigation JSON uses runtime titles without hard-coded Chinese', () => {
  const failures = walk(path.join(root, 'pages'), '.json').flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return /[\u3400-\u9fff]/.test(source) ? [path.relative(root, file)] : [];
  });
  assert.deepEqual(failures, [], `Chinese navigation fallback remains: ${failures.join(', ')}`);
});

test('toast, modal and runtime navigation literals are localized', () => {
  const failures = walk(path.join(root, 'pages'), '.js').flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const callPattern = /wx\.(?:showToast|showModal|setNavigationBarTitle)\s*\(\s*\{[\s\S]{0,700}?\}\s*\)/g;
    return (source.match(callPattern) || []).flatMap((call) => {
      const withoutLocalizedFallbacks = call.replace(/(?:text|t)\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]*['"]\s*\)/g, 'localizedText');
      return /[\u3400-\u9fff]/.test(withoutLocalizedFallbacks)
        ? [`${path.relative(root, file)}: ${call.slice(0, 120).replace(/\s+/g, ' ')}`]
        : [];
    });
  });
  assert.deepEqual(failures, [], `Localized API calls still contain Chinese:\n${failures.join('\n')}`);
});

test('page catalogs have matching zh-CN and en keys', () => {
  const catalogs = [
    require('../utils/i18n-catalog-home'),
    require('../utils/i18n-catalog-learning'),
    require('../utils/i18n-catalog-account')
  ];
  catalogs.forEach((catalog) => {
    Object.entries(catalog).forEach(([scope, languages]) => {
      const zhKeys = Object.keys(languages['zh-CN'] || {}).sort();
      const enKeys = Object.keys(languages.en || {}).sort();
      assert.deepEqual(enKeys, zhKeys, `${scope} catalog keys differ`);
      assert.ok(zhKeys.includes('navTitle'), `${scope} is missing navTitle`);
      const englishWithChinese = Object.entries(languages.en || {}).filter(([, value]) => /[\u3400-\u9fff]/.test(String(value)));
      assert.deepEqual(englishWithChinese, [], `${scope} English catalog still contains Chinese`);
    });
  });
});

test('every WXML texts key exists in its page catalog', () => {
  const i18n = require('../utils/i18n');
  const failures = walk(path.join(root, 'pages'), '.wxml').flatMap((file) => {
    const route = path.relative(root, file).replace(/\.wxml$/, '');
    const scope = i18n.getPageScope(route);
    if (!scope) return [`${route}: missing page scope`];
    const texts = i18n.getPageTexts(scope, 'en');
    const source = fs.readFileSync(file, 'utf8');
    const keys = [...source.matchAll(/texts\.([A-Za-z0-9_]+)/g)].map((match) => match[1]);
    return [...new Set(keys)].filter((key) => !Object.prototype.hasOwnProperty.call(texts, key))
      .map((key) => `${route}: texts.${key}`);
  });
  assert.deepEqual(failures, [], `Missing WXML i18n keys:\n${failures.join('\n')}`);
});

test('English page rules never split a single word', () => {
  const files = [path.join(root, 'app.wxss')].concat(walk(path.join(root, 'pages'), '.wxss'));
  const failures = files.flatMap((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return [...source.matchAll(/([^{}]*\.language-en[^{}]*)\{([^{}]*)\}/g)].flatMap((match) => {
      const body = match[2] || '';
      return /overflow-wrap:\s*(?:break-word|anywhere)|word-break:\s*(?:break-all|break-word)/.test(body)
        ? [`${path.relative(root, file)}: ${match[1].trim().replace(/\s+/g, ' ')}`]
        : [];
    });
  });
  assert.deepEqual(failures, [], `English rules can split words:\n${failures.join('\n')}`);
});

test('Reading toast messages stay short in English', () => {
  const reading = require('../utils/i18n-catalog-learning').readingDetail.en;
  const toastKeys = [
    'generateFailed', 'translateFailed', 'parentPreview', 'addedReview', 'lookupFailed',
    'addSuccess', 'addFailed', 'playbackFailed', 'pronunciationFailed', 'finishFirst',
    'trialDone', 'submitted', 'analysisFailed'
  ];
  const failures = toastKeys.filter((key) => String(reading[key] || '').length > 18);
  assert.deepEqual(failures, [], `Reading English toast text is too long: ${failures.join(', ')}`);
});
