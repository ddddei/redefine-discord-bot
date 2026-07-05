const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ChannelType } = require('discord.js');
const { handleDmChatMessage } = require('../src/dmChat');
const {
  resetDmChatSafetyAlertThrottleForTest,
  sendDmChatSafetyAlert,
} = require('../src/dmChatLogging');
const { createDmChatRepository } = require('../src/dmChatRepository');

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

function createDmMessage(content, sentMessages = []) {
  return {
    content,
    author: {
      id: 'participant_dm_test',
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
    assert.strictEqual(resetData.version, 3);
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
    assert.strictEqual(normalizedVersionTwoData.version, 3);
    assert.strictEqual(normalizedVersionTwoData.historyResets.length, 1);
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
