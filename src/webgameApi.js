const { createWebgameRepository, getIsoWeekKey } = require('./webgameRepository');

const MAX_BODY_BYTES = 4 * 1024;

// 랭킹 화면 choices/표시용 게임 정의. 클라이언트 값은 신뢰하지 않으므로
// 점수 상한 등 부정 방지 기준은 전부 여기(서버 쪽 상수)에 둔다.
const GAME_DEFINITIONS = {
  match3: {
    id: 'match3',
    title: '간식 맞추기',
    rankable: true,
    // 30수 * 컷당 이론상 최대(5매치 다중 캐스케이드)를 넉넉히 넘는 상한.
    maxScore: 50000,
  },
  deck: {
    id: 'deck',
    title: '간식 수호대',
    rankable: true,
    // 점수화 공식: 도달 스테이지 * 1000 + 잔여 HP. 스테이지 11개, 최대 HP 60.
    maxScore: 11 * 1000 + 60,
  },
  idle: {
    id: 'idle',
    title: '간식 공방 키우기',
    rankable: false,
    // 방치형은 랭킹 부적합 장르 - 참여 기록만 남기고 랭킹에는 노출하지 않는다.
    // 프레스티지 반복을 감안해 넉넉한 상한만 둔다.
    maxScore: 1e15,
  },
};

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

function isKnownGame(gameId) {
  return Object.prototype.hasOwnProperty.call(GAME_DEFINITIONS, gameId);
}

function listRankableGames() {
  return Object.values(GAME_DEFINITIONS).filter((game) => game.rankable);
}

function readJsonBody(req) {
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
      if (totalBytes > MAX_BODY_BYTES) {
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
        resolve({});
        return;
      }

      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
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

function createWebgameApi(options = {}) {
  const repository = options.repository || createWebgameRepository();
  const now = typeof options.now === 'function' ? options.now : () => new Date();

  // IP별 연결 코드 시도 기록. 프로세스 재시작 시 초기화되는 인메모리 억지력이며,
  // 코드 자체의 짧은 TTL(10분)·일회성과 조합되어 무차별 대입을 막는다.
  const linkAttemptsByAddress = new Map();

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

  async function handleScore(req, res, sendJson) {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: 'INVALID_REQUEST', message: '요청 본문을 확인해 주세요.' });
      return;
    }

    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
    const score = Number(body.score);
    const seed = body.seed !== undefined && body.seed !== null ? String(body.seed) : null;

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

    const gameDefinition = GAME_DEFINITIONS[gameId];
    if (score > gameDefinition.maxScore) {
      sendJson(res, 400, { error: 'SCORE_OUT_OF_RANGE', message: '점수 값이 허용 범위를 넘었어요.' });
      return;
    }

    const weekKey = getIsoWeekKey(nowDate);
    const previousBest = repository.getPreviousWeekBest(link.discordId, gameId, weekKey);
    const isOutlier = Boolean(previousBest) && score > previousBest.score * OUTLIER_MULTIPLIER;

    const record = repository.recordScore({
      discordId: link.discordId,
      gameId,
      score,
      seed,
      flagged: isOutlier,
    }, nowDate);

    const weekBest = repository.getWeekBest(link.discordId, gameId, weekKey);

    sendJson(res, 200, {
      accepted: true,
      flagged: record.flagged,
      weekBest: weekBest ? weekBest.score : record.score,
    });
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
    const ranking = repository.listWeeklyRanking(gameId, weekKey, { limit: 10 });

    const token = getBearerToken(req);
    let myRank = null;
    if (token) {
      const link = repository.getLinkByToken(token);
      if (link) {
        myRank = repository.getMyWeeklyRank(gameId, weekKey, link.discordId);
      }
    }

    sendJson(res, 200, { gameId, weekKey, ranking, myRank });
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
  OUTLIER_MULTIPLIER,
};
