const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { buildWritingReportPdf, FONT_PATH } = require('../lib/writing-report-pdf');
const writing = require('../services/writing.service');

test('生成含中英文、题目图片、作文和批改内容的 PDF', async () => {
  const image = fs.readFileSync(path.resolve(
    __dirname,
    '../../../data/writing-senior-autumn/images/sh-autumn-2012-writing-1-fa232447b7.png'
  ));
  const buffer = await buildWritingReportPdf({
    attempt: {
      title: '初中、高中与 IELTS 写作报告',
      prompt: 'Write an essay.',
      promptMeta: {
        directions: 'Directions: Read the task carefully.',
        scenario: '请根据题目完成写作。',
        requirements: ['观点明确', '举例充分'],
        notices: ['不得出现真实姓名。'],
        promptStarter: 'In my opinion,',
        minWords: 60
      },
      essay: 'This is the complete student essay. It contains two paragraphs.',
      wordCount: 11,
      totalScore: 20,
      review: {
        score: 16,
        totalScore: 20,
        level: '良好',
        summary: '结构清楚，内容完整。',
        criterionDetails: [{
          label: '内容与任务完成',
          comment: '任务完成度较高。',
          evidence: ['原文观点明确。'],
          descriptorMatch: '符合当前档要求。',
          limiters: ['细节仍可展开。'],
          nextBandActions: ['补充具体例证。']
        }],
        strengths: ['观点明确'],
        problems: ['句式变化不足'],
        suggestions: ['增加复合句'],
        grammarCorrections: [{
          original: 'He go to school.',
          corrected: 'He goes to school.',
          reason: '主谓一致。'
        }],
        polishedVersion: 'This is a polished model answer.'
      }
    },
    imageBuffers: [image]
  });

  assert.equal(buffer.subarray(0, 4).toString(), '%PDF');
  assert.ok(buffer.length > 10000);
  assert.ok(fs.existsSync(FONT_PATH));
  const output = path.join(os.tmpdir(), `writing-report-${Date.now()}.pdf`);
  fs.writeFileSync(output, buffer);
  assert.ok(fs.statSync(output).size > 10000);
  fs.unlinkSync(output);
});

test('旧写作记录原题图片字段可规范化为 PDF 与记录页共用格式', () => {
  assert.deepEqual(writing._test.normalizeAttemptPromptImages([
    {
      fileID: 'cloud://example/image.jpg',
      cloudPath: '_content/writing/image.jpg',
      url: 'https://example.test/image.jpg',
      alt: '原题图'
    }
  ]), [{
    fileId: 'cloud://example/image.jpg',
    cloudPath: '_content/writing/image.jpg',
    alt: '原题图',
    src: 'https://example.test/image.jpg'
  }]);
});
