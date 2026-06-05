const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPointsRepository } = require('../src/pointsRepository');
const {
  appendGoogleSheetsLog,
  buildMissionSubmissionPayload,
  buildPointTransactionPayload,
} = require('../src/googleSheetsLogger');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createTempRepository(options = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'google-sheets-logger-'));
  const dataDir = path.join(__dirname, '..', 'data');
  const paths = {
    points: path.join(tempDir, 'points.json'),
    pointsFallback: path.join(dataDir, 'points.example.json'),
    shopItems: path.join(tempDir, 'shop-items.json'),
    shopItemsFallback: path.join(dataDir, 'shop-items.example.json'),
    redemptions: path.join(tempDir, 'redemptions.json'),
    redemptionsFallback: path.join(dataDir, 'redemptions.example.json'),
    missions: path.join(tempDir, 'missions.json'),
    missionsFallback: path.join(dataDir, 'missions.example.json'),
    submissions: path.join(tempDir, 'submissions.json'),
    submissionsFallback: path.join(dataDir, 'submissions.example.json'),
  };

  return {
    paths,
    repository: createPointsRepository(paths, options),
  };
}

async function testSkipsWhenDisabledOrIncomplete() {
  let fetchCalled = false;
  const fetchImpl = async () => {
    fetchCalled = true;
    throw new Error('fetch should not be called');
  };

  let result = await appendGoogleSheetsLog('point_transactions', {}, {
    env: {},
    fetch: fetchImpl,
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'DISABLED');

  result = await appendGoogleSheetsLog('point_transactions', {}, {
    env: { GOOGLE_SHEETS_LOGGING_ENABLED: 'true' },
    fetch: fetchImpl,
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'MISSING_CONFIG');
  assert.strictEqual(fetchCalled, false);
}

async function testAcceptsAppendedAndDuplicateResponses() {
  const requests = [];
  const env = {
    GOOGLE_SHEETS_LOGGING_ENABLED: 'true',
    GOOGLE_SHEETS_WEB_APP_URL: 'https://script.google.test/exec',
    GOOGLE_SHEETS_WEB_APP_SECRET: 'secret_for_test',
  };
  const statuses = ['appended', 'duplicate'];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        return { status: statuses[requests.length - 1] };
      },
    };
  };

  const appended = await appendGoogleSheetsLog('mission_submissions', { event_id: 'event_1' }, { env, fetch: fetchImpl });
  const duplicate = await appendGoogleSheetsLog('mission_submissions', { event_id: 'event_1' }, { env, fetch: fetchImpl });

  assert.strictEqual(appended.ok, true);
  assert.strictEqual(appended.status, 'appended');
  assert.strictEqual(duplicate.ok, true);
  assert.strictEqual(duplicate.status, 'duplicate');
  assert.strictEqual(requests.length, 2);
  assert.strictEqual(requests[0].url, env.GOOGLE_SHEETS_WEB_APP_URL);
  assert.deepStrictEqual(JSON.parse(requests[0].options.body), {
    secret: env.GOOGLE_SHEETS_WEB_APP_SECRET,
    tab: 'mission_submissions',
    payload: { event_id: 'event_1' },
  });
}

async function testFailuresDoNotThrow() {
  const warnings = [];
  const result = await appendGoogleSheetsLog('point_transactions', { event_id: 'event_2' }, {
    env: {
      GOOGLE_SHEETS_LOGGING_ENABLED: 'true',
      GOOGLE_SHEETS_WEB_APP_URL: 'https://script.google.test/exec',
      GOOGLE_SHEETS_WEB_APP_SECRET: 'secret_for_test',
    },
    fetch: async () => {
      throw new Error('network down');
    },
    warn: (...args) => warnings.push(args.join(' ')),
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.skipped, false);
  assert.match(result.error.message, /network down/);
  assert.strictEqual(warnings.length, 1);
}

function testPayloadBuilders() {
  const missionPayload = buildMissionSubmissionPayload({
    id: 'submission_1',
    type: 'todayMission',
    missionId: null,
    missionTitle: '오늘의 미션',
    todayMissionDate: '2026-06-05',
    userId: 'user_1',
    displayName: '참여자',
    contentSummary: '사진 인증',
    attachmentCount: 2,
    attachmentUrls: ['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg'],
    messageId: 'message_1',
    channelId: 'channel_1',
    guildId: 'guild_1',
    messageUrl: 'https://discord.com/channels/guild_1/channel_1/message_1',
    status: 'pending',
    rewardPoints: 20,
    createdAt: '2026-06-04T15:01:00.000Z',
  });

  assert.strictEqual(missionPayload.tab, 'mission_submissions');
  assert.strictEqual(missionPayload.payload.submission_id, 'submission_1');
  assert.strictEqual(missionPayload.payload.duplicate_key, 'todayMission:2026-06-05:user_1');
  assert.strictEqual(missionPayload.payload.attachment_urls, JSON.stringify(['https://cdn.test/a.jpg', 'https://cdn.test/b.jpg']));
  assert.strictEqual(missionPayload.payload.discord_message_url, 'https://discord.com/channels/guild_1/channel_1/message_1');

  const pointPayload = buildPointTransactionPayload({
    id: 'tx_1',
    createdAt: '2026-06-04T15:02:00.000Z',
    userId: 'user_1',
    type: 'earn',
    amount: 20,
    balanceAfter: 40,
    reason: '오늘의 미션 인증 승인',
    relatedType: 'todayMissionSubmission',
    relatedId: 'submission_1',
    createdBy: 'operator_1',
    note: 'messageUrl=https://discord.com/channels/guild_1/channel_1/message_1',
  }, {
    displayName: '참여자',
    sourceSurface: 'today_mission_channel',
    discordMessageUrl: 'https://discord.com/channels/guild_1/channel_1/message_1',
  });

  assert.strictEqual(pointPayload.tab, 'point_transactions');
  assert.strictEqual(pointPayload.payload.event_id, 'point_transaction:tx_1');
  assert.strictEqual(pointPayload.payload.transaction_id, 'tx_1');
  assert.strictEqual(pointPayload.payload.display_name, '참여자');
  assert.strictEqual(pointPayload.payload.source_surface, 'today_mission_channel');
}

function testRepositoryLogsAfterLocalSaves() {
  const calls = [];
  const { paths, repository } = createTempRepository({
    googleSheetsLogger: {
      appendMissionSubmission(submission) {
        const submissionsData = readJson(paths.submissions);
        assert.ok(submissionsData.submissions.some((item) => item.id === submission.id));
        calls.push({ tab: 'mission_submissions', id: submission.id });
      },
      appendPointTransaction(transaction) {
        const pointsData = readJson(paths.points);
        assert.ok(pointsData.pointTransactions.some((item) => item.id === transaction.id));
        calls.push({ tab: 'point_transactions', id: transaction.id });
      },
    },
  });

  repository.saveMissionsData({
    isExample: false,
    description: 'test missions',
    missions: [
      {
        id: 'mission_sheet_test',
        title: 'Sheets 테스트 미션',
        rewardPoints: 30,
        status: 'active',
        requiresSubmission: true,
      },
    ],
  });

  const missionSubmission = repository.createMissionSubmission({
    user: {
      userId: 'sheet_mission_user',
      displayName: 'Sheets 미션 사용자',
    },
    missionId: 'mission_sheet_test',
    content: '일반 미션 인증',
  });
  assert.strictEqual(missionSubmission.ok, true);

  const todaySubmission = repository.createTodayMissionSubmission({
    user: {
      userId: 'sheet_today_user',
      displayName: 'Sheets 오늘 사용자',
    },
    content: '오늘의 미션 사진',
    attachmentCount: 1,
    rewardPoints: 20,
    todayMissionDate: '2030-05-01',
    messageId: 'today_message_sheet',
    channelId: 'today_channel_sheet',
    guildId: 'guild_sheet',
  });
  assert.strictEqual(todaySubmission.ok, true);

  const approved = repository.approveSubmissionById(
    todaySubmission.submission.id,
    { userId: 'operator_sheet' },
    '확인'
  );
  assert.strictEqual(approved.transaction.relatedType, 'todayMissionSubmission');

  assert.deepStrictEqual(calls.map((call) => call.tab), [
    'mission_submissions',
    'mission_submissions',
    'point_transactions',
  ]);
}

async function main() {
  await testSkipsWhenDisabledOrIncomplete();
  await testAcceptsAppendedAndDuplicateResponses();
  await testFailuresDoNotThrow();
  testPayloadBuilders();
  testRepositoryLogsAfterLocalSaves();

  console.log('googleSheetsLogger smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
