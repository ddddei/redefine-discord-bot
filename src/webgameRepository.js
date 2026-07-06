const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadJsonFile, saveJsonFile } = require('./pointsStore');

const DATA_DIR = path.join(__dirname, '..', 'data');

const DEFAULT_PATHS = {
  links: process.env.WEBGAME_LINKS_DATA_PATH || path.join(DATA_DIR, 'webgame-links.local.json'),
  scores: process.env.WEBGAME_SCORES_DATA_PATH || path.join(DATA_DIR, 'webgame-scores.local.json'),
  social: process.env.WEBGAME_SOCIAL_DATA_PATH || path.join(DATA_DIR, 'webgame-social.local.json'),
  replayMismatch: process.env.WEBGAME_REPLAY_MISMATCH_DATA_PATH
    || path.join(DATA_DIR, 'webgame-replay-mismatch.local.json'),
};

// mismatch 진단 파일은 최근 이 개수만큼만 순환 보관한다(계획서 3절 - 오탐 분석·
// strict 전환 판단 근거 용도이며 무기한 누적하지 않는다).
const REPLAY_MISMATCH_MAX_RECORDS = 50;

const LINK_CODE_TTL_MS = 10 * 60 * 1000;

function createTimestamp(now = new Date()) {
  return now.toISOString();
}

function createInitialLinksData() {
  return {
    version: 1,
    isExample: false,
    description: 'Local webgame account link data for redefine discord bot MVP. JSON storage is for MVP operation only.',
    links: [],
    pendingCodes: [],
  };
}

function createInitialScoresData() {
  return {
    version: 1,
    isExample: false,
    description: 'Local webgame score submission data for redefine discord bot MVP. JSON storage is for MVP operation only.',
    scores: [],
  };
}

function createInitialSocialData() {
  return {
    version: 1,
    isExample: false,
    description: 'Local webgame anonymous cheer data for redefine discord bot MVP. JSON storage is for MVP operation only.',
    cheerSalt: crypto.randomBytes(16).toString('hex'),
    cheers: [],
  };
}

// 개인 행동 데이터(로그 원문 포함)이므로 백업 대상에 넣지 않고 커밋 금지(local) -
// docs/replay-verification-plan.md 3절.
function createInitialReplayMismatchData() {
  return {
    version: 1,
    isExample: false,
    description: 'Local webgame replay verification mismatch diagnostics for redefine discord bot MVP. Rotates to the most recent 50 records. Not for backup, not for commit.',
    records: [],
  };
}

// 예시 픽스처(*.example.json)로는 절대 폴백하지 않는다. 픽스처의 샘플 코드/토큰이
// 실데이터로 로드되면 저장소에 공개된 값으로 인증이 뚫린다 (CLAUDE.md 금기).
function loadOrCreate(primaryPath, createInitial) {
  if (fs.existsSync(primaryPath)) {
    return loadJsonFile(primaryPath);
  }

  const initialData = createInitial();
  saveJsonFile(primaryPath, initialData);
  return initialData;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function pad(value, length) {
  return String(value).padStart(length, '0');
}

// ISO 8601 주차(월요일 시작). 예: 2026-W27
function getIsoWeekKey(date = new Date()) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7; // 월요일=0 ... 일요일=6
  target.setUTCDate(target.getUTCDate() - dayNumber + 3); // 해당 주의 목요일로 이동
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const weekNumber = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${pad(weekNumber, 2)}`;
}

function getDayKey(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getDailySeed(dayKey) {
  return Number(String(dayKey).replace(/-/g, ''));
}

function generateLinkCode() {
  const code = crypto.randomInt(0, 1000000);
  return pad(code, 6);
}

function generatePlayerToken() {
  return crypto.randomUUID();
}

function requireTrimmedString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} 값이 필요합니다.`);
  }

  return value.trim();
}

function normalizeMode(mode) {
  return mode === 'daily' ? 'daily' : 'free';
}

const VALID_REPLAY_STATUSES = new Set(['verified', 'mismatch', 'missing', 'skipped']);

// 기존 레코드(replay 필드 없음)는 'missing'으로 관용 해석한다 - 비동기 소셜 때의
// mode/dayKey 확장과 동일한 하위 호환 패턴(docs/replay-verification-plan.md 3절).
function normalizeReplayStatus(replay) {
  return VALID_REPLAY_STATUSES.has(replay) ? replay : 'missing';
}

function normalizeScoreRecord(score) {
  const mode = normalizeMode(score.mode);
  return {
    ...score,
    mode,
    dayKey: mode === 'daily' && typeof score.dayKey === 'string' ? score.dayKey : null,
    replay: normalizeReplayStatus(score.replay),
  };
}

function createTargetId(cheerSalt, discordId) {
  return crypto.createHash('sha256').update(`${cheerSalt}:${discordId}`).digest('hex').slice(0, 16);
}

function createWebgameRepository(paths = {}) {
  const resolvedPaths = {
    ...DEFAULT_PATHS,
    ...paths,
  };
  if (!paths.social && paths.scores) {
    resolvedPaths.social = path.join(path.dirname(paths.scores), 'webgame-social.local.json');
  }
  if (!paths.replayMismatch && paths.scores) {
    resolvedPaths.replayMismatch = path.join(path.dirname(paths.scores), 'webgame-replay-mismatch.local.json');
  }

  function getLinksData() {
    const data = loadOrCreate(resolvedPaths.links, createInitialLinksData);
    return {
      ...createInitialLinksData(),
      ...data,
      isExample: data.isExample === true,
      links: Array.isArray(data.links) ? data.links : [],
      pendingCodes: Array.isArray(data.pendingCodes) ? data.pendingCodes : [],
    };
  }

  function saveLinksData(linksData) {
    saveJsonFile(resolvedPaths.links, {
      version: 1,
      isExample: false,
      description: linksData.description || createInitialLinksData().description,
      links: Array.isArray(linksData.links) ? linksData.links : [],
      pendingCodes: Array.isArray(linksData.pendingCodes) ? linksData.pendingCodes : [],
    });
  }

  function getScoresData() {
    const data = loadOrCreate(resolvedPaths.scores, createInitialScoresData);
    return {
      ...createInitialScoresData(),
      ...data,
      isExample: data.isExample === true,
      scores: Array.isArray(data.scores) ? data.scores : [],
    };
  }

  function saveScoresData(scoresData) {
    saveJsonFile(resolvedPaths.scores, {
      version: 1,
      isExample: false,
      description: scoresData.description || createInitialScoresData().description,
      scores: Array.isArray(scoresData.scores) ? scoresData.scores : [],
    });
  }

  function getSocialData() {
    const data = loadOrCreate(resolvedPaths.social, createInitialSocialData);
    const initial = createInitialSocialData();
    return {
      ...initial,
      ...data,
      isExample: data.isExample === true,
      cheerSalt: typeof data.cheerSalt === 'string' && data.cheerSalt ? data.cheerSalt : initial.cheerSalt,
      cheers: Array.isArray(data.cheers) ? data.cheers : [],
    };
  }

  function saveSocialData(socialData) {
    saveJsonFile(resolvedPaths.social, {
      version: 1,
      isExample: false,
      description: socialData.description || createInitialSocialData().description,
      cheerSalt: socialData.cheerSalt,
      cheers: Array.isArray(socialData.cheers) ? socialData.cheers : [],
    });
  }

  function getReplayMismatchData() {
    const data = loadOrCreate(resolvedPaths.replayMismatch, createInitialReplayMismatchData);
    return {
      ...createInitialReplayMismatchData(),
      ...data,
      isExample: data.isExample === true,
      records: Array.isArray(data.records) ? data.records : [],
    };
  }

  function saveReplayMismatchData(replayMismatchData) {
    saveJsonFile(resolvedPaths.replayMismatch, {
      version: 1,
      isExample: false,
      description: replayMismatchData.description || createInitialReplayMismatchData().description,
      records: Array.isArray(replayMismatchData.records) ? replayMismatchData.records : [],
    });
  }

  // mismatch 진단 기록 추가. 최근 REPLAY_MISMATCH_MAX_RECORDS건만 순환 보관한다.
  function appendReplayMismatch(input, now = new Date()) {
    const replayMismatchData = cloneJson(getReplayMismatchData());
    const record = {
      discordId: typeof input.discordId === 'string' ? input.discordId : null,
      gameId: typeof input.gameId === 'string' ? input.gameId : null,
      seed: input.seed !== undefined && input.seed !== null ? String(input.seed) : null,
      score: Number.isFinite(input.score) ? input.score : null,
      replayScore: Number.isFinite(input.replayScore) ? input.replayScore : null,
      reason: typeof input.reason === 'string' ? input.reason : null,
      log: input.log !== undefined ? input.log : null,
      at: createTimestamp(now),
    };

    replayMismatchData.records.push(record);
    if (replayMismatchData.records.length > REPLAY_MISMATCH_MAX_RECORDS) {
      replayMismatchData.records = replayMismatchData.records.slice(-REPLAY_MISMATCH_MAX_RECORDS);
    }
    saveReplayMismatchData(replayMismatchData);
    return record;
  }

  function findLinkByDiscordId(linksData, discordId) {
    return linksData.links.find((link) => link.discordId === discordId) || null;
  }

  function findLinkByToken(linksData, playerToken) {
    return linksData.links.find((link) => link.playerToken === playerToken) || null;
  }

  // 기존 발급 코드를 폐기하고 새 코드를 발급한다. 재실행 시 이전 코드는 자동 무효화된다.
  function issueLinkCode(input, now = new Date()) {
    const discordId = requireTrimmedString(input.discordId, 'discordId');
    const displayName = requireTrimmedString(input.displayName, 'displayName');

    const linksData = cloneJson(getLinksData());
    linksData.pendingCodes = linksData.pendingCodes.filter((entry) => entry.discordId !== discordId);

    const code = generateLinkCode();
    const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS).toISOString();
    const record = {
      code,
      discordId,
      displayName,
      expiresAt,
      createdAt: createTimestamp(now),
    };

    linksData.pendingCodes.push(record);
    saveLinksData(linksData);

    return { code, expiresAt };
  }

  // 코드 검증 -> playerToken 발급(신규 연결) 또는 재발급(기존 연결, 이전 토큰 무효화)
  function redeemLinkCode(code, now = new Date()) {
    const normalizedCode = requireTrimmedString(code, 'code');
    const linksData = cloneJson(getLinksData());
    const index = linksData.pendingCodes.findIndex((entry) => entry.code === normalizedCode);

    if (index === -1) {
      return { ok: false, reason: 'CODE_NOT_FOUND' };
    }

    const pending = linksData.pendingCodes[index];
    linksData.pendingCodes.splice(index, 1);

    if (new Date(pending.expiresAt).getTime() < now.getTime()) {
      saveLinksData(linksData);
      return { ok: false, reason: 'CODE_EXPIRED' };
    }

    const existingLinkIndex = linksData.links.findIndex((link) => link.discordId === pending.discordId);
    const playerToken = generatePlayerToken();
    const linkedAt = createTimestamp(now);
    const nextLink = {
      discordId: pending.discordId,
      displayName: pending.displayName,
      playerToken,
      linkedAt,
    };

    if (existingLinkIndex === -1) {
      linksData.links.push(nextLink);
    } else {
      linksData.links[existingLinkIndex] = nextLink;
    }

    saveLinksData(linksData);

    return { ok: true, playerToken, displayName: pending.displayName, discordId: pending.discordId };
  }

  function getLinkByToken(playerToken) {
    if (typeof playerToken !== 'string' || !playerToken.trim()) {
      return null;
    }

    const linksData = getLinksData();
    return findLinkByToken(linksData, playerToken.trim());
  }

  function getLinkByDiscordId(discordId) {
    if (typeof discordId !== 'string' || !discordId.trim()) {
      return null;
    }

    const linksData = getLinksData();
    return findLinkByDiscordId(linksData, discordId.trim());
  }

  function listRecentScores(options = {}) {
    const scoresData = getScoresData();
    let scores = scoresData.scores.slice();

    if (options.discordId) {
      scores = scores.filter((score) => score.discordId === options.discordId);
    }

    if (options.playerToken) {
      const link = getLinkByToken(options.playerToken);
      // 유효하지 않은 토큰이면 전체 목록이 아니라 빈 목록을 돌려준다 (discordId 노출 방지).
      if (!link) {
        return [];
      }
      scores = scores.filter((score) => score.discordId === link.discordId);
    }

    return scores;
  }

  function recordScore(input, now = new Date()) {
    const discordId = requireTrimmedString(input.discordId, 'discordId');
    const gameId = requireTrimmedString(input.gameId, 'gameId');

    if (!Number.isFinite(input.score)) {
      throw new Error('score 값이 필요합니다.');
    }

    const scoresData = cloneJson(getScoresData());
    const weekKey = input.weekKey || getIsoWeekKey(now);
    const mode = normalizeMode(input.mode);
    const record = {
      discordId,
      gameId,
      score: input.score,
      seed: input.seed !== undefined && input.seed !== null ? String(input.seed) : null,
      submittedAt: createTimestamp(now),
      weekKey,
      flagged: Boolean(input.flagged),
      mode,
      dayKey: mode === 'daily' ? requireTrimmedString(input.dayKey, 'dayKey') : null,
      replay: normalizeReplayStatus(input.replay),
    };

    scoresData.scores.push(record);
    saveScoresData(scoresData);

    return record;
  }

  function countRecentSubmissions(discordId, sinceMs, now = new Date()) {
    const scoresData = getScoresData();
    const threshold = now.getTime() - sinceMs;
    return scoresData.scores.filter((score) => {
      return score.discordId === discordId
        && new Date(score.submittedAt).getTime() >= threshold;
    }).length;
  }

  function getWeekBest(discordId, gameId, weekKey) {
    const scoresData = getScoresData();
    const candidates = scoresData.scores.filter((score) => {
      const normalized = normalizeScoreRecord(score);
      return normalized.discordId === discordId
        && score.gameId === gameId
        && normalized.weekKey === weekKey
        && !normalized.flagged;
    });

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((best, current) => (current.score > best.score ? current : best));
  }

  function getPreviousWeekBest(discordId, gameId, weekKey) {
    const scoresData = getScoresData();
    const candidates = scoresData.scores.filter((score) => {
      const normalized = normalizeScoreRecord(score);
      return normalized.discordId === discordId
        && score.gameId === gameId
        && normalized.weekKey < weekKey
        && !normalized.flagged;
    });

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((best, current) => (current.weekKey > best.weekKey ? current
      : current.weekKey === best.weekKey && current.score > best.score ? current : best));
  }

  function listWeeklyRanking(gameId, weekKey, options = {}) {
    const scoresData = getScoresData();
    const linksData = getLinksData();
    const displayNameByDiscordId = new Map(linksData.links.map((link) => [link.discordId, link.displayName]));
    const socialData = options.includeTargetId ? getSocialData() : null;
    const limit = Number.isInteger(options.limit) ? options.limit : 10;

    const bestByDiscordId = new Map();
    scoresData.scores.forEach((score) => {
      const normalized = normalizeScoreRecord(score);
      if (normalized.gameId !== gameId || normalized.weekKey !== weekKey || normalized.flagged) {
        return;
      }

      const current = bestByDiscordId.get(normalized.discordId);
      if (!current || normalized.score > current.score) {
        bestByDiscordId.set(normalized.discordId, normalized);
      }
    });

    const ranking = Array.from(bestByDiscordId.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((score, index) => ({
        rank: index + 1,
        discordId: score.discordId,
        displayName: displayNameByDiscordId.get(score.discordId) || '알 수 없음',
        score: score.score,
        ...(socialData ? { targetId: createTargetId(socialData.cheerSalt, score.discordId) } : {}),
      }));

    return ranking;
  }

  function getMyWeeklyRank(gameId, weekKey, discordId) {
    const scoresData = getScoresData();
    const bestByDiscordId = new Map();
    scoresData.scores.forEach((score) => {
      const normalized = normalizeScoreRecord(score);
      if (normalized.gameId !== gameId || normalized.weekKey !== weekKey || normalized.flagged) {
        return;
      }

      const current = bestByDiscordId.get(normalized.discordId);
      if (!current || normalized.score > current.score) {
        bestByDiscordId.set(normalized.discordId, normalized);
      }
    });

    const sorted = Array.from(bestByDiscordId.entries())
      .sort((left, right) => right[1].score - left[1].score);
    const index = sorted.findIndex(([id]) => id === discordId);

    if (index === -1) {
      return null;
    }

    return { rank: index + 1, score: sorted[index][1].score };
  }

  function listDailyRanking(gameId, dayKey, options = {}) {
    const scoresData = getScoresData();
    const linksData = getLinksData();
    const socialData = options.includeTargetId ? getSocialData() : null;
    const displayNameByDiscordId = new Map(linksData.links.map((link) => [link.discordId, link.displayName]));
    const limit = Number.isInteger(options.limit) ? options.limit : 10;

    const bestByDiscordId = new Map();
    scoresData.scores.forEach((score) => {
      const normalized = normalizeScoreRecord(score);
      if (
        normalized.gameId !== gameId
        || normalized.mode !== 'daily'
        || normalized.dayKey !== dayKey
        || normalized.flagged
      ) {
        return;
      }

      const current = bestByDiscordId.get(normalized.discordId);
      if (!current || normalized.score > current.score) {
        bestByDiscordId.set(normalized.discordId, normalized);
      }
    });

    return Array.from(bestByDiscordId.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((score, index) => ({
        rank: index + 1,
        discordId: score.discordId,
        displayName: displayNameByDiscordId.get(score.discordId) || '알 수 없음',
        score: score.score,
        ...(socialData ? { targetId: createTargetId(socialData.cheerSalt, score.discordId) } : {}),
      }));
  }

  function getMyDailyRank(gameId, dayKey, discordId) {
    const scoresData = getScoresData();
    const bestByDiscordId = new Map();
    scoresData.scores.forEach((score) => {
      const normalized = normalizeScoreRecord(score);
      if (
        normalized.gameId !== gameId
        || normalized.mode !== 'daily'
        || normalized.dayKey !== dayKey
        || normalized.flagged
      ) {
        return;
      }

      const current = bestByDiscordId.get(normalized.discordId);
      if (!current || normalized.score > current.score) {
        bestByDiscordId.set(normalized.discordId, normalized);
      }
    });

    const sorted = Array.from(bestByDiscordId.entries())
      .sort((left, right) => right[1].score - left[1].score);
    const index = sorted.findIndex(([id]) => id === discordId);

    if (index === -1) {
      return null;
    }

    return { rank: index + 1, score: sorted[index][1].score };
  }

  function getDailyBest(discordId, gameId, dayKey) {
    const scoresData = getScoresData();
    const candidates = scoresData.scores
      .map(normalizeScoreRecord)
      .filter((score) => {
        return score.discordId === discordId
          && score.gameId === gameId
          && score.mode === 'daily'
          && score.dayKey === dayKey
          && !score.flagged;
      });

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((best, current) => (current.score > best.score ? current : best));
  }

  function countDailyParticipants(gameId, dayKey) {
    const scoresData = getScoresData();
    const participants = new Set();
    scoresData.scores.forEach((score) => {
      const normalized = normalizeScoreRecord(score);
      if (
        normalized.gameId === gameId
        && normalized.mode === 'daily'
        && normalized.dayKey === dayKey
        && !normalized.flagged
      ) {
        participants.add(normalized.discordId);
      }
    });
    return participants.size;
  }

  function getDailyResultDistribution(gameId, dayKey) {
    const scoresData = getScoresData();
    const bestByDiscordId = new Map();
    scoresData.scores.map(normalizeScoreRecord).forEach((score) => {
      if (
        score.gameId !== gameId
        || score.mode !== 'daily'
        || score.dayKey !== dayKey
        || score.flagged
      ) {
        return;
      }

      const current = bestByDiscordId.get(score.discordId);
      if (!current || score.score > current.score) {
        bestByDiscordId.set(score.discordId, score);
      }
    });

    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
    };
    bestByDiscordId.forEach((score) => {
      if (Number.isInteger(score.score) && score.score >= 1 && score.score <= 6) {
        distribution[String(7 - score.score)] += 1;
      }
    });

    return {
      participants: bestByDiscordId.size,
      distribution,
    };
  }

  function getCommunalGoalProgress(weekKey) {
    const scoresData = getScoresData();
    const currentByDiscordId = new Map();
    const previousMaxByDiscordId = new Map();

    scoresData.scores.map(normalizeScoreRecord).forEach((score) => {
      if (score.gameId !== 'idle' || score.flagged) {
        return;
      }

      if (score.weekKey === weekKey) {
        const entry = currentByDiscordId.get(score.discordId) || { min: score.score, max: score.score };
        entry.min = Math.min(entry.min, score.score);
        entry.max = Math.max(entry.max, score.score);
        currentByDiscordId.set(score.discordId, entry);
        return;
      }

      if (score.weekKey < weekKey) {
        const currentMax = previousMaxByDiscordId.get(score.discordId);
        if (currentMax === undefined || score.score > currentMax) {
          previousMaxByDiscordId.set(score.discordId, score.score);
        }
      }
    });

    const contributions = new Map();
    let total = 0;
    currentByDiscordId.forEach((current, discordId) => {
      const baseline = previousMaxByDiscordId.has(discordId)
        ? previousMaxByDiscordId.get(discordId)
        : current.min;
      const contribution = Math.max(0, current.max - baseline);
      contributions.set(discordId, contribution);
      total += contribution;
    });

    return {
      weekKey,
      total,
      participants: currentByDiscordId.size,
      contributions,
    };
  }

  function addCheer(input, now = new Date()) {
    const fromDiscordId = requireTrimmedString(input.fromDiscordId, 'fromDiscordId');
    const targetDiscordId = requireTrimmedString(input.targetDiscordId, 'targetDiscordId');
    const gameId = requireTrimmedString(input.gameId, 'gameId');
    const periodKey = requireTrimmedString(input.periodKey, 'periodKey');
    const socialData = cloneJson(getSocialData());

    const duplicated = socialData.cheers.some((cheer) => {
      return cheer.fromDiscordId === fromDiscordId
        && cheer.targetDiscordId === targetDiscordId
        && cheer.gameId === gameId
        && cheer.periodKey === periodKey;
    });

    if (duplicated) {
      return { ok: false, reason: 'ALREADY_CHEERED' };
    }

    socialData.cheers.push({
      fromDiscordId,
      targetDiscordId,
      gameId,
      periodKey,
      createdAt: createTimestamp(now),
    });
    saveSocialData(socialData);
    return { ok: true };
  }

  function countCheers(gameId, periodKey) {
    const socialData = getSocialData();
    const counts = new Map();
    socialData.cheers.forEach((cheer) => {
      if (cheer.gameId !== gameId || cheer.periodKey !== periodKey) {
        return;
      }
      counts.set(cheer.targetDiscordId, (counts.get(cheer.targetDiscordId) || 0) + 1);
    });
    return counts;
  }

  function countCheersSentToday(fromDiscordId, dayKey) {
    const socialData = getSocialData();
    return socialData.cheers.filter((cheer) => {
      return cheer.fromDiscordId === fromDiscordId
        && cheer.createdAt
        && getDayKey(new Date(cheer.createdAt)) === dayKey;
    }).length;
  }

  function resolveTargetId(targetId) {
    if (typeof targetId !== 'string' || !targetId.trim()) {
      return null;
    }

    const normalizedTargetId = targetId.trim();
    const linksData = getLinksData();
    const socialData = getSocialData();
    return linksData.links.find((link) => {
      return createTargetId(socialData.cheerSalt, link.discordId) === normalizedTargetId;
    }) || null;
  }

  function getTargetId(discordId) {
    const socialData = getSocialData();
    return createTargetId(socialData.cheerSalt, discordId);
  }

  // 이번 주(weekKey) replay 상태별 건수 - admin 대시보드 카드용(계획서 5절).
  function countReplayStatusesForWeek(weekKey) {
    const scoresData = getScoresData();
    const counts = { verified: 0, mismatch: 0, missing: 0 };
    scoresData.scores.map(normalizeScoreRecord).forEach((score) => {
      if (score.weekKey !== weekKey || score.replay === 'skipped') {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(counts, score.replay)) {
        counts[score.replay] += 1;
      }
    });
    return counts;
  }

  // admin 표시용 mismatch 메타 목록(로그 원문은 노출하지 않는다 - 계획서 5절).
  function listRecentMismatches(limit = 10) {
    const replayMismatchData = getReplayMismatchData();
    const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 10;
    return replayMismatchData.records
      .slice()
      .reverse()
      .slice(0, safeLimit)
      .map((record) => ({
        discordId: record.discordId,
        gameId: record.gameId,
        score: record.score,
        replayScore: record.replayScore,
        reason: record.reason,
        at: record.at,
      }));
  }

  return {
    issueLinkCode,
    redeemLinkCode,
    getLinkByToken,
    getLinkByDiscordId,
    listRecentScores,
    recordScore,
    countRecentSubmissions,
    getWeekBest,
    getPreviousWeekBest,
    listWeeklyRanking,
    getMyWeeklyRank,
    listDailyRanking,
    getMyDailyRank,
    getDailyBest,
    countDailyParticipants,
    getDailyResultDistribution,
    getCommunalGoalProgress,
    addCheer,
    countCheers,
    countCheersSentToday,
    resolveTargetId,
    getTargetId,
    appendReplayMismatch,
    countReplayStatusesForWeek,
    listRecentMismatches,
    getLinksData,
    getScoresData,
    getSocialData,
    getReplayMismatchData,
  };
}

module.exports = {
  createWebgameRepository,
  getIsoWeekKey,
  getDayKey,
  getDailySeed,
  LINK_CODE_TTL_MS,
  REPLAY_MISMATCH_MAX_RECORDS,
};
