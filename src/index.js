require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const { handleInteractionCreate } = require('./handlers');
const {
  findFaqAnswer,
  findKnowledgeAnswer,
  normalizeText,
  scoreFaqItem,
} = require('./search');

console.log('봇 실행 준비 중...');

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('clientReady', () => {
  console.log(`${client.user.tag} 봇이 준비됐어요.`);
});

client.on('interactionCreate', handleInteractionCreate);

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
  normalizeText,
  scoreFaqItem,
};
