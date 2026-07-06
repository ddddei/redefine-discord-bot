const {
  createWebgameRepository,
  getDailySeed,
  getDayKey,
  getIsoWeekKey,
} = require('./webgameRepository');
const { verifyReplay, isStrictModeEnabled, REPLAY_STATUS } = require('./webgameReplay');
const crypto = require('crypto');
const WordLogic = require('../public/word/logic');
const WORD_POOL = require('../data/word-pool.json');

const MAX_BODY_BYTES = 4 * 1024;
// score 엔드포인트만 replayLog를 담을 수 있어 32KB로 상향한다(다른 엔드포인트는 기존 4KB
// 유지 - docs/replay-verification-plan.md 1절). 클라이언트는 로그 포함 본문이 이 값을
// 넘으면 로그를 떼고 제출하므로, 서버 상한 초과는 여전히 예외적인 경우로 취급한다.
const MAX_SCORE_BODY_BYTES = 32 * 1024;

// 랭킹 화면 choices/표시용 게임 정의. 클라이언트 값은 신뢰하지 않으므로
// 점수 상한 등 부정 방지 기준은 전부 여기(서버 쪽 상수)에 둔다.
const GAME_DEFINITIONS = {
  match3: {
    id: 'match3',
    title: '간식 맞추기',
    rankable: true,
    dailyCapable: true,
    // 특수 타일 도입(docs/match3-improvement-plan.md 1.3) 후 재산정.
    // 실측(500개 시드 x 전체 인접 스왑 전수 스캔)한 단일 스왑 최고 점수는 2,790점
    // (컬러 타일 발동 포함 캐스케이드 7단). 여유 계수를 적용해 수 하나당 가정
    // 최댓값을 3,000점으로 반올림하고 30수를 곱해 상한을 90,000으로 상향한다.
    maxScore: 90000,
  },
  deck: {
    id: 'deck',
    title: '간식 수호대',
    rankable: true,
    dailyCapable: true,
    // 점수화 공식: 도달 스테이지 * 1000 + 잔여 HP. 스테이지 11개, 최대 HP 60.
    maxScore: 11 * 1000 + 60,
  },
  idle: {
    id: 'idle',
    title: '간식 공방 키우기',
    rankable: false,
    dailyCapable: false,
    // 방치형은 랭킹 부적합 장르 - 참여 기록만 남기고 랭킹에는 노출하지 않는다.
    // 프레스티지 반복을 감안해 넉넉한 상한만 둔다.
    maxScore: 1e15,
  },
  word: {
    id: 'word',
    title: '오늘의 간식 단어',
    rankable: false,
    dailyCapable: true,
    maxScore: 6,
  },
};

// 오늘의 도전 요일 변형(docs/match3-improvement-plan.md 2절). 서버가 유일한
// 결정 소스다 - 클라이언트는 요일을 계산하지 않고 이 응답을 그대로 따른다.
// 요일 인덱스: dayKey(KST YYYY-MM-DD)를 Date.UTC로 파싱해 getUTCDay()를 쓴다
// (dayKey 문자열 자체가 이미 KST 기준으로 계산된 값이므로, 그 문자열이 나타내는
// 달력 날짜의 요일을 구하는 데는 UTC 파싱이 시간대 이중 보정 없이 정확하다).
const MATCH3_VARIANT_BY_WEEKDAY = {
  0: { id: 'standard', label: '오늘의 간식판이에요.' }, // 일
  1: { id: 'standard', label: '오늘의 간식판이에요.' }, // 월
  2: { id: 'sprint20', label: '오늘은 20수 스프린트예요. 짧고 굵게!', movesLimit: 20 }, // 화
  3: { id: 'standard', label: '오늘의 간식판이에요.' }, // 수
  4: { id: 'collect', label: '오늘의 목표 간식을 많이 모아 보세요.', targetCount: 40, bonusScore: 3000 }, // 목
  5: { id: 'standard', label: '오늘의 간식판이에요.' }, // 금
  6: { id: 'combo', label: '오늘은 콤보가 돈이 돼요.', comboMultiplierBonus: 500 }, // 토
};

function getMatch3VariantForDayKey(dayKey) {
  const parts = String(dayKey).split('-').map(Number);
  const weekday = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
  const config = MATCH3_VARIANT_BY_WEEKDAY[weekday] || MATCH3_VARIANT_BY_WEEKDAY[0];

  const variant = {
    id: config.id,
    movesLimit: config.movesLimit || 30,
    label: config.label,
  };

  if (config.id === 'collect') {
    // targetTile: 시드로 결정적 선택(계획서 2.1) - dayKey의 일일 시드를 salt로 써서
    // 매치3 간식 종류 중 하나를 고른다.
    const seed = getDailySeed(dayKey);
    const tileTypes = ['strawberry', 'orange', 'candy', 'cookie', 'cupcake', 'jelly'];
    const index = seed % tileTypes.length;
    variant.targetTile = tileTypes[index];
    variant.targetCount = config.targetCount;
    variant.bonusScore = config.bonusScore;
  }

  if (config.id === 'combo') {
    variant.comboMultiplierBonus = config.comboMultiplierBonus;
  }

  return variant;
}

const RATE_LIMIT_PER_MINUTE = 3;
const RATE_LIMIT_PER_DAY = 50;
const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
// 이상치 플래그: 직전 주간 최고의 3배 초과.
const OUTLIER_MULTIPLIER = 3;
// 연결 코드는 6자리 숫자라 무차별 대입을 막아야 한다. IP당 시도 횟수 제한(인메모리).
// 코드 TTL(10분) 안에 15회로는 100만 조합을 사실상 탐색할 수 없다.
const LINK_ATTEMPT_LIMIT = 15;
const LINK_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const CHEER_RATE_LIMIT_PER_MINUTE = 10;
const CHEER_RATE_LIMIT_PER_DAY = 30;
const WORD_GUESS_RATE_LIMIT_PER_MINUTE = 30;
const DEFAULT_COMMUNAL_GOAL = 4000000000;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isKnownGame(gameId) {
  return Object.prototype.hasOwnProperty.call(GAME_DEFINITIONS, gameId);
}

function listRankableGames() {
  return Object.values(GAME_DEFINITIONS).filter((game) => game.rankable);
}

function isDailyCapable(gameDefinition) {
  return gameDefinition.dailyCapable === true;
}

function getCommunalGoal() {
  const parsed = Number(process.env.WEBGAME_COMMUNAL_GOAL);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_COMMUNAL_GOAL;
}

// includeSize: true면 { body, bytes } 형태로 돌려준다(score 엔드포인트가 replayLog
// 유무에 따라 4KB/32KB 상한을 나눠 적용하는 데 사용, 그 외 호출부는 기존처럼 body만 받는다).
function readJsonBody(req, maxBytes = MAX_BODY_BYTES, includeSize = false) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '');
    if (contentType && !contentType.includes('application/json')) {
      reject(Object.assign(new Error('INVALID_CONTENT_TYPE'), { code: 'INVALID_CONTENT_TYPE' }));
      return;
    }

    let totalBytes = 0;
    let tooLarge = false;
    const chunks = [];

    req.on('data', (chunk) => {
      if (tooLarge) {
        return;
      }

      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (tooLarge) {
        reject(Object.assign(new Error('BODY_TOO_LARGE'), { code: 'BODY_TOO_LARGE' }));
        return;
      }

      if (totalBytes === 0) {
        resolve(includeSize ? { body: {}, bytes: 0 } : {});
        return;
      }

      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const body = parsed && typeof parsed === 'object' ? parsed : {};
        resolve(includeSize ? { body, bytes: totalBytes } : body);
      } catch (error) {
        reject(Object.assign(new Error('INVALID_JSON'), { code: 'INVALID_JSON' }));
      }
    });

    req.on('error', (error) => {
      reject(error);
    });
  });
}

function getBearerToken(req) {
  const header = req.headers['authorization'] || req.headers['x-webgame-token'];
  if (!header) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(String(header));
  return match ? match[1].trim() : String(header).trim();
}

function getClientAddress(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || (req.socket && req.socket.remoteAddress) || 'unknown';
}

function isAllowedWordDayKey(dayKey, nowDate) {
  if (typeof dayKey !== 'string' || !DAY_KEY_PATTERN.test(dayKey)) {
    return false;
  }

  const todayKey = getDayKey(nowDate);
  const yesterdayKey = getDayKey(new Date(nowDate.getTime() - ONE_DAY_MS));
  return dayKey === todayKey || dayKey === yesterdayKey;
}

function selectWordAnswer(dayKey, salt) {
  const digest = crypto.createHash('sha256').update(`${salt}:${dayKey}`).digest('hex');
  const index = Number(BigInt(`0x${digest}`) % BigInt(WORD_POOL.answers.length));
  return WORD_POOL.answers[index];
}

function createWordResult(record) {
  if (!record) {
    return null;
  }

  if (Number.isInteger(record.score) && record.score >= 1 && record.score <= 6) {
    return { tries: 7 - record.score };
  }

  return { tries: null };
}

function createWebgameApi(options = {}) {
  const repository = options.repository || createWebgameRepository();
  const now = typeof options.now === 'function' ? options.now : () => new Date();

  // IP별 연결 코드 시도 기록. 프로세스 재시작 시 초기화되는 인메모리 억지력이며,
  // 코드 자체의 짧은 TTL(10분)·일회성과 조합되어 무차별 대입을 막는다.
  const linkAttemptsByAddress = new Map();
  const cheerAttemptsByToken = new Map();
  const wordGuessAttemptsByAddress = new Map();
  const validWordGuesses = new Set(WORD_POOL.validGuesses);

  function isLinkAttemptAllowed(address, nowMs) {
    const entry = linkAttemptsByAddress.get(address);
    if (!entry || nowMs - entry.windowStart > LINK_ATTEMPT_WINDOW_MS) {
      linkAttemptsByAddress.set(address, { windowStart: nowMs, count: 1 });
      return true;
    }
    entry.count += 1;
    if (linkAttemptsByAddress.size > 1000) {
      // 오래된 항목 정리 (소규모 운영 기준 과도한 성장 방지).
      linkAttemptsByAddress.forEach((value, key) => {
        if (nowMs - value.windowStart > LINK_ATTEMPT_WINDOW_MS) {
          linkAttemptsByAddress.delete(key);
        }
      });
    }
    return entry.count <= LINK_ATTEMPT_LIMIT;
  }

  function isCheerAttemptAllowed(token, nowMs) {
    const entry = cheerAttemptsByToken.get(token);
    if (!entry || nowMs - entry.windowStart > ONE_MINUTE_MS) {
      cheerAttemptsByToken.set(token, { windowStart: nowMs, count: 1 });
      return true;
    }
    entry.count += 1;
    if (cheerAttemptsByToken.size > 1000) {
      cheerAttemptsByToken.forEach((value, key) => {
        if (nowMs - value.windowStart > ONE_MINUTE_MS) {
          cheerAttemptsByToken.delete(key);
        }
      });
    }
    return entry.count <= CHEER_RATE_LIMIT_PER_MINUTE;
  }

  function isWordGuessAttemptAllowed(address, nowMs) {
    const entry = wordGuessAttemptsByAddress.get(address);
    if (!entry || nowMs - entry.windowStart > ONE_MINUTE_MS) {
      wordGuessAttemptsByAddress.set(address, { windowStart: nowMs, count: 1 });
      return true;
    }
    entry.count += 1;
    if (wordGuessAttemptsByAddress.size > 1000) {
      wordGuessAttemptsByAddress.forEach((value, key) => {
        if (nowMs - value.windowStart > ONE_MINUTE_MS) {
          wordGuessAttemptsByAddress.delete(key);
        }
      });
    }
    return entry.count <= WORD_GUESS_RATE_LIMIT_PER_MINUTE;
  }

  function getWordSalt() {
    const envSalt = typeof process.env.WEBGAME_WORD_SALT === 'string'
      ? process.env.WEBGAME_WORD_SALT.trim()
      : '';
    return envSalt || repository.getSocialData().cheerSalt;
  }

  function decorateRankingEntries(ranking, gameId, periodKey, myDiscordId) {
    const cheersByDiscordId = repository.countCheers(gameId, periodKey);
    return ranking.map((entry) => ({
      rank: entry.rank,
      displayName: entry.displayName,
      score: entry.score,
      targetId: entry.targetId,
      cheers: cheersByDiscordId.get(entry.discordId) || 0,
      isMe: Boolean(myDiscordId && entry.discordId === myDiscordId),
    }));
  }

  function getDailyModeForSubmission(seed, nowDate) {
    const todayKey = getDayKey(nowDate);
    const yesterdayKey = getDayKey(new Date(nowDate.getTime() - ONE_DAY_MS));
    const normalizedSeed = seed !== null && seed !== undefined ? String(seed) : '';

    if (normalizedSeed === String(getDailySeed(todayKey))) {
      return { mode: 'daily', dayKey: todayKey };
    }

    if (normalizedSeed === String(getDailySeed(yesterdayKey))) {
      return { mode: 'daily', dayKey: yesterdayKey };
    }

    return { mode: 'free', dayKey: null };
  }

  function isAllowedCheerPeriod(periodKey, nowDate) {
    const todayKey = getDayKey(nowDate);
    const yesterdayKey = getDayKey(new Date(nowDate.getTime() - ONE_DAY_MS));
    const weekKey = getIsoWeekKey(nowDate);
    return periodKey === weekKey || periodKey === todayKey || periodKey === yesterdayKey;
  }

  async function handleLink(req, res, sendJson) {
    if (!isLinkAttemptAllowed(getClientAddress(req), now().getTime())) {
      sendJson(res, 429, { error: 'RATE_LIMITED', message: '시도가 너무 많아요. 잠시 후 다시 해 주세요.' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: 'INVALID_REQUEST', message: '요청 본문을 확인해 주세요.' });
      return;
    }

    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!code) {
      sendJson(res, 400, { error: 'CODE_REQUIRED', message: '코드를 입력해 주세요.' });
      return;
    }

    const result = repository.redeemLinkCode(code, now());

    if (!result.ok) {
      if (result.reason === 'CODE_EXPIRED') {
        sendJson(res, 410, { error: 'CODE_EXPIRED', message: '코드가 만료됐어요. Discord에서 다시 발급받아 주세요.' });
        return;
      }

      sendJson(res, 404, { error: 'CODE_NOT_FOUND', message: '코드를 찾을 수 없어요. 다시 확인해 주세요.' });
      return;
    }

    sendJson(res, 200, { playerToken: result.playerToken, displayName: result.displayName });
  }

  function handleWordScore(res, sendJson, input) {
    const { body, link, score, challenge, nowDate } = input;
    const dayKey = typeof body.dayKey === 'string' ? body.dayKey.trim() : '';

    if (challenge !== 'daily') {
      sendJson(res, 400, { error: 'NOT_DAILY', message: '이 게임은 오늘의 도전만 기록할 수 있어요.' });
      return;
    }

    if (!Number.isInteger(score) || score < 0 || score > GAME_DEFINITIONS.word.maxScore) {
      sendJson(res, 400, { error: 'SCORE_OUT_OF_RANGE', message: '점수 값이 허용 범위를 넘었어요.' });
      return;
    }

    if (!isAllowedWordDayKey(dayKey, nowDate)) {
      sendJson(res, 400, { error: 'INVALID_DAY', message: '기록할 수 있는 날짜가 아니에요.' });
      return;
    }

    const existingResult = repository.getDailyBest(link.discordId, 'word', dayKey);
    if (existingResult) {
      sendJson(res, 200, {
        accepted: true,
        duplicate: true,
        mode: 'daily',
        dayKey,
        myResult: createWordResult(existingResult),
      });
      return;
    }

    const perMinute = repository.countRecentSubmissions(link.discordId, ONE_MINUTE_MS, nowDate);
    if (perMinute >= RATE_LIMIT_PER_MINUTE) {
      sendJson(res, 429, { error: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요.' });
      return;
    }

    const perDay = repository.countRecentSubmissions(link.discordId, ONE_DAY_MS, nowDate);
    if (perDay >= RATE_LIMIT_PER_DAY) {
      sendJson(res, 429, { error: 'RATE_LIMITED', message: '오늘 제출 가능한 횟수를 넘었어요.' });
      return;
    }

    const record = repository.recordScore({
      discordId: link.discordId,
      gameId: 'word',
      score,
      seed: null,
      flagged: false,
      mode: 'daily',
      dayKey,
    }, nowDate);

    sendJson(res, 200, {
      accepted: true,
      flagged: false,
      mode: 'daily',
      dayKey,
      myResult: createWordResult(record),
    });
  }

  async function handleScore(req, res, sendJson) {
    let body;
    let bodyBytes;
    try {
      const parsed = await readJsonBody(req, MAX_SCORE_BODY_BYTES, true);
      body = parsed.body;
      bodyBytes = parsed.bytes;
    } catch (error) {
      sendJson(res, 400, { error: 'INVALID_REQUEST', message: '요청 본문을 확인해 주세요.' });
      return;
    }

    const replayLog = body.replayLog !== undefined ? body.replayLog : null;

    // replayLog가 없는 제출은 기존 4KB 상한을 그대로 유지한다(하위 호환 - 계획서 1절).
    // 로그가 실려 있을 때만 32KB까지 허용한다.
    if (!replayLog && bodyBytes > MAX_BODY_BYTES) {
      sendJson(res, 400, { error: 'INVALID_REQUEST', message: '요청 본문을 확인해 주세요.' });
      return;
    }

    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    const score = Number(body.score);
    const seed = body.seed !== undefined && body.seed !== null ? String(body.seed) : null;
    const challenge = body.challenge === 'daily' ? 'daily' : null;

    if (!token) {
      sendJson(res, 401, { error: 'TOKEN_REQUIRED', message: '연결 토큰이 필요해요.' });
      return;
    }

    const link = repository.getLinkByToken(token);
    if (!link) {
      sendJson(res, 401, { error: 'INVALID_TOKEN', message: '연결이 확인되지 않아요. 다시 연결해 주세요.' });
      return;
    }

    if (!isKnownGame(gameId)) {
      sendJson(res, 400, { error: 'UNKNOWN_GAME', message: '알 수 없는 게임이에요.' });
      return;
    }

    if (!Number.isFinite(score) || score < 0) {
      sendJson(res, 400, { error: 'INVALID_SCORE', message: '점수 값을 확인해 주세요.' });
      return;
    }

    const nowDate = now();
    const gameDefinition = GAME_DEFINITIONS[gameId];

    if (gameId === 'word') {
      handleWordScore(res, sendJson, { body, link, score, challenge, nowDate });
      return;
    }

    const perMinute = repository.countRecentSubmissions(link.discordId, ONE_MINUTE_MS, nowDate);
    if (perMinute >= RATE_LIMIT_PER_MINUTE) {
      sendJson(res, 429, { error: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요.' });
      return;
    }

    const perDay = repository.countRecentSubmissions(link.discordId, ONE_DAY_MS, nowDate);
    if (perDay >= RATE_LIMIT_PER_DAY) {
      sendJson(res, 429, { error: 'RATE_LIMITED', message: '오늘 제출 가능한 횟수를 넘었어요.' });
      return;
    }

    if (challenge === 'daily' && !isDailyCapable(gameDefinition)) {
      sendJson(res, 400, { error: 'NOT_DAILY', message: '이 게임에는 오늘의 도전이 없어요.' });
      return;
    }

    if (score > gameDefinition.maxScore) {
      sendJson(res, 400, { error: 'SCORE_OUT_OF_RANGE', message: '점수 값이 허용 범위를 넘었어요.' });
      return;
    }

    const weekKey = getIsoWeekKey(nowDate);
    const previousBest = repository.getPreviousWeekBest(link.discordId, gameId, weekKey);
    const isOutlier = Boolean(previousBest) && score > previousBest.score * OUTLIER_MULTIPLIER;
    const dailyMode = challenge === 'daily'
      ? getDailyModeForSubmission(seed, nowDate)
      : { mode: 'free', dayKey: null };

    // 서버 리플레이 검증(v2, docs/replay-verification-plan.md 2절). 검증 실패(예외 등)는
    // 절대 제출을 막지 않는다 - missing 폴백 + 콘솔 경고. mismatch는 도입기에 자동으로
    // flagged 전환하지 않으며, WEBGAME_REPLAY_STRICT=true일 때만 flagged를 같이 세운다.
    const replayResult = verifyReplay({ gameId, score, seed, replayLog });
    let flagged = isOutlier;
    if (replayResult.status === REPLAY_STATUS.MISMATCH && isStrictModeEnabled()) {
      flagged = true;
    }
    if (replayResult.status === REPLAY_STATUS.MISMATCH) {
      repository.appendReplayMismatch({
        discordId: link.discordId,
        gameId,
        seed,
        score,
        replayScore: replayResult.replayScore,
        reason: replayResult.reason,
        log: replayLog,
      }, nowDate);
    }

    const record = repository.recordScore({
      discordId: link.discordId,
      gameId,
      score,
      seed,
      flagged,
      mode: dailyMode.mode,
      dayKey: dailyMode.dayKey,
      replay: replayResult.status,
    }, nowDate);

    const weekBest = repository.getWeekBest(link.discordId, gameId, weekKey);
    const payload = {
      accepted: true,
      flagged: record.flagged,
      weekBest: weekBest ? weekBest.score : record.score,
      // 참여자 UI 표시용이 아니라 콘솔 진단용이다(배려 원칙 - "검증 실패" 신호를 보여주지 않는다).
      replay: record.replay,
    };

    if (challenge === 'daily') {
      payload.mode = record.mode;
      if (record.mode === 'daily') {
        const dayBest = repository.getDailyBest(link.discordId, gameId, record.dayKey);
        payload.dayKey = record.dayKey;
        payload.dayBest = dayBest ? dayBest.score : record.score;
      }
    }

    sendJson(res, 200, payload);
  }

  async function handleRankings(req, res, sendJson, searchParams) {
    const gameId = searchParams.get('gameId') || '';

    if (!isKnownGame(gameId)) {
      sendJson(res, 400, { error: 'UNKNOWN_GAME', message: '알 수 없는 게임이에요.' });
      return;
    }

    if (!GAME_DEFINITIONS[gameId].rankable) {
      // 방치형 등 랭킹 부적합 게임은 참여 기록만 받고 랭킹은 노출하지 않는다 (Discord 명령과 동일 정책).
      sendJson(res, 400, { error: 'NOT_RANKABLE', message: '랭킹 대상 게임이 아니에요.' });
      return;
    }

    const nowDate = now();
    const weekKey = getIsoWeekKey(nowDate);

    const token = getBearerToken(req);
    let myRank = null;
    let myDiscordId = null;
    if (token) {
      const link = repository.getLinkByToken(token);
      if (link) {
        myDiscordId = link.discordId;
        myRank = repository.getMyWeeklyRank(gameId, weekKey, link.discordId);
      }
    }

    const ranking = decorateRankingEntries(
      repository.listWeeklyRanking(gameId, weekKey, { limit: 10, includeTargetId: true }),
      gameId,
      weekKey,
      myDiscordId
    );

    sendJson(res, 200, { gameId, weekKey, ranking, myRank });
  }

  async function handleDaily(req, res, sendJson, searchParams) {
    const gameId = searchParams.get('gameId') || '';

    if (!isKnownGame(gameId)) {
      sendJson(res, 400, { error: 'UNKNOWN_GAME', message: '알 수 없는 게임이에요.' });
      return;
    }

    const gameDefinition = GAME_DEFINITIONS[gameId];
    if (!isDailyCapable(gameDefinition)) {
      sendJson(res, 400, { error: 'NOT_DAILY', message: '이 게임에는 오늘의 도전이 없어요.' });
      return;
    }

    const nowDate = now();
    const dayKey = getDayKey(nowDate);
    const token = getBearerToken(req);
    if (gameId === 'word') {
      const resultSummary = repository.getDailyResultDistribution(gameId, dayKey);
      let myResult = null;

      if (token) {
        const link = repository.getLinkByToken(token);
        if (link) {
          myResult = createWordResult(repository.getDailyBest(link.discordId, gameId, dayKey));
        }
      }

      sendJson(res, 200, {
        gameId,
        dayKey,
        participants: resultSummary.participants,
        distribution: resultSummary.distribution,
        myResult,
      });
      return;
    }

    let myDiscordId = null;
    let myBest = null;
    let myRank = null;

    if (token) {
      const link = repository.getLinkByToken(token);
      if (link) {
        myDiscordId = link.discordId;
        myBest = repository.getDailyBest(link.discordId, gameId, dayKey);
        myRank = repository.getMyDailyRank(gameId, dayKey, link.discordId);
      }
    }

    const ranking = decorateRankingEntries(
      repository.listDailyRanking(gameId, dayKey, { limit: 10, includeTargetId: true }),
      gameId,
      dayKey,
      myDiscordId
    );

    const payload = {
      gameId,
      dayKey,
      seed: getDailySeed(dayKey),
      participants: repository.countDailyParticipants(gameId, dayKey),
      ranking,
      myBest: myBest ? myBest.score : null,
      myRank,
    };

    // 요일 변형(계획서 2절)은 match3만 대상 - 서버가 유일 소스, 클라 요일 계산 금지.
    // 구버전 클라이언트는 variant 필드를 모르므로 무해하게 무시한다(추가 필드).
    if (gameId === 'match3') {
      payload.variant = getMatch3VariantForDayKey(dayKey);
    }

    sendJson(res, 200, payload);
  }

  async function handleGoal(req, res, sendJson) {
    const nowDate = now();
    const weekKey = getIsoWeekKey(nowDate);
    const progress = repository.getCommunalGoalProgress(weekKey);
    const goal = getCommunalGoal();
    const token = getBearerToken(req);
    let myContribution = null;

    if (token) {
      const link = repository.getLinkByToken(token);
      if (link) {
        myContribution = progress.contributions.get(link.discordId) || 0;
      }
    }

    sendJson(res, 200, {
      weekKey,
      goal,
      total: progress.total,
      participants: progress.participants,
      achieved: progress.total >= goal,
      myContribution,
    });
  }

  async function handleCheer(req, res, sendJson) {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: 'INVALID_REQUEST', message: '요청 본문을 확인해 주세요.' });
      return;
    }

    const token = typeof body.token === 'string' ? body.token.trim() : getBearerToken(req);
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    const periodKey = typeof body.periodKey === 'string' ? body.periodKey.trim() : '';
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
    const nowDate = now();

    if (!token) {
      sendJson(res, 401, { error: 'TOKEN_REQUIRED', message: '연결 토큰이 필요해요.' });
      return;
    }

    const link = repository.getLinkByToken(token);
    if (!link) {
      sendJson(res, 401, { error: 'INVALID_TOKEN', message: '연결이 확인되지 않아요. 다시 연결해 주세요.' });
      return;
    }

    if (!isKnownGame(gameId)) {
      sendJson(res, 400, { error: 'UNKNOWN_GAME', message: '알 수 없는 게임이에요.' });
      return;
    }

    if (!GAME_DEFINITIONS[gameId].rankable) {
      sendJson(res, 400, { error: 'NOT_CHEERABLE', message: '이 게임은 응원 대상이 아니에요.' });
      return;
    }

    if (!isAllowedCheerPeriod(periodKey, nowDate)) {
      sendJson(res, 400, { error: 'INVALID_PERIOD', message: '응원할 수 있는 기간이 아니에요.' });
      return;
    }

    const target = repository.resolveTargetId(targetId);
    if (!target) {
      sendJson(res, 404, { error: 'TARGET_NOT_FOUND', message: '응원할 기록을 찾지 못했어요.' });
      return;
    }

    if (target.discordId === link.discordId) {
      sendJson(res, 400, { error: 'CANNOT_CHEER_SELF', message: '내 기록에는 응원할 수 없어요.' });
      return;
    }

    if (!isCheerAttemptAllowed(token, nowDate.getTime())) {
      sendJson(res, 429, { error: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요.' });
      return;
    }

    if (repository.countCheersSentToday(link.discordId, getDayKey(nowDate)) >= CHEER_RATE_LIMIT_PER_DAY) {
      sendJson(res, 429, { error: 'RATE_LIMITED', message: '오늘 보낼 수 있는 응원 횟수를 넘었어요.' });
      return;
    }

    const result = repository.addCheer({
      fromDiscordId: link.discordId,
      targetDiscordId: target.discordId,
      gameId,
      periodKey,
    }, nowDate);
    const cheers = repository.countCheers(gameId, periodKey).get(target.discordId) || 0;

    if (!result.ok && result.reason === 'ALREADY_CHEERED') {
      sendJson(res, 200, { ok: true, alreadyCheered: true, cheers });
      return;
    }

    sendJson(res, 200, { ok: true, cheers });
  }

  async function handleWordGuess(req, res, sendJson) {
    const nowDate = now();
    if (!isWordGuessAttemptAllowed(getClientAddress(req), nowDate.getTime())) {
      sendJson(res, 429, { error: 'RATE_LIMITED', message: '잠시 후 다시 시도해 주세요.' });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: 'INVALID_REQUEST', message: '요청 본문을 확인해 주세요.' });
      return;
    }

    const dayKey = typeof body.dayKey === 'string' ? body.dayKey.trim() : '';
    if (!isAllowedWordDayKey(dayKey, nowDate)) {
      sendJson(res, 400, { error: 'INVALID_DAY', message: '풀 수 있는 날짜가 아니에요.' });
      return;
    }

    const normalizedGuess = WordLogic.normalizeGuess(body.guess);
    if (!normalizedGuess.valid || !validWordGuesses.has(normalizedGuess.value)) {
      sendJson(res, 200, {
        valid: false,
        message: '사전에 있는 두 글자 단어를 입력해 주세요.',
      });
      return;
    }

    const answer = selectWordAnswer(dayKey, getWordSalt());
    const feedback = WordLogic.calculateFeedback(
      WordLogic.decomposeWord(answer),
      WordLogic.decomposeWord(normalizedGuess.value)
    );

    sendJson(res, 200, {
      valid: true,
      feedback,
      solved: normalizedGuess.value === answer,
    });
  }

  async function handleMe(req, res, sendJson) {
    const token = getBearerToken(req);
    if (!token) {
      sendJson(res, 401, { error: 'TOKEN_REQUIRED', message: '연결 토큰이 필요해요.' });
      return;
    }

    const link = repository.getLinkByToken(token);
    if (!link) {
      sendJson(res, 401, { error: 'INVALID_TOKEN', message: '연결이 확인되지 않아요.' });
      return;
    }

    sendJson(res, 200, { displayName: link.displayName });
  }

  return {
    handleLink,
    handleScore,
    handleRankings,
    handleDaily,
    handleGoal,
    handleCheer,
    handleWordGuess,
    handleMe,
  };
}

module.exports = {
  createWebgameApi,
  GAME_DEFINITIONS,
  listRankableGames,
  isKnownGame,
  MAX_BODY_BYTES,
  RATE_LIMIT_PER_MINUTE,
  RATE_LIMIT_PER_DAY,
  CHEER_RATE_LIMIT_PER_MINUTE,
  CHEER_RATE_LIMIT_PER_DAY,
  WORD_GUESS_RATE_LIMIT_PER_MINUTE,
  OUTLIER_MULTIPLIER,
  DEFAULT_COMMUNAL_GOAL,
  getCommunalGoal,
  getMatch3VariantForDayKey,
};
