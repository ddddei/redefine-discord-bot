const { EmbedBuilder } = require('discord.js');
const { truncateEmbedValue } = require('./embeds');

function formatKoreanTime(date = new Date()) {
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kstDate.getUTCDate()).padStart(2, '0');
  const hours = String(kstDate.getUTCHours()).padStart(2, '0');
  const minutes = String(kstDate.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

async function sendUnansweredQuestionLog(interaction, question) {
  const logChannelId = process.env.LOG_CHANNEL_ID;

  if (!logChannelId) {
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(logChannelId);

    if (!channel || typeof channel.send !== 'function') {
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xd6a35f)
      .setTitle('답변하지 못한 질문')
      .addFields(
        {
          name: '질문 내용',
          value: truncateEmbedValue(question),
        },
        {
          name: '시간',
          value: formatKoreanTime(),
        }
      );

    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('답변 실패 질문 로그 전송 실패:', error.message);
  }
}

module.exports = {
  formatKoreanTime,
  sendUnansweredQuestionLog,
};
