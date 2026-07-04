const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadJsonFile, saveJsonFile } = require('./pointsStore');

const DATA_DIR = path.join(__dirname, '..', 'data');

const DEFAULT_PATHS = {
  links: process.env.WEBGAME_LINKS_DATA_PATH || path.join(DATA_DIR, 'webgame-links.local.json'),
  linksFallback: path.join(DATA_DIR, 'webgame-links.example.json'),
  scores: process.env.WEBGAME_SCORES_DATA_PATH || path.join(DATA_DIR, 'webgame-scores.local.json'),
  scoresFallback: path.join(DATA_DIR, 'webgame-scores.example.json'),
};

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

function loadWithFallback(primaryPath, fallbackPath, createInitial) {
  if (fs.existsSync(primaryPath)) {
    return loadJsonFile(primaryPath);
  }

  if (fs.existsSync(fallbackPath)) {
    return loadJsonFile(fallbackPath);
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

function createWebgameRepository(paths = {}) {
  const resolvedPaths = {
    ...DEFAULT_PATHS,
    ...paths,
  };

  function getLinksData() {
    const data = loadWithFallback(resolvedPaths.links, resolvedPaths.linksFallback, createInitialLinksData);
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
    const data = loadWithFallback(resolvedPaths.scores, resolvedPaths.scoresFallback, createInitialScoresData);
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
      if (link) {
        scores = scores.filter((score) => score.discordId === link.discordId);
      }
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
    const record = {
      discordId,
      gameId,
      score: input.score,
      seed: input.seed !== undefined && input.seed !== null ? String(input.seed) : null,
      submittedAt: createTimestamp(now),
      weekKey,
      flagged: Boolean(input.flagged),
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
      return score.discordId === discordId
        && score.gameId === gameId
        && score.weekKey === weekKey
        && !score.flagged;
    });

    if (candidates.length === 0) {
      return null;
    }

    return candidates.reduce((best, current) => (current.score > best.score ? current : best));
  }

  function getPreviousWeekBest(discordId, gameId, weekKey) {
    const scoresData = getScoresData();
    const candidates = scoresData.scores.filter((score) => {
      return score.discordId === discordId
        && score.gameId === gameId
        && score.weekKey < weekKey
        && !score.flagged;
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
    const limit = Number.isInteger(options.limit) ? options.limit : 10;

    const bestByDiscordId = new Map();
    scoresData.scores.forEach((score) => {
      if (score.gameId !== gameId || score.weekKey !== weekKey || score.flagged) {
        return;
      }

      const current = bestByDiscordId.get(score.discordId);
      if (!current || score.score > current.score) {
        bestByDiscordId.set(score.discordId, score);
      }
    });

    const ranking = Array.from(bestByDiscordId.values())
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((score, index) => ({
        rank: index + 1,
        displayName: displayNameByDiscordId.get(score.discordId) || '알 수 없음',
        score: score.score,
      }));

    return ranking;
  }

  function getMyWeeklyRank(gameId, weekKey, discordId) {
    const scoresData = getScoresData();
    const bestByDiscordId = new Map();
    scoresData.scores.forEach((score) => {
      if (score.gameId !== gameId || score.weekKey !== weekKey || score.flagged) {
        return;
      }

      const current = bestByDiscordId.get(score.discordId);
      if (!current || score.score > current.score) {
        bestByDiscordId.set(score.discordId, score);
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
    getLinksData,
    getScoresData,
  };
}

module.exports = {
  createWebgameRepository,
  getIsoWeekKey,
  LINK_CODE_TTL_MS,
};
