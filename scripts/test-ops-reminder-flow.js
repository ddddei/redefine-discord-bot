const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildOpsDelaySummary,
  getMissionDeadlineMetadata,
  getWaitingMetadata,
} = require('../src/opsDelayPolicy');
const {
  findDueSlot,
  formatOpsReminderMessage,
  normalizeSlots,
  readHistory,
  resetOpsReminderForTests,
  runOpsReminderTick,
  startOpsReminder,
} = require('../src/opsReminder');
const { getOperationDataPaths } = require('../src/operationDataPaths');
const { collectBackupSnapshot } = require('../src/operationBackup');
const { LOCAL_FILENAMES } = require('./restore-operation-backup');

function tempPath(name) {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ops-reminder-')), name);
}

function repository(input = {}) {
  return {
    loadState() {
      return {
        redemptionsData: { redemptions: input.redemptions || [] },
        submissionsData: { submissions: input.submissions || [] },
        missionsData: { missions: input.missions || [] },
      };
    },
    getReactionApprovalData() { return { records: input.reactions || [] }; },
  };
}

function client(mode = 'success') {
  const sent = [];
  const channel = { async send(payload) { if (mode === 'send-fail') throw new Error('send'); sent.push(payload); } };
  return {
    sent,
    channels: {
      cache: { get: () => null },
      async fetch() { if (mode === 'fetch-fail') throw new Error('fetch'); return mode === 'missing' ? null : channel; },
    },
  };
}

async function main() {
  const now = new Date('2026-07-11T01:02:00.000Z'); // KST 10:02
  assert.deepStrictEqual(getWaitingMetadata('2026-07-10T01:02:00.000Z', 24, now), {
    waitingHours: 24, overdue: true, invalidTimestamp: false,
  });
  assert.strictEqual(getWaitingMetadata('invalid', 24, now).invalidTimestamp, true);
  assert.strictEqual(getWaitingMetadata('2027-01-01T00:00:00Z', 24, now).invalidTimestamp, true);
  assert.deepStrictEqual(getMissionDeadlineMetadata('2026-07-11', 24, now), {
    deadlineStatus: 'dueSoon', hoursUntilDeadline: 13, invalidTimestamp: false,
  });
  assert.strictEqual(getMissionDeadlineMetadata('2026-07-10T00:00:00Z', 24, now).deadlineStatus, 'overdue');

  const summary = buildOpsDelaySummary({
    redemptions: [
      { id: 'real', status: 'pending', createdAt: '2026-07-09T00:00:00Z' },
      { id: 'example-redemption', isExample: true, status: 'pending', createdAt: '2026-07-01T00:00:00Z' },
    ],
    submissions: [{ id: 's1', status: 'pending', createdAt: '2026-07-10T01:02:00Z' }],
    missions: [{ id: 'm1', status: 'active', endDate: '2026-07-11' }],
  }, { now });
  assert.strictEqual(summary.redemptions.total, 1);
  assert.strictEqual(summary.submissions.overdue, 1);
  assert.strictEqual(summary.missions.dueSoon, 1);
  const message = formatOpsReminderMessage(summary, { dateKst: '2026-07-11', slot: '10:00' }, 'http://unsafe');
  assert.ok(!message.includes('real'));
  assert.ok(!message.includes('http://'));

  const missingTransactionSummary = buildOpsDelaySummary({
    followUps: [{ id: 'missing-transaction', createdAt: '2026-07-10T01:02:00Z' }],
  }, { now });
  assert.strictEqual(missingTransactionSummary.followUps.total, 1);

  assert.deepStrictEqual(normalizeSlots('bad,25:00'), ['10:00']);
  assert.deepStrictEqual(normalizeSlots('10:00,10:00,09:30'), ['09:30', '10:00']);
  assert.strictEqual(findDueSlot(new Date('2026-07-11T00:59:00Z'), ['10:00'], 5), null);
  assert.deepStrictEqual(findDueSlot(now, ['10:00'], 5), { dateKst: '2026-07-11', slot: '10:00' });
  assert.strictEqual(findDueSlot(new Date('2026-07-11T01:05:00Z'), ['10:00'], 5), null);

  const env = { OPS_REMINDER_ENABLED: 'true', OPS_REMINDER_SLOTS: '10:00', OPS_REMINDER_CHANNEL_ID: 'ops' };
  const input = {
    redemptions: [{ id: 'r1', status: 'pending', createdAt: '2026-07-01T00:00:00Z', userId: 'private' }],
    reactions: [{ id: 'approval-missing-tx', status: 'approved', rewardPoints: 100, transactionId: null, reviewedAt: '2026-07-10T01:02:00Z' }],
  };
  const historyPath = tempPath('history.json');
  const okClient = client();
  const sent = await runOpsReminderTick({ client: okClient, repository: repository(input), env, now, historyPath });
  assert.strictEqual(sent.reason, 'SENT');
  assert.strictEqual(okClient.sent.length, 1);
  assert.ok(!okClient.sent[0].content.includes('private'));
  assert.ok(okClient.sent[0].content.includes('후속 1건'));
  assert.strictEqual(readHistory(historyPath).records[0].status, 'sent');
  assert.strictEqual((await runOpsReminderTick({ client: okClient, repository: repository(input), env, now, historyPath })).reason, 'ALREADY_RESERVED');

  const boundedPath = tempPath('history.json');
  fs.writeFileSync(boundedPath, JSON.stringify({
    version: 1,
    records: Array.from({ length: 130 }, (_, index) => ({ dateKst: `old-${index}`, slot: '10:00', status: 'sent' })),
  }));
  await runOpsReminderTick({ client: client(), repository: repository(input), env, now, historyPath: boundedPath });
  assert.strictEqual(readHistory(boundedPath).records.length, 120);

  const concurrentPath = tempPath('history.json');
  let releaseSend;
  const slowClient = {
    channels: { cache: { get: () => null }, fetch: async () => ({ send: () => new Promise((resolve) => { releaseSend = resolve; }) }) },
  };
  const firstTick = runOpsReminderTick({ client: slowClient, repository: repository(input), env, now, historyPath: concurrentPath });
  await new Promise((resolve) => setImmediate(resolve));
  const secondTick = await runOpsReminderTick({ client: slowClient, repository: repository(input), env, now, historyPath: concurrentPath });
  assert.strictEqual(secondTick.reason, 'TICK_RUNNING');
  releaseSend();
  assert.strictEqual((await firstTick).reason, 'SENT');

  for (const [mode, expectedStatus, expectedReason] of [
    ['missing', 'skipped', 'CHANNEL_NOT_FOUND'], ['fetch-fail', 'failed', 'CHANNEL_FETCH_FAILED'], ['send-fail', 'failed', 'SEND_FAILED'],
  ]) {
    const target = tempPath('history.json');
    const result = await runOpsReminderTick({ client: client(mode), repository: repository(input), env, now, historyPath: target });
    assert.strictEqual(result.reason, expectedReason);
    assert.strictEqual(readHistory(target).records[0].status, expectedStatus);
  }
  const emptyPath = tempPath('history.json');
  assert.strictEqual((await runOpsReminderTick({ client: client(), repository: repository(), env, now, historyPath: emptyPath })).reason, 'EMPTY');
  assert.strictEqual(readHistory(emptyPath).records[0].status, 'skipped-empty');
  const noChannelPath = tempPath('history.json');
  assert.strictEqual((await runOpsReminderTick({ client: client(), repository: repository(input), env: { ...env, OPS_REMINDER_CHANNEL_ID: '' }, now, historyPath: noChannelPath })).reason, 'MISSING_CHANNEL');

  const impossibleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-reminder-impossible-'));
  const parentFile = path.join(impossibleRoot, 'file');
  fs.writeFileSync(parentFile, 'not-a-directory');
  const impossiblePath = path.join(parentFile, 'child.json');
  assert.strictEqual((await runOpsReminderTick({ client: client(), repository: repository(input), env, now, historyPath: impossiblePath })).reason, 'RESERVATION_FAILED');

  const exampleHistoryPath = tempPath('history.json');
  fs.writeFileSync(exampleHistoryPath, JSON.stringify({ version: 1, isExample: true, records: [] }));
  const exampleHistoryClient = client();
  assert.strictEqual((await runOpsReminderTick({ client: exampleHistoryClient, repository: repository(input), env, now, historyPath: exampleHistoryPath })).reason, 'RESERVATION_FAILED');
  assert.strictEqual(exampleHistoryClient.sent.length, 0);

  resetOpsReminderForTests();
  assert.strictEqual(startOpsReminder({ env: {}, client: client(), repository: repository() }).started, false);
  const scheduler = startOpsReminder({ env, client: client(), repository: repository(input), historyPath: tempPath('scheduler.json'), now });
  assert.strictEqual(scheduler.started, true);
  assert.strictEqual(startOpsReminder({ env, client: client(), repository: repository(input) }), scheduler);
  scheduler.stop();

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-reminder-path-'));
  assert.strictEqual(getOperationDataPaths({ OPERATION_DATA_DIR: dataDir }).opsReminders, path.join(dataDir, 'ops-reminders.local.json'));
  assert.strictEqual(LOCAL_FILENAMES.opsReminders, 'ops-reminders.local.json');
  const backup = collectBackupSnapshot({ opsReminders: historyPath }, { now });
  assert.strictEqual(backup.manifest.opsReminders.included, true);
  assert.strictEqual(backup.manifest.opsReminders.requiredForStrict, false);

  console.log('운영 지연 정책과 리마인더 흐름 테스트 통과');
}

main().catch((error) => { console.error(error); process.exit(1); });
