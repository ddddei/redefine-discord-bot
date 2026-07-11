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
const { createAdminAudit } = require('../src/adminAudit');

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
function request(handler, url, auth = authorization, options = {}) {
  const body = options.body === undefined ? null : Buffer.from(JSON.stringify(options.body));
  const listeners = {};
  const req = {
    method: options.method || 'GET', url,
    headers: { host: 'localhost', ...(auth ? { authorization: auth } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
    on(event, callback) { listeners[event] = callback; if (event === 'end') { if (body && listeners.data) listeners.data(body); callback(); } },
  };
  return new Promise((resolve) => handler(req, new Response(resolve)));
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
  const warnings = [];
  const previousWarn = console.warn;
  console.warn = (message) => warnings.push(String(message));
  assert.deepStrictEqual(require('../src/weeklyOpsReportScheduler').parseSchedule({ WEEKLY_OPS_REPORT_WEEKDAY: '9', WEEKLY_OPS_REPORT_TIME_KST: '25:61' }), { weekday: 1, time: '10:00' });
  console.warn = previousWarn;
  assert.ok(warnings.some((message) => message.includes('WEEKLY_OPS_REPORT')));
  const historyPath = tempPath();
  const okClient = client();
  assert.strictEqual((await runWeeklyOpsReportTick({ client: okClient, repository: repository(input), env, now, historyPath })).reason, 'SENT');
  assert.strictEqual(readHistory(historyPath).records[0].weekStartDateKst, '2026-06-29');
  assert.strictEqual(okClient.sent[0].content.includes('[주간 운영 리포트 2026-06-29]'), true);
  assert.deepStrictEqual(okClient.sent[0].allowedMentions, { parse: [] });
  assert.strictEqual(readHistory(historyPath).records[0].status, 'sent');
  assert.strictEqual((await runWeeklyOpsReportTick({ client: okClient, repository: repository(input), env, now, historyPath })).reason, 'ALREADY_RESERVED');
  const restarted = await sendWeeklyOpsReport({ client: okClient, repository: repository(input), env, now, historyPath, weekOffset: -1 });
  assert.strictEqual(restarted.reason, 'ALREADY_RESERVED');
  assert.strictEqual(okClient.sent.length, 1);

  let releaseSend;
  const blockedClient = { channels: { cache: { get: () => null }, async fetch() { return { send() { return new Promise((resolve) => { releaseSend = resolve; }); } }; } } };
  const concurrentPath = tempPath();
  const firstTick = runWeeklyOpsReportTick({ client: blockedClient, repository: repository(input), env, now, historyPath: concurrentPath });
  await new Promise((resolve) => setImmediate(resolve));
  assert.strictEqual((await runWeeklyOpsReportTick({ client: blockedClient, repository: repository(input), env, now, historyPath: concurrentPath })).reason, 'TICK_RUNNING');
  releaseSend();
  assert.strictEqual((await firstTick).reason, 'SENT');

  const reservationFailure = await sendWeeklyOpsReport({
    client: client(), repository: repository(input), env, now, historyPath: tempPath(),
    historyStore: { readHistory() { throw new Error('read failed'); } },
  });
  assert.strictEqual(reservationFailure.reason, 'RESERVATION_FAILED');
  const finishFailureClient = client();
  let saves = 0;
  const sentHistoryFailure = await sendWeeklyOpsReport({
    client: finishFailureClient, repository: repository(input), env, now, historyPath: tempPath(),
    historyStore: {
      readHistory() { return { version: 1, isExample: false, records: [] }; },
      saveHistory() { saves += 1; if (saves > 1) throw new Error('finish failed'); },
    },
  });
  assert.strictEqual(sentHistoryFailure.reason, 'SENT_HISTORY_FAILED');
  assert.strictEqual(finishFailureClient.sent.length, 1);
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

  const previousWriteEnabled = process.env.ADMIN_WRITE_ENABLED;
  const previousWriteToken = process.env.ADMIN_WRITE_TOKEN;
  const previousChannel = process.env.WEEKLY_OPS_REPORT_CHANNEL_ID;
  process.env.ADMIN_WRITE_ENABLED = 'true';
  process.env.ADMIN_WRITE_TOKEN = 'weekly-write-secret';
  process.env.WEEKLY_OPS_REPORT_CHANNEL_ID = 'ops';
  const auditPath = tempPath();
  const notifications = [];
  const manualHistoryPath = tempPath();
  const manualHandler = createAdminRequestHandler(apiRepository, {}, { getState() { return {}; } }, {
    client: client(), audit: createAdminAudit({ filePath: auditPath }),
    notifyAdminWrite(entry) { notifications.push(entry); },
  });
  const noAuth = await request(manualHandler, '/api/admin/weekly-report/send', null, { method: 'POST', body: {} });
  assert.strictEqual(noAuth.statusCode, 401);
  const badToken = await request(manualHandler, '/api/admin/weekly-report/send', authorization, { method: 'POST', body: {}, headers: { 'x-admin-write-token': 'wrong' } });
  assert.strictEqual(badToken.statusCode, 403);
  const originalHistoryPath = process.env.WEEKLY_OPS_REPORT_HISTORY_PATH;
  process.env.WEEKLY_OPS_REPORT_HISTORY_PATH = manualHistoryPath;
  const sent = await request(manualHandler, '/api/admin/weekly-report/send', authorization, { method: 'POST', body: {}, headers: { 'x-admin-write-token': 'weekly-write-secret' } });
  assert.strictEqual(sent.statusCode, 200);
  const duplicate = await request(manualHandler, '/api/admin/weekly-report/send', authorization, { method: 'POST', body: {}, headers: { 'x-admin-write-token': 'weekly-write-secret' } });
  assert.strictEqual(duplicate.statusCode, 409);
  await new Promise((resolve) => setImmediate(resolve));
  const auditText = fs.readFileSync(auditPath, 'utf8');
  const entries = JSON.parse(auditText).entries;
  assert(entries.some((entry) => entry.result === 'rejected' && entry.errorCode === 'INVALID_WRITE_TOKEN'));
  assert(entries.some((entry) => entry.result === 'success'));
  assert(entries.some((entry) => entry.errorCode === 'ALREADY_RESERVED'));
  ['private-1', 'private-2', 'SECRET_CONTENT', 'attachment', 'url', 'note', 'weekly-write-secret'].forEach((value) => assert.ok(!auditText.includes(value)));
  assert(notifications.every((entry) => !JSON.stringify(entry).includes('private-')));
  if (originalHistoryPath === undefined) delete process.env.WEEKLY_OPS_REPORT_HISTORY_PATH; else process.env.WEEKLY_OPS_REPORT_HISTORY_PATH = originalHistoryPath;
  if (previousWriteEnabled === undefined) delete process.env.ADMIN_WRITE_ENABLED; else process.env.ADMIN_WRITE_ENABLED = previousWriteEnabled;
  if (previousWriteToken === undefined) delete process.env.ADMIN_WRITE_TOKEN; else process.env.ADMIN_WRITE_TOKEN = previousWriteToken;
  if (previousChannel === undefined) delete process.env.WEEKLY_OPS_REPORT_CHANNEL_ID; else process.env.WEEKLY_OPS_REPORT_CHANNEL_ID = previousChannel;

  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'admin.css'), 'utf8');
  assert(css.includes('@media (max-width: 375px)'));
  assert(css.includes('#weekly-report-section'));

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
