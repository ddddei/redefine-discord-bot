const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.GOOGLE_SHEETS_LOGGING_ENABLED = 'false';

function setupEnvironment() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'today-mission-auto-publish-'));

  process.env.POINTS_DATA_PATH = path.join(tempDir, 'points.json');
  process.env.SHOP_ITEMS_DATA_PATH = path.join(tempDir, 'shop-items.json');
  process.env.REDEMPTIONS_DATA_PATH = path.join(tempDir, 'redemptions.json');
  process.env.MISSIONS_DATA_PATH = path.join(tempDir, 'missions.json');
  process.env.MISSION_TEMPLATES_DATA_PATH = path.join(tempDir, 'mission-templates.json');
  process.env.SUBMISSIONS_DATA_PATH = path.join(tempDir, 'submissions.json');
  process.env.REACTION_APPROVALS_DATA_PATH = path.join(tempDir, 'reaction-approvals.json');
}

function createClient() {
  const sentMessages = [];
  const channel = {
    id: 'today_mission_channel_test',
    async send(payload) {
      sentMessages.push(payload);
      return { id: `today_mission_${sentMessages.length}`, url: `https://discord.test/${sentMessages.length}` };
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
    TODAY_MISSION_AUTO_PUBLISH_ENABLED: process.env.TODAY_MISSION_AUTO_PUBLISH_ENABLED,
    TODAY_MISSION_AUTO_PUBLISH_HOUR: process.env.TODAY_MISSION_AUTO_PUBLISH_HOUR,
    TODAY_MISSION_CHANNEL_ID: process.env.TODAY_MISSION_CHANNEL_ID,
  };

  try {
    setupEnvironment();

    const {
      getTodayMissionAutoPublishHour,
      isTodayMissionAutoPublishEnabled,
      publishTodayMissionIfDue,
    } = require('../src/todayMissionAutoPublish');
    const { createPointsRepository } = require('../src/pointsRepository');

    process.env.TODAY_MISSION_AUTO_PUBLISH_ENABLED = 'false';
    delete process.env.TODAY_MISSION_AUTO_PUBLISH_HOUR;
    process.env.TODAY_MISSION_CHANNEL_ID = 'today_mission_channel_test';

    assert.strictEqual(isTodayMissionAutoPublishEnabled(), false);
    assert.strictEqual(getTodayMissionAutoPublishHour(), 9);
    process.env.TODAY_MISSION_AUTO_PUBLISH_HOUR = '24';
    assert.strictEqual(getTodayMissionAutoPublishHour(), 9);
    process.env.TODAY_MISSION_AUTO_PUBLISH_HOUR = '9';

    const repository = createPointsRepository();
    const dueDate = new Date('2026-06-04T00:20:00.000Z');

    const disabledClient = createClient();
    const disabledResult = await publishTodayMissionIfDue(disabledClient, { repository, now: dueDate });
    assert.strictEqual(disabledResult.ok, false);
    assert.strictEqual(disabledResult.reason, 'DISABLED');
    assert.strictEqual(disabledClient.sentMessages.length, 0);

    process.env.TODAY_MISSION_AUTO_PUBLISH_ENABLED = 'true';

    const earlyClient = createClient();
    const earlyResult = await publishTodayMissionIfDue(
      earlyClient,
      { repository, now: new Date('2026-06-03T23:20:00.000Z') }
    );
    assert.strictEqual(earlyResult.ok, false);
    assert.strictEqual(earlyResult.reason, 'NOT_SCHEDULED_HOUR');
    assert.strictEqual(earlyClient.sentMessages.length, 0);

    const noMissionClient = createClient();
    const noMissionResult = await publishTodayMissionIfDue(noMissionClient, { repository, now: dueDate });
    assert.strictEqual(noMissionResult.ok, false);
    assert.strictEqual(noMissionResult.reason, 'NO_ACTIVE_MISSION');
    assert.strictEqual(noMissionClient.sentMessages.length, 0);

    const mission = repository.createMission({
      title: '자동 게시 테스트 미션',
      description: '자동 게시 스케줄러 smoke test용 미션입니다.',
      rewardPoints: 25,
      requiresSubmission: true,
      activeDate: '2026-06-04',
      status: 'active',
    });

    delete process.env.TODAY_MISSION_CHANNEL_ID;
    const missingChannelClient = createClient();
    const missingChannelResult = await publishTodayMissionIfDue(missingChannelClient, { repository, now: dueDate });
    assert.strictEqual(missingChannelResult.ok, false);
    assert.strictEqual(missingChannelResult.reason, 'MISSING_CHANNEL_ID');
    process.env.TODAY_MISSION_CHANNEL_ID = 'today_mission_channel_test';

    const client = createClient();
    const result = await publishTodayMissionIfDue(client, { repository, now: dueDate });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.reason, 'PUBLISHED');
    assert.strictEqual(client.sentMessages.length, 1);
    assert.match(client.sentMessages[0].embeds[0].data.description, /자동 게시 테스트 미션/);
    assert.match(client.sentMessages[0].embeds[0].data.description, /25P/);
    assert.ok(repository.hasTodayMissionNoticeBeenPublished('2026-06-04'));

    const duplicateClient = createClient();
    const duplicateResult = await publishTodayMissionIfDue(duplicateClient, { repository, now: dueDate });
    assert.strictEqual(duplicateResult.ok, false);
    assert.strictEqual(duplicateResult.reason, 'ALREADY_PUBLISHED');
    assert.strictEqual(duplicateClient.sentMessages.length, 0);

    const channelNotFoundClient = { channels: { cache: { get: () => null }, fetch: async () => null } };
    const otherDayRepository = createPointsRepository();
    otherDayRepository.createMission({
      title: '다른 날짜 미션',
      description: '채널을 찾지 못하는 경우를 확인하는 미션입니다.',
      rewardPoints: 10,
      requiresSubmission: true,
      activeDate: '2026-06-05',
      status: 'active',
    });
    const channelNotFoundResult = await publishTodayMissionIfDue(
      channelNotFoundClient,
      { repository: otherDayRepository, now: new Date('2026-06-05T00:20:00.000Z') }
    );
    assert.strictEqual(channelNotFoundResult.ok, false);
    assert.strictEqual(channelNotFoundResult.reason, 'CHANNEL_NOT_FOUND');

    console.log('today mission auto publish flow smoke test passed');
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
