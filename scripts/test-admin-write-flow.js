const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable, Writable } = require('stream');
const { createAdminAudit, MAX_AUDIT_ENTRIES } = require('../src/adminAudit');
const { createAdminRequestHandler } = require('../src/adminServer');
const { getOperationDataPaths } = require('../src/operationDataPaths');

process.env.ADMIN_DASHBOARD_PASSWORD = 'password';
const auth = `Basic ${Buffer.from('operator:password').toString('base64')}`;

function createRepository() {
  const state = {
    redemptionsData: { redemptions: [{ id: 'rd1', status: 'pending' }] },
    submissions: [{ id: 'sub1', status: 'pending' }, { id: 'sub2', status: 'pending' }],
    mission: { id: 'mission1', status: 'active' },
    shop: { id: 'shop1', status: 'active' },
    adjustments: [],
  };
  return {
    state,
    loadState: () => ({ redemptionsData: state.redemptionsData }),
    findSubmission: (id) => state.submissions.find((row) => row.id === id) || null,
    findMission: (id) => id === state.mission.id ? state.mission : null,
    findShopItem: (id) => id === state.shop.id ? state.shop : null,
    reviewRedemption(input) { const row = state.redemptionsData.redemptions[0]; row.status = input.action === 'complete' ? 'completed' : 'cancelled'; return { redemption: row }; },
    approveSubmissionById(id) { const row = this.findSubmission(id); row.status = 'approved'; return { submission: row, transaction: { amount: 20 } }; },
    rejectSubmissionById(id) { const row = this.findSubmission(id); row.status = 'rejected'; return { submission: row }; },
    adjustUserPoints(input) { state.adjustments.push(input); return { transaction: { amount: input.amount, reason: input.reason } }; },
    setMissionStatus(id, status) { state.mission.status = status; return state.mission; },
    setShopItemStatus(id, status) { state.shop.status = status; return state.shop; },
    getSubmissionsData: () => ({ submissions: state.submissions }),
    getOperatorSupportSummary: () => ({}),
    getReactionApprovalData: () => ({ approvals: [] }),
    getOperationSummary: () => ({}),
    listOperationalTransactions: () => [],
    listMissionsForAdmin: () => [state.mission],
    listShopItemsForAdmin: () => [state.shop],
  };
}

function request(handler, url, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.raw === undefined ? JSON.stringify(options.body || {}) : options.raw;
    const req = Readable.from(body ? [Buffer.from(body)] : []);
    req.url = url;
    req.method = options.method || 'GET';
    req.headers = { host: 'localhost', authorization: options.auth === false ? undefined : auth, ...(options.headers || {}) };
    const chunks = [];
    const res = new Writable({ write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    res.headers = {};
    res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
    res.on('finish', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      resolve({ status: res.statusCode, body: text && res.headers['content-type']?.includes('json') ? JSON.parse(text) : text });
    });
    res.on('error', reject);
    handler(req, res);
  });
}

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-write-'));
  const auditPath = path.join(directory, 'admin-audit.local.json');
  const audit = createAdminAudit({ filePath: auditPath });
  const repository = createRepository();
  const handler = createAdminRequestHandler(repository, null, {}, { audit });
  const jsonHeaders = { 'content-type': 'application/json', 'x-admin-write-token': 'token' };

  process.env.ADMIN_WRITE_ENABLED = 'false';
  process.env.ADMIN_WRITE_TOKEN = 'token';
  assert.equal((await request(handler, '/api/admin/points/adjust', { method: 'POST', headers: jsonHeaders, body: { discordId: 'u1', amount: 1, reason: 'test' } })).status, 403);

  process.env.ADMIN_WRITE_ENABLED = 'true';
  assert.equal((await request(handler, '/api/admin/points/adjust', { method: 'POST', headers: { ...jsonHeaders, 'x-admin-write-token': 'wrong' } })).status, 403);
  assert.equal((await request(handler, '/api/admin/points/adjust', { method: 'POST', headers: jsonHeaders, body: { discordId: 'u1', amount: 0, reason: 'test' } })).status, 400);
  const pointResult = await request(handler, '/api/admin/points/adjust', { method: 'POST', headers: jsonHeaders, body: { discordId: 'u1', amount: 5, reason: '운영 지급' } });
  assert.equal(pointResult.status, 200, JSON.stringify(pointResult.body));
  assert.equal(repository.state.adjustments[0].reason, '운영 지급');
  assert.equal((await request(handler, '/api/admin/redemptions/rd1/status', { method: 'POST', headers: jsonHeaders, body: { status: 'complete' } })).status, 200);
  assert.equal((await request(handler, '/api/admin/redemptions/rd1/status', { method: 'POST', headers: jsonHeaders, body: { status: 'complete' } })).status, 409);
  assert.equal((await request(handler, '/api/admin/submissions/sub1/decision', { method: 'POST', headers: jsonHeaders, body: { decision: 'approve' } })).status, 200);
  assert.equal((await request(handler, '/api/admin/submissions/sub2/decision', { method: 'POST', headers: jsonHeaders, body: { decision: 'reject' } })).status, 400);
  assert.equal((await request(handler, '/api/admin/missions/mission1/status', { method: 'POST', headers: jsonHeaders, body: { status: 'paused' } })).status, 200);
  assert.equal((await request(handler, '/api/admin/shop-items/shop1/status', { method: 'POST', headers: jsonHeaders, body: { status: 'paused' } })).status, 200);
  assert.equal((await request(handler, '/api/admin/points/adjust', { method: 'POST', auth: false, headers: jsonHeaders, body: {} })).status, 401);
  assert.equal((await request(handler, '/api/admin/points/adjust', { method: 'POST', headers: { 'x-admin-write-token': 'token', 'content-type': 'text/plain' }, raw: '{}' })).status, 415);
  assert.equal((await request(handler, '/api/admin/points/adjust', { method: 'POST', headers: jsonHeaders, raw: '{' })).status, 400);

  const blockedRepository = createRepository();
  const blockedHandler = createAdminRequestHandler(blockedRepository, null, {}, {
    audit: { appendAuditEntry() { throw new Error('disk unavailable'); } },
  });
  assert.equal((await request(blockedHandler, '/api/admin/redemptions/rd1/status', { method: 'POST', headers: jsonHeaders, body: { status: 'complete' } })).status, 503);
  assert.equal(blockedRepository.state.redemptionsData.redemptions[0].status, 'pending');

  const auditText = fs.readFileSync(auditPath, 'utf8');
  assert(!auditText.includes('token'));
  const entries = JSON.parse(auditText).entries;
  assert(entries.some((entry) => entry.result === 'attempt'));
  assert(entries.some((entry) => entry.result === 'success'));
  assert(entries.some((entry) => entry.result === 'rejected'));

  for (let index = 0; index < MAX_AUDIT_ENTRIES + 5; index += 1) audit.appendAuditEntry({ action: 'limit', targetType: 'test', targetId: String(index), result: 'success' });
  assert.equal(JSON.parse(fs.readFileSync(auditPath, 'utf8')).entries.length, MAX_AUDIT_ENTRIES);
  assert.equal(path.basename(getOperationDataPaths({ OPERATION_DATA_DIR: directory }).adminAudit), 'admin-audit.local.json');

  delete process.env.ADMIN_WRITE_TOKEN;
  const capabilities = await request(handler, '/api/admin/capabilities');
  assert.equal(capabilities.body.writeEnabled, false);
  assert.equal((await request(handler, '/api/admin/points/adjust', { method: 'POST', headers: jsonHeaders, body: {} })).status, 503);
  fs.rmSync(directory, { recursive: true, force: true });
  console.log('admin write flow smoke test passed');
}

run().catch((error) => { console.error(error); process.exit(1); });
