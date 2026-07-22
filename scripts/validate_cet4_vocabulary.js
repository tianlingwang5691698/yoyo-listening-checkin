#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_ROOT = path.join(ROOT, 'data', 'dictionary-import', 'cet4-v1');
const FINAL_ROOT = path.join(DATA_ROOT, 'cet4');
const REPORT_PATH = path.join(DATA_ROOT, 'clean-report.json');
const REJECTED_PATH = path.join(DATA_ROOT, 'rejected.json');

function clean(value) {
  return String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

function exampleContainsWord(word, example) {
  const target = clean(word).toLowerCase().replace('(al)', '');
  const text = ` ${clean(example).toLowerCase().replace(/[^a-z'-]+/g, ' ')} `;
  if (target.includes(' ')) return text.includes(` ${target} `);
  const variants = new Set([target, `${target}s`, `${target}es`, `${target}ed`, `${target}ing`]);
  if (target.endsWith('e')) {
    variants.add(`${target}d`);
    variants.add(`${target.slice(0, -1)}ed`);
    variants.add(`${target.slice(0, -1)}ing`);
  }
  if (target.endsWith('y')) {
    variants.add(`${target.slice(0, -1)}ies`);
    variants.add(`${target.slice(0, -1)}ied`);
  }
  variants.add(`${target}${target.slice(-1)}ed`);
  variants.add(`${target}${target.slice(-1)}ing`);
  const irregular = { kneel: ['knelt'], overcome: ['overcame', 'overcome'] };
  (irregular[target] || []).forEach((value) => variants.add(value));
  return Array.from(variants).some((value) => text.includes(` ${value} `));
}

function main() {
  const expected = JSON.parse(fs.readFileSync(path.join(DATA_ROOT, 'candidate-report.json'), 'utf8'));
  const rejected = [];
  const lists = [];
  let total = 0;
  let duplicates = 0;
  let missingFields = 0;
  let maxBytes = 0;
  for (let list = 1; list <= 35; list += 1) {
    const filePath = path.join(FINAL_ROOT, `list-${list}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`missing-list:${list}`);
    let body = fs.readFileSync(filePath);
    const rows = JSON.parse(body.toString('utf8'));
    if (!Array.isArray(rows)) throw new Error(`list-not-array:${list}`);
    const seen = new Set();
    rows.forEach((row, index) => {
      const issues = [];
      const key = clean(row.wordLower);
      if (seen.has(key)) {
        issues.push('duplicate-key');
        duplicates += 1;
      }
      seen.add(key);
      if (!clean(row.word) || row.wordLower !== clean(row.word).toLowerCase()) issues.push('word-invalid');
      if (row.level !== 'cet4' || Number(row.list) !== list) issues.push('location-invalid');
      if (!Array.isArray(row.definitions) || !row.definitions.length || row.definitions.some((value) => !clean(value))) issues.push('definitions-missing');
      if (!/^\/.{1,80}\/$/.test(clean(row.phonetic)) || /[\u3400-\u9fff]/.test(clean(row.phonetic))) issues.push('phonetic-invalid');
      if (!clean(row.example) || !clean(row.exampleMeaning) || !exampleContainsWord(row.word, row.example)) issues.push('example-invalid');
      if (!clean(row.source) || !Array.isArray(row.sourceFiles) || !row.sourceFiles.length || Number(row.sourcePage) < 15) issues.push('source-invalid');
      if (issues.length) {
        missingFields += 1;
        rejected.push({ list, index, word: row.word, sourcePage: row.sourcePage, reasons: issues });
      } else if (row.auditStatus === 'deterministic-pending') {
        row.auditStatus = 'deterministic-audited';
      }
    });
    body = Buffer.from(`${JSON.stringify(rows, null, 2)}\n`);
    fs.writeFileSync(filePath, body);
    const expectedList = expected.lists.find((item) => item.list === list);
    if (!expectedList || rows.length !== expectedList.count) throw new Error(`list-count-mismatch:${list}:${rows.length}/${expectedList && expectedList.count}`);
    if (body.length >= 1024 * 1024) throw new Error(`list-too-large:${list}:${body.length}`);
    maxBytes = Math.max(maxBytes, body.length);
    total += rows.length;
    lists.push({ list, count: rows.length, bytes: body.length, sha256: crypto.createHash('sha256').update(body).digest('hex') });
  }
  const report = {
    source: expected.source,
    inputCount: expected.total,
    passedCount: total - rejected.length,
    rejectedCount: rejected.length,
    duplicateCount: duplicates,
    missingFieldCount: missingFields,
    total,
    maxBytes,
    lists,
    validatedAt: new Date().toISOString()
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(REJECTED_PATH, `${JSON.stringify(rejected, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (rejected.length || total !== expected.total) process.exitCode = 1;
}

main();
