const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Writable } = require('stream');
const {
  buildAdminSummary,
  buildFaqCandidateQueue,
  buildFirstDayCheck,
  buildOnboardingSignals,
  buildReactionFollowUpQueue,
  buildTodayOperationsQueue,
  buildWebgameOperationsSummary,
  filterOperationalRecords,
  isExampleLikeRecord,
  listMissionStatus,
  listPendingRedemptions,
  listPendingSubmissions,
  listRecentDmChatMessages,
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
const { createWebgameRepository, getDailySeed, getIsoWeekKey: getIsoWeekKeyForFixture } = require('../src/webgameRepository');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

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
  const stale = new Date(Date.now() - 60 * 60 * 60 * 1000).toISOString();
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
          id: 'rd_stale',
          userId: 'user1234567890',
          itemId: 'item1',
          cost: 50,
          status: 'pending',
          requestedAt: stale,
        },
        {
          id: 'rd_duplicate',
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
          id: 'sub_stale',
          type: 'mission',
          missionId: 'mission1',
          userId: 'user1234567890',
          displayName: '테스트 참여자',
          status: 'pending',
          createdAt: stale,
          attachment: null,
        },
        {
          id: 'sub_duplicate',
          type: 'mission',
          missionId: 'mission1',
          userId: 'user1234567890',
          displayName: '테스트 참여자',
          status: 'pending',
          createdAt: now,
          attachment: null,
        },
        {
          id: 'sub_approved',
          type: 'mission',
          missionId: 'mission1',
          userId: 'user1234567890',
          displayName: '테스트 참여자',
          status: 'approved',
          createdAt: now,
          reviewedAt: now,
          attachment: null,
        },
        {
          id: 'sub_rejected',
          type: 'mission',
          missionId: 'mission1',
          userId: 'user1234567890',
          displayName: '테스트 참여자',
          status: 'rejected',
          createdAt: now,
          reviewedAt: now,
          attachment: null,
        },
        {
          id: 'checkin_approved',
          type: 'checkin',
          missionId: null,
          userId: 'user1234567890',
          displayName: '테스트 참여자',
          status: 'approved',
          createdAt: now,
          reviewedAt: now,
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
          id: 'mission_example',
          title: '예시 미션',
          status: 'active',
          rewardPoints: 20,
          createdAt: '2030-01-01T00:00:00.000Z',
          updatedAt: '2030-01-01T00:00:00.000Z',
        },
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
          id: 'item_example',
          name: '예시 상점 항목',
          status: 'active',
          cost: 100,
          stock: null,
          createdAt: '2030-01-01T00:00:00.000Z',
          updatedAt: '2030-01-01T00:00:00.000Z',
        },
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
      id: 'reaction_example',
      authorId: 'user_example_001',
      authorDisplayName: '참여자 예시',
      reviewedBy: 'operator_example',
      status: 'approved',
      rewardPoints: 20,
      reviewedAt: '2030-01-01T00:00:00.000Z',
    },
    {
      id: 'reaction1',
      authorId: 'user1234567890',
      authorDisplayName: '테스트 참여자',
      reviewedBy: 'operator',
      status: 'approved',
      rewardPoints: 20,
      reviewedAt: now,
      notificationResults: {
        dmUser: 'failed',
        publicReply: 'sent',
      },
      transactionId: null,
    },
  ];
  const supportSummary = {
    readOnly: true,
    storageMode: 'local-json',
    trackedCommands: ['안내', '포인트', '미션', '상점'],
    commandCounts: { 안내: 1, 포인트: 1, 미션: 0, 상점: 0 },
    trackedUsersCount: 1,
    guidanceSentCount: 1,
    helpSignals: [{
      userId: 'user1234567890',
      usedCommands: ['안내', '포인트'],
      missingCommands: ['미션', '상점'],
      usedCount: 2,
    }],
    faqCandidates: [{
      id: 'faq_candidate_1',
      sampleQuestion: '주차는 어디에 하나요?',
      latestQuestion: '주차 어디에 해요?',
      count: 2,
      lastSeenAt: now,
    }],
  };

  return {
    loadState: () => state,
    getReactionApprovalData: () => ({ records: reactionRecords }),
    listPendingRedemptions: (limit) => state.redemptionsData.redemptions.slice(0, limit),
    listPendingSubmissions: (limit) => state.submissionsData.submissions
      .filter((submission) => submission.status === 'pending')
      .map((submission) => ({
        ...submission,
        missionTitle: '테스트 미션',
        rewardPoints: 20,
      }))
      .slice(0, limit),
    listTransactions: ({ limit }) => state.pointsData.pointTransactions.slice(0, limit),
    listMissionsForAdmin: ({ limit }) => state.missionsData.missions.slice(0, limit),
    listShopItemsForAdmin: ({ limit }) => state.shopItemsData.shopItems.slice(0, limit),
    listRecentReactionApprovals: (limit) => reactionRecords.slice(0, limit),
    getOperatorSupportSummary: () => supportSummary,
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

function createWebgameFixture() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-dashboard-webgame-'));
  const paths = {
    links: path.join(tempDir, 'webgame-links.local.json'),
    scores: path.join(tempDir, 'webgame-scores.local.json'),
    social: path.join(tempDir, 'webgame-social.local.json'),
  };
  const repository = createWebgameRepository(paths);
  const now = new Date('2026-07-06T03:00:00Z'); // 월요일 KST 정오
  const weekKey = getIsoWeekKeyForFixture(now);
  const previousWeekKey = getIsoWeekKeyForFixture(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const dayKey = '2026-07-06';

  function link(discordId, displayName) {
    const issued = repository.issueLinkCode({ discordId, displayName }, now);
    const redeemed = repository.redeemLinkCode(issued.code, now);
    assert.strictEqual(redeemed.ok, true, `링크 발급 실패: ${discordId}`);
    return redeemed;
  }

  link('user_a', '참여자A');
  link('user_b', '참여자B');
  link('user_flag', '플래그참여자');

  // match3: 참여자A 주간 최고 1800(오늘의 도전), 참여자B 900. 참여자A는 낮은 점수도 하나 더 제출해
  // "최고 점수만 표시" 규칙을 검증한다.
  repository.recordScore({ discordId: 'user_a', gameId: 'match3', score: 1200, mode: 'free' }, now);
  repository.recordScore({
    discordId: 'user_a',
    gameId: 'match3',
    score: 1800,
    mode: 'daily',
    dayKey,
    seed: String(getDailySeed(dayKey)),
  }, now);
  repository.recordScore({ discordId: 'user_b', gameId: 'match3', score: 900, mode: 'free' }, now);
  // flagged 기록: 랭킹/참여 수에서 제외돼야 한다.
  repository.recordScore({
    discordId: 'user_flag',
    gameId: 'match3',
    score: 49000,
    mode: 'free',
    flagged: true,
  }, now);

  // deck: 참여자B만 오늘의 도전 참여.
  repository.recordScore({
    discordId: 'user_b',
    gameId: 'deck',
    score: 5500,
    mode: 'daily',
    dayKey,
    seed: String(getDailySeed(dayKey)),
  }, now);

  // idle: 공동 목표. 참여자A는 이전 주 baseline 500 -> 이번 주 800 (기여 300).
  // 참여자B는 신규 참여자, 이번 주 200~500 (기여 300, 최소값 baseline).
  repository.recordScore({ discordId: 'user_a', gameId: 'idle', score: 500, weekKey: previousWeekKey, mode: 'free' }, now);
  repository.recordScore({ discordId: 'user_a', gameId: 'idle', score: 800, weekKey, mode: 'free' }, now);
  repository.recordScore({ discordId: 'user_b', gameId: 'idle', score: 200, weekKey, mode: 'free' }, now);
  repository.recordScore({ discordId: 'user_b', gameId: 'idle', score: 500, weekKey, mode: 'free' }, now);

  // word: 참여자A 3회 시도 성공(score=4), 참여자B 실패(score=0, tries 없음 취급).
  repository.recordScore({
    discordId: 'user_a',
    gameId: 'word',
    score: 4,
    mode: 'daily',
    dayKey,
  }, now);
  repository.recordScore({
    discordId: 'user_b',
    gameId: 'word',
    score: 0,
    mode: 'daily',
    dayKey,
  }, now);

  // 응원: match3 주간 랭킹의 user_a에게 1회, deck 오늘 랭킹의 user_b에게 2회.
  repository.addCheer({ fromDiscordId: 'user_b', targetDiscordId: 'user_a', gameId: 'match3', periodKey: weekKey }, now);
  repository.addCheer({ fromDiscordId: 'user_a', targetDiscordId: 'user_b', gameId: 'deck', periodKey: dayKey }, now);
  repository.addCheer({ fromDiscordId: 'user_flag', targetDiscordId: 'user_b', gameId: 'deck', periodKey: dayKey }, now);

  return { tempDir, repository, now, weekKey, dayKey };
}

function createExampleOnlyWebgameRepository() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-dashboard-webgame-example-'));
  const linksPath = path.join(tempDir, 'webgame-links.local.json');
  const scoresPath = path.join(tempDir, 'webgame-scores.local.json');
  const socialPath = path.join(tempDir, 'webgame-social.local.json');

  fs.writeFileSync(linksPath, JSON.stringify({
    version: 1,
    isExample: true,
    links: [{ discordId: 'user_example_001', displayName: '참여자 예시', playerToken: 'example-token', linkedAt: '2030-01-01T00:00:00.000Z' }],
    pendingCodes: [],
  }));
  fs.writeFileSync(scoresPath, JSON.stringify({
    version: 1,
    isExample: false,
    scores: [{
      discordId: 'user_example_001',
      gameId: 'match3',
      score: 3000,
      mode: 'free',
      weekKey: '2030-W01',
      flagged: false,
      submittedAt: '2030-01-01T00:00:00.000Z',
    }],
  }));
  fs.writeFileSync(socialPath, JSON.stringify({
    version: 1,
    isExample: false,
    cheerSalt: 'example-salt',
    cheers: [],
  }));

  return {
    tempDir,
    repository: createWebgameRepository({ links: linksPath, scores: scoresPath, social: socialPath }),
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
  const originalDmChatLogPath = process.env.DM_CHAT_LOG_PATH;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-dashboard-dm-chat-'));
  const dmChatLogPath = path.join(tempDir, 'dm-chat-logs.json');
  const webgameTempDirs = [];

  try {
    fs.writeFileSync(dmChatLogPath, `${JSON.stringify({
      version: 1,
      isExample: false,
      messages: [
        {
          id: 'dm_chat_example_001',
          userId: 'user_example_001',
          displayName: '참여자 예시',
          role: 'user',
          content: '예시 DM 대화',
          createdAt: '2030-01-01T00:00:00.000Z',
        },
        {
          id: 'dm_chat_is_example',
          userId: 'participant_dm_example_flag',
          displayName: '플래그 예시',
          role: 'user',
          content: 'isExample 플래그 레코드',
          createdAt: '2026-07-03T01:09:00.000Z',
          isExample: true,
        },
        {
          id: 'dm_chat_001',
          userId: 'participant_dm_001',
          username: 'participant_dm',
          displayName: 'DM 참여자',
          role: 'user',
          content: '처음 사람들한테 뭐라고 말하면 좋을까? 길게 말해도 대시보드 표가 깨지면 안 됩니다.'.repeat(4),
          createdAt: '2026-07-03T01:10:00.000Z',
          safetyDetection: {
            category: 'danger',
            severity: 'high',
            matchedKeyword: '괴롭힘',
          },
        },
        {
          id: 'dm_chat_002',
          userId: 'participant_dm_001',
          username: 'participant_dm',
          displayName: 'DM 참여자',
          role: 'assistant',
          content: '짧게 연습해볼게요. 먼저 한 문장으로 인사하고 질문을 이어가면 좋아요.',
          createdAt: '2026-07-03T01:11:00.000Z',
        },
      ],
    }, null, 2)}\n`);
    process.env.DM_CHAT_LOG_PATH = dmChatLogPath;

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
    assert.strictEqual(isExampleLikeRecord({ id: 'rd1', isExample: true }), true);
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
    assert.strictEqual(summary.pendingRedemptionsCount, 3);
    assert.strictEqual(summary.pendingSubmissionsCount, 3);
    assert.strictEqual(summary.reviewedSubmissionsCount, 2);
    assert.deepStrictEqual(summary.submissionStatusCounts, {
      pending: 3,
      approved: 1,
      rejected: 1,
    });
    assert.strictEqual(summary.activeMissionsCount, 1);
    assert.strictEqual(summary.activeShopItemsCount, 1);
    assert.strictEqual(summary.todayReactionApprovalsCount, 1);
    assert.strictEqual(summary.reactionFollowUpsCount, 2);
    assert.strictEqual(summary.todayEarnedPoints, 20);
    assert.strictEqual(summary.exampleRecordsExcluded, 6);
    assert.strictEqual(summary.meta.exampleRecordsExcluded, 6);
    assert.strictEqual(summary.storageMode, 'local-json');
    assert.strictEqual(summary.readOnly, true);

    const queue = buildTodayOperationsQueue(repository, 10);
    assert.strictEqual(queue.title, '오늘의 운영 큐');
    assert.strictEqual(queue.readOnly, true);
    assert.strictEqual(queue.counts.pendingRedemptions, 3);
    assert.strictEqual(queue.counts.pendingSubmissions, 3);
    assert.strictEqual(queue.counts.todayReactionApprovals, 1);
    assert.strictEqual(queue.counts.todayPointTransactions, 1);
    assert.strictEqual(queue.pendingRedemptions.length, 3);
    assert.strictEqual(queue.pendingSubmissions.length, 3);
    assert.strictEqual(queue.todayReactionApprovals.length, 1);
    assert.strictEqual(queue.todayPointTransactions.length, 1);
    assert.strictEqual(queue.followUps.length, 2);
    assert.match(queue.followUps[0].message, /DM 알림 실패/);
    assert.ok(queue.followUps.some((item) => /포인트 거래 ID/.test(item.message)));
    assert.ok(queue.qaWarnings.some((warning) => /오래된 교환 대기/.test(warning.message)));
    assert.ok(queue.qaWarnings.some((warning) => /오래된 인증 대기/.test(warning.message)));
    assert.ok(queue.qaWarnings.some((warning) => /중복 교환 대기/.test(warning.message)));
    assert.ok(queue.qaWarnings.some((warning) => /중복 인증 대기/.test(warning.message)));
    assert.strictEqual(queue.meta.exampleRecordsExcluded, 6);
    const firstDayCheck = buildFirstDayCheck(repository, {
      channelChecks: [{
        envName: 'LOG_CHANNEL_ID',
        required: true,
        configured: true,
        found: true,
        accessible: true,
        canSendMessages: true,
      }],
      googleSheetsCheck: {
        loggingEnabled: false,
        webAppUrlConfigured: false,
      },
    });
    assert.strictEqual(firstDayCheck.readOnly, true);
    assert.strictEqual(firstDayCheck.activeMissionsCount, 1);
    assert.strictEqual(firstDayCheck.activeShopItemsCount, 1);
    assert.strictEqual(firstDayCheck.pendingRedemptionsCount, 3);
    assert.strictEqual(firstDayCheck.pendingSubmissionsCount, 3);
    assert.strictEqual(firstDayCheck.reactionFollowUpsCount, 2);
    assert.strictEqual(firstDayCheck.exampleRecordsExcluded, 6);
    assert.strictEqual(firstDayCheck.channelReadyCount, 1);
    assert.strictEqual(firstDayCheck.backupReminderEnabled, false);
    assert.strictEqual(firstDayCheck.exportGuideCommand, '/운영내보내기 종류:전체 형식:JSON');
    assert.ok(firstDayCheck.riskChecks.some((risk) => risk.level === 'critical'
      && /예시 데이터/.test(risk.title)));
    assert.ok(firstDayCheck.riskChecks.some((risk) => /별도 인증 채널/.test(risk.title)));
    assert.ok(firstDayCheck.todayActions.some((action) => /운영내보내기/.test(action)));
    assert.match(firstDayCheck.exampleDataWarning, /운영 데이터로 표시하지 않고 제외/);

    const reactionFollowUps = buildReactionFollowUpQueue(repository, 10);
    assert.strictEqual(reactionFollowUps.readOnly, true);
    assert.strictEqual(reactionFollowUps.counts.followUps, 2);
    assert.ok(reactionFollowUps.followUps.some((item) => /DM 알림 실패/.test(item.message)));
    assert.ok(reactionFollowUps.followUps.some((item) => /포인트 거래 ID/.test(item.message)));

    const onboardingSignals = buildOnboardingSignals(repository, 10);
    assert.strictEqual(onboardingSignals.trackedUsersCount, 1);
    assert.strictEqual(onboardingSignals.guidanceSentCount, 1);
    assert.deepStrictEqual(onboardingSignals.helpSignals[0].missingCommands, ['미션', '상점']);

    const faqCandidateQueue = buildFaqCandidateQueue(repository, 10);
    assert.strictEqual(faqCandidateQueue.readOnly, true);
    assert.strictEqual(faqCandidateQueue.faqCandidates[0].count, 2);

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
    const exampleOnlyQueue = buildTodayOperationsQueue(exampleOnlyRepository, 10);
    assert.strictEqual(exampleOnlyQueue.counts.pendingRedemptions, 0);
    assert.strictEqual(exampleOnlyQueue.counts.pendingSubmissions, 0);
    assert.strictEqual(exampleOnlyQueue.counts.todayReactionApprovals, 0);
    assert.strictEqual(exampleOnlyQueue.counts.todayPointTransactions, 0);
    assert.deepStrictEqual(exampleOnlyQueue.pendingRedemptions, []);
    assert.deepStrictEqual(exampleOnlyQueue.pendingSubmissions, []);
    assert.deepStrictEqual(exampleOnlyQueue.todayReactionApprovals, []);
    assert.deepStrictEqual(exampleOnlyQueue.todayPointTransactions, []);
    assert.strictEqual(exampleOnlyQueue.meta.exampleRecordsExcluded, 7);
    assert.deepStrictEqual(listPendingRedemptions(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listPendingSubmissions(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listRecentPointTransactions(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listMissionStatus(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listShopItemStatus(exampleOnlyRepository, 10).data, []);
    assert.deepStrictEqual(listRecentReactionApprovals(exampleOnlyRepository, 10).data, []);

    assert.strictEqual(listPendingRedemptions(repository, 10).data.length, 3);
    assert.strictEqual(listPendingSubmissions(repository, 10).data.length, 3);
    assert.strictEqual(listRecentPointTransactions(repository, 10).data.length, 1);
    assert.strictEqual(listMissionStatus(repository, 10).data.length, 1);
    assert.strictEqual(listShopItemStatus(repository, 10).data.length, 1);
    assert.strictEqual(listRecentReactionApprovals(repository, 10).data.length, 1);
    assert.strictEqual(listMissionStatus(repository, 1).data[0].id, 'mission1');
    assert.strictEqual(listShopItemStatus(repository, 1).data[0].id, 'item1');
    assert.strictEqual(listRecentReactionApprovals(repository, 1).data[0].id, 'reaction1');
    const dmChatMessages = listRecentDmChatMessages(null, 10);
    assert.strictEqual(dmChatMessages.data.length, 2);
    assert.strictEqual(dmChatMessages.data[0].id, 'dm_chat_002');
    assert.strictEqual(dmChatMessages.data[1].displayName, 'DM 참여자');
    assert.strictEqual(dmChatMessages.data[1].hasSafetyDetection, true);
    assert.deepStrictEqual(dmChatMessages.data[1].safetyDetection, {
      category: 'danger',
      severity: 'high',
    });
    assert.strictEqual(JSON.stringify(dmChatMessages.data).includes('matchedKeyword'), false);
    assert.strictEqual(JSON.stringify(dmChatMessages.data).includes('괴롭힘'), false);
    assert.strictEqual(dmChatMessages.meta.exampleRecordsExcluded, 2);

    const filteredDmChatMessages = listRecentDmChatMessages(null, {
      userId: 'participant_dm_001',
      safetyOnly: true,
      limit: 101,
    });
    assert.strictEqual(filteredDmChatMessages.data.length, 1);
    assert.strictEqual(filteredDmChatMessages.data[0].id, 'dm_chat_001');
    assert.strictEqual(filteredDmChatMessages.meta.filters.userId, 'participant_dm_001');
    assert.strictEqual(filteredDmChatMessages.meta.filters.safetyOnly, true);
    assert.strictEqual(filteredDmChatMessages.meta.filters.limit, 100);
    assert.strictEqual(JSON.stringify(filteredDmChatMessages).includes('matchedKeyword'), false);

    const webgameFixture = createWebgameFixture();
    webgameTempDirs.push(webgameFixture.tempDir);
    const webgameSummary = buildWebgameOperationsSummary(webgameFixture.repository, {
      weekKey: webgameFixture.weekKey,
      dayKey: webgameFixture.dayKey,
      now: webgameFixture.now,
    });
    assert.strictEqual(webgameSummary.readOnly, true);
    assert.strictEqual(webgameSummary.storageMode, 'local-json');
    assert.strictEqual(webgameSummary.weekKey, webgameFixture.weekKey);
    assert.strictEqual(webgameSummary.dayKey, webgameFixture.dayKey);

    // match3 주간 랭킹: user_a는 최고 점수(1800)만 표시되고 flagged user_flag는 제외된다.
    assert.strictEqual(webgameSummary.weeklyRankings.match3.length, 2);
    assert.strictEqual(webgameSummary.weeklyRankings.match3[0].discordId, 'user_a');
    assert.strictEqual(webgameSummary.weeklyRankings.match3[0].score, 1800);
    assert.strictEqual(webgameSummary.weeklyRankings.match3[0].cheers, 1);
    assert.ok(!webgameSummary.weeklyRankings.match3.some((row) => row.discordId === 'user_flag'));
    assert.strictEqual(webgameSummary.counts.flaggedScores, 1);

    // flagged 목록: user_flag가 최신순으로 표시되고 민감값이 없다.
    assert.strictEqual(webgameSummary.flaggedScores.length, 1);
    assert.strictEqual(webgameSummary.flaggedScores[0].discordId, 'user_flag');
    assert.strictEqual(webgameSummary.flaggedScores[0].gameId, 'match3');
    assert.strictEqual(webgameSummary.flaggedScores[0].score, 49000);

    // 오늘의 도전: match3은 user_a만(오늘 시드 제출), deck은 user_b만.
    assert.strictEqual(webgameSummary.dailyChallenges.match3.participants, 1);
    assert.strictEqual(webgameSummary.dailyChallenges.match3.ranking[0].discordId, 'user_a');
    assert.strictEqual(webgameSummary.dailyChallenges.deck.participants, 1);
    assert.strictEqual(webgameSummary.dailyChallenges.deck.ranking[0].discordId, 'user_b');
    assert.strictEqual(webgameSummary.dailyChallenges.deck.ranking[0].cheers, 2);

    // word: 참여 수와 분포만, 정답/salt/실패자 목록 없음.
    assert.strictEqual(webgameSummary.dailyChallenges.word.participants, 2);
    assert.strictEqual(webgameSummary.dailyChallenges.word.distribution['3'], 1);
    assert.strictEqual(webgameSummary.dailyChallenges.word.ranking, undefined);
    assert.strictEqual(JSON.stringify(webgameSummary).includes('answer'), false);

    // 공동 목표: flagged 없음, 이전 주 baseline/신규 참여자 baseline 규칙.
    assert.strictEqual(webgameSummary.communalGoal.weekKey, webgameFixture.weekKey);
    assert.strictEqual(webgameSummary.communalGoal.total, 600);
    assert.strictEqual(webgameSummary.communalGoal.participants, 2);
    assert.strictEqual(webgameSummary.communalGoal.achieved, false);

    // 응원 수: 주간/오늘 기간별 집계.
    const match3CheerStat = webgameSummary.cheerStats.find((row) => row.gameId === 'match3');
    const deckCheerStat = webgameSummary.cheerStats.find((row) => row.gameId === 'deck');
    assert.strictEqual(match3CheerStat.cheersThisWeek, 1);
    assert.strictEqual(deckCheerStat.cheersToday, 2);
    assert.strictEqual(webgameSummary.counts.cheersThisWeek, 1);
    assert.strictEqual(webgameSummary.counts.cheersToday, 2);

    // 민감값 비노출 확인.
    const webgameSummaryJson = JSON.stringify(webgameSummary);
    ['playerToken', 'pendingCodes', 'cheerSalt', 'WEBGAME_WORD_SALT', 'matchedKeyword'].forEach((sensitiveKey) => {
      assert.strictEqual(webgameSummaryJson.includes(sensitiveKey), false, `${sensitiveKey}가 응답에 노출되면 안 됩니다.`);
    });

    // limit clamp: 옵션으로 101을 넘겨도 100으로 제한된다 (parseLimit 재사용 확인은 API 라우트에서 별도 검증).

    // example 전용 저장소는 운영 데이터로 표시하지 않고 제외 건수만 meta에 반영한다.
    const exampleOnlyWebgameFixture = createExampleOnlyWebgameRepository();
    webgameTempDirs.push(exampleOnlyWebgameFixture.tempDir);
    const exampleOnlyWebgameSummary = buildWebgameOperationsSummary(exampleOnlyWebgameFixture.repository, {
      weekKey: webgameFixture.weekKey,
      dayKey: webgameFixture.dayKey,
    });
    assert.strictEqual(exampleOnlyWebgameSummary.counts.linkedUsers, 0);
    assert.strictEqual(exampleOnlyWebgameSummary.weeklyRankings.match3.length, 0);
    assert.strictEqual(exampleOnlyWebgameSummary.flaggedScores.length, 0);
    assert.ok(exampleOnlyWebgameSummary.meta.exampleRecordsExcluded > 0);

    // 리뷰 보강: 실데이터와 같은 주차에 example 유사 레코드가 섞여 있어도 랭킹에 노출되지 않는다.
    webgameFixture.repository.recordScore({
      discordId: 'user_example_099',
      gameId: 'match3',
      score: 9000,
      weekKey: webgameFixture.weekKey,
    });
    const mixedSummary = buildWebgameOperationsSummary(webgameFixture.repository, {
      weekKey: webgameFixture.weekKey,
      dayKey: webgameFixture.dayKey,
    });
    assert.ok(
      mixedSummary.weeklyRankings.match3.every((entry) => entry.discordId !== 'user_example_099'),
      'example 유사 레코드는 주간 랭킹 요약에서 제외되어야 합니다.'
    );

    const handler = createAdminRequestHandler(repository, undefined, webgameFixture.repository);
    const webgameApiUnauthorized = await invokeHandler(handler, '/api/admin/webgames');
    assert.strictEqual(webgameApiUnauthorized.statusCode, 401);

    const webgameApiResponse = await invokeHandler(
      handler,
      `/api/admin/webgames?weekKey=${webgameFixture.weekKey}&dayKey=${webgameFixture.dayKey}&limit=101`,
      basic('admin', 'secret')
    );
    assert.strictEqual(webgameApiResponse.statusCode, 200);
    const webgameApiPayload = JSON.parse(webgameApiResponse.body);
    assert.strictEqual(webgameApiPayload.readOnly, true);
    assert.strictEqual(webgameApiPayload.weekKey, webgameFixture.weekKey);
    assert.strictEqual(webgameApiPayload.dayKey, webgameFixture.dayKey);
    assert.strictEqual(webgameApiPayload.weeklyRankings.match3[0].discordId, 'user_a');
    // limit=101 요청도 parseLimit으로 100까지만 clamp된다 (응답 자체 목록 길이는 표본 수보다 작아 별도 카운트로 확인).
    assert.ok(!webgameApiResponse.body.includes('playerToken'));
    assert.ok(!webgameApiResponse.body.includes('cheerSalt'));

    const unauthorized = await invokeHandler(handler, '/api/admin/summary');
    assert.strictEqual(unauthorized.statusCode, 401);
    assert.ok(unauthorized.headers['www-authenticate']);

    const rejected = await invokeHandler(handler, '/api/admin/summary', basic('admin', 'wrong'));
    assert.strictEqual(rejected.statusCode, 401);

    const accepted = await invokeHandler(handler, '/api/admin/summary', basic('admin', 'secret'));
    assert.strictEqual(accepted.statusCode, 200);
    const acceptedSummary = JSON.parse(accepted.body);
    assert.strictEqual(acceptedSummary.usersCount, 1);
    assert.strictEqual(acceptedSummary.reviewedSubmissionsCount, 2);
    assert.deepStrictEqual(acceptedSummary.submissionStatusCounts, {
      pending: 3,
      approved: 1,
      rejected: 1,
    });

    const queueResponse = await invokeHandler(handler, '/api/admin/today-queue', basic('admin', 'secret'));
    assert.strictEqual(queueResponse.statusCode, 200);
    const queuePayload = JSON.parse(queueResponse.body);
    assert.strictEqual(queuePayload.counts.pendingRedemptions, 3);
    assert.strictEqual(queuePayload.followUps.length, 2);
    assert.ok(queuePayload.qaWarnings.some((warning) => /중복/.test(warning.message)));

    const firstDayResponse = await invokeHandler(handler, '/api/admin/first-day-check', basic('admin', 'secret'));
    assert.strictEqual(firstDayResponse.statusCode, 200);
    const firstDayPayload = JSON.parse(firstDayResponse.body);
    assert.strictEqual(firstDayPayload.readOnly, true);
    assert.ok(firstDayPayload.riskChecks.some((risk) => risk.level === 'critical'));
    assert.ok(firstDayPayload.todayActions.length >= 3);

    const reactionFollowUpsResponse = await invokeHandler(handler, '/api/admin/reaction-follow-ups', basic('admin', 'secret'));
    assert.strictEqual(reactionFollowUpsResponse.statusCode, 200);
    assert.strictEqual(JSON.parse(reactionFollowUpsResponse.body).counts.followUps, 2);

    const dmChatResponse = await invokeHandler(handler, '/api/admin/dm-chat-logs', basic('admin', 'secret'));
    assert.strictEqual(dmChatResponse.statusCode, 200);
    const dmChatPayload = JSON.parse(dmChatResponse.body);
    assert.strictEqual(dmChatPayload.data.length, 2);
    assert.strictEqual(dmChatPayload.data[0].role, 'assistant');
    assert.strictEqual(dmChatPayload.data[1].safetyDetection.category, 'danger');
    assert.strictEqual(dmChatPayload.meta.readOnly, true);
    assert.strictEqual(dmChatPayload.meta.exampleRecordsExcluded, 2);

    const filteredDmChatResponse = await invokeHandler(
      handler,
      '/api/admin/dm-chat-logs?userId=participant_dm_001&safetyOnly=true&limit=101',
      basic('admin', 'secret')
    );
    assert.strictEqual(filteredDmChatResponse.statusCode, 200);
    const filteredDmChatPayload = JSON.parse(filteredDmChatResponse.body);
    assert.strictEqual(filteredDmChatPayload.data.length, 1);
    assert.strictEqual(filteredDmChatPayload.data[0].id, 'dm_chat_001');
    assert.strictEqual(filteredDmChatPayload.meta.filters.limit, 100);
    assert.strictEqual(JSON.stringify(filteredDmChatPayload).includes('matchedKeyword'), false);

    const onboardingResponse = await invokeHandler(handler, '/api/admin/onboarding-signals', basic('admin', 'secret'));
    assert.strictEqual(onboardingResponse.statusCode, 200);
    assert.strictEqual(JSON.parse(onboardingResponse.body).trackedUsersCount, 1);

    const faqCandidatesResponse = await invokeHandler(handler, '/api/admin/faq-candidates', basic('admin', 'secret'));
    assert.strictEqual(faqCandidatesResponse.statusCode, 200);
    assert.strictEqual(JSON.parse(faqCandidatesResponse.body).faqCandidates[0].count, 2);

    const redemptionsResponse = await invokeHandler(handler, '/api/admin/redemptions', basic('admin', 'secret'));
    const redemptionsPayload = JSON.parse(redemptionsResponse.body);
    assert.strictEqual(redemptionsPayload.data.length, 3);
    assert.strictEqual(redemptionsPayload.meta.exampleRecordsExcluded, 1);

    const page = await invokeHandler(handler, '/admin', basic('admin', 'secret'));
    assert.strictEqual(page.statusCode, 200);
    assert.ok(page.body.includes('summary-cards'));
    assert.ok(page.body.includes('today-queue'));
    assert.ok(page.body.includes('first-day-actions'));
    assert.ok(page.body.includes('submission-status-card'));
    assert.ok(page.body.includes('first-day-check'));
    assert.ok(page.body.includes('faq-candidates'));
    assert.ok(page.body.includes('dm-chat-logs'));
    assert.ok(page.body.includes('dm-chat-user-filter'));
    assert.ok(page.body.includes('dm-chat-safety-filter'));
    assert.ok(page.body.includes('webgame-operations'));
    assert.ok(page.body.includes('webgame-flagged-scores'));
    assert.ok(page.body.includes('webgame-word-distribution'));
    assert.ok(page.body.includes('webgame-communal-goal'));

    const gamePage = await invokeHandler(handler, '/game/dungeonworld-survivors');
    assert.strictEqual(gamePage.statusCode, 200);
    assert.strictEqual(gamePage.headers['content-type'], 'text/html; charset=utf-8');
    assert.ok(gamePage.body.includes('검은 종 생존전'));

    const gameScript = await invokeHandler(handler, '/game/dungeonworld-survivors/game.js');
    assert.strictEqual(gameScript.statusCode, 200);
    assert.strictEqual(gameScript.headers['content-type'], 'application/javascript; charset=utf-8');
    assert.ok(gameScript.body.includes('DungeonworldSurvivorsRenderer'));
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

    if (originalDmChatLogPath === undefined) {
      delete process.env.DM_CHAT_LOG_PATH;
    } else {
      process.env.DM_CHAT_LOG_PATH = originalDmChatLogPath;
    }

    webgameTempDirs.forEach((dir) => {
      fs.rmSync(dir, { recursive: true, force: true });
    });
  }

  console.log('admin dashboard flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
