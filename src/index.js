require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { handleInteractionCreate } = require('./handlers');
const {
  handleMissionReactionApproval,
  handleMissionSubmissionGuidanceMessage,
} = require('./reactionApproval');
const { startAdminServer } = require('./adminServer');
const { startDailyMissionAnnouncementScheduler } = require('./dailyMissionAnnouncement');
const { startTodayMissionAutoPublishScheduler } = require('./todayMissionAutoPublish');
const { handleTodayMissionMessageCreate } = require('./todayMission');
const {
  startOperationBackupReminder,
} = require('./logging');
const { startOperationBackupScheduler } = require('./operationBackup');
const {
  findFaqAnswer,
  findKnowledgeAnswer,
  normalizeText,
  scoreFaqItem,
} = require('./search');

console.log('봇 실행 준비 중...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
  ],
});

client.once('clientReady', () => {
  console.log(`${client.user.tag} 봇이 준비됐어요.`);
  startDailyMissionAnnouncementScheduler(client);
  startTodayMissionAutoPublishScheduler(client);
  startOperationBackupReminder(client);
  startOperationBackupScheduler(client);
});

client.on('interactionCreate', handleInteractionCreate);

client.on('messageCreate', async (message) => {
  await handleTodayMissionMessageCreate(message, client);
  try {
    await handleMissionSubmissionGuidanceMessage(message);
  } catch (error) {
    console.warn('미션 인증 채널 자동 안내 처리 실패:', error.message);
  }
});

client.on('messageReactionAdd', async (reaction, user) => {
  await handleMissionReactionApproval(reaction, user, client);
});

if (require.main === module) {
  try {
    startAdminServer();
  } catch (error) {
    console.warn('관리자 대시보드 초기화 실패:', error.message);
  }

  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('봇 로그인 실패:', error);
  });
}

module.exports = {
  client,
  findFaqAnswer,
  findKnowledgeAnswer,
  handleInteractionCreate,
  handleMissionReactionApproval,
  handleMissionSubmissionGuidanceMessage,
  handleTodayMissionMessageCreate,
  normalizeText,
  scoreFaqItem,
};
