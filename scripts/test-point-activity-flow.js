const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getUserPoints, loadJsonFile } = require('../src/pointsStore');
const { CHECKIN_REWARD_POINTS, createPointsRepository } = require('../src/pointsRepository');

const dataDir = path.join(__dirname, '..', 'data');

function createTempRepository() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'point-activity-flow-'));
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
    repository: createPointsRepository(paths),
  };
}

function main() {
  const { paths, repository } = createTempRepository();

  repository.saveMissionsData({
    isExample: false,
    description: 'test missions',
    missions: [
      {
        id: 'mission_active_test',
        title: '테스트 active 미션',
        description: '테스트용 active 미션입니다.',
        rewardPoints: 20,
        status: 'active',
        requiresSubmission: true,
      },
      {
        id: 'mission_draft_test',
        title: '테스트 draft 미션',
        description: '목록에 표시되지 않아야 합니다.',
        rewardPoints: 30,
        status: 'draft',
        requiresSubmission: true,
      },
    ],
  });

  const activeMissions = repository.listActiveMissions();
  assert.strictEqual(activeMissions.length, 1);
  assert.strictEqual(activeMissions[0].id, 'mission_active_test');

  const checkinUser = {
    userId: 'activity_user_checkin',
    displayName: '체크인 테스트 사용자',
  };
  const firstCheckin = repository.createCheckin({
    user: checkinUser,
    content: '오늘도 가능한 만큼 참여합니다.',
    checkinDate: '2030-05-01',
  });
  assert.strictEqual(firstCheckin.ok, true);
  assert.strictEqual(firstCheckin.transaction.amount, CHECKIN_REWARD_POINTS);
  assert.strictEqual(repository.hasCheckedInToday(checkinUser.userId, '2030-05-01'), true);

  const duplicateCheckin = repository.createCheckin({
    user: checkinUser,
    content: '중복 체크인',
    checkinDate: '2030-05-01',
  });
  assert.strictEqual(duplicateCheckin.ok, false);
  assert.strictEqual(duplicateCheckin.reason, 'ALREADY_CHECKED_IN');

  let pointsData = repository.loadState().pointsData;
  assert.strictEqual(getUserPoints(pointsData, checkinUser.userId), CHECKIN_REWARD_POINTS);

  const missionUser = {
    userId: 'activity_user_mission',
    displayName: '미션 테스트 사용자',
  };
  const pendingSubmission = repository.createMissionSubmission({
    user: missionUser,
    missionId: 'mission_active_test',
    content: '테스트 미션 인증 내용',
  });
  assert.strictEqual(pendingSubmission.ok, true);
  assert.strictEqual(pendingSubmission.submission.status, 'pending');

  const duplicateSubmission = repository.createMissionSubmission({
    user: missionUser,
    missionId: 'mission_active_test',
    content: '중복 제출',
  });
  assert.strictEqual(duplicateSubmission.ok, false);
  assert.strictEqual(duplicateSubmission.reason, 'DUPLICATE_SUBMISSION');

  const approved = repository.approveSubmissionById(
    pendingSubmission.submission.id,
    { userId: 'operator_test' },
    '확인 완료'
  );
  assert.strictEqual(approved.submission.status, 'approved');
  assert.strictEqual(approved.transaction.amount, 20);
  assert.strictEqual(approved.submission.rewardTransactionId, approved.transaction.id);

  pointsData = repository.loadState().pointsData;
  assert.strictEqual(getUserPoints(pointsData, missionUser.userId), 20);

  assert.throws(() => {
    repository.approveSubmissionById(
      pendingSubmission.submission.id,
      { userId: 'operator_test' },
      '중복 승인'
    );
  }, /이미 처리된 인증 제출/);

  const rejectedUser = {
    userId: 'activity_user_rejected',
    displayName: '반려 테스트 사용자',
  };
  const rejectedPending = repository.createMissionSubmission({
    user: rejectedUser,
    missionId: 'mission_active_test',
    content: '반려 흐름 테스트',
  });
  assert.strictEqual(rejectedPending.ok, true);

  const rejected = repository.rejectSubmissionById(
    rejectedPending.submission.id,
    { userId: 'operator_test' },
    '추가 확인 필요'
  );
  assert.strictEqual(rejected.submission.status, 'rejected');
  assert.strictEqual(rejected.transaction, null);

  pointsData = repository.loadState().pointsData;
  assert.strictEqual(getUserPoints(pointsData, rejectedUser.userId), 0);

  const recentSubmissions = repository.listRecentSubmissions(10);
  assert.ok(recentSubmissions.length >= 3);
  assert.ok(recentSubmissions.some((submission) => submission.id === rejected.submission.id));
  assert.strictEqual(repository.listPendingSubmissions(10).length, 0);

  const submissionsData = loadJsonFile(paths.submissions);
  assert.strictEqual(submissionsData.submissions.length, 3);

  console.log('point activity flow smoke test passed');
}

main();
