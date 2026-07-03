const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

function setupEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dungeonworld-sessions-'));
  process.env.DUNGEONWORLD_LOG_PATH = path.join(tempDir, 'logs.json');
  process.env.DUNGEONWORLD_CONFIG_PATH = path.join(tempDir, 'config.json');
  delete process.env.DUNGEONWORLD_START_DATE;
}

function resetModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

function main() {
  setupEnvironment();
  resetModule('../src/dungeonworld');

  const {
    buildDungeonworldAnalytics,
    buildDungeonworldUserProgress,
    createDungeonworldConfigRepository,
    createDungeonworldRepository,
    getCurrentSessionId,
    getLatestDungeonworldPlaysBySession,
    getPreviousSessionId,
    getSession,
    pickIntroForSession,
    resolveAutoSessionId,
  } = require('../src/dungeonworld');

  // --- 자동 주차 계산 ---
  assert.strictEqual(resolveAutoSessionId(new Date()), 'session_01_black_bell');

  process.env.DUNGEONWORLD_START_DATE = '2030-01-01';
  resetModule('../src/dungeonworld');
  const dw = require('../src/dungeonworld');
  // 시작일 당일~6일째: 1회차. 7일째(1주 경과)부터 2회차로 넘어간다.
  assert.strictEqual(dw.resolveAutoSessionId(new Date('2030-01-01T00:00:00Z')), 'session_01_black_bell');
  assert.strictEqual(dw.resolveAutoSessionId(new Date('2030-01-07T23:00:00Z')), 'session_01_black_bell');
  assert.strictEqual(dw.resolveAutoSessionId(new Date('2030-01-08T00:00:01Z')), 'session_02_roots_below');
  assert.strictEqual(dw.resolveAutoSessionId(new Date('2030-01-15T00:00:00Z')), 'session_03_locked_basin');
  assert.strictEqual(dw.resolveAutoSessionId(new Date('2032-01-01T00:00:00Z')), 'session_12_new_map');
  delete process.env.DUNGEONWORLD_START_DATE;
  resetModule('../src/dungeonworld');

  // --- 운영자 수동 오버라이드 ---
  const configRepository = createDungeonworldConfigRepository();
  assert.strictEqual(configRepository.getOverride(), null);
  assert.strictEqual(getCurrentSessionId(configRepository), 'session_01_black_bell');

  assert.throws(() => configRepository.setOverride('not_a_real_session', 'operator_1'), /존재하지 않는 회차/);

  configRepository.setOverride('session_01_black_bell', 'operator_1');
  assert.strictEqual(configRepository.getOverride(), 'session_01_black_bell');
  assert.strictEqual(getCurrentSessionId(configRepository), 'session_01_black_bell');

  configRepository.clearOverride('operator_1');
  assert.strictEqual(configRepository.getOverride(), null);

  // --- 직전 회차 id 조회 ---
  assert.strictEqual(getPreviousSessionId('session_01_black_bell'), null);
  assert.strictEqual(getPreviousSessionId('session_02_roots_below'), 'session_01_black_bell');
  assert.strictEqual(getPreviousSessionId('session_09_final_gate'), 'session_08_three_doors');
  assert.strictEqual(getPreviousSessionId('session_10_quiet_morning'), 'session_09_final_gate');

  // --- introVariants 선택 로직 ---
  const fakeSession = {
    intro: '레거시 인트로',
    introVariants: {
      default: '기본 인트로',
      strong: '잘 풀린 결과를 반영한 인트로',
      mixed: '대가가 있었던 결과를 반영한 인트로',
      weak: '아쉬운 결과를 반영한 인트로',
    },
  };
  assert.strictEqual(pickIntroForSession(fakeSession, null), '기본 인트로');
  assert.strictEqual(pickIntroForSession(fakeSession, 'strong'), '잘 풀린 결과를 반영한 인트로');
  assert.strictEqual(pickIntroForSession(fakeSession, 'mixed'), '대가가 있었던 결과를 반영한 인트로');
  assert.strictEqual(pickIntroForSession(fakeSession, 'weak'), '아쉬운 결과를 반영한 인트로');

  const sessionWithoutVariants = { intro: '레거시 인트로만 있음' };
  assert.strictEqual(pickIntroForSession(sessionWithoutVariants, 'strong'), '레거시 인트로만 있음');

  // 결과가 없으면(직전 기록 없음) default 인트로를 사용한다.
  const sessionView = getSession('session_01_black_bell', { previousTier: null });
  assert.strictEqual(
    sessionView.intro,
    require('../src/dungeonworld').listSessions()[0].intro
  );

  // --- 직전 회차 결과 조회 ---
  const repository = createDungeonworldRepository();
  assert.strictEqual(repository.getPlayCount(), 0);
  assert.deepStrictEqual(repository.listRecentPlays(5), []);
  assert.strictEqual(repository.getLastPlayForUserInSession('user_1', 'session_01_black_bell'), null);

  repository.recordPlay({
    userId: 'user_1',
    displayName: '테스터',
    sessionId: 'session_01_black_bell',
    choiceId: 'pursue',
    choiceLabel: '고블린을 바로 추격한다',
    die1: 5,
    die2: 6,
    total: 11,
    tier: 'strong',
    tierLabel: '10+ 원하는 대로 풀림',
    outcomeText: '결과 텍스트',
  });

  const lastPlay = repository.getLastPlayForUserInSession('user_1', 'session_01_black_bell');
  assert.ok(lastPlay);
  assert.strictEqual(lastPlay.tier, 'strong');
  assert.strictEqual(repository.getLastPlayForUserInSession('user_2', 'session_01_black_bell'), null);
  assert.strictEqual(repository.getLastPlayForUserInSession('user_1', 'session_02_does_not_exist'), null);

  const emptyProgress = buildDungeonworldUserProgress([], 'unknown_user', 'session_01_black_bell');
  assert.strictEqual(emptyProgress.totalPlayCount, 0);
  assert.strictEqual(emptyProgress.completedSessionCount, 0);
  assert.strictEqual(emptyProgress.hasPlayedCurrentSession, false);
  assert.deepStrictEqual(emptyProgress.latestPlayBySession, []);
  assert.strictEqual(emptyProgress.currentSessionLatestPlay, null);
  assert.strictEqual(emptyProgress.previousSessionLatestPlay, null);

  const emptyAnalytics = buildDungeonworldAnalytics(undefined, { currentSessionId: 'session_01_black_bell' });
  assert.strictEqual(emptyAnalytics.totalPlayCount, 0);
  assert.strictEqual(emptyAnalytics.uniqueUserCount, 0);
  assert.deepStrictEqual(emptyAnalytics.tierCounts, { strong: 0, mixed: 0, weak: 0, unknown: 0 });
  assert.deepStrictEqual(emptyAnalytics.latestSessionProgressCounts, {
    sessionId: 'session_01_black_bell',
    sessionTitle: '1회차. 변방 여관의 검은 종',
    playCount: 0,
    uniqueUserCount: 0,
  });

  const logs = [
    {
      id: 'u1_s1_old',
      userId: 'user_1',
      displayName: '테스터 1',
      sessionId: 'session_01_black_bell',
      sessionTitle: '1회차. 변방 여관의 검은 종',
      choiceId: 'pursue',
      choiceLabel: '고블린을 바로 추격한다',
      tier: 'weak',
      tierLabel: '6- 예상과 다른 전개',
      createdAt: '2030-01-01T00:00:00.000Z',
    },
    {
      id: 'u2_s1',
      userId: 'user_2',
      displayName: '테스터 2',
      sessionId: 'session_01_black_bell',
      sessionTitle: '1회차. 변방 여관의 검은 종',
      choiceId: 'investigate',
      choiceLabel: '여관과 마을을 먼저 조사한다',
      tier: 'mixed',
      tierLabel: '7~9 해내지만 대가가 생김',
      createdAt: '2030-01-01T00:01:00.000Z',
    },
    {
      id: 'u1_s1_latest',
      userId: 'user_1',
      displayName: '테스터 1',
      sessionId: 'session_01_black_bell',
      sessionTitle: '1회차. 변방 여관의 검은 종',
      choiceId: 'negotiate',
      choiceLabel: '렌과 거래해 지도의 출처를 묻는다',
      tier: 'strong',
      tierLabel: '10+ 원하는 대로 풀림',
      createdAt: '2030-01-01T00:02:00.000Z',
    },
    {
      id: 'u1_s2',
      userId: 'user_1',
      displayName: '테스터 1',
      sessionId: 'session_02_roots_below',
      sessionTitle: '2회차. 뿌리 아래 고블린 길',
      choiceId: 'trade',
      choiceLabel: '고블린과 거래한다',
      tier: 'mixed',
      tierLabel: '7~9 해내지만 대가가 생김',
      createdAt: '2030-01-08T00:00:00.000Z',
    },
    {
      id: 'u2_s3',
      userId: 'user_2',
      displayName: '테스터 2',
      sessionId: 'session_03_locked_basin',
      sessionTitle: '3회차. 무너진 신전의 잠긴 물그릇',
      choiceId: 'decode',
      choiceLabel: '정지 문양을 해석한다',
      tier: 'weak',
      tierLabel: '6- 예상과 다른 전개',
      createdAt: '2030-01-15T00:00:00.000Z',
    },
    {
      id: 'u3_s4_negotiate',
      userId: 'user_3',
      displayName: '테스터 3',
      sessionId: 'session_04_orc_bridge',
      sessionTitle: '4회차. 오크가 지키는 다리',
      choiceId: 'negotiate',
      choiceLabel: '증표와 말로 협상한다',
      tier: 'mixed',
      tierLabel: '7~9 해내지만 대가가 생김',
      createdAt: '2030-01-15T00:01:00.000Z',
    },
    {
      id: 'u1_unknown_session',
      userId: 'user_1',
      displayName: '테스터 1',
      sessionId: 'session_99_missing',
      choiceId: 'lost',
      choiceLabel: '없는 회차 선택',
      tier: 'unknown_tier',
      createdAt: '2030-01-16T00:00:00.000Z',
    },
    {
      id: 'u1_missing_session',
      userId: 'user_1',
      displayName: '테스터 1',
      choiceId: 'missing',
      choiceLabel: '회차 누락',
      tier: 'strong',
      createdAt: '2030-01-17T00:00:00.000Z',
    },
  ];

  const latestBySession = getLatestDungeonworldPlaysBySession(logs, { userId: 'user_1' });
  assert.deepStrictEqual(latestBySession.map((log) => log.id), ['u1_s1_latest', 'u1_s2']);

  const userProgress = buildDungeonworldUserProgress(logs, 'user_1', 'session_02_roots_below');
  assert.strictEqual(userProgress.totalPlayCount, 5);
  assert.strictEqual(userProgress.completedSessionCount, 2);
  assert.strictEqual(userProgress.hasPlayedCurrentSession, true);
  assert.strictEqual(userProgress.currentSessionLatestPlay.id, 'u1_s2');
  assert.strictEqual(userProgress.previousSessionId, 'session_01_black_bell');
  assert.strictEqual(userProgress.previousTier, 'strong');
  assert.strictEqual(userProgress.previousSessionLatestPlay.id, 'u1_s1_latest');

  const unknownSessionProgress = buildDungeonworldUserProgress(logs, 'user_1', 'session_404_missing');
  assert.strictEqual(unknownSessionProgress.currentSessionId, null);
  assert.strictEqual(unknownSessionProgress.hasPlayedCurrentSession, false);
  assert.strictEqual(unknownSessionProgress.currentSessionLatestPlay, null);
  assert.strictEqual(unknownSessionProgress.previousSessionLatestPlay, null);

  const analytics = buildDungeonworldAnalytics(logs, {
    currentSessionId: 'session_02_roots_below',
    recentLimit: 3,
  });
  assert.strictEqual(analytics.totalPlayCount, logs.length);
  assert.strictEqual(analytics.uniqueUserCount, 3);
  assert.deepStrictEqual(analytics.sessionCounts.map((item) => [item.sessionId, item.count]), [
    ['session_01_black_bell', 3],
    ['session_02_roots_below', 1],
    ['session_03_locked_basin', 1],
    ['session_04_orc_bridge', 1],
  ]);

  const rankedSessionLogs = [
    'session_01_black_bell',
    'session_02_roots_below',
    'session_02_roots_below',
    'session_03_locked_basin',
    'session_04_orc_bridge',
    'session_04_orc_bridge',
    'session_05_broken_belfry',
    'session_06_memory_forest',
    'session_07_black_gate',
    'session_09_final_gate',
    'session_09_final_gate',
    'session_09_final_gate',
    'session_09_final_gate',
  ].map((sessionId, index) => ({
    id: `ranked_${index + 1}`,
    userId: `ranked_user_${index + 1}`,
    displayName: `랭킹 테스트 ${index + 1}`,
    sessionId,
    choiceId: 'ranked_choice',
    choiceLabel: '랭킹 테스트 선택',
    tier: 'strong',
    createdAt: `2030-02-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  }));
  const rankedAnalytics = buildDungeonworldAnalytics(rankedSessionLogs, {
    currentSessionId: 'session_01_black_bell',
  });
  assert.deepStrictEqual(rankedAnalytics.sessionCounts.slice(0, 5).map((item) => [item.sessionId, item.count]), [
    ['session_09_final_gate', 4],
    ['session_02_roots_below', 2],
    ['session_04_orc_bridge', 2],
    ['session_01_black_bell', 1],
    ['session_03_locked_basin', 1],
  ]);

  assert.deepStrictEqual(analytics.choiceCounts.map((item) => [item.choiceId, item.count]).slice(0, 2), [
    ['pursue', 1],
    ['investigate', 1],
  ]);
  assert.deepStrictEqual(
    analytics.choiceCounts
      .filter((item) => item.choiceId === 'negotiate')
      .map((item) => [item.choiceKey, item.sessionId, item.sessionTitle, item.choiceLabel, item.count]),
    [
      [
        'session_01_black_bell:negotiate',
        'session_01_black_bell',
        '1회차. 변방 여관의 검은 종',
        '렌과 거래해 지도의 출처를 묻는다',
        1,
      ],
      [
        'session_04_orc_bridge:negotiate',
        'session_04_orc_bridge',
        '4회차. 오크가 지키는 다리',
        '증표와 말로 협상한다',
        1,
      ],
    ]
  );
  assert.deepStrictEqual(analytics.tierCounts, { strong: 2, mixed: 3, weak: 2, unknown: 1 });
  assert.deepStrictEqual(analytics.recentActivity.map((log) => log.id), [
    'u1_missing_session',
    'u1_unknown_session',
    'u3_s4_negotiate',
  ]);
  assert.deepStrictEqual(analytics.latestSessionProgressCounts, {
    sessionId: 'session_02_roots_below',
    sessionTitle: '2회차. 뿌리 아래 고블린 길',
    playCount: 1,
    uniqueUserCount: 1,
  });

  const unknownSessionAnalytics = buildDungeonworldAnalytics(logs, { currentSessionId: 'session_404_missing' });
  assert.strictEqual(unknownSessionAnalytics.latestSessionProgressCounts, null);

  console.log('dungeonworld sessions smoke test passed');
}

main();
