const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable, Writable } = require('stream');
const { createAdminAudit } = require('../src/adminAudit');
const { createAdminRequestHandler } = require('../src/adminServer');
const { createPointsRepository } = require('../src/pointsRepository');
const { buildWeeklyPayoutPlan } = require('../src/webgamePayout');
const { createWebgameRepository, getAdminScoreId } = require('../src/webgameRepository');

process.env.ADMIN_DASHBOARD_PASSWORD = 'password';
process.env.ADMIN_WRITE_ENABLED = 'true';
process.env.ADMIN_WRITE_TOKEN = 'write-secret';
const auth = `Basic ${Buffer.from('operator:password').toString('base64')}`;
const jsonHeaders = { 'content-type': 'application/json', 'x-admin-write-token': 'write-secret' };

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function request(handler, url, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.raw === undefined ? JSON.stringify(options.body || {}) : options.raw;
    const req = Readable.from(body && options.method === 'POST' ? [Buffer.from(body)] : []);
    req.url = url;
    req.method = options.method || 'GET';
    req.headers = { host: 'localhost', authorization: options.auth === false ? undefined : auth, ...(options.headers || {}) };
    const chunks = [];
    const res = new Writable({ write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    res.headers = {};
    res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
    res.on('finish', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve({ status: res.statusCode, body: raw && res.headers['content-type']?.includes('json') ? JSON.parse(raw) : raw });
    });
    res.on('error', reject);
    handler(req, res);
  });
}

function score(discordId, value, weekKey, options = {}) {
  return {
    discordId,
    gameId: options.gameId || 'match3',
    score: value,
    seed: options.seed || 'private-seed',
    submittedAt: options.submittedAt || '2026-06-30T00:00:00.000Z',
    weekKey,
    flagged: Boolean(options.flagged),
    mode: 'free',
    dayKey: null,
    replay: 'verified',
    ...(options.isExample ? { isExample: true } : {}),
  };
}

function createFixture(name, scores) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  const links = Array.from(new Set(scores.map((entry) => entry.discordId))).map((discordId) => ({
    discordId,
    displayName: `name-${discordId}`,
    playerToken: `private-token-${discordId}`,
    linkedAt: '2026-06-29T00:00:00.000Z',
  }));
  const paths = {
    links: path.join(directory, 'links.json'),
    scores: path.join(directory, 'scores.json'),
    social: path.join(directory, 'social.json'),
    replayMismatch: path.join(directory, 'mismatch.json'),
  };
  writeJson(paths.links, { version: 1, isExample: false, links, pendingCodes: [] });
  writeJson(paths.scores, { version: 1, isExample: false, scores });
  writeJson(paths.social, { version: 1, isExample: false, cheerSalt: 'salt', cheers: [] });
  writeJson(paths.replayMismatch, { version: 1, isExample: false, records: [] });
  const pointsPath = path.join(directory, 'points.json');
  writeJson(pointsPath, { version: 1, isExample: false, users: [], pointTransactions: [] });
  const dataDirectory = path.resolve(__dirname, '..', 'data');
  const pointsRepository = createPointsRepository({
    points: pointsPath,
    pointsFallback: path.join(dataDirectory, 'points.example.json'),
    shopItems: path.join(directory, 'shop.json'),
    shopItemsFallback: path.join(dataDirectory, 'shop-items.example.json'),
    redemptions: path.join(directory, 'redemptions.json'),
    redemptionsFallback: path.join(dataDirectory, 'redemptions.example.json'),
    missions: path.join(directory, 'missions.json'),
    missionsFallback: path.join(dataDirectory, 'missions.example.json'),
    submissions: path.join(directory, 'submissions.json'),
    submissionsFallback: path.join(dataDirectory, 'submissions.example.json'),
  });
  return { directory, paths, pointsPath, pointsRepository, webgameRepository: createWebgameRepository(paths) };
}

function createHandler(fixture, pointsRepository = fixture.pointsRepository) {
  const auditPath = path.join(fixture.directory, 'audit.json');
  return {
    auditPath,
    handler: createAdminRequestHandler(pointsRepository, null, fixture.webgameRepository, {
      audit: createAdminAudit({ filePath: auditPath }),
    }),
  };
}

async function testResolution() {
  const weekKey = '2026-W27';
  const validLegacy = score('valid-user', 9000, weekKey, { flagged: true });
  const invalidLegacy = score('invalid-user', 8000, weekKey, { flagged: true, submittedAt: '2026-06-30T01:00:00.000Z' });
  const exampleLegacy = score('example-user', 7000, weekKey, { flagged: true, isExample: true, submittedAt: '2026-06-30T02:00:00.000Z' });
  const fixture = createFixture('admin-webgame-resolution', [validLegacy, invalidLegacy, exampleLegacy]);
  const { handler, auditPath } = createHandler(fixture);

  assert.equal(getAdminScoreId(validLegacy), getAdminScoreId({ ...validLegacy }));
  assert.notEqual(getAdminScoreId(validLegacy), getAdminScoreId({ ...validLegacy, seed: 'different-private-seed' }));
  const summary = await request(handler, `/api/admin/webgames?weekKey=${weekKey}`);
  const serialized = JSON.stringify(summary.body);
  assert.equal(summary.status, 200);
  assert(!serialized.includes('private-seed'));
  assert(!serialized.includes('private-token'));
  const validId = getAdminScoreId(validLegacy);
  const invalidId = getAdminScoreId(invalidLegacy);
  assert(summary.body.flaggedScores.some((entry) => entry.scoreId === validId));

  assert.equal((await request(handler, `/api/admin/webgames/scores/${validId}/resolve`, {
    method: 'POST', headers: jsonHeaders, body: { resolution: 'valid' },
  })).status, 400);
  const validResult = await request(handler, `/api/admin/webgames/scores/${validId}/resolve`, {
    method: 'POST', headers: jsonHeaders, body: { resolution: 'valid', reason: '리플레이 확인 완료' },
  });
  assert.equal(validResult.status, 200, JSON.stringify(validResult.body));
  assert.equal(fixture.webgameRepository.listWeeklyRanking('match3', weekKey, { limit: 10 })[0].discordId, 'valid-user');
  assert.equal((await request(handler, `/api/admin/webgames/scores/${validId}/resolve`, {
    method: 'POST', headers: jsonHeaders, body: { resolution: 'invalid', reason: '재판정' },
  })).status, 409);

  const invalidResult = await request(handler, `/api/admin/webgames/scores/${invalidId}/resolve`, {
    method: 'POST', headers: jsonHeaders, body: { resolution: 'invalid', reason: '점수 불일치' },
  });
  assert.equal(invalidResult.status, 200);
  const storedInvalid = fixture.webgameRepository.getScoresData().scores.find((entry) => entry.discordId === 'invalid-user');
  assert.equal(storedInvalid.flagged, true);
  assert.equal(storedInvalid.resolution.status, 'invalid');
  assert.equal((await request(handler, '/api/admin/webgames/scores/missing/resolve', {
    method: 'POST', headers: jsonHeaders, body: { resolution: 'valid', reason: '없음' },
  })).status, 404);
  assert.equal((await request(handler, `/api/admin/webgames/scores/${getAdminScoreId(exampleLegacy)}/resolve`, {
    method: 'POST', headers: jsonHeaders, body: { resolution: 'valid', reason: '예시' },
  })).status, 404);

  const auditText = fs.readFileSync(auditPath, 'utf8');
  assert(!auditText.includes('private-seed'));
  assert(!auditText.includes('private-token'));
  assert(JSON.parse(auditText).entries.some((entry) => entry.result === 'rejected'));
  fs.rmSync(fixture.directory, { recursive: true, force: true });
}

async function testSnapshotAndIdempotency() {
  const weekKey = '2026-W27';
  const fixture = createFixture('admin-webgame-payout', [score('alice', 100, weekKey), score('bob', 50, weekKey)]);
  const { handler } = createHandler(fixture);
  const preview = await request(handler, `/api/admin/webgames/payout-preview?weekKey=${weekKey}`);
  const directPlan = buildWeeklyPayoutPlan({ webgameRepository: fixture.webgameRepository, pointsRepository: fixture.pointsRepository, weekKey });
  assert.equal(preview.status, 200);
  assert.deepStrictEqual(preview.body.totals, directPlan.totals);

  fixture.webgameRepository.recordScore({ discordId: 'carol', gameId: 'match3', score: 200, weekKey, mode: 'free', replay: 'verified' });
  const stale = await request(handler, '/api/admin/webgames/payout', {
    method: 'POST', headers: jsonHeaders, body: { weekKey, snapshotToken: preview.body.snapshotToken, reason: '주간 지급' },
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'PAYOUT_SNAPSHOT_CHANGED');
  assert.equal(fixture.pointsRepository.listWebgameWeeklyRewardTransactions(weekKey).length, 0);

  const afterScoreChange = await request(handler, `/api/admin/webgames/payout-preview?weekKey=${weekKey}`);
  const linksData = fixture.webgameRepository.getLinksData();
  linksData.links.find((entry) => entry.discordId === 'alice').displayName = 'renamed-alice';
  writeJson(fixture.paths.links, linksData);
  const staleLink = await request(handler, '/api/admin/webgames/payout', {
    method: 'POST', headers: jsonHeaders, body: { weekKey, snapshotToken: afterScoreChange.body.snapshotToken, reason: '링크 변경 검사' },
  });
  assert.equal(staleLink.status, 409);
  assert.equal(staleLink.body.error, 'PAYOUT_SNAPSHOT_CHANGED');
  assert.equal(fixture.pointsRepository.listWebgameWeeklyRewardTransactions(weekKey).length, 0);

  const afterLinkChange = await request(handler, `/api/admin/webgames/payout-preview?weekKey=${weekKey}`);
  const firstWinner = afterLinkChange.body.games[0].winners[0];
  fixture.pointsRepository.awardWebgameWeeklyReward({
    user: { userId: firstWinner.discordId, displayName: firstWinner.displayName },
    amount: firstWinner.amount,
    weekKey,
    gameId: 'match3',
    kind: firstWinner.kind,
    reason: '동시 Discord 지급',
    operatorId: 'discord-operator',
  });
  const staleTransaction = await request(handler, '/api/admin/webgames/payout', {
    method: 'POST', headers: jsonHeaders, body: { weekKey, snapshotToken: afterLinkChange.body.snapshotToken, reason: '기지급 변경 검사' },
  });
  assert.equal(staleTransaction.status, 409);
  assert.equal(staleTransaction.body.error, 'PAYOUT_SNAPSHOT_CHANGED');
  assert.equal(fixture.pointsRepository.listWebgameWeeklyRewardTransactions(weekKey).length, 1);

  const fresh = await request(handler, `/api/admin/webgames/payout-preview?weekKey=${weekKey}`);
  const expectedTotalTransactions = fresh.body.totals.payableCount + fresh.body.totals.alreadyPaidCount;
  const paid = await request(handler, '/api/admin/webgames/payout', {
    method: 'POST', headers: jsonHeaders, body: { weekKey, snapshotToken: fresh.body.snapshotToken, reason: '주간 지급' },
  });
  assert.equal(paid.status, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.partialFailure, false);
  assert.equal(fixture.pointsRepository.listWebgameWeeklyRewardTransactions(weekKey).length, expectedTotalTransactions);
  const completed = await request(handler, `/api/admin/webgames/payout-preview?weekKey=${weekKey}`);
  assert.equal(completed.body.totals.payableCount, 0);
  const duplicate = await request(handler, '/api/admin/webgames/payout', {
    method: 'POST', headers: jsonHeaders, body: { weekKey, snapshotToken: completed.body.snapshotToken, reason: '중복 지급' },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, 'PAYOUT_ALREADY_COMPLETE');

  const flagged = score('late-user', 999, weekKey, { flagged: true, submittedAt: '2026-06-30T03:00:00.000Z' });
  const scoresData = fixture.webgameRepository.getScoresData();
  scoresData.scores.push(flagged);
  writeJson(fixture.paths.scores, scoresData);
  const warning = await request(handler, `/api/admin/webgames/scores/${getAdminScoreId(flagged)}/resolve`, {
    method: 'POST', headers: jsonHeaders, body: { resolution: 'invalid', reason: '지급 후 판정' },
  });
  assert.equal(warning.status, 200);
  assert.equal(warning.body.manualReconciliationRequired, true);
  fs.rmSync(fixture.directory, { recursive: true, force: true });
}

async function testPartialFailureRetryAndGuards() {
  const weekKey = '2026-W28';
  const fixture = createFixture('admin-webgame-partial', [score('alpha', 100, weekKey), score('beta', 50, weekKey)]);
  let failBeta = true;
  const wrapped = {
    ...fixture.pointsRepository,
    awardWebgameWeeklyReward(input) {
      if (input.user.userId === 'beta' && failBeta) throw new Error('temporary failure');
      return fixture.pointsRepository.awardWebgameWeeklyReward(input);
    },
  };
  const { handler, auditPath } = createHandler(fixture, wrapped);
  const preview = await request(handler, `/api/admin/webgames/payout-preview?weekKey=${weekKey}`);
  const partial = await request(handler, '/api/admin/webgames/payout', {
    method: 'POST', headers: jsonHeaders, body: { weekKey, snapshotToken: preview.body.snapshotToken, reason: '부분 실패 테스트' },
  });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.partialFailure, true);
  assert.equal(partial.body.result.failed.length, 1);
  const paidBeforeRetry = fixture.pointsRepository.listWebgameWeeklyRewardTransactions(weekKey).length;
  assert(paidBeforeRetry > 0);

  failBeta = false;
  const retryPreview = await request(handler, `/api/admin/webgames/payout-preview?weekKey=${weekKey}`);
  assert(retryPreview.body.totals.payableCount < preview.body.totals.payableCount);
  const retried = await request(handler, '/api/admin/webgames/payout', {
    method: 'POST', headers: jsonHeaders, body: { weekKey, snapshotToken: retryPreview.body.snapshotToken, reason: '실패 건 재시도' },
  });
  assert.equal(retried.status, 200);
  assert.equal(retried.body.partialFailure, false);
  assert.equal(fixture.pointsRepository.listWebgameWeeklyRewardTransactions(weekKey).length, preview.body.totals.payableCount);

  process.env.ADMIN_WRITE_ENABLED = 'false';
  assert.equal((await request(handler, '/api/admin/webgames/payout', { method: 'POST', headers: jsonHeaders, body: {} })).status, 403);
  process.env.ADMIN_WRITE_ENABLED = 'true';
  assert.equal((await request(handler, '/api/admin/webgames/payout', { method: 'POST', headers: { ...jsonHeaders, 'x-admin-write-token': 'wrong' }, body: {} })).status, 403);
  delete process.env.ADMIN_WRITE_TOKEN;
  assert.equal((await request(handler, '/api/admin/webgames/payout', { method: 'POST', headers: jsonHeaders, body: {} })).status, 503);
  process.env.ADMIN_WRITE_TOKEN = 'write-secret';
  assert.equal((await request(handler, '/api/admin/webgames/payout', { method: 'POST', auth: false, headers: jsonHeaders, body: {} })).status, 401);
  const auditText = fs.readFileSync(auditPath, 'utf8');
  assert(!auditText.includes('write-secret'));
  assert(JSON.parse(auditText).entries.some((entry) => entry.result === 'partial_failure'));
  fs.rmSync(fixture.directory, { recursive: true, force: true });
}

async function run() {
  await testResolution();
  await testSnapshotAndIdempotency();
  await testPartialFailureRetryAndGuards();
  console.log('admin webgame ops flow smoke test passed');
}

run().catch((error) => { console.error(error); process.exit(1); });
