const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  OPERATOR_HUB_OPTIONS,
  OPERATOR_HUB_SELECT_ID,
  createOperatorHubSelectRow,
} = require('../src/components');
const {
  buildOperatorChecklistEmbed,
  buildOperatorEnvironmentCheckEmbed,
  buildOperatorExportGuideEmbed,
  buildOperatorHubEmbed,
  buildOperatorMissionsShopEmbed,
  buildOperatorPointLogsEmbed,
  buildOperatorReactionApprovalsEmbed,
  buildOperatorRedemptionsEmbed,
  buildOperatorSubmissionsEmbed,
} = require('../src/embeds');
const {
  handleOperatorHubSelect,
} = require('../src/handlers');
const { createPointsRepository } = require('../src/pointsRepository');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

const dataDir = path.join(__dirname, '..', 'data');

function createTempRepository() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'operator-hub-flow-'));
  return createPointsRepository({
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
    reactionApprovals: path.join(tempDir, 'reaction-approvals.json'),
  });
}

function getEmbedTitle(embed) {
  return embed.data && embed.data.title;
}

function getEmbedDescription(embed) {
  return (embed.data && embed.data.description) || '';
}

function restoreEnv(name, value) {
  if (typeof value === 'undefined') {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

async function main() {
  assert.strictEqual(OPERATOR_HUB_SELECT_ID, 'operator_hub_select');
  assert.deepStrictEqual(
    OPERATOR_HUB_OPTIONS.map((option) => option.value),
    [
      'overview',
      'redemptions',
      'submissions',
      'points',
      'missions_shop',
      'mission_management',
      'reaction_approvals',
      'environment_check',
      'exports',
      'checklist',
    ]
  );

  const row = createOperatorHubSelectRow('points');
  const menu = row.components[0];
  assert.strictEqual(menu.data.custom_id, 'operator_hub_select');
  assert.strictEqual(menu.data.placeholder, '확인할 운영 메뉴를 선택해 주세요');
  assert.strictEqual(menu.options.length, 10);
  assert.ok(OPERATOR_HUB_OPTIONS.some((option) => option.value === 'environment_check'
    && /환경|채널/.test(option.label)));

  const repository = createTempRepository();
  const emptySummary = repository.getOperationSummary();
  assert.strictEqual(emptySummary.usersCount, 0);
  assert.strictEqual(emptySummary.pointTransactionsCount, 0);
  assert.strictEqual(emptySummary.pendingRedemptionsCount, 0);
  assert.deepStrictEqual(emptySummary.recentTransactions, []);
  assert.deepStrictEqual(repository.listOperationalTransactions({ limit: 10 }), []);
  const emptyPoints = buildOperatorPointLogsEmbed(repository.listOperationalTransactions({ limit: 10 }));
  assert.match(getEmbedDescription(emptyPoints), /아직 표시할 실제 포인트 로그가 없습니다/);

  const mission = repository.createMission({
    title: '운영 허브 테스트 미션',
    description: '운영 허브 smoke test용 미션입니다.',
    rewardPoints: 30,
    requiresSubmission: true,
  });
  repository.setMissionStatus(mission.id, 'active');
  repository.adjustUserPoints({
    user: {
      userId: 'operator_hub_user',
      displayName: '운영 허브 사용자',
    },
    amount: 200,
    reason: 'operator hub redemption seed points',
    operatorId: 'operator_hub_operator',
  });
  const shopItem = repository.createShopItem({
    name: '운영 허브 테스트 리워드',
    description: '운영 허브 smoke test용 상점 항목입니다.',
    cost: 100,
    type: 'reward',
  });
  repository.setShopItemStatus(shopItem.id, 'active');

  const redemption = repository.requestRedemption({
    user: {
      userId: 'operator_hub_user',
      displayName: '운영 허브 사용자',
    },
    itemId: shopItem.id,
    note: 'operator hub pending redemption',
  });
  assert.strictEqual(redemption.ok, true);

  const submission = repository.createMissionSubmission({
    user: {
      userId: 'operator_hub_submitter',
      displayName: '운영 허브 인증자',
    },
    missionId: mission.id,
    content: 'operator hub pending submission',
    attachment: {
      name: 'proof.png',
      url: 'https://example.invalid/proof.png',
    },
  });
  assert.strictEqual(submission.ok, true);

  repository.approveReactionMessage({
    messageId: 'operator_hub_message',
    channelId: 'operator_hub_channel',
    guildId: 'operator_hub_guild',
    authorId: 'operator_hub_reaction_user',
    authorDisplayName: '반응 승인 사용자',
    rewardPoints: 20,
    reviewedBy: 'operator_hub_operator',
    reviewedByDisplayName: '운영 허브 운영자',
    reviewEmoji: '✅',
    messageUrl: 'https://discord.com/channels/operator_hub_guild/operator_hub_channel/operator_hub_message',
  });

  const summary = repository.getOperationSummary();
  assert.ok(summary.usersCount >= 1);
  assert.ok(summary.pointTransactionsCount >= 1);
  assert.ok(summary.pendingRedemptionsCount >= 1);
  assert.ok(summary.pendingSubmissionsCount >= 1);
  assert.ok(summary.activeMissionsCount >= 1);
  assert.ok(summary.todayReactionApprovalsCount >= 1);

  const overview = buildOperatorHubEmbed(summary);
  assert.strictEqual(getEmbedTitle(overview), '운영 현황 허브');
  assert.match(getEmbedDescription(overview), /전체 사용자/);
  assert.match(getEmbedDescription(overview), /오늘 포인트 거래/);

  const redemptions = buildOperatorRedemptionsEmbed(repository.listPendingRedemptions(10));
  assert.strictEqual(getEmbedTitle(redemptions), '교환 대기');
  assert.match(getEmbedDescription(redemptions), /처리는 `\/교환관리`/);
  assert.match(getEmbedDescription(redemptions), /운영 허브 테스트 리워드/);

  const submissions = buildOperatorSubmissionsEmbed(repository.listPendingSubmissions(10));
  assert.strictEqual(getEmbedTitle(submissions), '인증 대기');
  assert.match(getEmbedDescription(submissions), /처리는 `\/인증관리`/);
  assert.match(getEmbedDescription(submissions), /운영 허브 테스트 미션/);
  assert.match(getEmbedDescription(submissions), /첨부파일: 있음/);

  const operationalTransactions = repository.listOperationalTransactions({ limit: 10 });
  assert.ok(operationalTransactions.length >= 1);
  assert.ok(!operationalTransactions.some((transaction) => String(transaction.id).includes('example')));
  const points = buildOperatorPointLogsEmbed(operationalTransactions);
  assert.strictEqual(getEmbedTitle(points), '최근 포인트 로그');
  assert.match(getEmbedDescription(points), /\/포인트로그/);

  const missionsShop = buildOperatorMissionsShopEmbed(summary);
  assert.strictEqual(getEmbedTitle(missionsShop), '미션/상점 상태');
  assert.match(getEmbedDescription(missionsShop), /\/미션관리/);
  assert.match(getEmbedDescription(missionsShop), /\/상점관리/);

  const reactions = buildOperatorReactionApprovalsEmbed(repository.listRecentReactionApprovals(10));
  assert.strictEqual(getEmbedTitle(reactions), '반응 승인 기록');
  assert.match(getEmbedDescription(reactions), /반응 승인 사용자/);

  const envCheck = buildOperatorEnvironmentCheckEmbed({
    channelChecks: [
      {
        envName: 'LOG_CHANNEL_ID',
        label: '기본 운영 로그',
        requirementLabel: '권장',
        required: true,
        configured: true,
        channelId: 'operator_log_channel',
        found: true,
        accessible: true,
        canSendMessages: true,
      },
      {
        envName: 'MISSION_SUBMISSION_CHANNEL_ID',
        label: '별도 인증 채널',
        requirementLabel: '선택',
        required: false,
        configured: false,
        channelId: null,
        found: false,
        accessible: false,
        canSendMessages: false,
      },
    ],
    googleSheetsCheck: {
      loggingEnabled: true,
      webAppUrlConfigured: true,
    },
  });
  const envCheckDescription = getEmbedDescription(envCheck);
  assert.strictEqual(getEmbedTitle(envCheck), '환경 설정 점검');
  assert.match(envCheckDescription, /LOG_CHANNEL_ID/);
  assert.match(envCheckDescription, /권장/);
  assert.match(envCheckDescription, /MISSION_SUBMISSION_CHANNEL_ID/);
  assert.match(envCheckDescription, /선택/);
  assert.match(envCheckDescription, /미설정.*선택 항목/);
  assert.match(envCheckDescription, /GOOGLE_SHEETS_LOGGING_ENABLED.*true/);
  assert.match(envCheckDescription, /GOOGLE_SHEETS_WEB_APP_URL.*설정됨/);
  assert.doesNotMatch(envCheckDescription, /https:\/\/script\.google\.com/);
  assert.doesNotMatch(envCheckDescription, /secret/i);
  assert.doesNotMatch(envCheckDescription, /token/i);

  const originalEnv = {
    logChannelId: process.env.LOG_CHANNEL_ID,
    sheetsEnabled: process.env.GOOGLE_SHEETS_LOGGING_ENABLED,
    sheetsUrl: process.env.GOOGLE_SHEETS_WEB_APP_URL,
  };
  process.env.LOG_CHANNEL_ID = 'operator_log_channel';
  process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'true';
  process.env.GOOGLE_SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/operator-secret-url/exec';
  try {
    let replyPayload = null;
    await handleOperatorHubSelect({
      customId: OPERATOR_HUB_SELECT_ID,
      values: ['environment_check'],
      member: {
        permissions: {
          has: () => true,
        },
      },
      client: {
        user: { id: 'bot_user' },
        channels: {
          cache: {
            get: (channelId) => channelId === 'operator_log_channel'
              ? {
                id: 'operator_log_channel',
                permissionsFor: () => ({
                  has: () => true,
                }),
              }
              : null,
          },
          fetch: async () => null,
        },
      },
      reply: async (payload) => {
        replyPayload = payload;
      },
    });
    assert.ok(replyPayload);
    assert.strictEqual(replyPayload.ephemeral, true);
    assert.strictEqual(getEmbedTitle(replyPayload.embeds[0]), '환경 설정 점검');
    const selectEnvDescription = getEmbedDescription(replyPayload.embeds[0]);
    assert.match(selectEnvDescription, /LOG_CHANNEL_ID/);
    assert.match(selectEnvDescription, /GOOGLE_SHEETS_WEB_APP_URL.*설정됨/);
    assert.doesNotMatch(selectEnvDescription, /script\.google\.com/);
    assert.doesNotMatch(selectEnvDescription, /operator-secret-url/);
  } finally {
    restoreEnv('LOG_CHANNEL_ID', originalEnv.logChannelId);
    restoreEnv('GOOGLE_SHEETS_LOGGING_ENABLED', originalEnv.sheetsEnabled);
    restoreEnv('GOOGLE_SHEETS_WEB_APP_URL', originalEnv.sheetsUrl);
  }

  assert.match(getEmbedDescription(buildOperatorExportGuideEmbed()), /\/운영내보내기 종류:전체 형식:JSON/);
  assert.match(getEmbedDescription(buildOperatorChecklistEmbed()), /docs\/operator-dashboard-guide\.md/);

  console.log('operator hub flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
