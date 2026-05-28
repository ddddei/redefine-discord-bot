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
    .setName('포인트')
    .setDescription('내 여정 포인트를 확인합니다.'),

  new SlashCommandBuilder()
    .setName('상점')
    .setDescription('교환 가능한 리워드를 확인합니다.'),

  new SlashCommandBuilder()
    .setName('교환')
    .setDescription('여정 포인트로 교환 신청을 접수합니다.')
    .addStringOption((option) =>
      option
        .setName('항목')
        .setDescription('신청할 상점 항목 ID를 입력해 주세요.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('메모')
        .setDescription('운영진에게 남길 메모가 있으면 입력해 주세요.')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('포인트관리')
    .setDescription('운영진이 참여자 여정 포인트를 지급하거나 정정합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) =>
      option
        .setName('대상')
        .setDescription('포인트를 조정할 참여자를 선택해 주세요.')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('증감')
        .setDescription('지급은 양수, 차감 또는 정정은 음수로 입력해 주세요.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('사유')
        .setDescription('운영 로그에 남길 사유를 입력해 주세요.')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('교환관리')
    .setDescription('운영진이 교환 신청을 완료, 취소, 환불 처리합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('신청id')
        .setDescription('처리할 교환 신청 ID를 입력해 주세요.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('처리')
        .setDescription('교환 신청 처리 상태를 선택해 주세요.')
        .setRequired(true)
        .addChoices(
          { name: '지급완료', value: 'complete' },
          { name: '취소', value: 'cancel' },
          { name: '환불완료', value: 'refund' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('메모')
        .setDescription('취소나 환불 사유 등 운영 메모를 입력해 주세요.')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('포인트로그')
    .setDescription('운영진이 포인트 거래 로그를 확인합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) =>
      option
        .setName('사용자')
        .setDescription('특정 사용자 로그만 확인할 때 선택해 주세요.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('확인할 거래 종류를 선택해 주세요.')
        .setRequired(false)
        .addChoices(
          { name: '지급', value: 'earn' },
          { name: '사용', value: 'spend' },
          { name: '정정', value: 'adjust' },
          { name: '교환차감', value: 'redeem' },
          { name: '환불', value: 'refund' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('개수')
        .setDescription('최대 20개까지 확인할 수 있어요.')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(20)
    ),

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
          { name: '봇사용안내', value: 'botGuide' },
          { name: '참여리마인드', value: 'reminder' },
          { name: '문의안내', value: 'contact' },
          { name: '준비물', value: 'preparation' },
          { name: '결석안내', value: 'absence' },
          { name: '입장안내', value: 'onboardingWelcome' },
          { name: '온보딩24시간', value: 'onboarding24' },
          { name: '온보딩48시간', value: 'onboarding48' },
          { name: '온보딩72시간', value: 'onboarding72' },
          { name: '역할전환안내', value: 'onboardingTransition' },
          { name: '온보딩연장안내', value: 'onboardingExtension' }
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
