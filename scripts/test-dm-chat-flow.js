const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ChannelType } = require('discord.js');
const { handleDmChatMessage } = require('../src/dmChat');
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

async function main() {
  const previousEnv = {
    AI_ENABLED: process.env.AI_ENABLED,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL: process.env.AI_MODEL,
    DM_CHAT_ENABLED: process.env.DM_CHAT_ENABLED,
    DM_CHAT_HISTORY_LIMIT: process.env.DM_CHAT_HISTORY_LIMIT,
    DM_CHAT_LOG_CHANNEL_ID: process.env.DM_CHAT_LOG_CHANNEL_ID,
    SAFETY_ALERT_CHANNEL_ID: process.env.SAFETY_ALERT_CHANNEL_ID,
    LOG_CHANNEL_ID: process.env.LOG_CHANNEL_ID,
  };
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-chat-'));
  const logPath = path.join(tempDir, 'dm-chat-logs.json');

  process.env.AI_ENABLED = 'true';
  process.env.AI_PROVIDER = 'mock';
  process.env.AI_MODEL = '';
  process.env.DM_CHAT_ENABLED = 'true';
  process.env.DM_CHAT_HISTORY_LIMIT = '8';
  process.env.DM_CHAT_LOG_CHANNEL_ID = 'dm_log_channel_test';
  process.env.SAFETY_ALERT_CHANNEL_ID = 'safety_alert_channel_test';
  process.env.LOG_CHANNEL_ID = '';

  try {
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
