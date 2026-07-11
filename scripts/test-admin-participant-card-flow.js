const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildAdminParticipantCard } = require('../src/adminParticipantCard');
const { createAdminRequestHandler } = require('../src/adminServer');

const previousPassword = process.env.ADMIN_DASHBOARD_PASSWORD;
process.env.ADMIN_DASHBOARD_PASSWORD = 'participant-card-test-password';
const authorization = `Basic ${Buffer.from('admin:participant-card-test-password').toString('base64')}`;
const old = '2026-07-01T00:00:00.000Z';
const recent = '2026-07-10T00:00:00.000Z';
const targetId = '10000000000000001';
const otherId = '20000000000000002';
const exampleId = '30000000000000003';

function fixture() {
  return {
    pointsData: {
      users: [
        { userId: targetId, displayName: '대상 참여자', status: 'active', totalPoints: -3, createdAt: old, updatedAt: recent, note: 'private-user-note' },
        { userId: otherId, displayName: '다른 참여자', totalPoints: 999 },
        { userId: exampleId, displayName: '샘플이 아닌 표시명', totalPoints: 100, isExample: true },
      ],
      pointTransactions: [
        { id: 'tx-old', userId: targetId, type: 'earn', amount: 2, balanceAfter: 2, reason: { note: 'SECRET_NESTED' }, createdAt: 'invalid-date', note: 'SECRET_NOTE' },
        { id: 'tx-new', userId: targetId, type: 'adjust', amount: -4, balanceAfter: -2, reason: '정정', createdAt: recent, playerToken: 'SECRET_TOKEN' },
        { id: 'tx-other', userId: otherId, type: 'earn', amount: 999, balanceAfter: 999, reason: 'OTHER_USER_SECRET', createdAt: recent },
      ],
    },
    submissionsData: { submissions: [
      { id: 'checkin-1', type: 'checkin', userId: targetId, status: 'approved', checkinDate: '2026-07-10', rewardPoints: 1, createdAt: recent, content: 'SECRET_CONTENT' },
      { id: 'sub-overdue', type: 'mission', userId: targetId, missionId: 'mission-1', status: 'pending', createdAt: old, attachmentUrls: ['https://secret.example'] },
      { id: 'sub-missing', type: 'mission', userId: targetId, missionId: 'missing-mission', status: 'approved', createdAt: 'not-a-date', reviewNote: 'SECRET_REVIEW' },
      { id: 'sub-other', type: 'mission', userId: otherId, missionId: 'mission-1', status: 'pending', createdAt: recent, content: 'OTHER_SUBMISSION_SECRET' },
    ] },
    redemptionsData: { redemptions: [
      { id: 'rd-overdue', userId: targetId, itemId: 'item-1', status: 'pending', cost: 30, requestedAt: old, messageUrl: 'https://secret.example/message' },
      { id: 'rd-missing', userId: targetId, itemId: 'missing-item', status: 'completed', cost: 5, requestedAt: recent, note: 'SECRET_REDEMPTION' },
      { id: 'rd-other', userId: otherId, itemId: 'item-1', status: 'pending', cost: 900, requestedAt: recent },
    ] },
    missionsData: { missions: [{ id: 'mission-1', title: '운영 미션', rewardPoints: 10, content: 'SECRET_MISSION' }] },
    shopItemsData: { shopItems: [{ id: 'item-1', name: '운영 상품', cost: 30, seed: 'SECRET_SEED' }] },
  };
}

function makeRepository(state) {
  return { loadState() { return JSON.parse(JSON.stringify(state)); } };
}

class Response {
  constructor(resolve) { this.statusCode = 200; this.headers = {}; this.chunks = []; this.resolve = resolve; this.writableEnded = false; }
  setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; }
  end(chunk) { if (chunk) this.chunks.push(Buffer.from(chunk)); this.writableEnded = true; this.resolve(this); }
}

function request(handler, url, auth = authorization) {
  return new Promise((resolve) => {
    handler({ method: 'GET', url, headers: { host: 'localhost', ...(auth ? { authorization: auth } : {}) } }, new Response(resolve));
  });
}

function body(response) { return JSON.parse(Buffer.concat(response.chunks).toString('utf8')); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function collectKeys(value, keys = []) {
  if (!value || typeof value !== 'object') return keys;
  Object.keys(value).forEach((key) => { keys.push(key); collectKeys(value[key], keys); });
  return keys;
}

(async () => {
  const state = fixture();
  const card = buildAdminParticipantCard(makeRepository(state), { userId: targetId, limit: 1, now: new Date('2026-07-11T12:00:00.000Z') });
  assert.strictEqual(card.meta.limit, 5, 'limit minimum must be five');
  assert.strictEqual(card.counts.checkins, 1);
  assert.deepStrictEqual(card.counts.submissions, { pending: 1, approved: 1 });
  assert.deepStrictEqual(card.counts.redemptions, { pending: 1, completed: 1 });
  assert.strictEqual(card.counts.pointTransactions, 2);
  assert.strictEqual(card.recent.submissions[0].missionTitle, '운영 미션');
  assert.strictEqual(card.recent.redemptions.find((item) => item.id === 'rd-overdue').itemName, '운영 상품');
  const codes = card.warnings.map((item) => item.code);
  ['NEGATIVE_BALANCE', 'BALANCE_MISMATCH', 'MISSION_NOT_FOUND', 'SHOP_ITEM_NOT_FOUND', 'SUBMISSION_OVERDUE', 'REDEMPTION_OVERDUE'].forEach((code) => assert(codes.includes(code), code));
  const serialized = JSON.stringify(card);
  const forbiddenKeys = ['content', 'contentSummary', 'attachment', 'attachmentUrls', 'messageUrl', 'note', 'reviewNote', 'playerToken', 'seed', 'log', 'notificationSettings', 'notificationResults'];
  forbiddenKeys.forEach((key) => assert(!collectKeys(card).includes(key), `must exclude key ${key}`));
  ['SECRET_', 'OTHER_', 'https://secret.example', 'contentSummary', 'attachmentUrls', 'messageUrl', 'reviewNote', 'playerToken', 'notificationSettings', 'notificationResults'].forEach((value) => assert(!serialized.includes(value), `must redact ${value}`));
  assert.strictEqual(buildAdminParticipantCard(makeRepository(state), { userId: otherId }).counts.pointTransactions, 1);
  assert.strictEqual(buildAdminParticipantCard(makeRepository(state), { userId: exampleId }), null);
  assert.strictEqual(buildAdminParticipantCard(makeRepository(state), { userId: 'missing' }), null);
  assert.strictEqual(buildAdminParticipantCard(makeRepository(state), { userId: targetId, limit: 999 }).meta.limit, 50);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'participant-card-'));
  const stateFile = path.join(tempDir, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify(state));
  const repository = { loadState() { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } };
  const handler = createAdminRequestHandler(repository, {}, { getState() { return {}; } });
  const before = { hash: hash(stateFile), mtime: fs.statSync(stateFile).mtimeMs };
  const unauthorized = await request(handler, `/api/admin/participant-card?userId=${targetId}`, null);
  assert.strictEqual(unauthorized.statusCode, 401);
  const missingId = await request(handler, '/api/admin/participant-card');
  assert.strictEqual(missingId.statusCode, 400);
  assert.strictEqual(body(missingId).error, 'INVALID_USER_ID');
  const invalidId = await request(handler, '/api/admin/participant-card?userId=missing');
  assert.strictEqual(invalidId.statusCode, 400);
  const notFound = await request(handler, '/api/admin/participant-card?userId=99999999999999999');
  assert.strictEqual(notFound.statusCode, 404);
  assert.strictEqual(body(notFound).error, 'PARTICIPANT_NOT_FOUND');
  const example = await request(handler, `/api/admin/participant-card?userId=${exampleId}`);
  assert.strictEqual(example.statusCode, 404);
  const success = await request(handler, `/api/admin/participant-card?userId=${targetId}&limit=10`);
  assert.strictEqual(success.statusCode, 200);
  assert.strictEqual(success.headers['cache-control'], 'no-store');
  assert.strictEqual(body(success).participant.userId, targetId);
  const after = { hash: hash(stateFile), mtime: fs.statSync(stateFile).mtimeMs };
  assert.deepStrictEqual(after, before, 'GET must not mutate local JSON');

  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'admin.js'), 'utf8');
  assert(html.includes('participant-card-form'));
  assert(js.includes("'/api/admin/participant-card?'"));
  assert(!/localStorage|sessionStorage|pushState|replaceState/.test(js), 'participant lookup must not use browser persistence/history');
  assert(!/participant-card[^\n]*loadDashboard|loadDashboard[^\n]*participant-card/.test(js), 'dashboard load must not automatically fetch card');
  console.log('admin participant card flow: ok');
})().finally(() => {
  if (previousPassword === undefined) delete process.env.ADMIN_DASHBOARD_PASSWORD;
  else process.env.ADMIN_DASHBOARD_PASSWORD = previousPassword;
});
