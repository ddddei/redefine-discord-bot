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
    createDungeonworldConfigRepository,
    createDungeonworldRepository,
    getCurrentSessionId,
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
  // 회차 수(9개)보다 더 많은 주가 지나면 마지막 회차에 고정된다.
  assert.strictEqual(dw.resolveAutoSessionId(new Date('2032-01-01T00:00:00Z')), 'session_09_final_gate');
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

  console.log('dungeonworld sessions smoke test passed');
}

main();
