const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildWeeklyOpsReport, formatWeeklyOpsReportMessage, getKstWeekRange, parseWeekOffset } = require('../src/weeklyOpsReport');
const { readHistory, resetWeeklyOpsReportForTests, runWeeklyOpsReportTick, sendWeeklyOpsReport, startWeeklyOpsReportScheduler } = require('../src/weeklyOpsReportScheduler');
const { getOperationDataPaths } = require('../src/operationDataPaths');
const { collectBackupSnapshot } = require('../src/operationBackup');
const { LOCAL_FILENAMES } = require('./restore-operation-backup');
const { createAdminRequestHandler } = require('../src/adminServer');

const previousPassword = process.env.ADMIN_DASHBOARD_PASSWORD;
process.env.ADMIN_DASHBOARD_PASSWORD = 'weekly-report-test-password';
const authorization = `Basic ${Buffer.from('admin:weekly-report-test-password').toString('base64')}`;

function tempPath() { return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-report-')), 'history.json'); }
function repository(input) {
  return { loadState() { return { pointsData: { users: input.users || [], pointTransactions: input.transactions || [] }, redemptionsData: { redemptions: input.redemptions || [] }, submissionsData: { submissions: input.submissions || [] }, missionsData: { missions: input.missions || [] } }; }, getReactionApprovalData() { return { records: input.reactions || [] }; } };
}
function client(mode = 'success') {
  const sent = [];
  return { sent, channels: { cache: { get: () => null }, async fetch() { if (mode === 'fetch-fail') throw new Error('fetch'); if (mode === 'missing') return null; return { async send(payload) { if (mode === 'send-fail') throw new Error('send'); sent.push(payload); } }; } } };
}
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
class Response {
  constructor(resolve) { this.statusCode = 200; this.headers = {}; this.chunks = []; this.resolve = resolve; this.writableEnded = false; }
  setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; }
  end(chunk) { if (chunk) this.chunks.push(Buffer.from(chunk)); this.writableEnded = true; this.resolve(this); }
}
function request(handler, url, auth = authorization) {
  return new Promise((resolve) => handler({ method: 'GET', url, headers: { host: 'localhost', ...(auth ? { authorization: auth } : {}) } }, new Response(resolve)));
}

async function main() {
  const now = new Date('2026-07-08T03:00:00.000Z');
  assert.deepStrictEqual(getKstWeekRange(new Date('2026-07-05T15:00:00.000Z'), 0), { weekOffset: 0, weekStartDateKst: '2026-07-06', startAt: '2026-07-05T15:00:00.000Z', endAt: '2026-07-05T15:00:00.000Z' });
  assert.strictEqual(getKstWeekRange(now, -1).weekStartDateKst, '2026-06-29');
  assert.throws(() => parseWeekOffset(1), /0~-12/);
  assert.throws(() => parseWeekOffset(-13), /0~-12/);

  const input = {
    submissions: [
      { id: 'c1', type: 'checkin', userId: 'private-1', status: 'approved', createdAt: '2026-07-06T00:00:00Z' },
      { id: 'c2', type: 'checkin', userId: 'private-1', status: 'approved', createdAt: '2026-07-07T00:00:00Z' },
      { id: 's1', type: 'mission', userId: 'private-2', status: 'pending', createdAt: '2026-07-06T01:00:00Z', content: 'SECRET_CONTENT' },
      { id: 'sample-submission', isExample: true, type: 'mission', status: 'approved', createdAt: '2026-07-06T01:00:00Z' },
    ],
    transactions: [{ id: 't1', userId: 'private-1', amount: 10, createdAt: '2026-07-06T00:00:00Z' }, { id: 't2', amount: -3, createdAt: '2026-07-07T00:00:00Z' }],
    redemptions: [{ id: 'r1', userId: 'private-1', status: 'pending', requestedAt: '2026-07-06T00:00:00Z' }],
    missions: [{ id: 'm1', status: 'active', endDate: '2026-07-08' }],
  };
  const report = buildWeeklyOpsReport(input, { now });
  assert.deepStrictEqual(report.participation, { participantCount: 1, checkinCount: 2 });
  assert.strictEqual(report.submissions.pending, 1);
  assert.deepStrictEqual(report.points, { transactionCount: 2, earned: 10, deducted: 3 });
  assert.strictEqual(report.redemptions.pending, 1);
  const serialized = JSON.stringify(report);
  ['private-1', 'private-2', 'SECRET_CONTENT', 'content', 'attachment', 'note'].forEach((value) => assert.ok(!serialized.includes(value)));
  const message = formatWeeklyOpsReportMessage(report, 'https://console.example/admin');
  assert.ok(message.includes('https://console.example/admin'));
  assert.ok(!message.includes('private'));
  assert.ok(!formatWeeklyOpsReportMessage(report, 'http://unsafe').includes('http://unsafe'));

  const fixturePath = tempPath();
  fs.writeFileSync(fixturePath, JSON.stringify(input));
  const before = { hash: hash(fixturePath), mtime: fs.statSync(fixturePath).mtimeMs };
  buildWeeklyOpsReport(JSON.parse(fs.readFileSync(fixturePath)), { now });
  assert.deepStrictEqual({ hash: hash(fixturePath), mtime: fs.statSync(fixturePath).mtimeMs }, before);

  const apiRepository = repository(input);
  const handler = createAdminRequestHandler(apiRepository, {}, { getState() { return {}; } });
  const unauthorized = await request(handler, '/api/admin/weekly-report?weekOffset=0', null);
  assert.strictEqual(unauthorized.statusCode, 401);
  const invalid = await request(handler, '/api/admin/weekly-report?weekOffset=1');
  assert.strictEqual(invalid.statusCode, 400);
  assert.strictEqual(JSON.parse(Buffer.concat(invalid.chunks).toString()).error, 'INVALID_WEEK_OFFSET');
  const response = await request(handler, '/api/admin/weekly-report?weekOffset=0');
  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(response.headers['cache-control'], 'no-store');
  assert.ok(JSON.parse(Buffer.concat(response.chunks).toString()).range.weekStartDateKst);

  const env = { WEEKLY_OPS_REPORT_ENABLED: 'true', WEEKLY_OPS_REPORT_WEEKDAY: '3', WEEKLY_OPS_REPORT_TIME_KST: '12:00', WEEKLY_OPS_REPORT_CHANNEL_ID: 'ops' };
  const historyPath = tempPath();
  const okClient = client();
  assert.strictEqual((await runWeeklyOpsReportTick({ client: okClient, repository: repository(input), env, now, historyPath })).reason, 'SENT');
  assert.strictEqual(readHistory(historyPath).records[0].weekStartDateKst, '2026-06-29');
  assert.strictEqual(okClient.sent[0].content.includes('[주간 운영 리포트 2026-06-29]'), true);
  assert.deepStrictEqual(okClient.sent[0].allowedMentions, { parse: [] });
  assert.strictEqual(readHistory(historyPath).records[0].status, 'sent');
  assert.strictEqual((await runWeeklyOpsReportTick({ client: okClient, repository: repository(input), env, now, historyPath })).reason, 'ALREADY_RESERVED');
  for (const [mode, reason] of [['missing', 'CHANNEL_NOT_FOUND'], ['fetch-fail', 'CHANNEL_FETCH_FAILED'], ['send-fail', 'SEND_FAILED']]) {
    const target = tempPath();
    assert.strictEqual((await sendWeeklyOpsReport({ client: client(mode), repository: repository(input), env, now, historyPath: target })).reason, reason);
    assert.strictEqual(readHistory(target).records[0].status, 'failed');
  }
  const missingPath = tempPath();
  assert.strictEqual((await sendWeeklyOpsReport({ client: client(), repository: repository(input), env: {}, now, historyPath: missingPath })).reason, 'MISSING_CHANNEL');
  assert.strictEqual(readHistory(missingPath).records[0].status, 'skipped');
  assert.strictEqual((await runWeeklyOpsReportTick({ env: {}, now })).reason, 'DISABLED');
  resetWeeklyOpsReportForTests();
  assert.strictEqual(startWeeklyOpsReportScheduler({ env: {} }).started, false);

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weekly-report-path-'));
  assert.strictEqual(getOperationDataPaths({ OPERATION_DATA_DIR: dataDir }).weeklyOpsReports, path.join(dataDir, 'weekly-ops-reports.local.json'));
  assert.strictEqual(LOCAL_FILENAMES.weeklyOpsReports, 'weekly-ops-reports.local.json');
  const backup = collectBackupSnapshot({ weeklyOpsReports: historyPath }, { now });
  assert.strictEqual(backup.manifest.weeklyOpsReports.included, true);
  assert.strictEqual(backup.manifest.weeklyOpsReports.requiredForStrict, false);

  console.log('주간 운영 리포트 흐름 테스트 통과');
  if (previousPassword === undefined) delete process.env.ADMIN_DASHBOARD_PASSWORD;
  else process.env.ADMIN_DASHBOARD_PASSWORD = previousPassword;
}
main().catch((error) => { console.error(error); process.exit(1); });
