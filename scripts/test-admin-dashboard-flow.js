const assert = require('assert');
const { Writable } = require('stream');
const {
  buildAdminSummary,
  filterOperationalRecords,
  isExampleLikeRecord,
  listMissionStatus,
  listPendingRedemptions,
  listPendingSubmissions,
  listRecentPointTransactions,
  listRecentReactionApprovals,
  listShopItemStatus,
} = require('../src/adminApi');
const {
  isAdminAuthConfigured,
  parseBasicAuthHeader,
  safeComparePassword,
} = require('../src/adminAuth');
const {
  createAdminRequestHandler,
  isAdminDashboardEnabled,
} = require('../src/adminServer');

function createRequest(authorization) {
  return {
    headers: authorization ? { authorization } : {},
  };
}

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function createRepository() {
  const now = new Date().toISOString();
  const state = {
    pointsData: {
      users: [{ userId: 'user1234567890', displayName: '테스트 참여자', totalPoints: 120 }],
      pointTransactions: [
        {
          id: 'tx1',
          userId: 'user1234567890',
          type: 'earn',
          amount: 20,
          balanceAfter: 120,
          reason: '테스트 지급',
          relatedType: 'manual',
          relatedId: null,
          createdBy: 'operator',
          createdAt: now,
        },
        {
          id: 'tx_example_001',
          userId: 'user_example_001',
          type: 'earn',
          amount: 999,
          balanceAfter: 999,
          reason: '예시 활동 지급',
          relatedType: 'mission',
          relatedId: 'submission_example_pending',
          createdBy: 'operator_example',
          createdAt: '2030-01-01T00:00:00.000Z',
        },
      ],
    },
    redemptionsData: {
      redemptions: [
        {
          id: 'rd1',
          userId: 'user1234567890',
          itemId: 'item1',
          cost: 50,
          status: 'pending',
          requestedAt: now,
        },
        {
          id: 'rd_example_pending',
          userId: 'user_example_001',
          itemId: 'item_youth_point_100_example',
          itemName: '청년동 포인트 전환권 100P 예시',
          cost: 100,
          status: 'pending',
          requestedAt: '2030-01-01T00:00:00.000Z',
        },
      ],
    },
    submissionsData: {
      submissions: [
        {
          id: 'sub1',
          type: 'mission',
          missionId: 'mission1',
          userId: 'user1234567890',
          displayName: '테스트 참여자',
          status: 'pending',
          createdAt: now,
          attachment: null,
        },
        {
          id: 'submission_example_pending',
          type: 'mission',
          missionId: 'mission_example',
          userId: 'user_example_001',
          displayName: '참여자 예시',
          status: 'pending',
          createdAt: '2030-01-01T00:00:00.000Z',
          attachment: null,
        },
      ],
    },
    missionsData: {
      missions: [
        {
          id: 'mission1',
          title: '테스트 미션',
          status: 'active',
          rewardPoints: 20,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'mission_example',
          title: '예시 미션',
          status: 'active',
          rewardPoints: 20,
          createdAt: '2030-01-01T00:00:00.000Z',
          updatedAt: '2030-01-01T00:00:00.000Z',
        },
      ],
    },
    shopItemsData: {
      shopItems: [
        {
          id: 'item1',
          name: '테스트 리워드',
          status: 'active',
          cost: 50,
          stock: null,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'item_example',
          name: '예시 상점 항목',
          status: 'active',
          cost: 100,
          stock: null,
          createdAt: '2030-01-01T00:00:00.000Z',
          updatedAt: '2030-01-01T00:00:00.000Z',
        },
      ],
    },
  };
  const reactionRecords = [
    {
      id: 'reaction1',
      authorId: 'user1234567890',
      authorDisplayName: '테스트 참여자',
      reviewedBy: 'operator',
      status: 'approved',
      rewardPoints: 20,
      reviewedAt: now,
    },
    {
      id: 'reaction_example',
      authorId: 'user_example_001',
      authorDisplayName: '참여자 예시',
      reviewedBy: 'operator_example',
      status: 'approved',
      rewardPoints: 20,
      reviewedAt: '2030-01-01T00:00:00.000Z',
    },
  ];

  return {
    loadState: () => state,
    getReactionApprovalData: () => ({ records: reactionRecords }),
    listPendingRedemptions: (limit) => state.redemptionsData.redemptions.slice(0, limit),
    listPendingSubmissions: (limit) => state.submissionsData.submissions.map((submission) => ({
      ...submission,
      missionTitle: '테스트 미션',
      rewardPoints: 20,
    })).slice(0, limit),
    listTransactions: ({ limit }) => state.pointsData.pointTransactions.slice(0, limit),
    listMissionsForAdmin: ({ limit }) => state.missionsData.missions.slice(0, limit),
    listShopItemsForAdmin: ({ limit }) => state.shopItemsData.shopItems.slice(0, limit),
    listRecentReactionApprovals: (limit) => reactionRecords.slice(0, limit),
  };
}

function createEmptyRepository() {
  return {
    loadState: () => ({
      pointsData: {},
      redemptionsData: {},
      submissionsData: {},
      missionsData: {},
      shopItemsData: {},
    }),
    getReactionApprovalData: () => ({}),
  };
}

function createExampleOnlyRepository() {
  return {
    loadState: () => ({
      pointsData: {
        users: [{ userId: 'user_example_001', displayName: '참여자 예시', totalPoints: 999 }],
        pointTransactions: [{
          id: 'tx_example_001',
          userId: 'user_example_001',
          type: 'earn',
          amount: 999,
          reason: '예시 활동 지급',
          createdAt: '2030-01-01T00:00:00.000Z',
        }],
      },
      redemptionsData: {
        redemptions: [{
          id: 'rd_example_pending',
          userId: 'user_example_001',
          itemId: 'item_youth_point_100_example',
          status: 'pending',
          requestedAt: '2030-01-01T00:00:00.000Z',
        }],
      },
      submissionsData: {
        submissions: [{
          id: 'submission_example_pending',
          missionId: 'mission_example',
          userId: 'user_example_001',
          status: 'pending',
          createdAt: '2030-01-01T00:00:00.000Z',
        }],
      },
      missionsData: {
        missions: [{
          id: 'mission_example',
          title: '예시 미션',
          status: 'active',
          createdAt: '2030-01-01T00:00:00.000Z',
        }],
      },
      shopItemsData: {
        shopItems: [{
          id: 'item_example',
          name: '예시 항목',
          status: 'active',
          createdAt: '2030-01-01T00:00:00.000Z',
        }],
      },
    }),
    getReactionApprovalData: () => ({
      records: [{
        id: 'reaction_example',
        authorId: 'user_example_001',
        status: 'approved',
        reviewedAt: '2030-01-01T00:00:00.000Z',
      }],
    }),
  };
}

function invokeHandler(handler, path, authorization) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const res = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    res.statusCode = 200;
    res.headers = {};
    res.setHeader = (name, value) => {
      res.headers[name.toLowerCase()] = value;
    };
    res.end = (chunk) => {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }
      Writable.prototype.end.call(res);
    };
    res.on('finish', () => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      });
    });
    res.on('error', reject);

    try {
      handler({
        method: 'GET',
        url: path,
        headers: authorization ? { authorization } : { host: 'localhost' },
      }, res);
    } catch (error) {
      reject(error);
    }
  });
}

async function main() {
  const originalEnabled = process.env.ADMIN_DASHBOARD_ENABLED;
  const originalPassword = process.env.ADMIN_DASHBOARD_PASSWORD;
  const originalTitle = process.env.ADMIN_DASHBOARD_TITLE;

  try {
    delete process.env.ADMIN_DASHBOARD_PASSWORD;
    process.env.ADMIN_DASHBOARD_ENABLED = 'true';
    assert.strictEqual(isAdminAuthConfigured(), false);
    assert.strictEqual(isAdminDashboardEnabled(), false);

    process.env.ADMIN_DASHBOARD_PASSWORD = 'secret';
    process.env.ADMIN_DASHBOARD_TITLE = '테스트 대시보드';
    assert.strictEqual(isAdminAuthConfigured(), true);
    assert.strictEqual(isAdminDashboardEnabled(), true);

    const parsed = parseBasicAuthHeader(createRequest(basic('admin', 'secret')));
    assert.deepStrictEqual(parsed, { username: 'admin', password: 'secret' });
    assert.strictEqual(parseBasicAuthHeader(createRequest('Bearer token')), null);
    assert.strictEqual(safeComparePassword('wrong', 'secret'), false);
    assert.strictEqual(safeComparePassword('secret', 'secret'), true);
    assert.strictEqual(isExampleLikeRecord({ id: 'rd_example_pending' }), true);
    assert.strictEqual(isExampleLikeRecord({ id: 'rd1', title: '운영 미션' }), false);
    assert.deepStrictEqual(filterOperationalRecords([{ id: 'rd1' }, { id: 'rd_example_pending' }]), {
      data: [{ id: 'rd1' }],
      excluded: 1,
    });

    const repository = createRepository();
    const summary = buildAdminSummary(repository);
    assert.strictEqual(summary.title, '테스트 대시보드');
    assert.strictEqual(summary.usersCount, 1);
    assert.strictEqual(summary.pointTransactionsCount, 1);
    assert.strictEqual(summary.pendingRedemptionsCount, 1);
    assert.strictEqual(summary.pendingSubmissionsCount, 1);
    assert.strictEqual(summary.activeMissionsCount, 1);
    assert.strictEqual(summary.activeShopItemsCount, 1);
    assert.strictEqual(summary.todayReactionApprovalsCount, 1);
    assert.strictEqual(summary.todayEarnedPoints, 20);
    assert.strictEqual(summary.exampleRecordsExcluded, 6);
    assert.strictEqual(summary.meta.exampleRecordsExcluded, 6);
    assert.strictEqual(summary.storageMode, 'local-json');
    assert.strictEqual(summary.readOnly, true);

    const emptyRepository = createEmptyRepository();
    const emptySummary = buildAdminSummary(emptyRepository);
    assert.strictEqual(emptySummary.usersCount, 0);
    assert.strictEqual(emptySummary.pointTransactionsCount, 0);
    assert.strictEqual(emptySummary.todayEarnedPoints, 0);
    assert.deepStrictEqual(listPendingRedemptions(emptyRepository, 10).data, []);
    assert.deepStrictEqual(listPendingSubmissions(emptyRepository, 10).data, []);
    assert.deepStrictEqual(listRecentPointTransactions(emptyRepository, 10).data, []);
    assert.deepStrictEqual(listMissionStatus(emptyRepository, 10).data, []);
    assert.deepStrictEqual(listShopItemStatus(emptyRepository, 10).data, []);
    assert.deepStrictEqual(listRecentReactionApprovals(emptyRepository, 10).data, []);

    const exampleOnlyRepository = createExampleOnlyRepository();
    const exampleOnlySummary = buildAdminSummary(exampleOnlyRepository);
    assert.strictEqual(exampleOnlySummary.usersCount, 0);
    assert.strictEqual(exampleOnlySummary.pointTransactionsCount, 0);
    assert.strictEqual(exampleOnlySummary.pendingRedemptionsCount, 0);
    assert.strictEqual(exampleOnlySummary.pendingSubmissionsCount, 0);
    assert.strictEqual(exampleOnlySummary.activeMissionsCount, 0);
    assert.strictEqual(exampleOnlySummary.activeShopItemsCount, 0);
    assert.strictEqual(exampleOnlySummary.exampleRecordsExcluded, 7);
    assert.deepStrictEqual(listPendingRedemptions(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listPendingSubmissions(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listRecentPointTransactions(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listMissionStatus(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listShopItemStatus(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listRecentReactionApprovals(exampleOnlyRepository, 10).data, []);

    assert.strictEqual(listPendingRedemptions(repository, 10).data.length, 1);
    assert.strictEqual(listPendingSubmissions(repository, 10).data.length, 1);
    assert.strictEqual(listRecentPointTransactions(repository, 10).data.length, 1);
    assert.strictEqual(listMissionStatus(repository, 10).data.length, 1);
    assert.strictEqual(listShopItemStatus(repository, 10).data.length, 1);
    assert.strictEqual(listRecentReactionApprovals(repository, 10).data.length, 1);

    const handler = createAdminRequestHandler(repository);
    const unauthorized = await invokeHandler(handler, '/api/admin/summary');
    assert.strictEqual(unauthorized.statusCode, 401);
    assert.ok(unauthorized.headers['www-authenticate']);

    const rejected = await invokeHandler(handler, '/api/admin/summary', basic('admin', 'wrong'));
    assert.strictEqual(rejected.statusCode, 401);

    const accepted = await invokeHandler(handler, '/api/admin/summary', basic('admin', 'secret'));
    assert.strictEqual(accepted.statusCode, 200);
    assert.strictEqual(JSON.parse(accepted.body).usersCount, 1);

    const redemptionsResponse = await invokeHandler(handler, '/api/admin/redemptions', basic('admin', 'secret'));
    const redemptionsPayload = JSON.parse(redemptionsResponse.body);
    assert.strictEqual(redemptionsPayload.data.length, 1);
    assert.strictEqual(redemptionsPayload.meta.exampleRecordsExcluded, 1);

    const page = await invokeHandler(handler, '/admin', basic('admin', 'secret'));
    assert.strictEqual(page.statusCode, 200);
    assert.ok(page.body.includes('summary-cards'));
  } finally {
    if (originalEnabled === undefined) {
      delete process.env.ADMIN_DASHBOARD_ENABLED;
    } else {
      process.env.ADMIN_DASHBOARD_ENABLED = originalEnabled;
    }

    if (originalPassword === undefined) {
      delete process.env.ADMIN_DASHBOARD_PASSWORD;
    } else {
      process.env.ADMIN_DASHBOARD_PASSWORD = originalPassword;
    }

    if (originalTitle === undefined) {
      delete process.env.ADMIN_DASHBOARD_TITLE;
    } else {
      process.env.ADMIN_DASHBOARD_TITLE = originalTitle;
    }
  }

  console.log('admin dashboard flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
