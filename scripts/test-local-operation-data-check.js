const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
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
      totalPoints: 40,
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
    }, {
      id: 'tx_redeem_real_001',
      userId: 'user_real_001',
      type: 'redeem',
      amount: -10,
      balanceAfter: 40,
      reason: '운영 리허설 교환',
      relatedType: 'redemption',
      relatedId: 'rd_real_001',
      createdBy: 'user_real_001',
      createdAt: '2026-07-01T10:10:00+09:00',
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
      transactionId: 'tx_redeem_real_001',
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
  const emptyStrictResult = checkLocalOperationData(emptyDir, { strict: true });
  assert.strictEqual(emptyStrictResult.ok, false);
  assert.ok(emptyStrictResult.issues.some((issue) => /필수 파일 누락/.test(issue)));
  const strictCliResult = spawnSync('node', [path.join(__dirname, 'check-local-operation-data.js')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PRODUCTION_DATA_STRICT: 'true',
      OPERATION_DATA_DIR: emptyDir,
      LOCAL_OPERATION_DATA_DIR: emptyDir,
    },
  });
  assert.notStrictEqual(strictCliResult.status, 0);
  assert.match(strictCliResult.stderr, /strict 모드 필수 파일 누락/);

  const validDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-data-valid-'));
  createValidData(validDir);
  const validResult = checkLocalOperationData(validDir);
  assert.strictEqual(validResult.ok, true);
  assert.strictEqual(validResult.checkedFiles, 5);
  const validStrictResult = checkLocalOperationData(validDir, { strict: true });
  assert.strictEqual(validStrictResult.ok, true);

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
  const shopPath = path.join(invalidDir, 'shop-items.local.json');
  const shop = JSON.parse(fs.readFileSync(shopPath, 'utf8'));
  shop.shopItems[0].stock = -1;
  writeJson(shopPath, shop);
  const redemptionPath = path.join(invalidDir, 'redemptions.local.json');
  const redemptionData = JSON.parse(fs.readFileSync(redemptionPath, 'utf8'));
  redemptionData.redemptions[0].status = 'refunded';
  redemptionData.redemptions[0].refundTransactionId = 'tx_missing_refund';
  writeJson(redemptionPath, redemptionData);
  const submissionPath = path.join(invalidDir, 'submissions.local.json');
  const submissionData = JSON.parse(fs.readFileSync(submissionPath, 'utf8'));
  submissionData.submissions[0].status = 'approved';
  submissionData.submissions[0].rewardTransactionId = 'tx_missing_submission';
  writeJson(submissionPath, submissionData);
  writeJson(path.join(invalidDir, 'reaction-approvals.local.json'), {
    isExample: false,
    records: [{
      id: 'reaction_real_001', messageId: 'message_001', authorId: 'user_real_001',
      status: 'approved', reviewedAt: '2026-07-01T11:00:00+09:00', transactionId: 'tx_missing_reaction',
    }],
  });

  const invalidResult = checkLocalOperationData(invalidDir);
  assert.strictEqual(invalidResult.ok, false);
  assert.ok(invalidResult.issues.some((issue) => /중복/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /음수/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /불일치/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /예시 데이터 혼입/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /잘못된 status/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /재고 음수/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /환불 거래 상호 참조/.test(issue)));
  assert.ok(invalidResult.issues.some((issue) => /지급 거래 참조 없음/.test(issue)));

  console.log('local operation data check smoke test passed');
}

main();
