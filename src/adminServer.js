const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { createPointsRepository } = require('./pointsRepository');
const { requireAdminAuth, isAdminAuthConfigured } = require('./adminAuth');
const {
  buildAdminSummary,
  listMissionStatus,
  listPendingRedemptions,
  listPendingSubmissions,
  listRecentPointTransactions,
  listRecentReactionApprovals,
  listShopItemStatus,
  parseLimit,
} = require('./adminApi');

const ADMIN_PUBLIC_DIR = path.join(__dirname, '..', 'public', 'admin');

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
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

function serveAdminAsset(req, res, pathname) {
  if (!requireAdminAuth(req, res)) {
    return;
  }

  const filePath = resolveAdminAsset(pathname);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendNotFound(res);
    return;
  }

  const ext = path.extname(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
}

function handleAdminApi(req, res, pathname, searchParams, repository) {
  if (!requireAdminAuth(req, res)) {
    return;
  }

  try {
    const limit = parseLimit(searchParams.get('limit'), 10);

    if (pathname === '/api/admin/summary') {
      sendJson(res, 200, buildAdminSummary(repository));
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

    sendNotFound(res);
  } catch (error) {
    sendJson(res, 500, {
      error: 'ADMIN_API_ERROR',
      message: '관리자 데이터를 불러오지 못했습니다.',
    });
  }
}

function createAdminRequestHandler(repository) {
  return (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (requestUrl.pathname === '/health') {
      sendJson(res, 200, { ok: true, adminDashboardEnabled: true });
      return;
    }

    if (requestUrl.pathname.startsWith('/api/admin/')) {
      handleAdminApi(req, res, requestUrl.pathname, requestUrl.searchParams, repository);
      return;
    }

    if (requestUrl.pathname === '/admin' || requestUrl.pathname.startsWith('/admin/')) {
      serveAdminAsset(req, res, requestUrl.pathname);
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
  const port = options.port || getAdminDashboardPort();
  const server = http.createServer(createAdminRequestHandler(repository));

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
