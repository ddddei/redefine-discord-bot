const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createPointsRepository } = require('../src/pointsRepository');
const {
  getOperationDataPaths,
  runOperationDataPreflight,
} = require('../src/operationDataPaths');

function read(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'production-data-safety-'));
try {
  const paths = {
    points: path.join(workDir, 'points.local.json'),
    shopItems: path.join(workDir, 'shop-items.local.json'),
    redemptions: path.join(workDir, 'redemptions.local.json'),
    missions: path.join(workDir, 'missions.local.json'),
    submissions: path.join(workDir, 'submissions.local.json'),
  };
  const repository = createPointsRepository(paths, { googleSheetsLogger: { logPointTransaction() {} } });
  assert.deepStrictEqual(repository.listActiveShopItemsWithCodes(), []);
  repository.adjustUserPoints({
    user: { userId: 'participant_001', displayName: '참여자' },
    amount: 10,
    reason: '첫 운영 지급',
    operatorId: 'operator_001',
  });
  for (const key of ['points', 'shopItems', 'redemptions', 'missions', 'submissions']) {
    const data = read(paths[key]);
    assert.strictEqual(data.isExample, false);
    const serializedRecords = JSON.stringify(data).replace(/"isExample":false/g, '');
    assert.strictEqual(/example|demo|sample|2030|예시/i.test(serializedRecords), false);
  }

  const partialDir = fs.mkdtempSync(path.join(os.tmpdir(), 'production-data-partial-'));
  fs.writeFileSync(path.join(partialDir, 'points.local.json'), JSON.stringify({ isExample: false, users: [], pointTransactions: [] }));
  const partialRepository = createPointsRepository({
    points: path.join(partialDir, 'points.local.json'),
    shopItems: path.join(partialDir, 'shop-items.local.json'),
    redemptions: path.join(partialDir, 'redemptions.local.json'),
    missions: path.join(partialDir, 'missions.local.json'),
    submissions: path.join(partialDir, 'submissions.local.json'),
  });
  partialRepository.loadState();
  assert.strictEqual(fs.existsSync(path.join(partialDir, 'shop-items.local.json')), true);

  const env = {
    OPERATION_DATA_DIR: workDir,
    POINTS_DATA_PATH: path.join(partialDir, 'custom-points.json'),
    SHOP_ITEMS_DATA_PATH: '   ',
  };
  const resolved = getOperationDataPaths(env);
  assert.strictEqual(resolved.points, env.POINTS_DATA_PATH);
  assert.strictEqual(resolved.shopItems, path.join(workDir, 'shop-items.local.json'));

  const contaminated = path.join(workDir, 'contaminated.json');
  fs.writeFileSync(contaminated, JSON.stringify({ isExample: true, users: [{ userId: 'user_example_1' }] }));
  const nonStrict = runOperationDataPreflight({ paths: { points: contaminated }, strict: false });
  assert.strictEqual(nonStrict.ok, false);
  assert.ok(nonStrict.warnings.length > 0);
  const strict = runOperationDataPreflight({ paths: { points: contaminated }, strict: true });
  assert.strictEqual(strict.ok, false);
  assert.ok(strict.issues.some((issue) => /isExample=true/.test(issue)));

  const duplicate = runOperationDataPreflight({ paths: { points: paths.points, shopItems: paths.points }, strict: true });
  assert.strictEqual(duplicate.ok, false);
  assert.ok(duplicate.issues.some((issue) => /같은 파일/.test(issue)));

  const blockedParent = path.join(workDir, 'not-a-directory');
  fs.writeFileSync(blockedParent, 'blocked');
  const unwritable = runOperationDataPreflight({
    paths: { points: path.join(blockedParent, 'points.local.json') },
    strict: true,
  });
  assert.strictEqual(unwritable.ok, false);
  assert.ok(unwritable.issues.some((issue) => /쓰기\/rename/.test(issue)));
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}

console.log('production data safety smoke test passed');
