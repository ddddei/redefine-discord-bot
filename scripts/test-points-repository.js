const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPointsRepository } = require('../src/pointsRepository');

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
  };
  const repository = createPointsRepository(paths);
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

  const cancelled = repository.reviewRedemption({
    redemptionId: 'rd_example_cancelled',
    action: 'refund',
    operatorId: 'operator_repository_test',
    note: 'repository 환불 테스트',
  });
  assert.strictEqual(cancelled.redemption.status, 'refunded');
  assert.strictEqual(cancelled.refundTransaction.amount, 100);

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

  console.log('pointsRepository smoke test passed');
}

main();
