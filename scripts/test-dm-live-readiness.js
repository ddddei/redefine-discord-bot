const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-live-readiness-'));
  process.env.DM_SAFETY_REVIEWS_PATH = path.join(tempDir, 'dm-safety-reviews.json');
  process.env.DM_CHAT_CLEANUP_STATE_PATH = path.join(tempDir, 'dm-chat-cleanup-state.json');
  process.env.DM_CHAT_LOG_PATH = path.join(tempDir, 'dm-chat-logs.json');
  process.env.DM_CHAT_ENABLED = 'true';
  process.env.DM_CHAT_MEMBER_ONLY = 'false';
  process.env.DM_CHAT_BURST_LIMIT_PER_MINUTE = '0';
  process.env.DM_CHAT_DAILY_LIMIT = '30';
  process.env.AI_ENABLED = 'true';
  process.env.AI_PROVIDER = 'mock';
  process.env.DM_CHAT_LOG_CHANNEL_ID = 'operator-log';
  process.env.SAFETY_ALERT_CHANNEL_ID = 'safety-log';

  const { createDmSafetyReviewRepository } = require('../src/dmSafetyReview');
  const { buildCustomId, parseCustomId } = require('../src/dmSafetyReviewUi');
  const {
    getCleanupConfig,
    resetDmChatCleanupSchedulerForTest,
    runAutomaticCleanup,
    runCleanupSchedulerCheck,
  } = require('../src/dmChatCleanup');
  const { getOperationDataPaths } = require('../src/operationDataPaths');
  const { createDmChatRepository } = require('../src/dmChatRepository');
  const { handleDmChatMessage } = require('../src/dmChat');
  const { listDmSafetyReviews, listRecentDmChatMessages } = require('../src/adminApi');
  const { collectBackupSnapshot, getDefaultSnapshotPaths } = require('../src/operationBackup');
  const { SCENARIOS, buildScenarioMenuMessage, findScenarioByName } = require('../src/dmChatScenarios');

  const reviewRepository = createDmSafetyReviewRepository();
  const created = reviewRepository.createForDetection({
    sourceLogId: 'log_input_1', userId: 'user_a', direction: 'input', detectedAt: '2026-07-09T00:00:00.000Z',
  });
  assert.strictEqual(created.created, true);
  assert.strictEqual(reviewRepository.createForDetection({
    sourceLogId: 'log_input_1', userId: 'user_a', direction: 'input', detectedAt: '2026-07-09T00:00:00.000Z',
  }).created, false);
  assert.throws(() => reviewRepository.transition(created.review.id, { status: 'unsafe-score' }), /허용되지 않은/);
  const reviewed = reviewRepository.transition(created.review.id, {
    status: 'reviewed', expectedUpdatedAt: created.review.updatedAt, reviewedBy: 'operator_a', note: '  확인 완료  ',
    changedAt: '2026-07-09T00:05:00.000Z',
  });
  assert.strictEqual(reviewed.ok, true);
  assert.strictEqual(reviewed.review.note, '확인 완료');
  assert.strictEqual(reviewed.review.history.length, 2);
  assert.throws(() => reviewRepository.transition(reviewed.review.id, {
    status: 'closed', expectedUpdatedAt: reviewed.review.updatedAt, reviewedBy: 'operator_a', note: '가'.repeat(501),
  }), /500자 이하/);
  assert.strictEqual(reviewRepository.transition(created.review.id, {
    status: 'closed', expectedUpdatedAt: created.review.updatedAt, reviewedBy: 'operator_b',
  }).reason, 'CONFLICT');
  const followUpSeed = reviewRepository.createForDetection({
    sourceLogId: 'log_input_2', userId: 'user_b', direction: 'input', detectedAt: '2026-07-09T00:01:00.000Z',
  }).review;
  assert.strictEqual(reviewRepository.transition(followUpSeed.id, {
    status: 'followUp', expectedUpdatedAt: followUpSeed.updatedAt, reviewedBy: 'operator_a',
  }).review.status, 'followUp');
  const closedSeed = reviewRepository.createForDetection({
    sourceLogId: 'log_output_1', userId: 'user_c', direction: 'output', detectedAt: '2026-07-09T00:02:00.000Z',
  }).review;
  assert.strictEqual(reviewRepository.transition(closedSeed.id, {
    status: 'closed', expectedUpdatedAt: closedSeed.updatedAt, reviewedBy: 'operator_a',
  }).review.status, 'closed');
  const invalidStoredPath = path.join(tempDir, 'invalid-stored-review.json');
  fs.writeFileSync(invalidStoredPath, JSON.stringify({ version: 1, isExample: false, reviews: [{
    id: 'invalid', sourceLogId: 'source', userId: 'user', direction: 'input', status: 'invalid-status',
  }] }));
  const invalidStoredBefore = fs.readFileSync(invalidStoredPath, 'utf8');
  assert.throws(() => createDmSafetyReviewRepository(invalidStoredPath).list(), /허용되지 않은/);
  assert.strictEqual(fs.readFileSync(invalidStoredPath, 'utf8'), invalidStoredBefore);

  const customId = buildCustomId('closed', reviewed.review);
  assert.ok(customId.length <= 100);
  assert.deepStrictEqual(parseCustomId(customId), {
    action: 'closed', id: reviewed.review.id, updatedAt: reviewed.review.updatedAt,
  });
  assert.ok(!customId.includes('user_a'));

  const adminPayload = listDmSafetyReviews(reviewRepository, 10);
  assert.strictEqual(adminPayload.meta.readOnly, true);
  assert.ok(!JSON.stringify(adminPayload).includes('확인 완료'));
  assert.ok(!JSON.stringify(adminPayload).includes('matchedKeyword'));
  assert.ok(!JSON.stringify(adminPayload).includes('content'));
  const longDmPath = path.join(tempDir, 'long-admin-dm.json');
  fs.writeFileSync(longDmPath, JSON.stringify({ version: 4, isExample: false, notices: [], historyResets: [], activeScenarios: [], messages: [
    { id: 'long', createdAt: '2026-07-09T00:00:00.000Z', userId: 'user_long', role: 'user', content: '가'.repeat(500) },
  ] }));
  const dmAdminPreview = listRecentDmChatMessages(createDmChatRepository(longDmPath), 10).data[0];
  assert.strictEqual(dmAdminPreview.content.length, 300);
  assert.strictEqual(dmAdminPreview.contentTruncated, true);

  const { handleDmSafetyReviewButton } = require('../src/handlers');
  let unauthorizedReply = null;
  await handleDmSafetyReviewButton({
    customId,
    member: { permissions: { has: () => false } },
    user: { id: 'not_operator' },
    reply: async (payload) => { unauthorizedReply = payload; },
  });
  assert.match(unauthorizedReply.content, /운영진 권한/);
  assert.strictEqual(reviewRepository.getById(created.review.id).status, 'reviewed');
  let authorizedUpdate = null;
  await handleDmSafetyReviewButton({
    customId,
    member: { permissions: { has: (permission) => permission === PermissionFlagsBits.ManageMessages } },
    user: { id: 'operator_authorized' },
    update: async (payload) => { authorizedUpdate = payload; },
    reply: async () => {},
  });
  assert.ok(authorizedUpdate && authorizedUpdate.embeds.length >= 1);
  assert.strictEqual(reviewRepository.getById(created.review.id).status, 'closed');

  const warnings = [];
  assert.strictEqual(getCleanupConfig({}, (message) => warnings.push(message)).enabled, false);
  const fallbackConfig = getCleanupConfig({ DM_CHAT_CLEANUP_WEEKDAY: 'invalid', DM_CHAT_CLEANUP_TIME_KST: '99:99' }, (message) => warnings.push(message));
  assert.strictEqual(fallbackConfig.weekday, 'sunday');
  assert.strictEqual(fallbackConfig.time, '04:00');
  assert.strictEqual(warnings.length, 2);
  const aliasRoot = path.join(tempDir, 'alias-root');
  const legacyCleanupPath = path.join(tempDir, 'legacy-cleanup.json');
  const newCleanupPath = path.join(tempDir, 'new-cleanup.json');
  assert.strictEqual(getOperationDataPaths({ OPERATION_DATA_DIR: aliasRoot, DM_CLEANUP_STATE_PATH: legacyCleanupPath }).dmCleanupState, legacyCleanupPath);
  assert.strictEqual(getOperationDataPaths({
    OPERATION_DATA_DIR: aliasRoot,
    DM_CLEANUP_STATE_PATH: legacyCleanupPath,
    DM_CHAT_CLEANUP_STATE_PATH: newCleanupPath,
  }).dmCleanupState, newCleanupPath);
  assert.strictEqual(getOperationDataPaths({ OPERATION_DATA_DIR: aliasRoot }).dmCleanupState, path.join(aliasRoot, 'dm-chat-cleanup-state.local.json'));

  const now = new Date('2026-07-09T00:00:00.000Z');
  const old = new Date(now.getTime() - 100 * 86400000).toISOString();
  const recent = new Date(now.getTime() - 10 * 86400000).toISOString();
  const cleanupPaths = {
    dmChatLogs: process.env.DM_CHAT_LOG_PATH,
    dmCleanupState: process.env.DM_CHAT_CLEANUP_STATE_PATH,
  };
  fs.writeFileSync(cleanupPaths.dmChatLogs, JSON.stringify({ messages: [
    { id: 'old', createdAt: old }, { id: 'recent', createdAt: recent }, { id: 'recent2', createdAt: recent },
  ], notices: [], historyResets: [], activeScenarios: [] }));
  const cleanupResult = runAutomaticCleanup({ now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: cleanupPaths });
  assert.strictEqual(cleanupResult.ok, true);
  assert.strictEqual(cleanupResult.removedCount, 1);
  assert.strictEqual(JSON.parse(fs.readFileSync(cleanupPaths.dmChatLogs)).messages.length, 2);
  assert.strictEqual(runAutomaticCleanup({ now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: cleanupPaths }).reason, 'ALREADY_RAN_THIS_WEEK');

  const noChangesPaths = { dmChatLogs: path.join(tempDir, 'no-changes.json'), dmCleanupState: path.join(tempDir, 'no-changes-state.json') };
  fs.writeFileSync(noChangesPaths.dmChatLogs, JSON.stringify({ messages: [{ id: 'recent', createdAt: recent }] }));
  const noChanges = runAutomaticCleanup({ now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: noChangesPaths });
  assert.strictEqual(noChanges.reason, 'NO_CHANGES');
  assert.strictEqual(noChanges.cutoffAt, new Date(now.getTime() - 90 * 86400000).toISOString());

  const disabledPaths = { dmChatLogs: path.join(tempDir, 'disabled.json'), dmCleanupState: path.join(tempDir, 'disabled-state.json') };
  fs.writeFileSync(disabledPaths.dmChatLogs, JSON.stringify({ messages: [{ id: 'old', createdAt: old }] }));
  const beforeDisabled = fs.readFileSync(disabledPaths.dmChatLogs, 'utf8');
  assert.strictEqual(runAutomaticCleanup({ now, env: { DM_CHAT_RETENTION_DAYS: '0' }, paths: disabledPaths }).reason, 'RETENTION_DISABLED');
  assert.strictEqual(fs.readFileSync(disabledPaths.dmChatLogs, 'utf8'), beforeDisabled);

  const ratioPaths = { dmChatLogs: path.join(tempDir, 'ratio.json'), dmCleanupState: path.join(tempDir, 'ratio-state.json') };
  fs.writeFileSync(ratioPaths.dmChatLogs, JSON.stringify({ messages: [{ id: 'old1', createdAt: old }, { id: 'old2', createdAt: old }, { id: 'recent', createdAt: recent }] }));
  const beforeRatio = fs.readFileSync(ratioPaths.dmChatLogs, 'utf8');
  assert.strictEqual(runAutomaticCleanup({ now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: ratioPaths }).reason, 'REMOVAL_RATIO_EXCEEDED');
  assert.strictEqual(fs.readFileSync(ratioPaths.dmChatLogs, 'utf8'), beforeRatio);
  assert.strictEqual(runAutomaticCleanup({ now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: ratioPaths }).reason, 'ALREADY_RAN_THIS_WEEK');

  const parsePaths = { dmChatLogs: path.join(tempDir, 'parse.json'), dmCleanupState: path.join(tempDir, 'parse-state.json') };
  fs.writeFileSync(parsePaths.dmChatLogs, '{bad json');
  assert.strictEqual(runAutomaticCleanup({ now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: parsePaths }).reason, 'LOG_PARSE_FAILED');
  assert.strictEqual(fs.readFileSync(parsePaths.dmChatLogs, 'utf8'), '{bad json');

  const backupFailPaths = { dmChatLogs: path.join(tempDir, 'backup-fail.json'), dmCleanupState: path.join(tempDir, 'backup-fail-state.json') };
  fs.writeFileSync(backupFailPaths.dmChatLogs, JSON.stringify({ messages: [{ id: 'old', createdAt: old }, { id: 'recent1', createdAt: recent }, { id: 'recent2', createdAt: recent }] }));
  const beforeBackupFail = fs.readFileSync(backupFailPaths.dmChatLogs, 'utf8');
  assert.strictEqual(runAutomaticCleanup({
    now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: backupFailPaths,
    createBackupCopy: () => { throw new Error('simulated backup failure'); },
  }).reason, 'BACKUP_FAILED');
  assert.strictEqual(fs.readFileSync(backupFailPaths.dmChatLogs, 'utf8'), beforeBackupFail);
  assert.strictEqual(runAutomaticCleanup({ now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: backupFailPaths }).reason, 'ALREADY_RAN_THIS_WEEK');

  const applyFailPaths = { dmChatLogs: path.join(tempDir, 'apply-fail.json'), dmCleanupState: path.join(tempDir, 'apply-fail-state.json') };
  fs.writeFileSync(applyFailPaths.dmChatLogs, JSON.stringify({ messages: [{ id: 'old', createdAt: old }, { id: 'recent1', createdAt: recent }, { id: 'recent2', createdAt: recent }] }));
  const beforeApplyFail = fs.readFileSync(applyFailPaths.dmChatLogs, 'utf8');
  const applyFailed = runAutomaticCleanup({
    now,
    env: { DM_CHAT_RETENTION_DAYS: '90' },
    paths: applyFailPaths,
    createBackupCopy: () => path.join(tempDir, 'simulated-backup.json'),
    saveLog: () => { throw new Error('raw write error'); },
  });
  assert.strictEqual(applyFailed.reason, 'APPLY_FAILED');
  assert.strictEqual(applyFailed.ok, false);
  assert.strictEqual(fs.readFileSync(applyFailPaths.dmChatLogs, 'utf8'), beforeApplyFail);
  assert.strictEqual(JSON.parse(fs.readFileSync(applyFailPaths.dmCleanupState, 'utf8')).records[0].reason, 'APPLY_FAILED');
  assert.strictEqual(runAutomaticCleanup({ now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: applyFailPaths }).reason, 'ALREADY_RAN_THIS_WEEK');

  resetDmChatCleanupSchedulerForTest();
  const schedulerNotifications = [];
  const schedulerClient = { channels: { fetch: async () => ({ send: async (payload) => schedulerNotifications.push(payload) }) } };
  const schedulerConfig = { enabled: true, weekday: 'thursday', time: '00:00' };
  const disabledAttempt = await runCleanupSchedulerCheck(schedulerClient, schedulerConfig, {
    now,
    env: { DM_CHAT_RETENTION_DAYS: '0' },
    paths: disabledPaths,
  });
  assert.strictEqual(disabledAttempt.reason, 'RETENTION_DISABLED');
  assert.strictEqual((await runCleanupSchedulerCheck(schedulerClient, schedulerConfig, {
    now, env: { DM_CHAT_RETENTION_DAYS: '0' }, paths: disabledPaths,
  })).reason, 'ALREADY_ATTEMPTED_IN_PROCESS');
  assert.strictEqual(schedulerNotifications.length, 1);
  const schedulerNotificationText = JSON.stringify(schedulerNotifications);
  assert.ok(!schedulerNotificationText.includes('user_'));
  assert.ok(!schedulerNotificationText.includes('raw write error'));

  const preApplyStateFailPaths = {
    dmChatLogs: path.join(tempDir, 'pre-apply-state-fail.json'),
    dmCleanupState: path.join(tempDir, 'pre-apply-state-fail-state.json'),
  };
  fs.writeFileSync(preApplyStateFailPaths.dmChatLogs, JSON.stringify({ messages: [
    { id: 'old1', createdAt: old }, { id: 'old2', createdAt: old }, { id: 'recent', createdAt: recent },
  ] }));
  const preApplyBefore = fs.readFileSync(preApplyStateFailPaths.dmChatLogs, 'utf8');
  const preApplyStateFailure = runAutomaticCleanup({
    now,
    env: { DM_CHAT_RETENTION_DAYS: '90' },
    paths: preApplyStateFailPaths,
    saveStateRecord: () => { throw new Error('private state write details'); },
  });
  assert.strictEqual(preApplyStateFailure.reason, 'STATE_WRITE_FAILED');
  assert.strictEqual(preApplyStateFailure.originalReason, 'REMOVAL_RATIO_EXCEEDED');
  assert.strictEqual(preApplyStateFailure.applied, false);
  assert.strictEqual(preApplyStateFailure.removedCount, 2);
  assert.strictEqual(fs.readFileSync(preApplyStateFailPaths.dmChatLogs, 'utf8'), preApplyBefore);

  resetDmChatCleanupSchedulerForTest();
  const postApplyPaths = {
    dmChatLogs: path.join(tempDir, 'post-apply-state-fail.json'),
    dmCleanupState: path.join(tempDir, 'post-apply-state-fail-state.json'),
  };
  fs.writeFileSync(postApplyPaths.dmChatLogs, JSON.stringify({ messages: [
    { id: 'old', userId: 'private_user', createdAt: old },
    { id: 'recent1', userId: 'private_user', createdAt: recent },
    { id: 'recent2', userId: 'private_user', createdAt: recent },
  ] }));
  const postApplyNotifications = [];
  const postApplyClient = { channels: { fetch: async () => ({ send: async (payload) => postApplyNotifications.push(payload) }) } };
  const postApplyStateFailure = await runCleanupSchedulerCheck(postApplyClient, schedulerConfig, {
    now,
    env: { DM_CHAT_RETENTION_DAYS: '90' },
    paths: postApplyPaths,
    saveStateRecord: () => { throw new Error('raw private state error'); },
  });
  assert.strictEqual(postApplyStateFailure.reason, 'STATE_WRITE_FAILED_AFTER_APPLY');
  assert.strictEqual(postApplyStateFailure.originalReason, 'APPLIED');
  assert.strictEqual(postApplyStateFailure.applied, true);
  assert.strictEqual(postApplyStateFailure.removedCount, 1);
  assert.strictEqual(postApplyStateFailure.cutoffAt, new Date(now.getTime() - 90 * 86400000).toISOString());
  assert.strictEqual(JSON.parse(fs.readFileSync(postApplyPaths.dmChatLogs, 'utf8')).messages.length, 2);
  assert.strictEqual(postApplyNotifications.length, 1);
  const postApplyNotificationText = JSON.stringify(postApplyNotifications);
  assert.ok(postApplyNotificationText.includes('삭제 1건'));
  assert.ok(!postApplyNotificationText.includes('private_user'));
  assert.ok(!postApplyNotificationText.includes('raw private state error'));
  assert.strictEqual((await runCleanupSchedulerCheck(postApplyClient, schedulerConfig, {
    now, env: { DM_CHAT_RETENTION_DAYS: '90' }, paths: postApplyPaths,
  })).reason, 'ALREADY_ATTEMPTED_IN_PROCESS');
  assert.strictEqual(postApplyNotifications.length, 1);

  const statsPath = path.join(tempDir, 'stats.json');
  fs.writeFileSync(statsPath, JSON.stringify({ version: 4, isExample: false, notices: [], historyResets: [], activeScenarios: [], messages: [
    { id: 'u', createdAt: now.toISOString(), userId: 'user_stats', role: 'user', content: '일반 문장' },
    { id: 'a', createdAt: now.toISOString(), userId: 'user_stats', role: 'assistant', content: '응답', outcome: 'aiSuccess', tokens: { input: 12, output: 8 } },
    { id: 'e', createdAt: now.toISOString(), userId: 'user_stats', role: 'event', content: '', outcome: 'burstLimit' },
    { id: 't', createdAt: now.toISOString(), userId: 'user_stats', role: 'assistant', content: '오류', outcome: 'aiTimeout', error: 'timeout' },
  ] }));
  const stats = createDmChatRepository(statsPath).summarizeToday(now);
  assert.strictEqual(stats.periods.sevenDays.tokens.input, 12);
  assert.strictEqual(stats.periods.sevenDays.aiSuccesses, 1);
  assert.strictEqual(stats.periods.sevenDays.aiTimeouts, 1);
  assert.strictEqual(stats.periods.sevenDays.burstLimitHits, 1);

  const customScenarios = SCENARIOS.filter((scenario) => scenario.pack === 'redefine');
  assert.strictEqual(customScenarios.length, 6);
  customScenarios.forEach((scenario) => assert.strictEqual(findScenarioByName(scenario.name).id, scenario.id));
  assert.match(buildScenarioMenuMessage(), /리디파인 맞춤 연습/);

  const backupPaths = getDefaultSnapshotPaths();
  assert.ok(backupPaths.dmCleanupState.endsWith('dm-chat-cleanup-state.json'));
  assert.ok(backupPaths.dmSafetyReviews.endsWith('dm-safety-reviews.json'));
  const snapshot = collectBackupSnapshot(backupPaths, { now });
  assert.ok(snapshot.manifest.dmCleanupState);
  assert.ok(snapshot.manifest.dmSafetyReviews);

  const flowLogPath = path.join(tempDir, 'flow.json');
  const flowReviewPath = path.join(tempDir, 'flow-reviews.json');
  const flowRepository = createDmChatRepository(flowLogPath);
  const flowReviewRepository = createDmSafetyReviewRepository(flowReviewPath);
  const sent = [];
  const client = { channels: { fetch: async () => ({ send: async (payload) => { sent.push(payload); } }) } };
  const message = {
    content: '괴롭힘 때문에 운영진 확인이 필요해요',
    author: { id: 'flow_user', username: 'flow_user', bot: false },
    channel: { type: ChannelType.DM, send: async (payload) => sent.push(payload), sendTyping: async () => true },
  };
  await handleDmChatMessage(message, client, { repository: flowRepository, safetyReviewRepository: flowReviewRepository });
  const flowData = JSON.parse(fs.readFileSync(flowLogPath, 'utf8'));
  const inputReview = flowReviewRepository.list({ limit: 10 })[0];
  assert.strictEqual(inputReview.sourceLogId, flowData.messages.find((record) => record.role === 'user').id);
  assert.notStrictEqual(inputReview.sourceLogId, flowData.messages.find((record) => record.role === 'assistant').id);

  const outputLogPath = path.join(tempDir, 'output-flow.json');
  const outputReviewRepository = createDmSafetyReviewRepository(path.join(tempDir, 'output-flow-reviews.json'));
  const outputRepository = createDmChatRepository(outputLogPath);
  const outputClient = {
    responses: { create: async () => ({ output_text: '자해 관련 민감 출력', usage: { input_tokens: 3, output_tokens: 2 } }) },
  };
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_MODEL = 'test-model';
  await handleDmChatMessage({
    ...message,
    content: '평범한 첫인사 문장을 연습할래요',
    author: { ...message.author, id: 'output_user' },
  }, client, { repository: outputRepository, safetyReviewRepository: outputReviewRepository, ai: { openaiClient: outputClient } });
  const outputData = JSON.parse(fs.readFileSync(outputLogPath, 'utf8'));
  const outputReview = outputReviewRepository.list({ limit: 10 })[0];
  assert.strictEqual(outputReview.direction, 'output');
  assert.strictEqual(outputReview.sourceLogId, outputData.messages.find((record) => record.role === 'assistant').id);
  assert.notStrictEqual(outputReview.sourceLogId, outputData.messages.find((record) => record.role === 'user').id);
  process.env.AI_PROVIDER = 'mock';

  const failureSent = [];
  const failureRepository = createDmChatRepository(path.join(tempDir, 'queue-failure-flow.json'));
  const failureClient = { channels: { fetch: async () => ({ send: async (payload) => failureSent.push(payload) }) } };
  await handleDmChatMessage({
    ...message,
    channel: { ...message.channel, send: async (payload) => failureSent.push(payload) },
  }, failureClient, {
    repository: failureRepository,
    safetyReviewRepository: { createForDetection: () => { throw new Error('secret raw value must not leak'); } },
  });
  const failureData = JSON.parse(fs.readFileSync(path.join(tempDir, 'queue-failure-flow.json'), 'utf8'));
  assert.ok(failureData.messages.some((record) => record.safetyDetection));
  assert.ok(failureSent.some((payload) => typeof payload === 'string' && /운영진 확인/.test(payload)));
  const serializedFailureOutput = JSON.stringify(failureSent);
  assert.ok(!serializedFailureOutput.includes('secret raw value'));
  assert.ok(serializedFailureOutput.includes('안전 확인 큐 저장 실패'));

  console.log('DM live operation readiness test passed');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
