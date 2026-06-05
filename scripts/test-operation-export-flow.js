const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildExportFilename,
  buildOperationExportPayload,
  normalizeExportFormat,
  normalizeExportKind,
  toCsv,
  truncateForDiscord,
} = require('../src/exportUtils');
const { createPointsRepository } = require('../src/pointsRepository');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

const dataDir = path.join(__dirname, '..', 'data');

function createTempRepository(fallbacks = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'operation-export-flow-'));
  const paths = {
    points: path.join(tempDir, 'points.local.json'),
    pointsFallback: fallbacks.pointsFallback || path.join(dataDir, 'points.example.json'),
    shopItems: path.join(tempDir, 'shop-items.local.json'),
    shopItemsFallback: fallbacks.shopItemsFallback || path.join(dataDir, 'shop-items.example.json'),
    redemptions: path.join(tempDir, 'redemptions.local.json'),
    redemptionsFallback: fallbacks.redemptionsFallback || path.join(dataDir, 'redemptions.example.json'),
    missions: path.join(tempDir, 'missions.local.json'),
    missionsFallback: fallbacks.missionsFallback || path.join(dataDir, 'missions.example.json'),
    submissions: path.join(tempDir, 'submissions.local.json'),
    submissionsFallback: fallbacks.submissionsFallback || path.join(dataDir, 'submissions.example.json'),
  };

  return {
    repository: createPointsRepository(paths),
    paths,
    tempDir,
  };
}

function assertAttachmentPayload(payload, extension) {
  assert.strictEqual(payload.isAttachment, true);
  assert.ok(payload.filename.endsWith(extension));
  assert.ok(Buffer.isBuffer(payload.buffer));
  assert.ok(payload.buffer.length > 0);
  assert.ok(payload.content.length > 0);
}

function main() {
  const { repository, paths } = createTempRepository();

  assert.strictEqual(normalizeExportKind('전체'), 'all');
  assert.strictEqual(normalizeExportKind('상점'), 'shopItems');
  assert.strictEqual(normalizeExportFormat('JSON'), 'json');

  const fixedNow = new Date('2030-01-02T03:04:05.000Z');
  const summaryPayload = buildOperationExportPayload(repository, {
    kind: 'summary',
    format: 'summary',
    limit: 50,
    now: fixedNow,
  });
  assert.strictEqual(summaryPayload.isAttachment, false);
  assert.ok(summaryPayload.content.includes('운영 요약'));
  assert.ok(summaryPayload.content.includes('개인정보'));

  const pointsJson = buildOperationExportPayload(repository, {
    kind: 'points',
    format: 'json',
    limit: 5,
    now: fixedNow,
  });
  assertAttachmentPayload(pointsJson, '.json');
  const parsedPoints = JSON.parse(pointsJson.content);
  assert.strictEqual(parsedPoints.kind, 'points');
  assert.ok(parsedPoints.data.pointTransactions.length <= 5);

  const redemptionsJson = buildOperationExportPayload(repository, {
    kind: 'redemptions',
    format: 'json',
    limit: 5,
    now: fixedNow,
  });
  assertAttachmentPayload(redemptionsJson, '.json');
  assert.strictEqual(JSON.parse(redemptionsJson.content).kind, 'redemptions');

  const submissionsJson = buildOperationExportPayload(repository, {
    kind: 'submissions',
    format: 'json',
    limit: 5,
    now: fixedNow,
  });
  assertAttachmentPayload(submissionsJson, '.json');
  assert.strictEqual(JSON.parse(submissionsJson.content).kind, 'submissions');

  const missionsJson = buildOperationExportPayload(repository, {
    kind: 'missions',
    format: 'json',
    limit: 5,
    now: fixedNow,
  });
  assertAttachmentPayload(missionsJson, '.json');
  assert.strictEqual(JSON.parse(missionsJson.content).kind, 'missions');

  const shopItemsJson = buildOperationExportPayload(repository, {
    kind: 'shopItems',
    format: 'json',
    limit: 5,
    now: fixedNow,
  });
  assertAttachmentPayload(shopItemsJson, '.json');
  assert.strictEqual(JSON.parse(shopItemsJson.content).kind, 'shopItems');

  const allJson = buildOperationExportPayload(repository, {
    kind: 'all',
    format: 'json',
    limit: 2,
    now: fixedNow,
  });
  assertAttachmentPayload(allJson, '.json');
  assert.strictEqual(JSON.parse(allJson.content).kind, 'all');

  const pointsCsv = buildOperationExportPayload(repository, {
    kind: 'points',
    format: 'csv',
    limit: 5,
    now: fixedNow,
  });
  assertAttachmentPayload(pointsCsv, '.csv');
  assert.ok(pointsCsv.content.startsWith('거래ID,사용자ID,유형'));

  const redemptionsCsv = buildOperationExportPayload(repository, {
    kind: 'redemptions',
    format: 'csv',
    limit: 5,
    now: fixedNow,
  });
  assertAttachmentPayload(redemptionsCsv, '.csv');
  assert.ok(redemptionsCsv.content.startsWith('신청ID,사용자ID,항목ID'));

  const escapedCsv = toCsv(
    [
      {
        memo: '콤마, 줄바꿈\n따옴표 " 포함',
        objectValue: { nested: true },
      },
    ],
    [
      ['memo', '메모'],
      ['objectValue', '객체'],
    ]
  );
  assert.ok(escapedCsv.includes('"콤마, 줄바꿈\n따옴표 "" 포함"'));
  assert.ok(escapedCsv.includes('"{""nested"":true}"'));

  assert.strictEqual(
    buildExportFilename('points', 'json', fixedNow),
    'operation-export-points-20300102-030405.json'
  );

  const truncated = truncateForDiscord('a'.repeat(300), 80);
  assert.ok(truncated.length <= 80);
  assert.ok(truncated.includes('일부만 표시'));

  for (const localPath of [
    paths.points,
    paths.shopItems,
    paths.redemptions,
    paths.missions,
    paths.submissions,
  ]) {
    assert.strictEqual(fs.existsSync(localPath), false);
  }

  const missingFallbackPath = path.join(os.tmpdir(), `missing-${Date.now()}.json`);
  const { repository: emptyRepository } = createTempRepository({
    pointsFallback: missingFallbackPath,
    shopItemsFallback: missingFallbackPath,
    redemptionsFallback: missingFallbackPath,
    missionsFallback: missingFallbackPath,
    submissionsFallback: missingFallbackPath,
  });
  const emptyPayload = buildOperationExportPayload(emptyRepository, {
    kind: 'summary',
    format: 'summary',
    limit: 50,
    now: fixedNow,
  });
  assert.ok(emptyPayload.content.includes('사용자: 0명'));

  console.log('operation export flow smoke test passed');
}

main();
