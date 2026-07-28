require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { handleInteractionCreate } = require('./handlers');
const { handleDmChatMessage, logDmChatConfiguration } = require('./dmChat');
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
const { startDmChatCleanupScheduler } = require('./dmChatCleanup');
const { startOpsReminder } = require('./opsReminder');
const { startWeeklyOpsReportScheduler } = require('./weeklyOpsReportScheduler');
const {
  createWelcomeOnboardingConfig,
  getWelcomeOnboardingStore,
  handleGuildMemberAdd,
  startWelcomeOnboardingScheduler,
} = require('./welcomeOnboarding');
const { createPointsRepository } = require('./pointsRepository');
const { enforceOperationDataPreflight } = require('./operationDataPaths');
const {
  findFaqAnswer,
  findKnowledgeAnswer,
  normalizeText,
  scoreFaqItem,
} = require('./search');

console.log('봇 실행 준비 중...');

const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.DirectMessages,
  GatewayIntentBits.GuildMessageReactions,
  GatewayIntentBits.MessageContent,
];
if (process.env.WELCOME_ONBOARDING_ENABLED === 'true') {
  intents.push(GatewayIntentBits.GuildMembers);
}

const client = new Client({
  intents,
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
  ],
});

const operationRepository = createPointsRepository();
const welcomeOnboardingConfig = createWelcomeOnboardingConfig();
const welcomeOnboardingStore = getWelcomeOnboardingStore();

client.once('clientReady', () => {
  console.log(`${client.user.tag} 봇이 준비됐어요.`);
  logDmChatConfiguration();
  startDailyMissionAnnouncementScheduler(client);
  startTodayMissionAutoPublishScheduler(client);
  startOperationBackupReminder(client);
  startOperationBackupScheduler(client);
  startDmChatCleanupScheduler(client);
  startOpsReminder({ client, repository: operationRepository });
  startWeeklyOpsReportScheduler({ client, repository: operationRepository });
  startWelcomeOnboardingScheduler(client);
});

client.on('interactionCreate', handleInteractionCreate);

client.on('messageCreate', async (message) => {
  if (await handleDmChatMessage(message, client)) {
    return;
  }

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

client.on('guildMemberAdd', async (member) => {
  try {
    await handleGuildMemberAdd(member, {
      config: welcomeOnboardingConfig,
      store: welcomeOnboardingStore,
      log: (message, error) => console.warn(`${message}:`, error.message),
    });
  } catch (error) {
    console.error('신규 입장자 환영 처리 실패:', error.message);
  }
});

if (require.main === module) {
  try {
    enforceOperationDataPreflight();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  try {
    startAdminServer({ client, repository: operationRepository });
  } catch (error) {
    console.warn('관리자 대시보드 초기화 실패:', error.message);
  }

  client.login(process.env.DISCORD_TOKEN).catch((error) => {
    console.error('봇 로그인 실패:', error);
  });
}

module.exports = {
  client,
  handleDmChatMessage,
  logDmChatConfiguration,
  findFaqAnswer,
  findKnowledgeAnswer,
  handleInteractionCreate,
  handleMissionReactionApproval,
  handleMissionSubmissionGuidanceMessage,
  handleTodayMissionMessageCreate,
  normalizeText,
  scoreFaqItem,
};
