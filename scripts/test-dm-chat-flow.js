const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ChannelType } = require('discord.js');
const {
  BURST_LIMIT_FALLBACK,
  NON_MEMBER_NOTICE,
  handleDmChatMessage,
  resetDmChatAccessControlStateForTest,
  splitReplyIntoChunks,
} = require('../src/dmChat');
const {
  resetDmChatSafetyAlertThrottleForTest,
  sendDmChatSafetyAlert,
} = require('../src/dmChatLogging');
const { createDmChatRepository } = require('../src/dmChatRepository');
const { SCENARIOS } = require('../src/dmChatScenarios');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function createClient() {
  const sentLogs = [];

  return {
    sentLogs,
    channels: {
      fetch: async () => ({
        send: async (payload) => {
          sentLogs.push(payload);
          return payload;
        },
      }),
    },
  };
}

function createDmMessage(content, sentMessages = [], authorId = 'participant_dm_test') {
  return {
    content,
    author: {
      id: authorId,
      username: 'participant_dm',
      globalName: '참가자 DM',
      bot: false,
    },
    channel: {
      type: ChannelType.DM,
      send: async (payload) => {
        sentMessages.push(payload);
        return payload;
      },
      sendTyping: async () => true,
    },
  };
}

function createGuildClient({ memberIds = [], failMembersFetch = false } = {}) {
  const sentLogs = [];
  const memberSet = new Set(memberIds);

  return {
    sentLogs,
    channels: {
      fetch: async () => ({
        send: async (payload) => {
          sentLogs.push(payload);
          return payload;
        },
      }),
    },
    guilds: {
      cache: new Map(),
      fetch: async () => ({
        members: {
          cache: new Map(),
          fetch: async (userId) => {
            if (failMembersFetch) {
              throw new Error('member fetch failed (test)');
            }
            if (memberSet.has(userId)) {
              return { id: userId };
            }
            return null;
          },
        },
      }),
    },
  };
}

function createOpenAiClient(outputText) {
  const calls = [];

  return {
    calls,
    responses: {
      create: async (payload) => {
        calls.push(payload);
        return { output_text: outputText };
      },
    },
  };
}

function getEmbedData(payload) {
  const embed = payload && payload.embeds && payload.embeds[0];
  if (!embed) {
    return null;
  }

  if (typeof embed.toJSON === 'function') {
    return embed.toJSON();
  }

  return embed.data || null;
}

function countLogsByTitle(client, title) {
  return client.sentLogs.filter((payload) => {
    const data = getEmbedData(payload);
    return data && data.title === title;
  }).length;
}

function findLogByTitle(client, title) {
  return client.sentLogs.find((payload) => {
    const data = getEmbedData(payload);
    return data && data.title === title;
  });
}

function findEmbedField(payload, name) {
  const data = getEmbedData(payload);
  const fields = data && Array.isArray(data.fields) ? data.fields : [];
  return fields.find((field) => field.name === name) || null;
}

async function main() {
  const previousEnv = {
    AI_ENABLED: process.env.AI_ENABLED,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL: process.env.AI_MODEL,
    DM_CHAT_DAILY_LIMIT: process.env.DM_CHAT_DAILY_LIMIT,
    DM_CHAT_ENABLED: process.env.DM_CHAT_ENABLED,
    DM_CHAT_HISTORY_LIMIT: process.env.DM_CHAT_HISTORY_LIMIT,
    DM_CHAT_LOG_CHANNEL_ID: process.env.DM_CHAT_LOG_CHANNEL_ID,
    SAFETY_ALERT_CHANNEL_ID: process.env.SAFETY_ALERT_CHANNEL_ID,
    SAFETY_ALERT_THROTTLE_MINUTES: process.env.SAFETY_ALERT_THROTTLE_MINUTES,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
    GUILD_ID: process.env.GUILD_ID,
    DM_CHAT_MEMBER_ONLY: process.env.DM_CHAT_MEMBER_ONLY,
    DM_CHAT_BURST_LIMIT_PER_MINUTE: process.env.DM_CHAT_BURST_LIMIT_PER_MINUTE,
    DM_CHAT_RETENTION_DAYS: process.env.DM_CHAT_RETENTION_DAYS,
  };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chat-'));
  const logPath = path.join(tempDir, 'dm-chat-logs.json');

  process.env.AI_ENABLED = 'true';
  process.env.AI_PROVIDER = 'mock';
  process.env.AI_MODEL = '';
  process.env.DM_CHAT_ENABLED = 'true';
  process.env.DM_CHAT_DAILY_LIMIT = '30';
  process.env.DM_CHAT_HISTORY_LIMIT = '8';
  process.env.DM_CHAT_LOG_CHANNEL_ID = 'dm_log_channel_test';
  process.env.SAFETY_ALERT_CHANNEL_ID = 'safety_alert_channel_test';
  process.env.SAFETY_ALERT_THROTTLE_MINUTES = '10';
  process.env.LOG_CHANNEL_ID = '';

  try {
    resetDmChatSafetyAlertThrottleForTest();

    const repository = createDmChatRepository(logPath);
    const client = createClient();
    const sentMessages = [];

    const handled = await handleDmChatMessage(
      createDmMessage('처음 사람들한테 뭐라고 말하면 좋을까?', sentMessages),
      client,
      { repository }
    );

    assert.strictEqual(handled, true);
    assert.strictEqual(sentMessages.length, 2);
    assert.match(sentMessages[0], /운영진이 확인할 수 있어요/);
    assert.match(sentMessages[1], /짧게 연습/);
    assert.strictEqual(client.sentLogs.length, 2);

    const data = readJson(logPath);
    assert.strictEqual(data.notices.length, 1);
    assert.strictEqual(data.messages.length, 2);
    assert.strictEqual(data.messages[0].role, 'user');
    assert.strictEqual(data.messages[1].role, 'assistant');

    const secondMessages = [];
    await handleDmChatMessage(
      createDmMessage('그 다음에는?', secondMessages),
      client,
      { repository }
    );

    assert.strictEqual(secondMessages.length, 1);
    assert.match(secondMessages[0], /짧게 연습/);

    const safetyMessages = [];
    await handleDmChatMessage(
      createDmMessage('계속 괴롭힘을 당하고 있어요', safetyMessages),
      client,
      { repository }
    );

    assert.strictEqual(safetyMessages.length, 1);
    assert.match(safetyMessages[0], /운영진 확인/);

    const nextData = readJson(logPath);
    assert.strictEqual(nextData.notices.length, 1);
    assert.strictEqual(nextData.messages.length, 6);
    assert.strictEqual(nextData.messages[4].safetyDetection.category, 'danger');
    assert.strictEqual(client.sentLogs.length, 7);

    resetDmChatSafetyAlertThrottleForTest();
    const throttleClient = createClient();
    const throttleDetection = {
      category: 'danger',
      severity: 'high',
    };
    const throttleRecord = {
      userId: 'participant_throttle_test',
      displayName: '스로틀 테스트',
      content: '계속 괴롭힘을 당하고 있어요',
    };
    const firstAlert = await sendDmChatSafetyAlert(
      throttleClient,
      throttleRecord,
      throttleDetection,
      { now: '2026-07-03T00:00:00.000Z' }
    );
    const throttledAlert = await sendDmChatSafetyAlert(
      throttleClient,
      throttleRecord,
      throttleDetection,
      { now: '2026-07-03T00:05:00.000Z' }
    );
    const resumedAlert = await sendDmChatSafetyAlert(
      throttleClient,
      throttleRecord,
      throttleDetection,
      { now: '2026-07-03T00:11:00.000Z' }
    );

    assert.strictEqual(firstAlert, true);
    assert.strictEqual(throttledAlert, false);
    assert.strictEqual(resumedAlert, true);
    assert.strictEqual(throttleClient.sentLogs.length, 2);
    const resumedThrottleField = findEmbedField(throttleClient.sentLogs[1], '스로틀 생략');
    assert.ok(resumedThrottleField);
    assert.match(resumedThrottleField.value, /1건/);

    resetDmChatSafetyAlertThrottleForTest();
    process.env.SAFETY_ALERT_THROTTLE_MINUTES = '0';
    const unthrottledClient = createClient();
    await sendDmChatSafetyAlert(
      unthrottledClient,
      throttleRecord,
      throttleDetection,
      { now: '2026-07-03T00:00:00.000Z' }
    );
    await sendDmChatSafetyAlert(
      unthrottledClient,
      throttleRecord,
      throttleDetection,
      { now: '2026-07-03T00:01:00.000Z' }
    );
    assert.strictEqual(unthrottledClient.sentLogs.length, 2);
    process.env.SAFETY_ALERT_THROTTLE_MINUTES = '10';

    process.env.DM_CHAT_ENABLED = 'false';
    const disabledMessages = [];
    const disabledHandled = await handleDmChatMessage(
      createDmMessage('꺼져 있나요?', disabledMessages),
      client,
      { repository }
    );

    assert.strictEqual(disabledHandled, false);
    assert.strictEqual(disabledMessages.length, 0);

    process.env.DM_CHAT_ENABLED = 'true';
    const emptyContentMessages = [];
    const emptyContentHandled = await handleDmChatMessage(
      createDmMessage('', emptyContentMessages),
      client,
      { repository }
    );

    assert.strictEqual(emptyContentHandled, true);
    assert.strictEqual(emptyContentMessages.length, 1);
    assert.match(emptyContentMessages[0], /Message Content Intent/);

    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MODEL = 'test-model';
    process.env.DM_CHAT_DAILY_LIMIT = '1';
    resetDmChatSafetyAlertThrottleForTest();

    const limitRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-limit-logs.json'));
    const limitClient = createClient();
    const limitOpenAiClient = createOpenAiClient('좋아요. 첫 답변입니다.');
    const firstLimitMessages = [];
    await handleDmChatMessage(
      createDmMessage('오늘 첫 연습을 해보고 싶어요', firstLimitMessages),
      limitClient,
      { repository: limitRepository, ai: { openaiClient: limitOpenAiClient } }
    );

    assert.strictEqual(limitOpenAiClient.calls.length, 1);
    assert.strictEqual(firstLimitMessages.length, 2);
    assert.match(firstLimitMessages[1], /첫 답변/);

    const overLimitMessages = [];
    await handleDmChatMessage(
      createDmMessage('한 번 더 연습할래요', overLimitMessages),
      limitClient,
      { repository: limitRepository, ai: { openaiClient: limitOpenAiClient } }
    );

    assert.strictEqual(limitOpenAiClient.calls.length, 1);
    assert.strictEqual(overLimitMessages.length, 1);
    assert.strictEqual(
      overLimitMessages[0],
      '오늘은 연습을 충분히 했어요. 내일 다시 이어서 연습해요. 급한 일이나 어려운 일이 있다면 운영진에게 문의해 주세요.'
    );

    const limitData = readJson(path.join(tempDir, 'dm-chat-limit-logs.json'));
    assert.strictEqual(limitData.messages.length, 4);
    assert.strictEqual(limitData.messages[3].role, 'assistant');
    assert.strictEqual(limitData.messages[3].content, overLimitMessages[0]);

    const overLimitSafetyMessages = [];
    await handleDmChatMessage(
      createDmMessage('계속 괴롭힘을 당하고 있어요', overLimitSafetyMessages),
      limitClient,
      { repository: limitRepository, ai: { openaiClient: limitOpenAiClient } }
    );

    assert.strictEqual(limitOpenAiClient.calls.length, 1);
    assert.strictEqual(overLimitSafetyMessages.length, 1);
    assert.match(overLimitSafetyMessages[0], /운영진 확인/);
    assert.strictEqual(countLogsByTitle(limitClient, 'DM 안전 확인 필요'), 1);

    const throttledSafetyMessages = [];
    await handleDmChatMessage(
      createDmMessage('또 괴롭힘을 당하고 있어요', throttledSafetyMessages),
      limitClient,
      { repository: limitRepository, ai: { openaiClient: limitOpenAiClient } }
    );

    assert.strictEqual(limitOpenAiClient.calls.length, 1);
    assert.strictEqual(throttledSafetyMessages.length, 1);
    assert.strictEqual(countLogsByTitle(limitClient, 'DM 안전 확인 필요'), 1);
    assert.ok(countLogsByTitle(limitClient, 'DM 대화 로그: 참가자') >= 4);

    process.env.DM_CHAT_DAILY_LIMIT = '0';
    const unlimitedMessages = [];
    await handleDmChatMessage(
      createDmMessage('제한을 끄면 다시 연습되나요?', unlimitedMessages),
      limitClient,
      { repository: limitRepository, ai: { openaiClient: limitOpenAiClient } }
    );

    assert.strictEqual(limitOpenAiClient.calls.length, 2);
    assert.strictEqual(unlimitedMessages.length, 1);
    assert.match(unlimitedMessages[0], /첫 답변/);

    process.env.DM_CHAT_DAILY_LIMIT = '30';
    const outputRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-output-logs.json'));
    const outputClient = createClient();
    const outputOpenAiClient = createOpenAiClient('자해하고 싶다는 말을 그대로 보내면 안 됩니다.');
    const outputMessages = [];
    await handleDmChatMessage(
      createDmMessage('평범하게 인사하는 문장을 연습하고 싶어요', outputMessages),
      outputClient,
      { repository: outputRepository, ai: { openaiClient: outputOpenAiClient } }
    );

    assert.strictEqual(outputOpenAiClient.calls.length, 1);
    assert.strictEqual(outputMessages.length, 2);
    assert.strictEqual(outputMessages[1], '지금은 답변을 만들지 못했어요. 잠시 후 다시 말을 걸어 주세요.');
    assert.strictEqual(countLogsByTitle(outputClient, 'DM 안전 확인 필요'), 0);

    const outputData = readJson(path.join(tempDir, 'dm-chat-output-logs.json'));
    assert.strictEqual(outputData.messages.length, 2);
    assert.strictEqual(outputData.messages[1].role, 'assistant');
    assert.strictEqual(outputData.messages[1].content, outputMessages[1]);
    assert.strictEqual(outputData.messages[1].safetyDetection.category, 'selfHarm');
    assert.strictEqual(outputData.messages[1].safetyDetectionSource, 'output');

    const outputBotLog = findLogByTitle(outputClient, 'DM 대화 로그: 봇');
    const outputSafetyField = findEmbedField(outputBotLog, '안전 감지');
    assert.ok(outputSafetyField);
    assert.match(outputSafetyField.value, /출력 감지/);

    process.env.DM_CHAT_DAILY_LIMIT = '30';
    process.env.SAFETY_ALERT_THROTTLE_MINUTES = '10';
    const resetRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-reset-logs.json'));
    const resetClient = createClient();
    const resetOpenAiClient = createOpenAiClient('좋아요. 새 대화를 이어가요.');
    const beforeResetMessages = [];
    await handleDmChatMessage(
      createDmMessage('이전 대화 내용을 기억해줘', beforeResetMessages),
      resetClient,
      { repository: resetRepository, ai: { openaiClient: resetOpenAiClient } }
    );
    assert.strictEqual(resetOpenAiClient.calls.length, 1);

    const resetMessages = [];
    await handleDmChatMessage(
      createDmMessage('  새로 시작  ', resetMessages),
      resetClient,
      { repository: resetRepository, ai: { openaiClient: resetOpenAiClient } }
    );
    assert.strictEqual(resetOpenAiClient.calls.length, 1);
    assert.strictEqual(resetMessages.length, 1);
    assert.strictEqual(resetMessages[0], '좋아요, 새 마음으로 다시 시작해요. 편하게 말을 걸어 주세요.');

    const afterResetMessages = [];
    await handleDmChatMessage(
      createDmMessage('초기화 뒤 첫 대화야', afterResetMessages),
      resetClient,
      { repository: resetRepository, ai: { openaiClient: resetOpenAiClient } }
    );
    assert.strictEqual(resetOpenAiClient.calls.length, 2);
    const afterResetInput = resetOpenAiClient.calls[1].input;
    assert.ok(afterResetInput.some((item) => item.role === 'user' && item.content === '초기화 뒤 첫 대화야'));
    assert.ok(!afterResetInput.some((item) => /이전 대화 내용을 기억해줘/.test(item.content)));

    const resetData = readJson(path.join(tempDir, 'dm-chat-reset-logs.json'));
    assert.strictEqual(resetData.version, 4);
    assert.strictEqual(resetData.historyResets.length, 1);
    assert.strictEqual(resetData.messages.length, 6);

    const versionTwoPath = path.join(tempDir, 'dm-chat-v2-logs.json');
    fs.writeFileSync(versionTwoPath, `${JSON.stringify({
      version: 2,
      notices: [],
      messages: [],
    }, null, 2)}\n`);
    const versionTwoRepository = createDmChatRepository(versionTwoPath);
    assert.deepStrictEqual(versionTwoRepository.listRecentMessages('missing_user'), []);
    versionTwoRepository.recordHistoryReset({ id: 'v2_user', username: 'v2_user' }, '2026-07-03T00:00:00.000Z');
    const normalizedVersionTwoData = readJson(versionTwoPath);
    assert.strictEqual(normalizedVersionTwoData.version, 4);
    assert.strictEqual(normalizedVersionTwoData.historyResets.length, 1);

    // --- 작업 C: 스키마 v3 파일 관용 로드 + 기존 사용자 notice v2 재고지 1회 ---
    const versionThreePath = path.join(tempDir, 'dm-chat-v3-logs.json');
    fs.writeFileSync(versionThreePath, `${JSON.stringify({
      version: 3,
      notices: [{
        userId: 'v3_existing_user',
        username: 'v3_existing_user',
        displayName: 'v3 기존 사용자',
        sentAt: '2026-06-01T00:00:00.000Z',
        // noticeVersion 없음 (v1 취급)
      }],
      messages: [],
      historyResets: [],
    }, null, 2)}\n`);

    const versionThreeRepository = createDmChatRepository(versionThreePath);
    assert.strictEqual(versionThreeRepository.hasNotice('v3_existing_user'), false, 'v1 고지만 받은 기존 사용자는 v2 재고지 대상입니다.');

    const renoticeClient = createClient();
    const renoticeMessages = [];
    await handleDmChatMessage(
      createDmMessage('안녕하세요, 다시 왔어요', renoticeMessages, 'v3_existing_user'),
      renoticeClient,
      { repository: versionThreeRepository }
    );
    assert.strictEqual(renoticeMessages.length, 2, '기존 사용자도 notice v2 재고지를 1회 받아야 합니다.');
    assert.match(renoticeMessages[0], /자동 정리/);
    assert.match(renoticeMessages[0], /연습 메뉴/);

    const renoticeMessagesSecond = [];
    await handleDmChatMessage(
      createDmMessage('또 왔어요', renoticeMessagesSecond, 'v3_existing_user'),
      renoticeClient,
      { repository: versionThreeRepository }
    );
    assert.strictEqual(renoticeMessagesSecond.length, 1, '재고지는 1회만 발송되어야 합니다.');

    const versionThreeData = readJson(versionThreePath);
    assert.strictEqual(versionThreeData.version, 4);
    assert.strictEqual(versionThreeData.notices[0].noticeVersion, 2);

    // DM_CHAT_RETENTION_DAYS 값에 따라 안내 문구가 렌더링되는지 확인
    process.env.DM_CHAT_RETENTION_DAYS = '30';
    const customRetentionRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-retention-notice-logs.json'));
    const customRetentionMessages = [];
    await handleDmChatMessage(
      createDmMessage('안녕하세요', customRetentionMessages, 'retention_notice_user'),
      createClient(),
      { repository: customRetentionRepository }
    );
    assert.match(customRetentionMessages[0], /30일 뒤 자동 정리/);

    process.env.DM_CHAT_RETENTION_DAYS = '0';
    const unlimitedRetentionRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-retention-unlimited-logs.json'));
    const unlimitedRetentionMessages = [];
    await handleDmChatMessage(
      createDmMessage('안녕하세요', unlimitedRetentionMessages, 'retention_unlimited_user'),
      createClient(),
      { repository: unlimitedRetentionRepository }
    );
    assert.match(unlimitedRetentionMessages[0], /운영 종료 시까지 보관/);
    process.env.DM_CHAT_RETENTION_DAYS = '90';

    // --- 작업 A: 서버 멤버 확인 ---
    process.env.AI_PROVIDER = 'mock';
    process.env.AI_MODEL = '';
    process.env.DM_CHAT_DAILY_LIMIT = '30';
    process.env.GUILD_ID = 'guild_test';
    process.env.DM_CHAT_MEMBER_ONLY = 'true';
    resetDmChatAccessControlStateForTest();
    resetDmChatSafetyAlertThrottleForTest();

    const memberRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-member-logs.json'));
    const nonMemberClient = createGuildClient({ memberIds: [] });
    const nonMemberMessagesFirst = [];
    const nonMemberHandledFirst = await handleDmChatMessage(
      createDmMessage('안녕하세요, 비멤버입니다', nonMemberMessagesFirst, 'non_member_user'),
      nonMemberClient,
      { repository: memberRepository }
    );
    assert.strictEqual(nonMemberHandledFirst, true);
    assert.strictEqual(nonMemberMessagesFirst.length, 1);
    assert.strictEqual(nonMemberMessagesFirst[0], NON_MEMBER_NOTICE);

    const nonMemberMessagesSecond = [];
    await handleDmChatMessage(
      createDmMessage('또 보냅니다', nonMemberMessagesSecond, 'non_member_user'),
      nonMemberClient,
      { repository: memberRepository }
    );
    assert.strictEqual(nonMemberMessagesSecond.length, 0, '비멤버는 두 번째부터 침묵해야 합니다.');

    assert.strictEqual(fs.existsSync(path.join(tempDir, 'dm-chat-member-logs.json')), false, '비멤버 메시지는 기록/AI 호출 대상이 아닙니다.');

    // 민감 표현을 보낸 비멤버도 감지·알림 대상이 아니다(계획서 1.1 예외).
    resetDmChatAccessControlStateForTest();
    const nonMemberSensitiveMessages = [];
    await handleDmChatMessage(
      createDmMessage('계속 괴롭힘을 당하고 있어요', nonMemberSensitiveMessages, 'non_member_sensitive_user'),
      nonMemberClient,
      { repository: memberRepository }
    );
    assert.strictEqual(nonMemberSensitiveMessages.length, 1);
    assert.strictEqual(nonMemberSensitiveMessages[0], NON_MEMBER_NOTICE);
    assert.strictEqual(fs.existsSync(path.join(tempDir, 'dm-chat-member-logs.json')), false);

    // 멤버 확인 API 오류는 허용 쪽 폴백
    resetDmChatAccessControlStateForTest();
    const failingMembersClient = createGuildClient({ failMembersFetch: true });
    const fallbackMessages = [];
    const fallbackHandled = await handleDmChatMessage(
      createDmMessage('멤버 확인 실패 상황', fallbackMessages, 'fallback_user'),
      failingMembersClient,
      { repository: memberRepository }
    );
    assert.strictEqual(fallbackHandled, true);
    assert.ok(fallbackMessages.length >= 1);
    assert.match(fallbackMessages[0], /운영진이 확인할 수 있어요/);

    // 정상 멤버는 평소대로 응답
    resetDmChatAccessControlStateForTest();
    const memberClient = createGuildClient({ memberIds: ['real_member_user'] });
    const memberMessages = [];
    const memberHandled = await handleDmChatMessage(
      createDmMessage('저는 서버 멤버예요', memberMessages, 'real_member_user'),
      memberClient,
      { repository: memberRepository }
    );
    assert.strictEqual(memberHandled, true);
    assert.strictEqual(memberMessages.length, 2);
    assert.match(memberMessages[1], /짧게 연습/);

    // DM_CHAT_MEMBER_ONLY=false로 개별 해제 가능해야 한다.
    resetDmChatAccessControlStateForTest();
    process.env.DM_CHAT_MEMBER_ONLY = 'false';
    const disabledMemberCheckClient = createGuildClient({ memberIds: [] });
    const disabledMemberCheckMessages = [];
    await handleDmChatMessage(
      createDmMessage('멤버 확인이 꺼진 상태', disabledMemberCheckMessages, 'no_member_check_user'),
      disabledMemberCheckClient,
      { repository: memberRepository }
    );
    assert.strictEqual(disabledMemberCheckMessages.length, 2, 'DM_CHAT_MEMBER_ONLY=false면 비멤버도 응답을 받는다.');
    process.env.DM_CHAT_MEMBER_ONLY = 'true';
    delete process.env.GUILD_ID;
    resetDmChatAccessControlStateForTest();

    // --- 작업 A: 분당 버스트 제한 ---
    process.env.DM_CHAT_BURST_LIMIT_PER_MINUTE = '2';
    const burstRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-burst-logs.json'));
    const burstClient = createClient();

    for (let index = 0; index < 2; index += 1) {
      const burstMessages = [];
      // eslint-disable-next-line no-await-in-loop
      await handleDmChatMessage(
        createDmMessage(`빠르게 보내는 메시지 ${index}`, burstMessages, 'burst_user'),
        burstClient,
        { repository: burstRepository }
      );
      const expectedLength = index === 0 ? 2 : 1; // 첫 메시지에는 첫 안내가 함께 전송된다.
      assert.strictEqual(burstMessages.length, expectedLength, `초과 전 ${index}번째 메시지는 정상 응답해야 합니다.`);
    }

    const burstOverMessagesFirst = [];
    await handleDmChatMessage(
      createDmMessage('세 번째 빠른 메시지', burstOverMessagesFirst, 'burst_user'),
      burstClient,
      { repository: burstRepository }
    );
    assert.strictEqual(burstOverMessagesFirst.length, 1);
    assert.strictEqual(burstOverMessagesFirst[0], BURST_LIMIT_FALLBACK);

    const burstOverMessagesSecond = [];
    await handleDmChatMessage(
      createDmMessage('네 번째 빠른 메시지', burstOverMessagesSecond, 'burst_user'),
      burstClient,
      { repository: burstRepository }
    );
    assert.strictEqual(burstOverMessagesSecond.length, 0, '분당 제한 안내는 1분에 1회만 발송해야 합니다.');

    // 분당 제한 상태에서도 민감 메시지는 안전 알림 흐름을 그대로 수행한다.
    const burstSensitiveMessages = [];
    await handleDmChatMessage(
      createDmMessage('계속 괴롭힘을 당하고 있어요', burstSensitiveMessages, 'burst_user'),
      burstClient,
      { repository: burstRepository }
    );
    assert.strictEqual(burstSensitiveMessages.length, 1);
    assert.match(burstSensitiveMessages[0], /운영진 확인/);

    process.env.DM_CHAT_BURST_LIMIT_PER_MINUTE = '0';
    const burstDisabledMessages = [];
    await handleDmChatMessage(
      createDmMessage('제한이 꺼진 상태에서 계속 보내기', burstDisabledMessages, 'burst_user'),
      burstClient,
      { repository: burstRepository }
    );
    assert.strictEqual(burstDisabledMessages.length, 1, 'DM_CHAT_BURST_LIMIT_PER_MINUTE=0이면 제한이 해제됩니다.');
    process.env.DM_CHAT_BURST_LIMIT_PER_MINUTE = '5';

    // --- 작업 A: 사용자별 순차 처리 ---
    const sequentialRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-sequential-logs.json'));
    const sequentialClient = createClient();
    const callOrder = [];
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    const sequentialOpenAiClient = {
      responses: {
        create: async (payload) => {
          const text = payload.input[payload.input.length - 1].content;
          if (text.includes('첫 번째')) {
            callOrder.push('start-1');
            await firstGate;
            callOrder.push('end-1');
            return { output_text: '첫 응답' };
          }
          callOrder.push('start-2');
          callOrder.push('end-2');
          return { output_text: '두 번째 응답' };
        },
      },
    };
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MODEL = 'test-model';

    const sequentialMessagesA = [];
    const sequentialMessagesB = [];
    const firstCallPromise = handleDmChatMessage(
      createDmMessage('첫 번째 메시지', sequentialMessagesA, 'sequential_user'),
      sequentialClient,
      { repository: sequentialRepository, ai: { openaiClient: sequentialOpenAiClient } }
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    const secondCallPromise = handleDmChatMessage(
      createDmMessage('두 번째 메시지', sequentialMessagesB, 'sequential_user'),
      sequentialClient,
      { repository: sequentialRepository, ai: { openaiClient: sequentialOpenAiClient } }
    );
    await new Promise((resolve) => setTimeout(resolve, 10));
    releaseFirst();
    await Promise.all([firstCallPromise, secondCallPromise]);

    assert.deepStrictEqual(callOrder, ['start-1', 'end-1', 'start-2', 'end-2'], '같은 사용자의 두 번째 AI 호출은 첫 번째 완료 후 순차 실행되어야 합니다.');
    assert.match(sequentialMessagesA[sequentialMessagesA.length - 1], /첫 응답/);
    assert.match(sequentialMessagesB[sequentialMessagesB.length - 1], /두 번째 응답/);

    process.env.AI_PROVIDER = 'mock';
    process.env.AI_MODEL = '';

    // --- 작업 B: 2,000자 문장 경계 분할 ---
    const shortReply = '안녕하세요. 짧은 문장입니다.';
    assert.deepStrictEqual(splitReplyIntoChunks(shortReply), [shortReply]);

    const longSentence = '이 문장은 매우 깁니다. '.repeat(120); // 문장 경계 다수 포함, 2000자 초과
    const longChunks = splitReplyIntoChunks(longSentence);
    assert.ok(longChunks.length <= 2, '분할은 최대 2조각까지만 허용합니다.');
    assert.ok(longChunks.every((chunk) => chunk.length <= 2000), '각 조각은 Discord 한도를 넘지 않아야 합니다.');

    const veryLongSentence = 'ㄱ'.repeat(5000); // 문장 경계가 없는 초과 텍스트 (2조각 후 절단)
    const veryLongChunks = splitReplyIntoChunks(veryLongSentence);
    assert.strictEqual(veryLongChunks.length, 2);
    assert.ok(veryLongChunks[1].endsWith('…'), '두 번째 조각을 넘는 내용은 절단 표시(…)로 마무리합니다.');

    const splitSendRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-split-logs.json'));
    const splitSendClient = createClient();
    const longMockText = '안녕하세요, 짧은 응답 연습을 해봐요. '.repeat(150);
    const splitOpenAiClient = createOpenAiClient(longMockText);
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MODEL = 'test-model';
    const splitSentMessages = [];
    await handleDmChatMessage(
      createDmMessage('긴 응답을 받아보고 싶어요', splitSentMessages, 'split_reply_user'),
      splitSendClient,
      { repository: splitSendRepository, ai: { openaiClient: splitOpenAiClient } }
    );
    // 첫 안내 1개 + 분할된 응답(최대 2개)
    assert.ok(splitSentMessages.length >= 2 && splitSentMessages.length <= 3);
    assert.ok(splitSentMessages[splitSentMessages.length - 1].length <= 2000);
    process.env.AI_PROVIDER = 'mock';
    process.env.AI_MODEL = '';

    // --- 작업 B: 전역 AI 오류 경고 (10분 5회 스로틀 1회) ---
    resetDmChatAccessControlStateForTest();
    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MODEL = 'test-model';
    const errorAlertRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-error-alert-logs.json'));
    const erroringOpenAiClient = {
      responses: {
        create: async () => {
          throw new Error('모의 OpenAI 오류');
        },
      },
    };
    const errorAlertClient = createClient();

    for (let index = 0; index < 5; index += 1) {
      const errMessages = [];
      // eslint-disable-next-line no-await-in-loop
      await handleDmChatMessage(
        createDmMessage(`오류 유발 메시지 ${index}`, errMessages, `error_alert_user_${index}`),
        errorAlertClient,
        { repository: errorAlertRepository, ai: { openaiClient: erroringOpenAiClient } }
      );
    }

    assert.strictEqual(countLogsByTitle(errorAlertClient, 'DM 대화 AI 응답 오류 경고'), 1, '10분 내 5회 오류 시 경고가 1회 발송되어야 합니다.');

    const errMessagesSixth = [];
    await handleDmChatMessage(
      createDmMessage('오류 유발 메시지 6', errMessagesSixth, 'error_alert_user_5'),
      errorAlertClient,
      { repository: errorAlertRepository, ai: { openaiClient: erroringOpenAiClient } }
    );
    assert.strictEqual(countLogsByTitle(errorAlertClient, 'DM 대화 AI 응답 오류 경고'), 1, '스로틀 구간 내 추가 경고는 생략됩니다.');

    process.env.AI_PROVIDER = 'mock';
    process.env.AI_MODEL = '';
    resetDmChatAccessControlStateForTest();

    // --- 작업 E: 연습 시나리오 6종 + 연습 정리 ---
    assert.strictEqual(SCENARIOS.length, 6);

    process.env.DM_CHAT_BURST_LIMIT_PER_MINUTE = '0';
    const scenarioRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-scenario-logs.json'));
    const scenarioClient = createClient();

    const menuMessages = [];
    await handleDmChatMessage(
      createDmMessage('연습 메뉴', menuMessages, 'scenario_user'),
      scenarioClient,
      { repository: scenarioRepository }
    );
    // 첫 안내 1개 + 메뉴 안내
    assert.strictEqual(menuMessages.length, 2);
    assert.match(menuMessages[1], /첫인사/);
    assert.match(menuMessages[1], /자기소개/);
    assert.match(menuMessages[1], /부탁하기/);
    assert.match(menuMessages[1], /거절하기/);
    assert.match(menuMessages[1], /잡담/);
    assert.match(menuMessages[1], /면접/);

    const startMessages = [];
    await handleDmChatMessage(
      createDmMessage('연습: 첫인사', startMessages, 'scenario_user'),
      scenarioClient,
      { repository: scenarioRepository }
    );
    assert.strictEqual(startMessages.length, 1);
    assert.match(startMessages[0], /첫인사/);

    const invalidScenarioMessages = [];
    await handleDmChatMessage(
      createDmMessage('연습: 없는주제', invalidScenarioMessages, 'scenario_user'),
      scenarioClient,
      { repository: scenarioRepository }
    );
    assert.strictEqual(invalidScenarioMessages.length, 1);
    assert.match(invalidScenarioMessages[0], /찾을 수 없어요/);

    // 시작 실패 후에도 이전 시나리오(첫인사)가 유지되어 있어야 한다.
    await handleDmChatMessage(
      createDmMessage('연습: 첫인사', [], 'scenario_user'),
      scenarioClient,
      { repository: scenarioRepository }
    );

    process.env.AI_PROVIDER = 'openai';
    process.env.AI_MODEL = 'test-model';
    const scenarioAiClient = createOpenAiClient('안녕하세요! 만나서 반가워요.');
    const scenarioReplyMessages = [];
    await handleDmChatMessage(
      createDmMessage('안녕하세요, 처음 뵙겠습니다', scenarioReplyMessages, 'scenario_user'),
      scenarioClient,
      { repository: scenarioRepository, ai: { openaiClient: scenarioAiClient } }
    );
    assert.strictEqual(scenarioReplyMessages.length, 1);
    const scenarioCallInput = scenarioAiClient.calls[scenarioAiClient.calls.length - 1].input;
    const scenarioDeveloperMessage = scenarioCallInput.find((item) => item.role === 'developer');
    assert.match(scenarioDeveloperMessage.content, /상대 역/);
    assert.match(scenarioDeveloperMessage.content, /평가·점수·등급/);

    // 시나리오 중에도 민감 감지가 우선한다.
    const scenarioSensitiveMessages = [];
    await handleDmChatMessage(
      createDmMessage('계속 괴롭힘을 당하고 있어요', scenarioSensitiveMessages, 'scenario_user'),
      scenarioClient,
      { repository: scenarioRepository, ai: { openaiClient: scenarioAiClient } }
    );
    assert.strictEqual(scenarioSensitiveMessages.length, 1);
    assert.match(scenarioSensitiveMessages[0], /운영진 확인/);

    const endMessages = [];
    await handleDmChatMessage(
      createDmMessage('연습 끝', endMessages, 'scenario_user'),
      scenarioClient,
      { repository: scenarioRepository }
    );
    assert.strictEqual(endMessages.length, 1);
    assert.match(endMessages[0], /연습을 마칠게요/);

    // 연습 끝 이후에는 시나리오 지침 없이 평소대로 응답한다.
    const afterEndAiClient = createOpenAiClient('평소 응답입니다.');
    const afterEndMessages = [];
    await handleDmChatMessage(
      createDmMessage('그냥 평소처럼 이야기해요', afterEndMessages, 'scenario_user'),
      scenarioClient,
      { repository: scenarioRepository, ai: { openaiClient: afterEndAiClient } }
    );
    const afterEndInput = afterEndAiClient.calls[afterEndAiClient.calls.length - 1].input;
    const afterEndDeveloperMessage = afterEndInput.find((item) => item.role === 'developer');
    assert.ok(!/상대 역을 연기한다/.test(afterEndDeveloperMessage.content));

    process.env.DM_CHAT_BURST_LIMIT_PER_MINUTE = '5';

    // --- 작업 E: 오늘 연습 정리 ---
    const recapRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-recap-logs.json'));
    const recapClient = createClient();

    const emptyRecapMessages = [];
    await handleDmChatMessage(
      createDmMessage('오늘 연습 정리', emptyRecapMessages, 'recap_user'),
      recapClient,
      { repository: recapRepository }
    );
    // 첫 안내 + "기록 없음" 안내
    assert.strictEqual(emptyRecapMessages.length, 2);
    assert.match(emptyRecapMessages[1], /아직 연습 기록이 없어요/);

    process.env.AI_PROVIDER = 'mock';
    process.env.AI_MODEL = '';
    const recapPreMessages = [];
    await handleDmChatMessage(
      createDmMessage('오늘 처음 말 걸어봤어요', recapPreMessages, 'recap_user'),
      recapClient,
      { repository: recapRepository }
    );

    const recapMessages = [];
    await handleDmChatMessage(
      createDmMessage('오늘 연습 정리', recapMessages, 'recap_user'),
      recapClient,
      { repository: recapRepository }
    );
    assert.strictEqual(recapMessages.length, 1);
    assert.ok(!/\d+점|등급|평가 결과/.test(recapMessages[0]), '리캡 문구에는 평가·점수·등급 표현이 없어야 합니다.');

    const recapData = readJson(path.join(tempDir, 'dm-chat-recap-logs.json'));
    const recapAssistantRecord = recapData.messages
      .filter((record) => record.userId === 'recap_user' && record.role === 'assistant')
      .slice(-1)[0];
    assert.strictEqual(recapAssistantRecord.content, recapMessages[0]);

    process.env.AI_PROVIDER = 'mock';
    process.env.AI_MODEL = '';
    resetDmChatAccessControlStateForTest();

    // --- 작업 E: activeScenarios는 다음 날(KST) 자동 해제된다 ---
    const scenarioResetRepository = createDmChatRepository(path.join(tempDir, 'dm-chat-scenario-reset-logs.json'));
    scenarioResetRepository.setActiveScenario('scenario_reset_user', 'greeting', '2026-07-01T00:00:00.000Z');
    assert.ok(scenarioResetRepository.getActiveScenario('scenario_reset_user', new Date('2026-07-01T12:00:00.000Z')));
    assert.strictEqual(scenarioResetRepository.getActiveScenario('scenario_reset_user', new Date('2026-07-02T12:00:00.000Z')), null);
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  console.log('DM chat flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
