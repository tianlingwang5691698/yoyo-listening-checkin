#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const appConfig = require('../app-config');
const fixedPlanSummary = require('../cloudfunctions/yoyo/lib/fixed-plan-summary');

let cloudbase;
try {
  cloudbase = require('../cloudfunctions/yoyo/node_modules/@cloudbase/node-sdk');
} catch (_) {
  cloudbase = require('@cloudbase/node-sdk');
}

const ROOT = path.join(__dirname, '..');
const COLLECTION_NAME = 'fixedPlanProgressSummaries';

function readCredentials() {
  const credentialPath = path.join(ROOT, 'SecretKey.csv');
  if (!fs.existsSync(credentialPath)) return {};
  const lines = fs.readFileSync(credentialPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return {};
  const values = lines[1].split(',').map((item) => item.trim());
  return { secretId: values[0] || '', secretKey: values[1] || '' };
}

async function readAll(query, pageSize = 100) {
  const rows = [];
  let offset = 0;
  while (true) {
    const result = await query.skip(offset).limit(pageSize).get();
    const page = result && result.data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
    offset += page.length;
  }
}

async function readDocument(reference) {
  try {
    const result = await reference.get();
    if (!result || !result.data) return null;
    return Array.isArray(result.data) ? (result.data[0] || null) : result.data;
  } catch (error) {
    const message = String(error && (error.errMsg || error.message) || error || '');
    if (message.includes('-502005') || /document.*not exist|not found/i.test(message)) return null;
    throw error;
  }
}

function parseChildLoginCode() {
  const option = process.argv.find((item) => item.startsWith('--child-login-code='));
  return String(option ? option.slice('--child-login-code='.length) : '317613').trim();
}

async function main() {
  const apply = process.argv.includes('--apply');
  const childLoginCode = parseChildLoginCode();
  const credentials = readCredentials();
  if (!credentials.secretId || !credentials.secretKey) {
    throw new Error('SecretKey.csv is missing valid SDK credentials');
  }
  const app = cloudbase.init({ env: appConfig.cloudEnvId, ...credentials });
  const db = app.database();
  const childResult = await db.collection('children').where({ childLoginCode }).limit(2).get();
  const children = childResult && childResult.data || [];
  if (children.length !== 1) throw new Error(`child-count-invalid:${childLoginCode}:${children.length}`);
  const child = children[0];
  const scope = { familyId: String(child.familyId || ''), childId: String(child.childId || '') };
  if (!scope.familyId || !scope.childId) throw new Error(`child-scope-missing:${childLoginCode}`);
  const [membersResult, progressRecords] = await Promise.all([
    db.collection('familyMembers').where({ familyId: scope.familyId }).get(),
    readAll(db.collection('dailyTaskProgress').where(scope))
  ]);
  const members = membersResult && membersResult.data || [];
  const summaryReference = db.collection(COLLECTION_NAME).doc(fixedPlanSummary.buildSummaryId(scope));
  const current = await readDocument(summaryReference);
  const summary = fixedPlanSummary.buildSummaryDocument(progressRecords, scope, current);
  const report = {
    mode: apply ? 'apply' : 'dry-run',
    envId: appConfig.cloudEnvId,
    collection: COLLECTION_NAME,
    childLoginCode,
    familyId: scope.familyId,
    childId: scope.childId,
    familyMemberCount: members.length,
    familyRoles: Array.from(new Set(members.map((item) => String(item.role || '')).filter(Boolean))).sort(),
    sourceProgressCount: progressRecords.length,
    fixedPlanProgressCount: summary.sourceRecordCount,
    completedProgressCount: summary.completedRecordCount,
    slotCount: Object.keys(summary.slots || {}).length,
    existingSummary: !!current,
    summaryId: fixedPlanSummary.buildSummaryId(scope)
  };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  await summaryReference.set(summary);
  const saved = await readDocument(summaryReference);
  const verified = !!(saved
    && Number(saved.version || 0) === fixedPlanSummary.SUMMARY_VERSION
    && Number(saved.sourceRecordCount || 0) === Number(summary.sourceRecordCount || 0)
    && Object.keys(saved.slots || {}).length === Object.keys(summary.slots || {}).length);
  if (!verified) {
    throw new Error(`fixed-plan-summary-readback-mismatch:${JSON.stringify({
      savedVersion: saved && saved.version,
      expectedVersion: fixedPlanSummary.SUMMARY_VERSION,
      savedSourceRecordCount: saved && saved.sourceRecordCount,
      expectedSourceRecordCount: summary.sourceRecordCount,
      savedSlotCount: Object.keys(saved && saved.slots || {}).length,
      expectedSlotCount: Object.keys(summary.slots || {}).length
    })}`);
  }
  console.log(JSON.stringify(Object.assign({}, report, {
    verified,
    savedUpdatedAt: saved.updatedAt || ''
  }), null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
