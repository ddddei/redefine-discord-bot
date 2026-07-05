const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  isMessageExpired,
  runRetentionCleanup,
  runUserDeletion,
  SAFETY_RECORD_RETENTION_DAYS,
} = require('../scripts/cleanup-dm-chat-logs');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function daysAgoIso(days, from = new Date('2026-07-05T00:00:00.000Z')) {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function buildSampleData(now) {
  return {
    version: 4,
    isExample: false,
    notices: [{
      userId: 'user_a',
      username: 'user_a',
      displayName: 'user_a',
      sentAt: daysAgoIso(200, now),
      noticeVersion: 2,
    }],
    historyResets: [{
      userId: 'user_a',
      username: 'user_a',
      displayName: 'user_a',
      resetAt: daysAgoIso(150, now),
    }],
    activeScenarios: [{ userId: 'user_a', scenarioId: 'greeting', startedAt: daysAgoIso(0, now) }],
    messages: [
      {
        id: 'm1', createdAt: daysAgoIso(100, now), userId: 'user_a', username: 'user_a',
        displayName: 'user_a', role: 'user', content: '오래된 일반 메시지', safetyDetection: null,
        safetyDetectionSource: null, error: null,
      },
      {
        id: 'm2', createdAt: daysAgoIso(10, now), userId: 'user_a', username: 'user_a',
        displayName: 'user_a', role: 'assistant', content: '최근 일반 메시지', safetyDetection: null,
        safetyDetectionSource: null, error: null,
      },
      {
        id: 'm3', createdAt: daysAgoIso(170, now), userId: 'user_a', username: 'user_a',
        displayName: 'user_a', role: 'user', content: '오래됐지만 안전 레코드(180일 이내)',
        safetyDetection: { category: 'danger', severity: 'attention' }, safetyDetectionSource: 'input', error: null,
      },
      {
        id: 'm4', createdAt: daysAgoIso(200, now), userId: 'user_a', username: 'user_a',
        displayName: 'user_a', role: 'user', content: '안전 레코드(180일 초과)',
        safetyDetection: { category: 'danger', severity: 'attention' }, safetyDetectionSource: 'input', error: null,
      },
      {
        id: 'm5', createdAt: daysAgoIso(5, now), userId: 'user_b', username: 'user_b',
        displayName: 'user_b', role: 'user', content: '다른 사용자 최근 메시지', safetyDetection: null,
        safetyDetectionSource: null, error: null,
      },
    ],
  };
}

function main() {
  const now = new Date('2026-07-05T00:00:00.000Z');

  // --- 단위 테스트: isMessageExpired / runRetentionCleanup / runUserDeletion ---
  const sample = buildSampleData(now);

  assert.strictEqual(SAFETY_RECORD_RETENTION_DAYS, 180);

  const generalOld = sample.messages.find((message) => message.id === 'm1');
  const generalRecent = sample.messages.find((message) => message.id === 'm2');
  const safetyWithinException = sample.messages.find((message) => message.id === 'm3');
  const safetyExpired = sample.messages.find((message) => message.id === 'm4');

  assert.strictEqual(isMessageExpired(generalOld, now, 90), true, '90일 보존 기준을 넘은 일반 메시지는 만료 대상입니다.');
  assert.strictEqual(isMessageExpired(generalRecent, now, 90), false);
  assert.strictEqual(isMessageExpired(safetyWithinException, now, 90), false, '안전 레코드는 90일이 지나도 180일까지는 보존됩니다.');
  assert.strictEqual(isMessageExpired(safetyExpired, now, 90), true, '안전 레코드도 180일이 지나면 만료 대상입니다.');

  const retentionResult = runRetentionCleanup(sample, { now, retentionDays: 90 });
  assert.strictEqual(retentionResult.removedCount, 2); // m1, m4
  assert.strictEqual(retentionResult.remainingCount, 3);
  assert.deepStrictEqual(
    retentionResult.nextData.messages.map((message) => message.id).sort(),
    ['m2', 'm3', 'm5']
  );
  // notices/historyResets/activeScenarios는 보존 정리 대상이 아니다.
  assert.strictEqual(retentionResult.nextData.notices.length, 1);
  assert.strictEqual(retentionResult.nextData.historyResets.length, 1);

  // retentionDays=0(무기한)이어도 안전 레코드 180일 예외는 적용된다.
  const unlimitedResult = runRetentionCleanup(sample, { now, retentionDays: 0 });
  assert.strictEqual(unlimitedResult.removedCount, 1); // m4만 제거
  assert.deepStrictEqual(
    unlimitedResult.nextData.messages.map((message) => message.id).sort(),
    ['m1', 'm2', 'm3', 'm5']
  );

  const userDeletionResult = runUserDeletion(sample, 'user_a');
  assert.strictEqual(userDeletionResult.removed.messages, 4);
  assert.strictEqual(userDeletionResult.removed.notices, 1);
  assert.strictEqual(userDeletionResult.removed.historyResets, 1);
  assert.strictEqual(userDeletionResult.removed.activeScenarios, 1);
  assert.strictEqual(userDeletionResult.nextData.messages.length, 1);
  assert.strictEqual(userDeletionResult.nextData.messages[0].userId, 'user_b');

  // --- CLI 동작: dry-run 무변경 ---
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chat-retention-'));
  const logPath = path.join(tempDir, 'dm-chat-logs.json');
  fs.writeFileSync(logPath, `${JSON.stringify(buildSampleData(now), null, 2)}\n`);
  const beforeDryRun = fs.readFileSync(logPath, 'utf8');

  const cleanupScript = path.join(__dirname, 'cleanup-dm-chat-logs.js');
  const dryRunOutput = execFileSync('node', [cleanupScript], {
    encoding: 'utf8',
    env: { ...process.env, DM_CHAT_LOG_PATH: logPath, DM_CHAT_RETENTION_DAYS: '90' },
  });

  assert.match(dryRunOutput, /dry-run/);
  assert.match(dryRunOutput, /제거 대상: 2건/);
  const afterDryRun = fs.readFileSync(logPath, 'utf8');
  assert.strictEqual(beforeDryRun, afterDryRun, 'dry-run은 파일을 바꾸지 않아야 합니다.');

  const filesBeforeApply = fs.readdirSync(tempDir);
  assert.strictEqual(filesBeforeApply.some((name) => name.startsWith('dm-chat-logs.backup-')), false);

  // --- CLI 동작: --apply 기준일 경계 + 백업 사본 ---
  const applyOutput = execFileSync('node', [cleanupScript, '--apply'], {
    encoding: 'utf8',
    env: { ...process.env, DM_CHAT_LOG_PATH: logPath, DM_CHAT_RETENTION_DAYS: '90' },
  });
  assert.match(applyOutput, /백업 사본 생성/);

  const afterApplyData = readJson(logPath);
  assert.deepStrictEqual(afterApplyData.messages.map((message) => message.id).sort(), ['m2', 'm3', 'm5']);
  assert.strictEqual(afterApplyData.notices.length, 1, 'notices는 정리 후에도 보존되어야 합니다.');
  assert.strictEqual(afterApplyData.historyResets.length, 1, 'historyResets는 정리 후에도 보존되어야 합니다.');

  const filesAfterApply = fs.readdirSync(tempDir);
  const backupFile = filesAfterApply.find((name) => name.startsWith('dm-chat-logs.backup-'));
  assert.ok(backupFile, '적용 전 백업 사본이 생성되어야 합니다.');
  const backupData = readJson(path.join(tempDir, backupFile));
  assert.strictEqual(backupData.messages.length, 5, '백업 사본에는 정리 전 전체 메시지가 남아 있어야 합니다.');

  // --- CLI 동작: --user 전체 제거 ---
  const userLogPath = path.join(tempDir, 'dm-chat-user-logs.json');
  fs.writeFileSync(userLogPath, `${JSON.stringify(buildSampleData(now), null, 2)}\n`);

  const userDryRunOutput = execFileSync('node', [cleanupScript, '--user', 'user_a'], {
    encoding: 'utf8',
    env: { ...process.env, DM_CHAT_LOG_PATH: userLogPath },
  });
  assert.match(userDryRunOutput, /dry-run/);
  const userDataAfterDryRun = readJson(userLogPath);
  assert.strictEqual(userDataAfterDryRun.messages.length, 5, '사용자 삭제 dry-run도 파일을 바꾸지 않아야 합니다.');

  const userApplyOutput = execFileSync('node', [cleanupScript, '--user', 'user_a', '--apply'], {
    encoding: 'utf8',
    env: { ...process.env, DM_CHAT_LOG_PATH: userLogPath },
  });
  assert.match(userApplyOutput, /백업 사본 생성/);

  const userDataAfterApply = readJson(userLogPath);
  assert.strictEqual(userDataAfterApply.messages.length, 1);
  assert.strictEqual(userDataAfterApply.messages[0].userId, 'user_b');
  assert.strictEqual(userDataAfterApply.notices.length, 0);
  assert.strictEqual(userDataAfterApply.historyResets.length, 0);
  assert.strictEqual(userDataAfterApply.activeScenarios.length, 0);

  const userDirFiles = fs.readdirSync(tempDir);
  assert.ok(userDirFiles.some((name) => name.startsWith('dm-chat-user-logs.backup-')), '사용자 삭제도 정리 전 백업 사본을 생성해야 합니다.');

  console.log('DM chat retention cleanup test passed');
}

main();
