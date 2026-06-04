const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  buildDailyMissionAnnouncementMessage,
  getDailyMissionAnnouncementChannelId,
  getDailyMissionAnnouncementHour,
  isDailyMissionAnnouncementEnabled,
  sendDailyMissionAnnouncementIfDue,
} = require('../src/dailyMissionAnnouncement');

function createTempStatePath() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-mission-announcement-'));
  return path.join(tempDir, 'announcements.json');
}

function createClient() {
  const sentMessages = [];
  const channel = {
    id: 'announcement_channel_test',
    async send(payload) {
      sentMessages.push(payload);
      return { id: `announcement_${sentMessages.length}` };
    },
  };

  return {
    sentMessages,
    channels: {
      cache: {
        get: (channelId) => (channelId === channel.id ? channel : null),
      },
      fetch: async (channelId) => (channelId === channel.id ? channel : null),
    },
  };
}

async function main() {
  const previousEnv = {
    DAILY_MISSION_ANNOUNCEMENT_ENABLED: process.env.DAILY_MISSION_ANNOUNCEMENT_ENABLED,
    DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID: process.env.DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID,
    DAILY_MISSION_ANNOUNCEMENT_HOUR: process.env.DAILY_MISSION_ANNOUNCEMENT_HOUR,
    TODAY_MISSION_CHANNEL_ID: process.env.TODAY_MISSION_CHANNEL_ID,
  };

  try {
    process.env.DAILY_MISSION_ANNOUNCEMENT_ENABLED = 'false';
    process.env.DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID = 'announcement_channel_test';
    process.env.TODAY_MISSION_CHANNEL_ID = 'today_mission_channel_test';
    delete process.env.DAILY_MISSION_ANNOUNCEMENT_HOUR;

    assert.strictEqual(isDailyMissionAnnouncementEnabled(), false);
    assert.strictEqual(getDailyMissionAnnouncementHour(), 9);
    assert.strictEqual(getDailyMissionAnnouncementChannelId(), 'announcement_channel_test');

    delete process.env.DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID;
    assert.strictEqual(getDailyMissionAnnouncementChannelId(), 'today_mission_channel_test');

    process.env.DAILY_MISSION_ANNOUNCEMENT_HOUR = '24';
    assert.strictEqual(getDailyMissionAnnouncementHour(), 9);
    process.env.DAILY_MISSION_ANNOUNCEMENT_HOUR = '8';
    assert.strictEqual(getDailyMissionAnnouncementHour(), 8);

    const message = buildDailyMissionAnnouncementMessage();
    assert.match(message.content, /오늘의 미션은 사진으로 인증/);
    assert.match(message.content, /#오늘의-미션 채널에 사진 업로드/);
    assert.match(message.content, /운영자가 확인하면 포인트 지급/);
    assert.match(message.content, /하루 1회만 지급/);

    process.env.DAILY_MISSION_ANNOUNCEMENT_ENABLED = 'true';
    process.env.DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID = 'announcement_channel_test';
    process.env.DAILY_MISSION_ANNOUNCEMENT_HOUR = '9';

    const client = createClient();
    const statePath = createTempStatePath();
    const dueDate = new Date('2026-06-04T00:20:00.000Z');
    const firstResult = await sendDailyMissionAnnouncementIfDue(client, { statePath, now: dueDate });

    assert.strictEqual(firstResult.ok, true);
    assert.strictEqual(firstResult.reason, 'SENT');
    assert.strictEqual(client.sentMessages.length, 1);

    const secondResult = await sendDailyMissionAnnouncementIfDue(createClient(), { statePath, now: dueDate });
    assert.strictEqual(secondResult.ok, false);
    assert.strictEqual(secondResult.reason, 'ALREADY_SENT_TODAY');

    const earlyClient = createClient();
    const earlyResult = await sendDailyMissionAnnouncementIfDue(
      earlyClient,
      { statePath: createTempStatePath(), now: new Date('2026-06-03T23:20:00.000Z') }
    );
    assert.strictEqual(earlyResult.ok, false);
    assert.strictEqual(earlyResult.reason, 'NOT_SCHEDULED_HOUR');
    assert.strictEqual(earlyClient.sentMessages.length, 0);

    process.env.DAILY_MISSION_ANNOUNCEMENT_ENABLED = 'false';
    const disabledClient = createClient();
    const disabledResult = await sendDailyMissionAnnouncementIfDue(
      disabledClient,
      { statePath: createTempStatePath(), now: dueDate }
    );
    assert.strictEqual(disabledResult.ok, false);
    assert.strictEqual(disabledResult.reason, 'DISABLED');
    assert.strictEqual(disabledClient.sentMessages.length, 0);

    console.log('daily mission announcement flow smoke test passed');
  } finally {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
