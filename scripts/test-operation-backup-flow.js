const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  collectBackupSnapshot,
  getOperationBackupChannelId,
  getOperationBackupTimeKst,
  hasTodayScheduledTimePassed,
  isOperationBackupAutoEnabled,
  runCatchUpBackupIfNeeded,
  sendOperationBackup,
  startOperationBackupScheduler,
} = require('../src/operationBackup');
const { saveJsonFileAtomic } = require('../src/jsonStorage');

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createClient(channelId = 'backup_channel_test') {
  const sentMessages = [];
  const channel = {
    id: channelId,
    async send(payload) {
      sentMessages.push(payload);
      return { id: `backup_message_${sentMessages.length}` };
    },
  };

  return {
    sentMessages,
    channels: {
      cache: {
        get: (id) => (id === channel.id ? channel : null),
      },
      fetch: async (id) => (id === channel.id ? channel : null),
    },
  };
}

async function main() {
  const previousEnv = {
    OPERATION_BACKUP_AUTO_ENABLED: process.env.OPERATION_BACKUP_AUTO_ENABLED,
    OPERATION_BACKUP_CHANNEL_ID: process.env.OPERATION_BACKUP_CHANNEL_ID,
    OPERATION_BACKUP_TIME_KST: process.env.OPERATION_BACKUP_TIME_KST,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
  };

  try {
    // 1. 스냅샷: 존재하는 파일은 원본 그대로, 없는 파일은 null
    const dataDir = createTempDir('operation-backup-data-');
    const pointsData = {
      isExample: false,
      users: [{ userId: 'user_1', totalPoints: 30 }],
      pointTransactions: [{ id: 'tx_1', amount: 30 }],
    };
    const missionsData = { isExample: false, missions: [{ id: 'mission_1', title: '테스트 미션' }] };
    saveJsonFileAtomic(path.join(dataDir, 'points.local.json'), pointsData);
    saveJsonFileAtomic(path.join(dataDir, 'missions.local.json'), missionsData);

    const snapshotPaths = {
      points: path.join(dataDir, 'points.local.json'),
      shopItems: path.join(dataDir, 'shop-items.local.json'),
      redemptions: path.join(dataDir, 'redemptions.local.json'),
      missions: path.join(dataDir, 'missions.local.json'),
      missionTemplates: path.join(dataDir, 'mission-templates.local.json'),
      submissions: path.join(dataDir, 'submissions.local.json'),
      reactionApprovals: path.join(dataDir, 'reaction-approvals.local.json'),
      operatorSupport: path.join(dataDir, 'operator-support.local.json'),
      dungeonworldLogs: path.join(dataDir, 'dungeonworld-logs.local.json'),
      dungeonworldConfig: path.join(dataDir, 'dungeonworld-config.local.json'),
      dailyMissionAnnouncements: path.join(dataDir, 'daily-mission-announcements.local.json'),
    };

    const snapshotNow = new Date('2026-07-03T12:30:00.000Z');
    const snapshot = collectBackupSnapshot(snapshotPaths, { now: snapshotNow, trigger: 'scheduled' });
    assert.strictEqual(snapshot.generatedAt, '2026-07-03T12:30:00.000Z');
    assert.strictEqual(snapshot.generatedDateKst, '2026-07-03');
    assert.strictEqual(snapshot.trigger, 'scheduled');
    assert.deepStrictEqual(snapshot.files.points, pointsData);
    assert.deepStrictEqual(snapshot.files.missions, missionsData);
    assert.strictEqual(snapshot.files.shopItems, null);
    assert.strictEqual(snapshot.files.dungeonworldLogs, null);
    assert.strictEqual(Object.keys(snapshot.files).length, 11);

    // 2. 비활성(기본) 시 스케줄러는 아무것도 하지 않는다
    delete process.env.OPERATION_BACKUP_AUTO_ENABLED;
    process.env.LOG_CHANNEL_ID = 'backup_channel_test';
    assert.strictEqual(isOperationBackupAutoEnabled(), false);
    const disabledResult = startOperationBackupScheduler(createClient());
    assert.strictEqual(disabledResult.ok, false);
    assert.strictEqual(disabledResult.reason, 'DISABLED');

    // 채널 폴백: OPERATION_BACKUP_CHANNEL_ID가 비어 있으면 LOG_CHANNEL_ID 사용
    assert.strictEqual(getOperationBackupChannelId(), 'backup_channel_test');
    process.env.OPERATION_BACKUP_CHANNEL_ID = 'dedicated_backup_channel';
    assert.strictEqual(getOperationBackupChannelId(), 'dedicated_backup_channel');
    delete process.env.OPERATION_BACKUP_CHANNEL_ID;

    // 시각 파싱: 기본 21:00, 잘못된 값도 21:00
    process.env.OPERATION_BACKUP_TIME_KST = '25:99';
    assert.deepStrictEqual(getOperationBackupTimeKst(), { hours: 21, minutes: 0 });
    process.env.OPERATION_BACKUP_TIME_KST = '21:00';
    assert.deepStrictEqual(getOperationBackupTimeKst(), { hours: 21, minutes: 0 });

    // 3. 발송: 파일명 형식, 첨부 전송, 상태 기록
    process.env.OPERATION_BACKUP_AUTO_ENABLED = 'true';
    const statePath = path.join(createTempDir('operation-backup-state-'), 'operation-backups.local.json');
    const client = createClient();
    // KST 2026-07-03 21:30 (예정 시각 이후)
    const sendNow = new Date('2026-07-03T12:30:00.000Z');
    const sendResult = await sendOperationBackup(client, {
      now: sendNow,
      statePath,
      paths: snapshotPaths,
      trigger: 'scheduled',
    });

    assert.strictEqual(sendResult.ok, true);
    assert.strictEqual(sendResult.reason, 'SENT');
    assert.match(sendResult.filename, /^operation-backup-\d{8}-\d{6}\.json$/);
    assert.strictEqual(client.sentMessages.length, 1);
    assert.strictEqual(client.sentMessages[0].files.length, 1);

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.strictEqual(state.records.length, 1);
    assert.strictEqual(state.records[0].date, '2026-07-03');
    assert.strictEqual(state.records[0].trigger, 'scheduled');
    assert.strictEqual(state.records[0].messageId, 'backup_message_1');
    assert.ok(state.records[0].byteSize > 0);

    // 4. 같은 날 캐치업은 중복 발송하지 않는다
    const catchUpClient = createClient();
    const catchUpResult = await runCatchUpBackupIfNeeded(catchUpClient, {
      now: sendNow,
      statePath,
      paths: snapshotPaths,
    });
    assert.strictEqual(catchUpResult.ok, false);
    assert.strictEqual(catchUpResult.reason, 'ALREADY_SENT_TODAY');
    assert.strictEqual(catchUpClient.sentMessages.length, 0);

    // 예정 시각 전에는 캐치업하지 않는다 (KST 2026-07-04 09:00)
    const earlyResult = await runCatchUpBackupIfNeeded(createClient(), {
      now: new Date('2026-07-04T00:00:00.000Z'),
      statePath,
      paths: snapshotPaths,
    });
    assert.strictEqual(earlyResult.ok, false);
    assert.strictEqual(earlyResult.reason, 'NOT_DUE_YET');
    assert.strictEqual(hasTodayScheduledTimePassed(new Date('2026-07-04T00:00:00.000Z')), false);

    // 다음 날 예정 시각 이후에는 캐치업이 발송된다 (KST 2026-07-04 21:30)
    const nextDayClient = createClient();
    const nextDayResult = await runCatchUpBackupIfNeeded(nextDayClient, {
      now: new Date('2026-07-04T12:30:00.000Z'),
      statePath,
      paths: snapshotPaths,
    });
    assert.strictEqual(nextDayResult.ok, true);
    assert.strictEqual(nextDayResult.record.trigger, 'catchUp');
    assert.strictEqual(nextDayClient.sentMessages.length, 1);

    // 5. 채널 fetch 실패 시 throw 없이 경고만 남긴다
    const failingClient = {
      channels: {
        fetch: async () => {
          throw new Error('Missing Access');
        },
      },
    };
    const fetchFailResult = await sendOperationBackup(failingClient, {
      now: new Date('2026-07-05T12:30:00.000Z'),
      statePath,
      paths: snapshotPaths,
    });
    assert.strictEqual(fetchFailResult.ok, false);
    assert.strictEqual(fetchFailResult.reason, 'CHANNEL_FETCH_FAILED');

    // 6. restore 스크립트: dry-run은 파일을 건드리지 않고, --apply --force는 바이트 동일 복원
    const snapshotFilePath = path.join(createTempDir('operation-backup-snapshot-'), 'snapshot.json');
    fs.writeFileSync(snapshotFilePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

    const restoreDir = createTempDir('operation-backup-restore-');
    const restoreScript = path.join(__dirname, 'restore-operation-backup.js');

    const dryRunResult = spawnSync('node', [restoreScript, snapshotFilePath, '--data-dir', restoreDir], {
      encoding: 'utf8',
    });
    assert.strictEqual(dryRunResult.status, 0, dryRunResult.stderr);
    assert.strictEqual(fs.readdirSync(restoreDir).length, 0);

    const applyResult = spawnSync('node', [restoreScript, snapshotFilePath, '--apply', '--force', '--data-dir', restoreDir], {
      encoding: 'utf8',
    });
    assert.strictEqual(applyResult.status, 0, applyResult.stderr);

    const restoredPointsPath = path.join(restoreDir, 'points.local.json');
    const restoredMissionsPath = path.join(restoreDir, 'missions.local.json');
    assert.strictEqual(
      fs.readFileSync(restoredPointsPath, 'utf8'),
      fs.readFileSync(path.join(dataDir, 'points.local.json'), 'utf8')
    );
    assert.strictEqual(
      fs.readFileSync(restoredMissionsPath, 'utf8'),
      fs.readFileSync(path.join(dataDir, 'missions.local.json'), 'utf8')
    );
    // null 항목은 파일을 만들지 않는다
    assert.strictEqual(fs.existsSync(path.join(restoreDir, 'shop-items.local.json')), false);

    // 기존 파일이 있으면 --apply만으로는 덮어쓰지 않는다
    const modifiedData = { isExample: false, users: [], pointTransactions: [] };
    saveJsonFileAtomic(restoredPointsPath, modifiedData);
    const noForceResult = spawnSync('node', [restoreScript, snapshotFilePath, '--apply', '--data-dir', restoreDir], {
      encoding: 'utf8',
    });
    assert.strictEqual(noForceResult.status, 0, noForceResult.stderr);
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(restoredPointsPath, 'utf8')), modifiedData);

    console.log('operation backup flow smoke test passed');
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
