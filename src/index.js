require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { handleInteractionCreate } = require('./handlers');
const { handleMissionReactionApproval } = require('./reactionApproval');
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
});

client.on('interactionCreate', handleInteractionCreate);

client.on('messageReactionAdd', async (reaction, user) => {
  await handleMissionReactionApproval(reaction, user, client);
});

if (require.main === module) {
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
  normalizeText,
  scoreFaqItem,
};
