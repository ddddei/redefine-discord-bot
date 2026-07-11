const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');
const { createPointsRepository } = require('./pointsRepository');
const { requireAdminAuth, isAdminAuthConfigured, parseBasicAuthHeader, safeCompareSecret } = require('./adminAuth');
const { createAdminAudit } = require('./adminAudit');
const { isExampleLikeRecord, isExampleLikeValue } = require('./operationalRecords');
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
  listDmSafetyReviews,
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
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function isAdminWriteEnabled() {
  return String(process.env.ADMIN_WRITE_ENABLED || '').trim().toLowerCase() === 'true';
}

function getWriteCapabilities() {
  const writeConfigured = String(process.env.ADMIN_WRITE_TOKEN || '').trim().length > 0;
  return {
    writeEnabled: isAdminWriteEnabled() && writeConfigured,
    writeConfigured,
    writeTokenRequired: true,
  };
}

function requireWriteAccess(req, res) {
  if (!isAdminWriteEnabled()) {
    sendJson(res, 403, { error: 'WRITE_DISABLED', message: '쓰기 기능이 비활성화되어 있습니다.' });
    return false;
  }
  const expected = String(process.env.ADMIN_WRITE_TOKEN || '').trim();
  if (!expected) {
    sendJson(res, 503, { error: 'WRITE_TOKEN_NOT_CONFIGURED', message: '쓰기 토큰이 설정되지 않았습니다.' });
    return false;
  }
  const supplied = req.headers['x-admin-write-token'];
  if (!safeCompareSecret(supplied, expected)) {
    sendJson(res, 403, { error: 'INVALID_WRITE_TOKEN', message: '쓰기 토큰이 올바르지 않습니다.' });
    return false;
  }
  return true;
}

function readJsonBody(req, maxBytes = 32 * 1024) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') {
      reject(Object.assign(new Error('JSON Content-Type이 필요합니다.'), { statusCode: 415, code: 'UNSUPPORTED_MEDIA_TYPE' }));
      return;
    }
    let size = 0;
    const chunks = [];
    let rejected = false;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        if (!rejected) {
          rejected = true;
          reject(Object.assign(new Error('요청 본문이 너무 큽니다.'), { statusCode: 413, code: 'PAYLOAD_TOO_LARGE' }));
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error) {
        reject(Object.assign(new Error('JSON 형식이 올바르지 않습니다.'), { statusCode: 400, code: 'INVALID_JSON' }));
      }
    });
    req.on('error', reject);
  });
}

function adminError(statusCode, code, message, extra = {}) {
  return Object.assign(new Error(message), { statusCode, code, extra });
}

function normalizeMutationError(error) {
  if (error.statusCode) return error;
  if (error.message === '포인트 잔액이 부족해 차감할 수 없습니다.') {
    return adminError(400, 'INSUFFICIENT_BALANCE', error.message);
  }
  return adminError(500, 'MUTATION_FAILED', '운영 데이터를 변경하지 못했습니다. 현재 상태를 확인해 주세요.');
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

function findRedemption(repository, id) {
  const state = repository.loadState();
  return (state.redemptionsData.redemptions || []).find((row) => row.id === id) || null;
}

function requireString(value, field, required = true) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && !result) throw adminError(400, 'INVALID_INPUT', `${field} 값이 필요합니다.`);
  return result;
}

function rejectExampleTarget(record, targetId) {
  if ((record && isExampleLikeRecord(record)) || isExampleLikeValue(targetId, 'id')) {
    throw adminError(404, 'NOT_FOUND', '운영 대상을 찾을 수 없습니다.');
  }
}

async function performAdminWrite(req, res, pathname, repository, options = {}) {
  if (!requireWriteAccess(req, res)) return;

  const routes = [
    { match: pathname.match(/^\/api\/admin\/redemptions\/([^/]+)\/status$/), action: 'redemption.status', type: 'redemption' },
    { match: pathname.match(/^\/api\/admin\/submissions\/([^/]+)\/decision$/), action: 'submission.decision', type: 'submission' },
    { match: pathname === '/api/admin/points/adjust' ? ['', 'points'] : null, action: 'points.adjust', type: 'user' },
    { match: pathname.match(/^\/api\/admin\/missions\/([^/]+)\/status$/), action: 'mission.status', type: 'mission' },
    { match: pathname.match(/^\/api\/admin\/shop-items\/([^/]+)\/status$/), action: 'shop-item.status', type: 'shopItem' },
  ];
  const route = routes.find((candidate) => candidate.match);
  if (!route) {
    sendNotFound(res);
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    sendJson(res, error.statusCode || 400, { error: error.code || 'INVALID_REQUEST', message: error.message });
    return;
  }

  let targetId;
  try {
    targetId = decodeURIComponent(route.match[1] || body.discordId || '');
  } catch (error) {
    sendJson(res, 400, { error: 'INVALID_TARGET_ID', message: '대상 ID 형식이 올바르지 않습니다.' });
    return;
  }
  const actor = (parseBasicAuthHeader(req) || {}).username || 'admin-console';
  const audit = options.audit || createAdminAudit();
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const auditBase = { action: route.action, targetType: route.type, targetId, reason, actor };

  try {
    audit.appendAuditEntry({ ...auditBase, result: 'attempt' });
  } catch (error) {
    sendJson(res, 503, { error: 'AUDIT_UNAVAILABLE', message: '감사 로그를 기록할 수 없어 변경하지 않았습니다.' });
    return;
  }

  try {
    let result;
    if (route.action === 'redemption.status') {
      const status = requireString(body.status, 'status');
      if (!['complete', 'cancel', 'refund'].includes(status)) throw adminError(400, 'INVALID_STATUS', '지원하지 않는 교환 상태입니다.');
      const current = findRedemption(repository, targetId);
      if (!current) throw adminError(404, 'NOT_FOUND', '교환 신청을 찾을 수 없습니다.');
      rejectExampleTarget(current, targetId);
      if ((status !== 'refund' && current.status !== 'pending') || (status === 'refund' && current.status !== 'cancelled')) {
        throw adminError(409, 'ALREADY_PROCESSED', '이미 처리되었거나 현재 상태에서 처리할 수 없습니다.', { currentStatus: current.status });
      }
      result = repository.reviewRedemption({ redemptionId: targetId, action: status, note: reason || undefined, operatorId: actor });
    } else if (route.action === 'submission.decision') {
      const decision = requireString(body.decision, 'decision');
      if (!['approve', 'reject'].includes(decision)) throw adminError(400, 'INVALID_DECISION', '지원하지 않는 인증 결정입니다.');
      if (decision === 'reject' && !reason) throw adminError(400, 'REASON_REQUIRED', '반려 사유가 필요합니다.');
      const current = repository.findSubmission(targetId);
      if (!current) throw adminError(404, 'NOT_FOUND', '인증 제출을 찾을 수 없습니다.');
      rejectExampleTarget(current, targetId);
      if (current.status !== 'pending') throw adminError(409, 'ALREADY_PROCESSED', '이미 처리된 인증 제출입니다.', { currentStatus: current.status });
      const reviewer = { userId: actor, displayName: actor };
      result = decision === 'approve'
        ? repository.approveSubmissionById(targetId, reviewer, reason || undefined)
        : repository.rejectSubmissionById(targetId, reviewer, reason);
    } else if (route.action === 'points.adjust') {
      const discordId = requireString(body.discordId, 'discordId');
      rejectExampleTarget(null, discordId);
      const adjustmentReason = requireString(body.reason, 'reason');
      if (!Number.isInteger(body.amount) || body.amount === 0) throw adminError(400, 'INVALID_AMOUNT', 'amount는 0이 아닌 정수여야 합니다.');
      result = repository.adjustUserPoints({
        user: { userId: discordId, displayName: requireString(body.displayName, 'displayName', false) || discordId },
        amount: body.amount,
        reason: adjustmentReason,
        note: requireString(body.note, 'note', false) || undefined,
        operatorId: actor,
      });
    } else if (route.action === 'mission.status') {
      const status = requireString(body.status, 'status');
      if (!['draft', 'active', 'paused', 'closed', 'archived'].includes(status)) throw adminError(400, 'INVALID_STATUS', '지원하지 않는 미션 상태입니다.');
      const current = repository.findMission(targetId);
      if (!current) throw adminError(404, 'NOT_FOUND', '미션을 찾을 수 없습니다.');
      rejectExampleTarget(current, targetId);
      if (current.status === status) throw adminError(409, 'ALREADY_PROCESSED', '이미 같은 상태입니다.', { currentStatus: current.status });
      result = repository.setMissionStatus(targetId, status);
    } else {
      const status = requireString(body.status, 'status');
      if (!['active', 'paused', 'soldOut', 'hidden'].includes(status)) throw adminError(400, 'INVALID_STATUS', '지원하지 않는 상점 항목 상태입니다.');
      const current = repository.findShopItem(targetId);
      if (!current) throw adminError(404, 'NOT_FOUND', '상점 항목을 찾을 수 없습니다.');
      rejectExampleTarget(current, targetId);
      if (current.status === status) throw adminError(409, 'ALREADY_PROCESSED', '이미 같은 상태입니다.', { currentStatus: current.status });
      result = repository.setShopItemStatus(targetId, status);
    }

    try { audit.appendAuditEntry({ ...auditBase, result: 'success' }); } catch (error) { console.warn('관리자 감사 결과 기록 실패:', error.message); }
    if (typeof options.notifyAdminWrite === 'function') {
      Promise.resolve(options.notifyAdminWrite({ ...auditBase, result: 'success' })).catch((error) => console.warn('관리자 처리 알림 실패:', error.message));
    }
    sendJson(res, 200, { ok: true, result });
  } catch (caughtError) {
    const error = normalizeMutationError(caughtError);
    const statusCode = error.statusCode;
    const code = error.code;
    try { audit.appendAuditEntry({ ...auditBase, result: 'rejected', errorCode: code }); } catch (auditError) { console.warn('관리자 감사 거부 기록 실패:', auditError.message); }
    sendJson(res, statusCode, { error: code, message: error.message, ...(error.extra || {}) });
  }
}

async function handleAdminApi(req, res, pathname, searchParams, repository, webgameRepository, options = {}) {
  if (!requireAdminAuth(req, res)) {
    return;
  }

  try {
    if (pathname === '/api/admin/capabilities' && req.method === 'GET') {
      sendJson(res, 200, getWriteCapabilities());
      return;
    }

    if (req.method === 'POST') {
      await performAdminWrite(req, res, pathname, repository, options);
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: '지원하지 않는 요청 방식입니다.' });
      return;
    }

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

    if (pathname === '/api/admin/dm-safety-reviews') {
      sendJson(res, 200, listDmSafetyReviews(null, limit));
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

function createAdminRequestHandler(repository, webgameApi, webgameRepository, options = {}) {
  const resolvedWebgameRepository = webgameRepository || createWebgameRepository();

  return (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (requestUrl.pathname === '/health') {
      sendJson(res, 200, { ok: true, adminDashboardEnabled: true });
      return;
    }

    if (requestUrl.pathname.startsWith('/api/admin/')) {
      handleAdminApi(req, res, requestUrl.pathname, requestUrl.searchParams, repository, resolvedWebgameRepository, options)
        .catch((error) => {
          if (!res.writableEnded) sendJson(res, 500, { error: 'ADMIN_API_ERROR', message: '관리자 요청을 처리하지 못했습니다.' });
          console.warn('관리자 API 처리 실패:', error.message);
        });
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
  const notifyAdminWrite = options.notifyAdminWrite || (options.client ? async (entry) => {
    const channelId = process.env.ADMIN_CONSOLE_LOG_CHANNEL_ID || process.env.LOG_CHANNEL_ID || '';
    if (!channelId) return;
    const channel = await options.client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      await channel.send(`관리자 콘솔 처리 · ${entry.action} · ${entry.targetType}:${entry.targetId} · ${entry.actor}`);
    }
  } : null);
  const server = http.createServer(createAdminRequestHandler(repository, webgameApi, webgameRepository, {
    audit: options.audit,
    notifyAdminWrite,
  }));

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
  getWriteCapabilities,
  isAdminDashboardEnabled,
  isAdminWriteEnabled,
  startAdminServer,
};
