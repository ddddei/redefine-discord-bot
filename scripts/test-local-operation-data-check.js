const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkLocalOperationData } = require('./check-local-operation-data');

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function createValidData(dir) {
  writeJson(path.join(dir, 'points.local.json'), {
    isExample: false,
    users: [{
      userId: 'user_real_001',
      displayName: '운영 참여자',
      totalPoints: 50,
      status: 'active',
    }],
    pointTransactions: [{
      id: 'tx_real_001',
      userId: 'user_real_001',
      type: 'earn',
      amount: 50,
      balanceAfter: 50,
      reason: '운영 리허설 지급',
      relatedType: 'manual',
      relatedId: null,
      createdBy: 'operator_real',
      createdAt: '2026-07-01T10:00:00+09:00',
    }],
  });
  writeJson(path.join(dir, 'missions.local.json'), {
    isExample: false,
    missions: [{
      id: 'mission_real_001',
      title: '운영 리허설 미션',
      status: 'active',
      rewardPoints: 10,
      createdAt: '2026-07-01T09:00:00+09:00',
    }],
  });
  writeJson(path.join(dir, 'shop-items.local.json'), {
    isExample: false,
    shopItems: [{
      id: 'item_real_001',
      name: '운영 리허설 리워드',
      cost: 10,
      status: 'active',
      stock: null,
      createdAt: '2026-07-01T09:00:00+09:00',
    }],
  });
  writeJson(path.join(dir, 'redemptions.local.json'), {
    isExample: false,
    redemptions: [{
      id: 'rd_real_001',
      userId: 'user_real_001',
      itemId: 'item_real_001',
      cost: 10,
      status: 'pending',
      requestedAt: '2026-07-01T10:10:00+09:00',
      transactionId: 'tx_real_001',
    }],
  });
  writeJson(path.join(dir, 'submissions.local.json'), {
    isExample: false,
    submissions: [{
      id: 'sub_real_001',
      missionId: 'mission_real_001',
      userId: 'user_real_001',
      status: 'pending',
      createdAt: '2026-07-01T10:20:00+09:00',
    }],
  });
}

function main() {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-data-empty-'));
  const emptyResult = checkLocalOperationData(emptyDir);
  assert.strictEqual(emptyResult.ok, true);
  assert.strictEqual(emptyResult.checkedFiles, 0);

  const validDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-data-valid-'));
  createValidData(validDir);
  const validResult = checkLocalOperationData(validDir);
  assert.strictEqual(validResult.ok, true);
  assert.strictEqual(validResult.checkedFiles, 5);

  const invalidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-data-invalid-'));
  createValidData(invalidDir);
  const pointsPath = path.join(invalidDir, 'points.local.json');
  const points = JSON.parse(fs.readFileSync(pointsPath, 'utf8'));
  points.users[0].totalPoints = -10;
  points.users.push({ userId: 'user_real_001', totalPoints: 0 });
  points.pointTransactions[0].balanceAfter = 40;
  points.pointTransactions.push({
    id: 'tx_example_2030',
    userId: 'user_example_001',
    type: 'earn',
    amount: 10,
    balanceAfter: 10,
    reason: '예시 지급',
    createdAt: '2030-01-01T00:00:00+09:00',
  });
  writeJson(pointsPath, points);
  const missionsPath = path.join(invalidDir, 'missions.local.json');
  const missions = JSON.parse(fs.readFileSync(missionsPath, 'utf8'));
  missions.missions[0].status = 'ready';
  writeJson(missionsPath, missions);

  const invalidResult = checkLocalOperationData(invalidDir);
  assert.strictEqual(invalidResult.ok, false);
  assert.ok(invalidResult.issues.some((issue) => /중복/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /음수/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /불일치/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /예시 데이터 혼입/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /잘못된 status/.test(issue)));

  console.log('local operation data check smoke test passed');
}

main();
