const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPointsRepository } = require('../src/pointsRepository');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'points-repository-'));
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
    operatorSupport: path.join(tempDir, 'operator-support.json'),
  };
  const sheetsEvents = [];
  const repository = createPointsRepository(paths, {
    googleSheetsLogger: {
      logPointTransaction(transaction, context) {
        sheetsEvents.push({ transaction, context });
      },
    },
  });
  assert.ok(repository.listTransactions({ limit: 5 }).length > 0);
  assert.deepStrictEqual(repository.listOperationalTransactions({ limit: 5 }), []);

  const redemptionResult = repository.requestRedemption({
    user: {
      userId: 'user_example_002',
      displayName: '참여자 예시 2',
    },
    itemId: 'item_youth_point_100_example',
    note: 'repository test',
  });

  assert.strictEqual(redemptionResult.ok, true);
  assert.strictEqual(redemptionResult.transaction.amount, -100);
  assert.strictEqual(redemptionResult.transaction.balanceAfter, 100);
  assert.strictEqual(redemptionResult.redemption.status, 'pending');
  assert.strictEqual(sheetsEvents.length, 1);
  assert.strictEqual(sheetsEvents[0].transaction.id, redemptionResult.transaction.id);
  assert.strictEqual(sheetsEvents[0].context.sourceSurface, 'slash_command');

  let pointsData = readJson(paths.points);
  let redemptionsData = readJson(paths.redemptions);
  assert.strictEqual(
    pointsData.users.find((user) => user.userId === 'user_example_002').totalPoints,
    100
  );
  assert.ok(
    redemptionsData.redemptions.some((redemption) => redemption.id === redemptionResult.redemption.id)
  );

  const completed = repository.reviewRedemption({
    redemptionId: redemptionResult.redemption.id,
    action: 'complete',
    operatorId: 'operator_repository_test',
  });
  assert.strictEqual(completed.redemption.status, 'completed');
  assert.strictEqual(completed.redemption.reviewedBy, 'operator_repository_test');
  assert.strictEqual(completed.redemption.reviewNote, 'repository test');
  assert.strictEqual(completed.redemption.reviewHistory.length, 1);

  const notedRedemption = repository.requestRedemption({
    user: {
      userId: 'user_example_003',
      displayName: '참여자 예시 3',
    },
    itemId: 'item_youth_point_100_example',
    note: 'repository test note target',
  });
  const completedWithNote = repository.reviewRedemption({
    redemptionId: notedRedemption.redemption.id,
    action: 'complete',
    operatorId: 'operator_repository_test',
    note: '현장 지급 완료 확인',
  });
  assert.strictEqual(completedWithNote.redemption.status, 'completed');
  assert.strictEqual(completedWithNote.redemption.reviewNote, '현장 지급 완료 확인');
  assert.strictEqual(completedWithNote.redemption.reviewHistory[0].note, '현장 지급 완료 확인');

  const adjusted = repository.adjustUserPoints({
    user: {
      userId: 'user_repository_new',
      displayName: '저장소 테스트 사용자',
    },
    amount: 75,
    reason: 'repository 지급 테스트',
    operatorId: 'operator_repository_test',
  });
  assert.strictEqual(adjusted.transaction.type, 'earn');
  assert.strictEqual(adjusted.transaction.balanceAfter, 75);
  assert.ok(
    sheetsEvents.some((event) => event.transaction.id === adjusted.transaction.id && event.context.sourceSurface === 'operator_command')
  );

  const cancelled = repository.reviewRedemption({
    redemptionId: 'rd_example_cancelled',
    action: 'refund',
    operatorId: 'operator_repository_test',
    note: 'repository 환불 테스트',
  });
  assert.strictEqual(cancelled.redemption.status, 'refunded');
  assert.strictEqual(cancelled.refundTransaction.amount, 100);
  assert.ok(
    sheetsEvents.some((event) => event.transaction.id === cancelled.refundTransaction.id && event.context.sourceSurface === 'operator_command')
  );

  pointsData = readJson(paths.points);
  redemptionsData = readJson(paths.redemptions);
  assert.strictEqual(
    pointsData.users.find((user) => user.userId === 'user_example_004').totalPoints,
    120
  );
  assert.strictEqual(
    redemptionsData.redemptions.find((redemption) => redemption.id === 'rd_example_cancelled').status,
    'refunded'
  );

  const logs = repository.listTransactions({
    userId: 'user_example_004',
    type: 'refund',
    limit: 5,
  });
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0].relatedId, 'rd_example_cancelled');

  const firstGuideUse = repository.recordParticipantCommandFirstUse({
    userId: 'first_use_user',
    commandName: '안내',
  });
  const duplicateGuideUse = repository.recordParticipantCommandFirstUse({
    userId: 'first_use_user',
    commandName: '안내',
  });
  repository.recordParticipantCommandFirstUse({
    userId: 'first_use_user',
    commandName: '포인트',
  });
  assert.strictEqual(firstGuideUse.recorded, true);
  assert.strictEqual(duplicateGuideUse.recorded, false);

  const firstGuidance = repository.recordMissionSubmissionGuidance({
    userId: 'first_use_user',
    channelId: 'mission_submission_channel',
    messageId: 'mission_submission_message',
  });
  const duplicateGuidance = repository.recordMissionSubmissionGuidance({
    userId: 'first_use_user',
    channelId: 'mission_submission_channel',
    messageId: 'mission_submission_message_2',
  });
  assert.strictEqual(firstGuidance.recorded, true);
  assert.strictEqual(duplicateGuidance.recorded, false);
  assert.strictEqual(repository.hasSentMissionSubmissionGuidance('first_use_user', 'mission_submission_channel'), true);

  repository.recordFaqFallbackCandidate({ question: '주차는 어디에 하나요?' });
  const repeatedFaqCandidate = repository.recordFaqFallbackCandidate({ question: '주차는 어디에 하나요?' });
  assert.strictEqual(repeatedFaqCandidate.count, 2);

  const supportSummary = repository.getOperatorSupportSummary(10);
  assert.strictEqual(supportSummary.trackedUsersCount, 1);
  assert.strictEqual(supportSummary.commandCounts['안내'], 1);
  assert.strictEqual(supportSummary.commandCounts['포인트'], 1);
  assert.strictEqual(supportSummary.guidanceSentCount, 1);
  assert.strictEqual(supportSummary.faqCandidates[0].count, 2);

  assert.strictEqual(repository.isDuplicateMissionRewardGuardHealthy('2030-06-01'), true);

  const guardCheckSubmission = repository.createTodayMissionSubmission({
    user: {
      userId: 'user_guard_check',
      displayName: '가드 점검 참여자',
    },
    content: '오늘의 미션 인증',
    attachmentCount: 1,
    rewardPoints: 20,
    todayMissionDate: '2030-06-01',
    messageId: 'today_message_guard_check',
    channelId: 'today_channel_guard_check',
    guildId: 'guild_guard_check',
  });
  const guardCheckApproved = repository.approveSubmissionById(
    guardCheckSubmission.submission.id,
    { userId: 'operator_guard_check', displayName: '가드 점검 운영자' },
    '확인'
  );
  assert.ok(guardCheckApproved.transaction);
  assert.strictEqual(repository.isDuplicateMissionRewardGuardHealthy('2030-06-01'), true);

  const duplicateGuardCheckSubmission = repository.createTodayMissionSubmission({
    user: {
      userId: 'user_guard_check',
      displayName: '가드 점검 참여자',
    },
    content: '오늘의 미션 두 번째 인증',
    attachmentCount: 1,
    rewardPoints: 20,
    todayMissionDate: '2030-06-01',
    messageId: 'today_message_guard_check_duplicate',
    channelId: 'today_channel_guard_check',
    guildId: 'guild_guard_check',
  });
  const duplicateGuardCheckBlocked = repository.approveSubmissionById(
    duplicateGuardCheckSubmission.submission.id,
    { userId: 'operator_guard_check', displayName: '가드 점검 운영자' },
    '중복 확인'
  );
  assert.strictEqual(duplicateGuardCheckBlocked.transaction, null);
  assert.strictEqual(duplicateGuardCheckBlocked.submission.duplicateRewardBlocked, true);
  assert.strictEqual(repository.isDuplicateMissionRewardGuardHealthy('2030-06-01'), true);

  const submissionsData = readJson(paths.submissions);
  submissionsData.submissions.push({
    ...submissionsData.submissions.find((submission) => submission.id === guardCheckSubmission.submission.id),
    id: 'today_submission_manual_anomaly',
    rewardTransactionId: 'tx_manual_anomaly',
  });
  fs.writeFileSync(paths.submissions, JSON.stringify(submissionsData, null, 2));
  assert.strictEqual(repository.isDuplicateMissionRewardGuardHealthy('2030-06-01'), false);

  console.log('pointsRepository smoke test passed');
}

main();
