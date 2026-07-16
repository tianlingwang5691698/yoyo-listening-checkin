#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const appConfig = require('../app-config');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (error) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const COMPLETION_COLLECTION = 'studyCompletedItems';
const REPORT_COLLECTION = 'dailyReports';
const PACK_COLLECTION = 'listeningStudyPacks';

function readCredentials() {
  const credentialPath = path.join(ROOT, 'SecretKey.csv');
  const lines = fs.readFileSync(credentialPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const values = (lines[1] || '').split(',').map((item) => item.trim());
  return { secretId: values[0] || '', secretKey: values[1] || '' };
}

async function readAll(db, collectionName) {
  const rows = [];
  for (let skip = 0; ; skip += 100) {
    const result = await db.collection(collectionName).skip(skip).limit(100).get();
    const page = result && result.data || [];
    rows.push(...page);
    if (page.length < 100) return rows;
  }
}

function timestamp(item) {
  const value = Date.parse(item && (item.updatedAt || item.createdAt) || '');
  return Number.isFinite(value) ? value : 0;
}

function sortNewestFirst(left, right) {
  const delta = timestamp(right) - timestamp(left);
  return delta || String(right && right._id || '').localeCompare(String(left && left._id || ''));
}

function groupDuplicates(rows, keyName) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = String(row && row[keyName] || '').trim();
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return Array.from(groups.entries())
    .filter((entry) => entry[1].length > 1)
    .map(([key, items]) => ({ key, items: items.slice().sort(sortNewestFirst) }));
}

function dedupeRows(rows) {
  const byId = new Map();
  rows.forEach((row, index) => {
    const key = String(row && (row.recordId || row.id || row._id) || `row-${index}`);
    const current = byId.get(key);
    if (!current || sortNewestFirst(row, current) < 0) byId.set(key, row);
  });
  return Array.from(byId.values());
}

function affectedScopeKey(item) {
  return [item.familyId, item.childId, item.date].join('|');
}

async function removeInBatches(db, rows) {
  for (let index = 0; index < rows.length; index += 20) {
    await Promise.all(rows.slice(index, index + 20).map((row) => (
      db.collection(COMPLETION_COLLECTION).doc(row._id).remove()
    )));
  }
}

async function rebuildAffectedReports(db, affectedScopes) {
  const rebuilt = [];
  for (const scope of affectedScopes) {
    const completionResult = await db.collection(COMPLETION_COLLECTION).where(scope).orderBy('updatedAt', 'desc').limit(300).get();
    const completionItems = dedupeRows(completionResult && completionResult.data || []).map((item) => Object.assign({}, item, {
      id: item.recordId || item._id || ''
    }));
    const reportResult = await db.collection(REPORT_COLLECTION).where(scope).limit(20).get();
    const reports = reportResult && reportResult.data || [];
    const updatedAt = new Date().toISOString();
    await Promise.all(reports.map((report) => db.collection(REPORT_COLLECTION).doc(report._id).update({
      completionItems,
      updatedAt,
      data: db.command.remove()
    })));
    rebuilt.push(Object.assign({}, scope, {
      reportCount: reports.length,
      completionItemCount: completionItems.length
    }));
  }
  return rebuilt;
}

async function audit(db) {
  const [completions, packs, reports] = await Promise.all([
    readAll(db, COMPLETION_COLLECTION),
    readAll(db, PACK_COLLECTION),
    readAll(db, REPORT_COLLECTION)
  ]);
  const completionGroups = groupDuplicates(completions, 'recordId');
  const packGroups = groupDuplicates(packs, 'listeningId');
  const reportDuplicates = reports.filter((report) => groupDuplicates(report.completionItems || [], 'recordId').length > 0);
  const reportsWithNestedRepairData = reports.filter((report) => report && report.data && Array.isArray(report.data.completionItems));
  return {
    completions,
    completionGroups,
    packGroups,
    reports,
    reportDuplicates,
    reportsWithNestedRepairData,
    summary: {
      completionTotal: completions.length,
      completionDuplicateGroups: completionGroups.length,
      completionRowsToDelete: completionGroups.reduce((sum, group) => sum + group.items.length - 1, 0),
      packTotal: packs.length,
      packDuplicateGroups: packGroups.length,
      reportTotal: reports.length,
      reportsWithDuplicates: reportDuplicates.length,
      reportsWithNestedRepairData: reportsWithNestedRepairData.length
    }
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const credentials = readCredentials();
  if (!credentials.secretId || !credentials.secretKey) throw new Error('SecretKey.csv is missing valid SDK credentials');
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials });
  const db = app.database();
  const before = await audit(db);
  const duplicateRows = before.completionGroups.flatMap((group) => group.items.slice(1));
  const affectedSources = before.completionGroups.map((group) => group.items[0])
    .concat(before.reportDuplicates, before.reportsWithNestedRepairData);
  const affectedScopes = Array.from(new Map(affectedSources.map((item) => {
    const scope = { familyId: item.familyId, childId: item.childId, date: item.date };
    return [affectedScopeKey(scope), scope];
  })).values());
  const preview = {
    mode: apply ? 'apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    before: before.summary,
    affectedScopeCount: affectedScopes.length,
    keepCount: before.completionGroups.length,
    deleteCount: duplicateRows.length,
    packDeleteCount: 0
  };
  if (!apply) {
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  const reportOption = process.argv.find((item) => item.startsWith('--report='));
  const reportPath = path.resolve(reportOption
    ? reportOption.slice('--report='.length)
    : path.join(ROOT, 'data/cloud-repair/study-completion-dedupe-2026-07-17.json'));
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  if (!fs.existsSync(reportPath) || duplicateRows.length) {
    fs.writeFileSync(reportPath, JSON.stringify({
      createdAt: new Date().toISOString(),
      envId: appConfig.cloudEnvId,
      before: before.summary,
      keptRows: before.completionGroups.map((group) => group.items[0]),
      deletedRows: duplicateRows,
      listeningStudyPackDuplicateGroups: before.packGroups.map((group) => ({
        listeningId: group.key,
        count: group.items.length,
        ids: group.items.map((item) => item._id)
      }))
    }, null, 2));
  }

  await removeInBatches(db, duplicateRows);
  const rebuiltReports = await rebuildAffectedReports(db, affectedScopes);
  const after = await audit(db);
  const verified = after.summary.completionDuplicateGroups === 0
    && after.summary.reportsWithDuplicates === 0
    && after.summary.reportsWithNestedRepairData === 0
    && after.summary.packDuplicateGroups === 0;
  if (!verified) throw new Error(`duplicate-repair-verification-failed:${JSON.stringify(after.summary)}`);
  console.log(JSON.stringify(Object.assign({}, preview, {
    verified,
    reportPath,
    rebuiltReports,
    after: after.summary
  }), null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
