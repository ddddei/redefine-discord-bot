const assert = require('assert');
const { Writable } = require('stream');
const {
  buildAdminSummary,
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

    const emptyRepository = createEmptyRepository();
    const emptySummary = buildAdminSummary(emptyRepository);
    assert.strictEqual(emptySummary.usersCount, 0);
    assert.strictEqual(emptySummary.pointTransactionsCount, 0);
    assert.strictEqual(emptySummary.todayEarnedPoints, 0);
    assert.deepStrictEqual(listPendingRedemptions(emptyRepository, 10), []);
    assert.deepStrictEqual(listPendingSubmissions(emptyRepository, 10), []);
    assert.deepStrictEqual(listRecentPointTransactions(emptyRepository, 10), []);
    assert.deepStrictEqual(listMissionStatus(emptyRepository, 10), []);
    assert.deepStrictEqual(listShopItemStatus(emptyRepository, 10), []);
    assert.deepStrictEqual(listRecentReactionApprovals(emptyRepository, 10), []);

    assert.ok(Array.isArray(listPendingRedemptions(repository, 10)));
    assert.ok(Array.isArray(listPendingSubmissions(repository, 10)));
    assert.ok(Array.isArray(listRecentPointTransactions(repository, 10)));
    assert.ok(Array.isArray(listMissionStatus(repository, 10)));
    assert.ok(Array.isArray(listShopItemStatus(repository, 10)));
    assert.ok(Array.isArray(listRecentReactionApprovals(repository, 10)));

    const handler = createAdminRequestHandler(repository);
    const unauthorized = await invokeHandler(handler, '/api/admin/summary');
    assert.strictEqual(unauthorized.statusCode, 401);
    assert.ok(unauthorized.headers['www-authenticate']);

    const rejected = await invokeHandler(handler, '/api/admin/summary', basic('admin', 'wrong'));
    assert.strictEqual(rejected.statusCode, 401);

    const accepted = await invokeHandler(handler, '/api/admin/summary', basic('admin', 'secret'));
    assert.strictEqual(accepted.statusCode, 200);
    assert.strictEqual(JSON.parse(accepted.body).usersCount, 1);

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
