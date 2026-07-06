const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { createPointsRepository } = require('./pointsRepository');
const { requireAdminAuth, isAdminAuthConfigured } = require('./adminAuth');
const { createWebgameApi } = require('./webgameApi');
const { createWebgameRepository } = require('./webgameRepository');
const {
  buildAdminSummary,
  buildFaqCandidateQueue,
  buildFirstDayCheck,
  buildOnboardingSignals,
  buildReactionFollowUpQueue,
  buildTodayOperationsQueue,
  buildWebgameOperationsSummary,
  listMissionStatus,
  listPendingRedemptions,
  listPendingSubmissions,
  listRecentDmChatMessages,
  listRecentPointTransactions,
  listRecentReactionApprovals,
  listShopItemStatus,
  parseLimit,
} = require('./adminApi');

const ADMIN_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'admin');
const DUNGEONWORLD_SURVIVORS_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'dungeonworld-survivors');
const MATCH3_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'match3');
const IDLE_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'idle');
const DECK_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'deck');
const WORD_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'word');
const SHARED_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'shared');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
};

function isAdminDashboardEnabled() {
  return process.env.ADMIN_DASHBOARD_ENABLED === 'true' && isAdminAuthConfigured();
}

function getAdminDashboardPort() {
  return Number(process.env.PORT || process.env.ADMIN_DASHBOARD_PORT || 3000);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function sendNotFound(res) {
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
}

function resolveAdminAsset(pathname) {
  const relativePath = pathname === '/admin' || pathname === '/admin/'
    ? 'index.html'
    : pathname.replace(/^\/admin\//, '');
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ADMIN_PUBLIC_DIR, normalized);

  if (!filePath.startsWith(ADMIN_PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

function resolveDungeonworldSurvivorsAsset(pathname) {
  const relativePath = pathname === '/game/dungeonworld-survivors' || pathname === '/game/dungeonworld-survivors/'
    ? 'index.html'
    : pathname.replace(/^\/game\/dungeonworld-survivors\//, '');
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(DUNGEONWORLD_SURVIVORS_PUBLIC_DIR, normalized);

  if (!filePath.startsWith(DUNGEONWORLD_SURVIVORS_PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

function resolveMatch3Asset(pathname) {
  const relativePath = pathname === '/game/match3' || pathname === '/game/match3/'
    ? 'index.html'
    : pathname.replace(/^\/game\/match3\//, '');
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(MATCH3_PUBLIC_DIR, normalized);

  if (!filePath.startsWith(MATCH3_PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

function resolveIdleAsset(pathname) {
  const relativePath = pathname === '/game/idle' || pathname === '/game/idle/'
    ? 'index.html'
    : pathname.replace(/^\/game\/idle\//, '');
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(IDLE_PUBLIC_DIR, normalized);

  if (!filePath.startsWith(IDLE_PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

function resolveDeckAsset(pathname) {
  const relativePath = pathname === '/game/deck' || pathname === '/game/deck/'
    ? 'index.html'
    : pathname.replace(/^\/game\/deck\//, '');
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(DECK_PUBLIC_DIR, normalized);

  if (!filePath.startsWith(DECK_PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

function resolveWordAsset(pathname) {
  const relativePath = pathname === '/game/word' || pathname === '/game/word/'
    ? 'index.html'
    : pathname.replace(/^\/game\/word\//, '');
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(WORD_PUBLIC_DIR, normalized);

  if (!filePath.startsWith(WORD_PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

function resolveSharedAsset(pathname) {
  const relativePath = pathname.replace(/^\/game\/shared\//, '');
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(SHARED_PUBLIC_DIR, normalized);

  if (!filePath.startsWith(SHARED_PUBLIC_DIR)) {
    return null;
  }

  return filePath;
}

function servePublicAsset(res, filePath) {
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendNotFound(res);
    return;
  }

  const ext = path.extname(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
}

function serveAdminAsset(req, res, pathname) {
  if (!requireAdminAuth(req, res)) {
    return;
  }

  servePublicAsset(res, resolveAdminAsset(pathname));
}

function serveDungeonworldSurvivorsAsset(res, pathname) {
  servePublicAsset(res, resolveDungeonworldSurvivorsAsset(pathname));
}

function serveMatch3Asset(res, pathname) {
  servePublicAsset(res, resolveMatch3Asset(pathname));
}

function serveIdleAsset(res, pathname) {
  servePublicAsset(res, resolveIdleAsset(pathname));
}

function serveDeckAsset(res, pathname) {
  servePublicAsset(res, resolveDeckAsset(pathname));
}

function serveWordAsset(res, pathname) {
  servePublicAsset(res, resolveWordAsset(pathname));
}

function serveSharedAsset(res, pathname) {
  servePublicAsset(res, resolveSharedAsset(pathname));
}

function handleAdminApi(req, res, pathname, searchParams, repository, webgameRepository) {
  if (!requireAdminAuth(req, res)) {
    return;
  }

  try {
    const limit = parseLimit(searchParams.get('limit'), 10);

    if (pathname === '/api/admin/webgames') {
      sendJson(res, 200, buildWebgameOperationsSummary(webgameRepository, {
        limit,
        weekKey: searchParams.get('weekKey') || undefined,
        dayKey: searchParams.get('dayKey') || undefined,
      }));
      return;
    }

    if (pathname === '/api/admin/summary') {
      sendJson(res, 200, buildAdminSummary(repository));
      return;
    }

    if (pathname === '/api/admin/today-queue') {
      sendJson(res, 200, buildTodayOperationsQueue(repository, limit));
      return;
    }

    if (pathname === '/api/admin/first-day-check') {
      sendJson(res, 200, buildFirstDayCheck(repository, { limit }));
      return;
    }

    if (pathname === '/api/admin/reaction-follow-ups') {
      sendJson(res, 200, buildReactionFollowUpQueue(repository, limit));
      return;
    }

    if (pathname === '/api/admin/onboarding-signals') {
      sendJson(res, 200, buildOnboardingSignals(repository, limit));
      return;
    }

    if (pathname === '/api/admin/faq-candidates') {
      sendJson(res, 200, buildFaqCandidateQueue(repository, limit));
      return;
    }

    if (pathname === '/api/admin/redemptions') {
      sendJson(res, 200, listPendingRedemptions(repository, limit));
      return;
    }

    if (pathname === '/api/admin/submissions') {
      sendJson(res, 200, listPendingSubmissions(repository, limit));
      return;
    }

    if (pathname === '/api/admin/point-transactions') {
      sendJson(res, 200, listRecentPointTransactions(repository, limit));
      return;
    }

    if (pathname === '/api/admin/missions') {
      sendJson(res, 200, listMissionStatus(repository, limit));
      return;
    }

    if (pathname === '/api/admin/shop-items') {
      sendJson(res, 200, listShopItemStatus(repository, limit));
      return;
    }

    if (pathname === '/api/admin/reaction-approvals') {
      sendJson(res, 200, listRecentReactionApprovals(repository, limit));
      return;
    }

    if (pathname === '/api/admin/dm-chat-logs') {
      sendJson(res, 200, listRecentDmChatMessages(null, {
        limit,
        userId: searchParams.get('userId'),
        safetyOnly: searchParams.get('safetyOnly'),
      }));
      return;
    }

    sendNotFound(res);
  } catch (error) {
    sendJson(res, 500, {
      error: 'ADMIN_API_ERROR',
      message: '관리자 데이터를 불러오지 못했습니다.',
    });
  }
}

function handleWebgameApiError(res, sendJson) {
  sendJson(res, 500, {
    error: 'WEBGAME_API_ERROR',
    message: '요청을 처리하지 못했어요.',
  });
}

async function handleWebgameApi(req, res, pathname, searchParams, webgameApi) {
  try {
    if (pathname === '/game/api/link' && req.method === 'POST') {
      await webgameApi.handleLink(req, res, sendJson);
      return;
    }

    if (pathname === '/game/api/score' && req.method === 'POST') {
      await webgameApi.handleScore(req, res, sendJson);
      return;
    }

    if (pathname === '/game/api/word/guess' && req.method === 'POST') {
      await webgameApi.handleWordGuess(req, res, sendJson);
      return;
    }

    if (pathname === '/game/api/rankings' && req.method === 'GET') {
      await webgameApi.handleRankings(req, res, sendJson, searchParams);
      return;
    }

    if (pathname === '/game/api/daily' && req.method === 'GET') {
      await webgameApi.handleDaily(req, res, sendJson, searchParams);
      return;
    }

    if (pathname === '/game/api/goal' && req.method === 'GET') {
      await webgameApi.handleGoal(req, res, sendJson);
      return;
    }

    if (pathname === '/game/api/cheer' && req.method === 'POST') {
      await webgameApi.handleCheer(req, res, sendJson);
      return;
    }

    if (pathname === '/game/api/me' && req.method === 'GET') {
      await webgameApi.handleMe(req, res, sendJson);
      return;
    }

    sendNotFound(res);
  } catch (error) {
    handleWebgameApiError(res, sendJson);
  }
}

function createAdminRequestHandler(repository, webgameApi, webgameRepository) {
  const resolvedWebgameRepository = webgameRepository || createWebgameRepository();

  return (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (requestUrl.pathname === '/health') {
      sendJson(res, 200, { ok: true, adminDashboardEnabled: true });
      return;
    }

    if (requestUrl.pathname.startsWith('/api/admin/')) {
      handleAdminApi(req, res, requestUrl.pathname, requestUrl.searchParams, repository, resolvedWebgameRepository);
      return;
    }

    if (requestUrl.pathname.startsWith('/game/api/')) {
      handleWebgameApi(req, res, requestUrl.pathname, requestUrl.searchParams, webgameApi);
      return;
    }

    if (requestUrl.pathname === '/admin' || requestUrl.pathname.startsWith('/admin/')) {
      serveAdminAsset(req, res, requestUrl.pathname);
      return;
    }

    if (
      requestUrl.pathname === '/game/dungeonworld-survivors'
      || requestUrl.pathname.startsWith('/game/dungeonworld-survivors/')
    ) {
      serveDungeonworldSurvivorsAsset(res, requestUrl.pathname);
      return;
    }

    if (
      requestUrl.pathname === '/game/match3'
      || requestUrl.pathname.startsWith('/game/match3/')
    ) {
      serveMatch3Asset(res, requestUrl.pathname);
      return;
    }

    if (
      requestUrl.pathname === '/game/idle'
      || requestUrl.pathname.startsWith('/game/idle/')
    ) {
      serveIdleAsset(res, requestUrl.pathname);
      return;
    }

    if (
      requestUrl.pathname === '/game/deck'
      || requestUrl.pathname.startsWith('/game/deck/')
    ) {
      serveDeckAsset(res, requestUrl.pathname);
      return;
    }

    if (
      requestUrl.pathname === '/game/word'
      || requestUrl.pathname.startsWith('/game/word/')
    ) {
      serveWordAsset(res, requestUrl.pathname);
      return;
    }

    if (requestUrl.pathname.startsWith('/game/shared/')) {
      serveSharedAsset(res, requestUrl.pathname);
      return;
    }

    sendNotFound(res);
  };
}

function startAdminServer(options = {}) {
  if (!isAdminDashboardEnabled()) {
    return null;
  }

  const repository = options.repository || createPointsRepository();
  const webgameRepository = options.webgameRepository || createWebgameRepository();
  const webgameApi = options.webgameApi || createWebgameApi({
    repository: webgameRepository,
    now: options.now,
  });
  const port = options.port || getAdminDashboardPort();
  const server = http.createServer(createAdminRequestHandler(repository, webgameApi, webgameRepository));

  server.on('error', (error) => {
    console.warn('관리자 대시보드 서버 시작 실패:', error.message);
  });

  try {
    server.listen(port, () => {
      console.log(`관리자 대시보드가 /admin 경로에서 활성화됐어요. port=${port}`);
    });
  } catch (error) {
    console.warn('관리자 대시보드 서버 시작 실패:', error.message);
    return null;
  }

  return server;
}

module.exports = {
  createAdminRequestHandler,
  getAdminDashboardPort,
  isAdminDashboardEnabled,
  startAdminServer,
};
