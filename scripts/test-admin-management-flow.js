const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { listActiveShopItems } = require('../src/pointsStore');
const { createPointsRepository } = require('../src/pointsRepository');

const dataDir = path.join(__dirname, '..', 'data');

function createTempRepository() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-management-flow-'));
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

  return createPointsRepository(paths);
}

function main() {
  const repository = createTempRepository();

  const initialSummary = repository.getOperationSummary();
  assert.ok(initialSummary.pendingRedemptionsCount >= 1);
  assert.ok(initialSummary.pendingSubmissionsCount >= 0);
  assert.ok(initialSummary.activeMissionsCount >= 0);
  assert.ok(initialSummary.activeShopItemsCount >= 0);

  const mission = repository.createMission({
    title: '운영 관리 테스트 미션',
    description: '관리 기능 smoke test용 미션입니다.',
    rewardPoints: 15,
    requiresSubmission: true,
    activeDate: '2030-06-01',
    note: 'created by smoke test',
  });
  assert.strictEqual(mission.status, 'draft');
  assert.strictEqual(mission.rewardPoints, 15);

  const updatedMission = repository.updateMission(mission.id, {
    title: '수정된 운영 관리 테스트 미션',
    rewardPoints: 25,
    requiresSubmission: false,
    note: 'updated by smoke test',
  });
  assert.strictEqual(updatedMission.title, '수정된 운영 관리 테스트 미션');
  assert.strictEqual(updatedMission.rewardPoints, 25);
  assert.strictEqual(updatedMission.requiresSubmission, false);

  const activeMission = repository.setMissionStatus(mission.id, 'active');
  assert.strictEqual(activeMission.status, 'active');
  assert.ok(repository.listActiveMissions().some((item) => item.id === mission.id));

  const pausedMission = repository.setMissionStatus(mission.id, 'paused');
  assert.strictEqual(pausedMission.status, 'paused');
  assert.ok(!repository.listActiveMissions().some((item) => item.id === mission.id));

  const closedMission = repository.setMissionStatus(mission.id, 'closed');
  assert.strictEqual(closedMission.status, 'closed');
  assert.ok(repository.listMissionsForAdmin({ limit: 20 }).some((item) => item.id === mission.id));

  const shopItem = repository.createShopItem({
    name: '운영 관리 테스트 리워드',
    description: '관리 기능 smoke test용 상점 항목입니다.',
    cost: 40,
    stock: 3,
    monthlyLimit: 1,
    type: 'reward',
    note: 'created by smoke test',
  });
  assert.strictEqual(shopItem.status, 'paused');
  assert.strictEqual(shopItem.cost, 40);

  const updatedShopItem = repository.updateShopItem(shopItem.id, {
    name: '수정된 운영 관리 테스트 리워드',
    cost: 50,
    stock: 2,
    monthlyLimit: 2,
    note: 'updated by smoke test',
  });
  assert.strictEqual(updatedShopItem.name, '수정된 운영 관리 테스트 리워드');
  assert.strictEqual(updatedShopItem.cost, 50);
  assert.strictEqual(updatedShopItem.stock, 2);
  assert.strictEqual(updatedShopItem.monthlyLimit, 2);

  const activeShopItem = repository.setShopItemStatus(shopItem.id, 'active');
  assert.strictEqual(activeShopItem.status, 'active');
  assert.ok(listActiveShopItems(repository.loadState().shopItemsData).some((item) => item.id === shopItem.id));

  const pausedShopItem = repository.setShopItemStatus(shopItem.id, 'paused');
  assert.strictEqual(pausedShopItem.status, 'paused');
  assert.ok(!listActiveShopItems(repository.loadState().shopItemsData).some((item) => item.id === shopItem.id));

  const soldOutShopItem = repository.setShopItemStatus(shopItem.id, 'soldOut');
  assert.strictEqual(soldOutShopItem.status, 'soldOut');

  const hiddenShopItem = repository.setShopItemStatus(shopItem.id, 'hidden');
  assert.strictEqual(hiddenShopItem.status, 'hidden');
  assert.ok(repository.listShopItemsForAdmin({ limit: 20 }).some((item) => item.id === shopItem.id));

  const redemption = repository.requestRedemption({
    user: {
      userId: 'user_example_002',
      displayName: '교환 대기 테스트 사용자',
    },
    itemId: 'item_youth_point_100_example',
    note: 'pending redemption smoke test',
  });
  assert.strictEqual(redemption.ok, true);
  assert.ok(repository.listPendingRedemptions(20).some((item) => item.id === redemption.redemption.id));

  const submissionMission = repository.setMissionStatus(mission.id, 'active');
  const submission = repository.createMissionSubmission({
    user: {
      userId: 'admin_management_submission_user',
      displayName: '인증 대기 테스트 사용자',
    },
    missionId: submissionMission.id,
    content: 'pending submission smoke test',
  });
  assert.strictEqual(submission.ok, true);
  assert.ok(repository.listPendingSubmissions(20).some((item) => item.id === submission.submission.id));

  const finalSummary = repository.getOperationSummary();
  assert.ok(finalSummary.pendingRedemptionsCount >= 1);
  assert.ok(finalSummary.pendingSubmissionsCount >= 1);
  assert.ok(finalSummary.activeMissionsCount >= 1);

  console.log('admin management flow smoke test passed');
}

main();
