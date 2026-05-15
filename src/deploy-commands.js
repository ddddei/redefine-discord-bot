require('dotenv').config();

const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('리디')
    .setDescription('프로젝트 리디파인 안내 봇이에요.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('도움')
        .setDescription('리디파인 안내 봇 사용법을 보여줘요.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('일정')
        .setDescription('리디파인 프로그램 일정을 안내해요.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('규칙')
        .setDescription('리디파인 참여 규칙을 안내해요.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('문의')
        .setDescription('문의 방법을 안내해요.')
    ),

  new SlashCommandBuilder()
    .setName('질문')
    .setDescription('리디파인 FAQ에서 답변을 찾아요.')
    .addStringOption((option) =>
      option
        .setName('내용')
        .setDescription('궁금한 내용을 입력해 주세요.')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('안내')
    .setDescription('처음 온 참여자를 위한 리디파인 사용 안내를 보여줘요.'),

  new SlashCommandBuilder()
    .setName('채널안내')
    .setDescription('리디파인 디스코드 주요 채널의 용도를 안내해요.'),

  new SlashCommandBuilder()
    .setName('공지')
    .setDescription('운영진이 복사해 쓸 수 있는 공지 템플릿을 보여줘요.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('필요한 공지 종류를 선택해 주세요.')
        .setRequired(true)
        .addChoices(
          { name: '일정안내', value: 'schedule' },
          { name: '참여리마인드', value: 'reminder' },
          { name: '문의안내', value: 'contact' },
          { name: '준비물', value: 'preparation' },
          { name: '결석안내', value: 'absence' }
        )
    ),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

async function main() {
  try {
    console.log('Slash commands 등록 중...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log('Slash commands 등록 완료!');
  } catch (error) {
    console.error('Slash commands 등록 실패:', error);
  }
}

main();
