const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  calculateUserBalance,
  canRedeem,
  cancelRedemption,
  completeRedemption,
  createPointTransaction,
  createRedemption,
  getShopItem,
  getUser,
  getUserPoints,
  listActiveShopItems,
  listPointTransactions,
  loadJsonFile,
  refundRedemption,
  saveJsonFile,
  validateUserBalance,
} = require('../src/pointsStore');

const dataDir = path.join(__dirname, '..', 'data');

function main() {
  const pointsData = loadJsonFile(path.join(dataDir, 'points.example.json'));
  const shopItemsData = loadJsonFile(path.join(dataDir, 'shop-items.example.json'));

  assert.strictEqual(pointsData.isExample, true);
  assert.strictEqual(getUser(pointsData, 'user_example_001').nickname, '예시별');
  assert.strictEqual(getUser(pointsData, 'user_missing'), null);
  assert.strictEqual(getUserPoints(pointsData, 'user_example_001'), 50);
  assert.strictEqual(getUserPoints(pointsData, 'user_missing'), 0);
  assert.strictEqual(calculateUserBalance(pointsData, 'user_example_001'), 50);
  assert.deepStrictEqual(validateUserBalance(pointsData, 'user_example_001'), {
    ok: true,
    userId: 'user_example_001',
    storedBalance: 50,
    calculatedBalance: 50,
    difference: 0,
  });

  const earnTransactions = listPointTransactions(pointsData, 'user_example_001', {
    type: 'earn',
    latestFirst: true,
  });
  assert.deepStrictEqual(earnTransactions.map((transaction) => transaction.id), [
    'tx_example_002',
    'tx_example_001',
  ]);
  assert.strictEqual(listPointTransactions(pointsData).length, 11);

  const activeItems = listActiveShopItems(shopItemsData);
  assert.deepStrictEqual(activeItems.map((item) => item.id), [
    'item_youth_point_100_example',
  ]);
  assert.strictEqual(
    getShopItem(shopItemsData, 'item_youth_point_100_example').cost,
    100
  );
  assert.strictEqual(getShopItem(shopItemsData, 'item_missing'), null);

  const pointsWithSufficientBalance = {
    ...pointsData,
    users: pointsData.users.map((user) => {
      if (user.userId !== 'user_example_001') return user;
      return { ...user, totalPoints: 150 };
    }),
  };
  assert.deepStrictEqual(
    canRedeem(
      pointsWithSufficientBalance,
      shopItemsData,
      'user_example_001',
      'item_youth_point_100_example'
    ),
    {
      ok: true,
      userId: 'user_example_001',
      itemId: 'item_youth_point_100_example',
      cost: 100,
      currentPoints: 150,
      reason: null,
    }
  );
  assert.deepStrictEqual(
    canRedeem(pointsData, shopItemsData, 'user_example_001', 'item_youth_point_100_example'),
    { ok: false, reason: 'INSUFFICIENT_POINTS' }
  );
  assert.deepStrictEqual(
    canRedeem(pointsData, shopItemsData, 'user_missing', 'item_youth_point_100_example'),
    { ok: false, reason: 'USER_NOT_FOUND' }
  );
  assert.deepStrictEqual(
    canRedeem(pointsData, shopItemsData, 'user_example_001', 'item_goods_example'),
    { ok: false, reason: 'SOLD_OUT' }
  );
  assert.deepStrictEqual(
    canRedeem(pointsData, shopItemsData, 'user_example_001', 'item_youth_point_300_example'),
    { ok: false, reason: 'ITEM_NOT_ACTIVE' }
  );

  const transaction = createPointTransaction({
    id: 'tx_test_redeem',
    userId: 'user_example_001',
    type: 'redeem',
    amount: -100,
    reason: '내부 사용처용 포인트 지급 신청 테스트',
    balanceAfter: 50,
    relatedType: 'redemption',
    relatedId: 'rd_test_pending',
    createdBy: 'user_example_001',
    createdAt: '2030-02-01T09:00:00+09:00',
  });
  assert.strictEqual(transaction.type, 'redeem');
  assert.throws(() => createPointTransaction({
    ...transaction,
    amount: 100,
  }), /must be negative/);

  const redemption = createRedemption({
    id: 'rd_test_pending',
    userId: 'user_example_001',
    itemId: 'item_youth_point_100_example',
    cost: 100,
    transactionId: transaction.id,
    requestedAt: '2030-02-01T09:00:00+09:00',
  });
  const originalSnapshot = JSON.stringify(redemption);
  const completed = completeRedemption(redemption, 'operator_example_a');
  const cancelled = cancelRedemption(redemption, 'operator_example_a', '지급 불가 테스트');
  const refunded = refundRedemption(cancelled, 'tx_test_refund');

  assert.strictEqual(redemption.status, 'pending');
  assert.strictEqual(JSON.stringify(redemption), originalSnapshot);
  assert.strictEqual(completed.status, 'completed');
  assert.strictEqual(completed.reviewedBy, 'operator_example_a');
  assert.strictEqual(cancelled.status, 'cancelled');
  assert.strictEqual(refunded.status, 'refunded');
  assert.strictEqual(refunded.refundTransactionId, 'tx_test_refund');
  assert.throws(() => completeRedemption(cancelled, 'operator_example_a'), /pending/);

  const temporaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'points-store-'));
  const savedPath = path.join(temporaryDir, 'nested', 'points.json');
  saveJsonFile(savedPath, { transaction });
  assert.deepStrictEqual(loadJsonFile(savedPath), { transaction });
  fs.rmSync(temporaryDir, { recursive: true, force: true });

  console.log('pointsStore smoke test passed');
}

main();
