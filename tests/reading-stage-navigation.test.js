const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadReadingPage() {
  const source = fs.readFileSync(path.join(__dirname, '../pages/reading/index.js'), 'utf8');
  let pageConfig = null;
  const page = {
    createCloudPageData(data) { return data; },
    buildCloudPageData(current, patch) { return Object.assign({}, current, patch); }
  };
  vm.runInNewContext(source, {
    Page(config) { pageConfig = config; },
    require(request) {
      if (request === '../../utils/page') return page;
      if (request === '../../utils/i18n') {
        return { getPageText(pageName, key, params, fallback) { return fallback; } };
      }
      return {};
    },
    Set,
    Object,
    Array,
    Number,
    String,
    encodeURIComponent
  });
  return pageConfig;
}

function group(key, count) {
  return {
    key,
    label: key,
    count,
    districts: [{ key: `${key}-node`, label: `${key}目录`, count, passages: [] }]
  };
}

test('阅读入口按初中和高中分层并隐藏真题卷', () => {
  const config = loadReadingPage();
  const context = Object.assign({}, config, {
    data: Object.assign({}, config.data),
    setData(patch) { this.data = Object.assign({}, this.data, patch); }
  });
  const data = {
    categoryTree: [{
      key: 'exam-reading',
      label: '英语真题阅读',
      groups: [group('一模', 10), group('二模', 20), group('真题', 30), group('春考', 4), group('秋考', 5)]
    }]
  };

  config.applyReadingHome.call(context, data);
  assert.deepEqual(Array.from(context.data.categoryRoot.stages, (stage) => stage.label), ['初中', '高中']);
  assert.deepEqual(Array.from(context.data.categoryRoot.stages[0].groups, (item) => item.label), ['一模', '二模']);
  assert.deepEqual(Array.from(context.data.categoryRoot.stages[1].groups, (item) => item.label), ['春考', '秋考']);
  assert.equal(context.data.categoryRoot.count, 39);

  config.selectStage.call(context, { currentTarget: { dataset: { stage: 'senior' } } });
  assert.equal(context.data.navigationLevel, 'stage');
  assert.equal(context.data.selectedGroup.key, '春考');
  config.selectExamType.call(context, { currentTarget: { dataset: { examType: '秋考' } } });
  assert.equal(context.data.navigationLevel, 'exam');
  assert.equal(context.data.selectedGroup.key, '秋考');
  config.selectDistrict.call(context, { currentTarget: { dataset: { district: '秋考-node' } } });
  assert.equal(context.data.navigationLevel, 'district');
  config.backOneLevel.call(context);
  assert.equal(context.data.navigationLevel, 'exam');
  config.backOneLevel.call(context);
  assert.equal(context.data.navigationLevel, 'stage');
  config.backOneLevel.call(context);
  assert.equal(context.data.navigationLevel, 'root');
});
