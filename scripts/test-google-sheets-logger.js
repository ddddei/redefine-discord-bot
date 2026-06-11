const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPointsRepository } = require('../src/pointsRepository');
const {
  appendGoogleSheetsLog,
  buildMissionReviewPayload,
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

  const approvedReviewPayload = buildMissionReviewPayload({
    id: 'submission_1',
    status: 'approved',
    reviewedBy: 'operator_1',
    reviewedAt: '2026-06-04T15:03:00.000Z',
    rewardTransactionId: 'tx_1',
    duplicateRewardBlocked: false,
    note: '확인',
    messageUrl: 'https://discord.com/channels/guild_1/channel_1/message_1',
  }, {
    reviewer: { userId: 'operator_1', displayName: '운영자' },
    transaction: { id: 'tx_1', amount: 20 },
  });

  assert.strictEqual(approvedReviewPayload.tab, 'mission_reviews');
  assert.strictEqual(approvedReviewPayload.payload.event_id, 'mission_reviews:review:submission_1');
  assert.strictEqual(approvedReviewPayload.payload.review_id, 'review:submission_1');
  assert.strictEqual(approvedReviewPayload.payload.submission_id, 'submission_1');
  assert.strictEqual(approvedReviewPayload.payload.reviewed_date_kst, '2026-06-05');
  assert.strictEqual(approvedReviewPayload.payload.action, 'approve');
  assert.strictEqual(approvedReviewPayload.payload.reviewer_display_name, '운영자');
  assert.strictEqual(approvedReviewPayload.payload.reward_transaction_id, 'tx_1');
  assert.strictEqual(approvedReviewPayload.payload.reward_points, 20);
  assert.strictEqual(approvedReviewPayload.payload.duplicate_reward_blocked, false);

  const rejectedReviewPayload = buildMissionReviewPayload({
    id: 'submission_2',
    status: 'rejected',
    reviewedBy: 'operator_1',
    reviewedAt: '2026-06-04T15:04:00.000Z',
    rewardTransactionId: null,
    duplicateRewardBlocked: false,
    note: '대상 아님',
  }, {
    reviewer: { userId: 'operator_1', displayName: '운영자' },
  });

  assert.strictEqual(rejectedReviewPayload.payload.action, 'reject');
  assert.strictEqual(rejectedReviewPayload.payload.reward_transaction_id, '');
  assert.strictEqual(rejectedReviewPayload.payload.reward_points, 0);

  const duplicateReviewPayload = buildMissionReviewPayload({
    id: 'submission_3',
    status: 'approved',
    reviewedBy: 'operator_1',
    reviewedAt: '2026-06-04T15:05:00.000Z',
    rewardTransactionId: null,
    duplicateRewardBlocked: true,
    note: '이미 오늘의 미션 포인트 지급 완료',
  });

  assert.strictEqual(duplicateReviewPayload.payload.action, 'duplicate_reward_blocked');
  assert.strictEqual(duplicateReviewPayload.payload.duplicate_reward_blocked, true);
  assert.strictEqual(duplicateReviewPayload.payload.reward_transaction_id, '');
  assert.strictEqual(duplicateReviewPayload.payload.reward_points, 0);
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
      appendMissionReview(submission, context) {
        const submissionsData = readJson(paths.submissions);
        const savedSubmission = submissionsData.submissions.find((item) => item.id === submission.id);
        assert.ok(savedSubmission);
        assert.strictEqual(savedSubmission.status, submission.status);
        calls.push({
          tab: 'mission_reviews',
          id: submission.id,
          action: context.action,
          duplicateRewardBlocked: submission.duplicateRewardBlocked === true,
          transactionId: context.transaction ? context.transaction.id : null,
        });
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
    { userId: 'operator_sheet', displayName: 'Sheets 운영자' },
    '확인'
  );
  assert.strictEqual(approved.transaction.relatedType, 'todayMissionSubmission');

  const duplicateTodaySubmission = repository.createTodayMissionSubmission({
    user: {
      userId: 'sheet_today_user',
      displayName: 'Sheets 오늘 사용자',
    },
    content: '오늘의 미션 두 번째 사진',
    attachmentCount: 1,
    rewardPoints: 20,
    todayMissionDate: '2030-05-01',
    messageId: 'today_message_sheet_duplicate',
    channelId: 'today_channel_sheet',
    guildId: 'guild_sheet',
  });
  assert.strictEqual(duplicateTodaySubmission.ok, true);

  const duplicateBlocked = repository.approveSubmissionById(
    duplicateTodaySubmission.submission.id,
    { userId: 'operator_sheet', displayName: 'Sheets 운영자' },
    '중복 확인'
  );
  assert.strictEqual(duplicateBlocked.transaction, null);
  assert.strictEqual(duplicateBlocked.submission.duplicateRewardBlocked, true);

  const rejectSubmission = repository.createMissionSubmission({
    user: {
      userId: 'sheet_reject_user',
      displayName: 'Sheets 반려 사용자',
    },
    missionId: 'mission_sheet_test',
    content: '반려될 일반 미션 인증',
  });
  assert.strictEqual(rejectSubmission.ok, true);

  const rejected = repository.rejectSubmissionById(
    rejectSubmission.submission.id,
    { userId: 'operator_sheet', displayName: 'Sheets 운영자' },
    '대상 아님'
  );
  assert.strictEqual(rejected.transaction, null);
  assert.strictEqual(rejected.submission.status, 'rejected');

  assert.deepStrictEqual(calls.map((call) => call.tab), [
    'mission_submissions',
    'mission_submissions',
    'point_transactions',
    'mission_reviews',
    'mission_submissions',
    'mission_reviews',
    'mission_submissions',
    'mission_reviews',
  ]);
  assert.deepStrictEqual(
    calls.filter((call) => call.tab === 'mission_reviews').map((call) => ({
      action: call.action,
      duplicateRewardBlocked: call.duplicateRewardBlocked,
      hasTransaction: Boolean(call.transactionId),
    })),
    [
      { action: 'approve', duplicateRewardBlocked: false, hasTransaction: true },
      { action: 'duplicate_reward_blocked', duplicateRewardBlocked: true, hasTransaction: false },
      { action: 'reject', duplicateRewardBlocked: false, hasTransaction: false },
    ]
  );
}

function testMissionReviewFailuresDoNotBlockReviews() {
  const { repository } = createTempRepository({
    googleSheetsLogger: {
      appendMissionSubmission() {},
      appendPointTransaction() {},
      appendMissionReview() {
        throw new Error('sheet unavailable');
      },
    },
  });

  repository.saveMissionsData({
    isExample: false,
    description: 'test missions',
    missions: [
      {
        id: 'mission_sheet_failure_test',
        title: 'Sheets 실패 테스트 미션',
        rewardPoints: 30,
        status: 'active',
        requiresSubmission: true,
      },
    ],
  });

  const missionSubmission = repository.createMissionSubmission({
    user: {
      userId: 'sheet_failure_user',
      displayName: 'Sheets 실패 사용자',
    },
    missionId: 'mission_sheet_failure_test',
    content: 'Sheets 실패와 무관하게 승인',
  });

  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const approved = repository.approveSubmissionById(
      missionSubmission.submission.id,
      { userId: 'operator_sheet', displayName: 'Sheets 운영자' },
      '확인'
    );

    assert.strictEqual(approved.submission.status, 'approved');
    assert.ok(approved.transaction);
  } finally {
    console.warn = originalWarn;
  }
}

async function main() {
  await testSkipsWhenDisabledOrIncomplete();
  await testAcceptsAppendedAndDuplicateResponses();
  await testFailuresDoNotThrow();
  testPayloadBuilders();
  testRepositoryLogsAfterLocalSaves();
  testMissionReviewFailuresDoNotBlockReviews();

  console.log('googleSheetsLogger smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
