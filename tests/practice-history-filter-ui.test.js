const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function loadPageDefinition() {
  const source = read('pages/practice-history/index.js');
  let definition;
  const catalog = {
    filterRecords: '筛选',
    filterAllRecords: '全部记录',
    filterJunior: '初中',
    filterSenior: '高中',
    filterOther: '其他',
    filterOtherGrammar: '其他语法',
    recordUnit: '条'
  };
  const sandbox = {
    Page(value) {
      definition = value;
    },
    getApp() {
      return { globalData: {} };
    },
    setTimeout,
    clearTimeout,
    console,
    wx: {},
    require(request) {
      if (request === '../../utils/page') {
        return {
          createCloudPageData: (value) => Object.assign({ theme: 'warm', language: 'zh-CN' }, value)
        };
      }
      if (request === '../../utils/i18n') {
        return { getPageText: (_page, key, _language, fallback) => catalog[key] || fallback || key };
      }
      if (request === '../../utils/i18n-catalog-learning') {
        return { practiceHistory: { 'zh-CN': catalog } };
      }
      if (request === '../../utils/writing-report') {
        return { normalizeWritingReview: (value) => value || {} };
      }
      if (request.startsWith('../../utils/') || request === '../../app-config') return {};
      throw new Error(`Unexpected require: ${request}`);
    }
  };
  vm.runInNewContext(source, sandbox, { filename: 'pages/practice-history/index.js' });
  return definition;
}

function createPage(definition, type) {
  const instance = {
    data: Object.assign({}, definition.data, { type }),
    allHistoryRecords: [],
    setData(patch) {
      Object.assign(this.data, patch);
    }
  };
  [
    'setHistoryRecords',
    'filterHistoryRecords',
    'selectRecordFilter',
    'updateRecord',
    'updateQuestion'
  ].forEach((name) => {
    instance[name] = definition[name].bind(instance);
  });
  return instance;
}

test('五板块四主题仅在多来源时显示轻筛选', () => {
  const template = read('pages/practice-history/index.wxml');
  const style = read('pages/practice-history/index.wxss');
  ['warm', 'library', 'voyage', 'dragon'].forEach((theme) => {
    assert.match(template, new RegExp(`class="${theme}-history-filter"`));
    assert.match(style, new RegExp(`\\.${theme}-history-filter`));
  });
  assert.match(style, /\.theme-tactical\.history-grammar \.history-summary\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(style, /\.theme-tactical\.history-grammar \.history-summary-main\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*min-width:\s*0/);
  assert.equal((template.match(/viewMode === 'history' && recordFilterOptions\.length/g) || []).length, 4);
  assert.doesNotMatch(template, /class="history-record-filter"/);

  const definition = loadPageDefinition();
  const reading = createPage(definition, 'reading');
  reading.setHistoryRecords([
    { id: 'junior-1', filterKey: 'junior', filterLabel: '初中', filterOrder: 10 },
    { id: 'ielts-1', filterKey: 'ielts', filterLabel: 'IELTS', filterOrder: 30 }
  ]);
  assert.equal(reading.data.recordFilterOptions.length, 3);
  reading.selectRecordFilter({ currentTarget: { dataset: { filterKey: 'ielts' } } });
  assert.deepEqual(reading.data.records.map((item) => item.id), ['ielts-1']);
  assert.equal(reading.allHistoryRecords.length, 2);
  reading.updateRecord('ielts-1', { detailReady: true });
  assert.equal(reading.allHistoryRecords.find((item) => item.id === 'ielts-1').detailReady, true);

  const singleSource = createPage(definition, 'writing');
  singleSource.setHistoryRecords([
    { id: 'junior-1', filterKey: 'junior', filterLabel: '初中', filterOrder: 10 }
  ]);
  assert.equal(singleSource.data.recordFilterOptions.length, 0);

  const speaking = createPage(definition, 'speaking');
  speaking.setHistoryRecords([
    { id: 'repeat-1', filterKey: 'repeat', filterLabel: '分级跟读' },
    { id: 'ielts-1', filterKey: 'ielts', filterLabel: '雅思口语' }
  ]);
  assert.equal(speaking.data.recordFilterOptions.length, 3);

  const vocabulary = createPage(definition, 'vocabulary');
  vocabulary.setHistoryRecords([
    { id: 'book-1', filterKey: 'book-1', filterLabel: '词表一' },
    { id: 'book-2', filterKey: 'book-2', filterLabel: '词表二' }
  ]);
  assert.equal(vocabulary.data.recordFilterOptions.length, 0);
});
