const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

const repoDir = path.resolve(__dirname, '..');
const dataDir = path.join(repoDir, 'data');

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function createScore(discordId, gameId, score, weekKey, options = {}) {
  return {
    discordId,
    gameId,
    score,
    seed: null,
    submittedAt: options.submittedAt || '2026-06-30T03:00:00.000Z',
    weekKey,
    flagged: Boolean(options.flagged),
    mode: 'free',
    dayKey: null,
    replay: 'skipped',
  };
}

function createLink(discordId, displayName) {
  return {
    discordId,
    displayName,
    playerToken: `token_${discordId}`,
    linkedAt: '2026-06-29T00:00:00.000Z',
  };
}

function createPointsFixturePath(tempDir, users = []) {
  const pointsPath = path.join(tempDir, 'points.json');
  writeJson(pointsPath, {
    version: 1,
    isExample: false,
    users,
    pointTransactions: [],
  });
  return pointsPath;
}

function createRepositoryPair(tempDir, { links, scores, mismatches = [] }) {
  const webgamePaths = {
    links: path.join(tempDir, 'webgame-links.json'),
    scores: path.join(tempDir, 'webgame-scores.json'),
    social: path.join(tempDir, 'webgame-social.json'),
    replayMismatch: path.join(tempDir, 'webgame-replay-mismatch.json'),
  };
  writeJson(webgamePaths.links, { version: 1, isExample: false, links, pendingCodes: [] });
  writeJson(webgamePaths.scores, { version: 1, isExample: false, scores });
  writeJson(webgamePaths.social, { version: 1, isExample: false, cheerSalt: 'test_salt', cheers: [] });
  writeJson(webgamePaths.replayMismatch, { version: 1, isExample: false, records: mismatches });

  const { createWebgameRepository } = require('../src/webgameRepository');
  const { createPointsRepository } = require('../src/pointsRepository');

  const pointsPath = createPointsFixturePath(tempDir);
  const pointsRepository = createPointsRepository({
    points: pointsPath,
    pointsFallback: path.join(dataDir, 'points.example.json'),
    shopItems: path.join(tempDir, 'shop-items.json'),
    shopItemsFallback: path.join(dataDir, 'shop-items.example.json'),
    redemptions: path.join(tempDir, 'redemptions.json'),
    redemptionsFallback: path.join(dataDir, 'redemptions.example.json'),
    missions: path.join(tempDir, 'missions.json'),
    missionsFallback: path.join(dataDir, 'missions.example.json'),
    submissions: path.join(tempDir, 'submissions.json'),
    submissionsFallback: path.join(dataDir, 'submissions.example.json'),
  });

  return {
    webgameRepository: createWebgameRepository(webgamePaths),
    pointsRepository,
    pointsPath,
  };
}

function testPayoutPlanAndExecution() {
  const weekKey = '2026-W27';
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webgame-payout-plan-'));
  const links = [
    createLink('alice', '앨리스'),
    createLink('bob', '봅'),
    createLink('carol', '캐럴'),
    createLink('dave', '데이브'),
    createLink('eve', '이브'),
    createLink('frank', '프랭크'),
    createLink('grace', '그레이스'),
    createLink('heidi', '하이디'),
    createLink('ivan', '이반'),
    createLink('judy', '주디'),
  ];
  const scores = [
    createScore('alice', 'match3', 5000, weekKey),
    createScore('bob', 'match3', 4000, weekKey),
    createScore('carol', 'match3', 3000, weekKey),
    createScore('dave', 'match3', 1000, weekKey),
    createScore('ivan', 'match3', 600, weekKey),
    // flagged 기록은 랭킹·참여 집계 모두에서 빠져야 한다.
    createScore('grace', 'match3', 9999, weekKey, { flagged: true }),
    // 다른 주차 기록은 이번 주 지급 대상이 아니다.
    createScore('frank', 'match3', 8000, '2026-W26'),
    createScore('bob', 'deck', 2000, weekKey),
    createScore('heidi', 'deck', 100, weekKey),
    createScore('eve', 'survivors', 700, weekKey),
    // 공동 목표: ivan 기여 20억(10억→30억), judy 기여 20억(5억→25억) = 총 40억.
    createScore('ivan', 'idle', 1e9, weekKey),
    createScore('ivan', 'idle', 3e9, weekKey),
    createScore('judy', 'idle', 0.5e9, weekKey),
    createScore('judy', 'idle', 2.5e9, weekKey),
  ];
  const mismatches = [
    { discordId: 'bob', gameId: 'match3', score: 4000, replayScore: 100, reason: 'score_mismatch', log: null, at: '2026-06-30T05:00:00.000Z' },
  ];

  const { webgameRepository, pointsRepository, pointsPath } = createRepositoryPair(tempDir, { links, scores, mismatches });
  const {
    buildWeeklyPayoutPlan,
    executeWeeklyPayoutPlan,
    buildPayoutPreviewLines,
    buildPayoutResultLines,
  } = require('../src/webgamePayout');

  const plan = buildWeeklyPayoutPlan({
    webgameRepository,
    pointsRepository,
    weekKey,
    communalGoal: 4e9,
  });

  // 게임별 순위 보상.
  assert.deepStrictEqual(
    plan.games.map((game) => [game.gameId, game.winners.map((winner) => [winner.discordId, winner.rank, winner.amount])]),
    [
      ['match3', [['alice', 1, 3000], ['bob', 2, 2000], ['carol', 3, 1000]]],
      ['deck', [['bob', 1, 3000], ['heidi', 2, 2000]]],
      ['survivors', [['eve', 1, 3000]]],
    ]
  );

  // flagged·다른 주차 사용자는 어디에도 없어야 한다.
  const allIds = [
    ...plan.games.flatMap((game) => game.winners.map((winner) => winner.discordId)),
    ...plan.participation.recipients.map((recipient) => recipient.discordId),
    ...plan.communal.recipients.map((recipient) => recipient.discordId),
  ];
  assert.ok(!allIds.includes('grace'));
  assert.ok(!allIds.includes('frank'));

  // 참여 보상: 순위 보상 수령자 제외, 게임 불문 주당 1회 → dave, ivan.
  assert.deepStrictEqual(
    plan.participation.recipients.map((recipient) => recipient.discordId).sort(),
    ['dave', 'ivan']
  );

  // 공동 목표: 40억/40억 달성, idle 제출자 전원(ivan·judy). ivan은 참여 보상과 중복 수령(허용).
  assert.strictEqual(plan.communal.achieved, true);
  assert.deepStrictEqual(
    plan.communal.recipients.map((recipient) => [recipient.discordId, recipient.displayName]).sort(),
    [['ivan', '이반'], ['judy', '주디']]
  );

  // mismatch 경고.
  assert.deepStrictEqual(plan.mismatchWarning, { count: 1, userCount: 1 });

  // 총액: 순위 14,000 + 참여 1,000 + 공동 목표 1,000.
  assert.deepStrictEqual(plan.totals, { payableAmount: 16000, payableCount: 10, alreadyPaidCount: 0 });

  const previewText = buildPayoutPreviewLines(plan).join('\n');
  assert.match(previewText, /간식 맞추기/);
  assert.match(previewText, /1위 앨리스 · 5,000점 · 3,000P/);
  assert.match(previewText, /대상 2명/);
  assert.match(previewText, /달성 \(4,000,000,000 \/ 4,000,000,000\)/);
  assert.match(previewText, /리플레이 검증 불일치 기록이 1건\(1명\)/);
  assert.match(previewText, /지급 예정: 10건 · 16,000P/);

  // 실행: 10건 전부 지급.
  const result = executeWeeklyPayoutPlan(plan, { pointsRepository, operatorId: 'operator_1' });
  assert.deepStrictEqual(result, { paid: 10, skipped: 0, paidAmount: 16000, failed: [] });

  const pointsData = readJson(pointsPath);
  const rewardTransactions = pointsData.pointTransactions
    .filter((transaction) => transaction.relatedType === 'webgameWeeklyReward');
  assert.strictEqual(rewardTransactions.length, 10);

  const aliceTransaction = rewardTransactions.find((transaction) => transaction.userId === 'alice');
  assert.strictEqual(aliceTransaction.amount, 3000);
  assert.strictEqual(aliceTransaction.reason, '간식 맞추기 2026-W27 주간 랭킹 1위');
  assert.strictEqual(aliceTransaction.relatedId, '2026-W27:match3:rank1');
  assert.strictEqual(aliceTransaction.createdBy, 'operator_1');

  const bob = pointsData.users.find((user) => user.userId === 'bob');
  assert.strictEqual(bob.totalPoints, 5000); // match3 2위 2,000 + deck 1위 3,000
  const ivan = pointsData.users.find((user) => user.userId === 'ivan');
  assert.strictEqual(ivan.totalPoints, 1000); // 참여 500 + 공동 목표 500 (중복 허용)

  const ivanReasons = rewardTransactions
    .filter((transaction) => transaction.userId === 'ivan')
    .map((transaction) => transaction.reason)
    .sort();
  assert.deepStrictEqual(ivanReasons, [
    '간식 공방 키우기 2026-W27 공동 목표 달성',
    '웹게임 2026-W27 주간 참여 보상',
  ]);

  // 재실행 멱등성: 계획 재계산 시 전건 지급됨, 실행 시 전건 스킵.
  const secondPlan = buildWeeklyPayoutPlan({
    webgameRepository,
    pointsRepository,
    weekKey,
    communalGoal: 4e9,
  });
  assert.deepStrictEqual(secondPlan.totals, { payableAmount: 0, payableCount: 0, alreadyPaidCount: 10 });
  assert.match(buildPayoutPreviewLines(secondPlan).join('\n'), /이미 지급된 항목 10건은 건너뛰어요/);

  const secondResult = executeWeeklyPayoutPlan(secondPlan, { pointsRepository, operatorId: 'operator_1' });
  assert.deepStrictEqual(secondResult, { paid: 0, skipped: 10, paidAmount: 0, failed: [] });
  assert.strictEqual(readJson(pointsPath).pointTransactions.length, pointsData.pointTransactions.length);

  const resultText = buildPayoutResultLines(weekKey, secondResult).join('\n');
  assert.match(resultText, /지급 완료: 0건/);
  assert.match(resultText, /건너뜀: 10건/);

  // awardWebgameWeeklyReward 단독 검증: 중복 차단, 다른 주차·kind는 별건, 0 이하 금액 거부.
  const duplicate = pointsRepository.awardWebgameWeeklyReward({
    user: { userId: 'alice', displayName: '앨리스' },
    amount: 3000,
    weekKey,
    gameId: 'match3',
    kind: 'rank1',
    reason: '중복 시도',
    operatorId: 'operator_1',
  });
  assert.strictEqual(duplicate.ok, false);
  assert.strictEqual(duplicate.reason, 'ALREADY_REWARDED');

  const otherWeek = pointsRepository.awardWebgameWeeklyReward({
    user: { userId: 'alice', displayName: '앨리스' },
    amount: 3000,
    weekKey: '2026-W28',
    gameId: 'match3',
    kind: 'rank1',
    reason: '간식 맞추기 2026-W28 주간 랭킹 1위',
    operatorId: 'operator_1',
  });
  assert.strictEqual(otherWeek.ok, true);

  assert.throws(() => {
    pointsRepository.awardWebgameWeeklyReward({
      user: { userId: 'alice', displayName: '앨리스' },
      amount: 0,
      weekKey,
      gameId: 'match3',
      kind: 'rank1',
      reason: '잘못된 금액',
      operatorId: 'operator_1',
    });
  }, /양의 정수/);

  fs.rmSync(tempDir, { recursive: true, force: true });
}

function createMember(isOperatorMember) {
  return {
    displayName: isOperatorMember ? '운영자' : '참여자',
    permissions: {
      has() {
        return isOperatorMember;
      },
    },
  };
}

function createPayoutCommandInteraction(userId, isOperatorMember, optionValues = {}) {
  return {
    commandName: '게임지급',
    channelId: 'operator_channel',
    user: { id: userId, username: userId },
    member: createMember(isOperatorMember),
    options: {
      getString(name) {
        return Object.hasOwn(optionValues, name) ? optionValues[name] : null;
      },
    },
    replyPayload: null,
    isChatInputCommand() {
      return true;
    },
    isStringSelectMenu() {
      return false;
    },
    isButton() {
      return false;
    },
    isModalSubmit() {
      return false;
    },
    async reply(payload) {
      this.replyPayload = payload;
    },
  };
}

function createPayoutButtonInteraction(customId, userId, isOperatorMember) {
  return {
    customId,
    channelId: 'operator_channel',
    user: { id: userId, username: userId },
    member: createMember(isOperatorMember),
    replyPayload: null,
    updatePayload: null,
    isChatInputCommand() {
      return false;
    },
    isStringSelectMenu() {
      return false;
    },
    isButton() {
      return true;
    },
    isModalSubmit() {
      return false;
    },
    async reply(payload) {
      this.replyPayload = payload;
    },
    async update(payload) {
      this.updatePayload = payload;
    },
  };
}

function getButtonIds(payload) {
  return payload.components.flatMap((row) => {
    return row.components.map((component) => component.toJSON().custom_id);
  });
}

async function testPayoutHandlersFlow() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webgame-payout-flow-'));
  const paths = {
    points: path.join(tempDir, 'points.json'),
    shopItems: path.join(tempDir, 'shop-items.json'),
    redemptions: path.join(tempDir, 'redemptions.json'),
    missions: path.join(tempDir, 'missions.json'),
    submissions: path.join(tempDir, 'submissions.json'),
    webgameLinks: path.join(tempDir, 'webgame-links.json'),
    webgameScores: path.join(tempDir, 'webgame-scores.json'),
    webgameSocial: path.join(tempDir, 'webgame-social.json'),
    webgameReplayMismatch: path.join(tempDir, 'webgame-replay-mismatch.json'),
  };

  writeJson(paths.points, { version: 1, isExample: false, users: [], pointTransactions: [] });
  writeJson(paths.shopItems, { version: 1, isExample: false, shopItems: [] });
  writeJson(paths.redemptions, { version: 1, isExample: false, redemptions: [] });
  writeJson(paths.missions, { version: 1, isExample: false, missions: [] });
  writeJson(paths.submissions, { version: 1, isExample: false, submissions: [] });
  writeJson(paths.webgameSocial, { version: 1, isExample: false, cheerSalt: 'test_salt', cheers: [] });
  writeJson(paths.webgameReplayMismatch, { version: 1, isExample: false, records: [] });

  process.env.POINTS_DATA_PATH = paths.points;
  process.env.SHOP_ITEMS_DATA_PATH = paths.shopItems;
  process.env.REDEMPTIONS_DATA_PATH = paths.redemptions;
  process.env.MISSIONS_DATA_PATH = paths.missions;
  process.env.SUBMISSIONS_DATA_PATH = paths.submissions;
  process.env.POINTS_DATA_FALLBACK = path.join(dataDir, 'points.example.json');
  process.env.SHOP_ITEMS_DATA_FALLBACK = path.join(dataDir, 'shop-items.example.json');
  process.env.REDEMPTIONS_DATA_FALLBACK = path.join(dataDir, 'redemptions.example.json');
  process.env.MISSIONS_DATA_FALLBACK = path.join(dataDir, 'missions.example.json');
  process.env.SUBMISSIONS_DATA_FALLBACK = path.join(dataDir, 'submissions.example.json');
  process.env.WEBGAME_LINKS_DATA_PATH = paths.webgameLinks;
  process.env.WEBGAME_SCORES_DATA_PATH = paths.webgameScores;
  process.env.WEBGAME_SOCIAL_DATA_PATH = paths.webgameSocial;
  process.env.WEBGAME_REPLAY_MISMATCH_DATA_PATH = paths.webgameReplayMismatch;
  // 공동 목표는 이 시나리오에서 미달 상태로 두어 순위 보상만 검증한다.
  process.env.WEBGAME_COMMUNAL_GOAL = String(1e15);

  [
    '../src/pointsRepository',
    '../src/webgameRepository',
    '../src/webgameApi',
    '../src/webgamePayout',
    '../src/webgameLink',
    '../src/minigameInteractions',
    '../src/minigameReport',
    '../src/handlers',
  ].forEach(resetModule);

  const { getIsoWeekKey } = require('../src/webgameRepository');
  const currentWeekKey = getIsoWeekKey(new Date());
  writeJson(paths.webgameLinks, {
    version: 1,
    isExample: false,
    links: [createLink('winner_user', '이번주 우승자')],
    pendingCodes: [],
  });
  writeJson(paths.webgameScores, {
    version: 1,
    isExample: false,
    scores: [createScore('winner_user', 'match3', 4200, currentWeekKey, { submittedAt: new Date().toISOString() })],
  });

  const { handleInteractionCreate } = require('../src/handlers');

  // 비운영자 차단.
  const blockedCommand = createPayoutCommandInteraction('normal_user', false, { '주차': 'current' });
  await handleInteractionCreate(blockedCommand);
  assert.match(blockedCommand.replyPayload.content, /운영진만/);

  // 미리보기.
  const previewCommand = createPayoutCommandInteraction('op_user', true, { '주차': 'current' });
  await handleInteractionCreate(previewCommand);
  assert.strictEqual(previewCommand.replyPayload.ephemeral, true);
  assert.strictEqual(previewCommand.replyPayload.embeds[0].data.title, '웹게임 주간 보상 지급 미리보기');
  assert.match(previewCommand.replyPayload.embeds[0].data.description, /1위 이번주 우승자 · 4,200점 · 3,000P/);
  assert.match(previewCommand.replyPayload.embeds[0].data.description, /미달성/);
  assert.deepStrictEqual(getButtonIds(previewCommand.replyPayload), [
    `operator_webgame_payout_confirm:${currentWeekKey}`,
    'operator_webgame_payout_cancel',
  ]);

  // 비운영자의 승인 버튼 차단.
  const blockedConfirm = createPayoutButtonInteraction(`operator_webgame_payout_confirm:${currentWeekKey}`, 'normal_user', false);
  await handleInteractionCreate(blockedConfirm);
  assert.match(blockedConfirm.replyPayload.content, /운영진만/);
  assert.strictEqual(blockedConfirm.updatePayload, null);

  // 취소 버튼.
  const cancelButton = createPayoutButtonInteraction('operator_webgame_payout_cancel', 'op_user', true);
  await handleInteractionCreate(cancelButton);
  assert.strictEqual(cancelButton.updatePayload.embeds[0].data.title, '웹게임 주간 보상 지급 취소');
  assert.deepStrictEqual(cancelButton.updatePayload.components, []);

  // 승인 → 지급.
  const confirmButton = createPayoutButtonInteraction(`operator_webgame_payout_confirm:${currentWeekKey}`, 'op_user', true);
  await handleInteractionCreate(confirmButton);
  assert.strictEqual(confirmButton.updatePayload.embeds[0].data.title, '웹게임 주간 보상 지급 완료');
  assert.match(confirmButton.updatePayload.embeds[0].data.description, /지급 완료: 1건 · 3,000P/);
  assert.deepStrictEqual(confirmButton.updatePayload.components, []);

  const pointsData = readJson(paths.points);
  const transaction = pointsData.pointTransactions.find((entry) => entry.relatedType === 'webgameWeeklyReward');
  assert.strictEqual(transaction.userId, 'winner_user');
  assert.strictEqual(transaction.amount, 3000);
  assert.strictEqual(transaction.relatedId, `${currentWeekKey}:match3:rank1`);
  assert.strictEqual(pointsData.users.find((user) => user.userId === 'winner_user').totalPoints, 3000);

  // 승인 이중 클릭: 중복 지급 없이 전건 스킵.
  const secondConfirm = createPayoutButtonInteraction(`operator_webgame_payout_confirm:${currentWeekKey}`, 'op_user', true);
  await handleInteractionCreate(secondConfirm);
  assert.match(secondConfirm.updatePayload.embeds[0].data.description, /지급 완료: 0건/);
  assert.match(secondConfirm.updatePayload.embeds[0].data.description, /건너뜀: 1건/);
  assert.strictEqual(
    readJson(paths.points).pointTransactions.filter((entry) => entry.relatedType === 'webgameWeeklyReward').length,
    1
  );

  fs.rmSync(tempDir, { recursive: true, force: true });
}

async function run() {
  testPayoutPlanAndExecution();
  await testPayoutHandlersFlow();
  console.log('webgame payout flow smoke test passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
