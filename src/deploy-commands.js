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
    .setName('던전월드')
    .setDescription('혼자 짧게 즐기는 솔로 던전월드 미니게임이에요. 포인트는 지급되지 않아요.'),

  new SlashCommandBuilder()
    .setName('던전월드기록')
    .setDescription('내 던전월드 진행 기록을 개인 메시지로 확인해요.'),

  new SlashCommandBuilder()
    .setName('던전월드관리')
    .setDescription('운영진이 현재 던전월드 회차를 확인하거나 수동으로 변경합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('회차')
        .setDescription('변경할 회차 ID를 입력해 주세요. 비워두면 현재 회차만 보여줘요.')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('초기화')
        .setDescription('수동 설정을 지우고 자동(주차 기준) 계산으로 되돌릴지 선택해 주세요.')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('게임연결')
    .setDescription('웹게임 계정을 Discord와 연결할 코드를 발급합니다.'),

  new SlashCommandBuilder()
    .setName('게임랭킹')
    .setDescription('웹게임 이번 주 랭킹을 확인합니다.')
    .addStringOption((option) =>
      option
        .setName('게임')
        .setDescription('확인할 게임을 선택해 주세요.')
        .setRequired(true)
        .addChoices(
          { name: '간식 맞추기', value: 'match3' },
          { name: '간식 수호대', value: 'deck' },
          { name: '간식 공방 키우기', value: 'idle' },
          { name: '검은 종 생존전', value: 'survivors' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('기간')
        .setDescription('랭킹 기간을 선택해 주세요. 기본값은 이번 주입니다.')
        .setRequired(false)
        .addChoices(
          { name: '이번 주', value: 'week' },
          { name: '오늘의 도전', value: 'daily' }
        )
    ),

  new SlashCommandBuilder()
    .setName('포인트')
    .setDescription('내 리디파인 포인트를 확인합니다.'),

  new SlashCommandBuilder()
    .setName('상점')
    .setDescription('교환 가능한 리워드를 확인합니다.'),

  new SlashCommandBuilder()
    .setName('체크인')
    .setDescription('오늘의 체크인을 남기고 리디파인 포인트를 받습니다.')
    .addStringOption((option) =>
      option
        .setName('내용')
        .setDescription('오늘의 짧은 상태나 한마디를 남길 수 있어요.')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('미션')
    .setDescription('현재 참여 가능한 미션을 확인합니다.'),

  new SlashCommandBuilder()
    .setName('인증')
    .setDescription('미션 수행 내용을 인증합니다.')
    .addStringOption((option) =>
      option
        .setName('미션')
        .setDescription('미션 코드를 알고 있다면 입력해 주세요. 비워두면 목록에서 선택할 수 있어요.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('내용')
        .setDescription('인증 내용을 짧게 적어 주세요.')
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName('첨부파일')
        .setDescription('사진이나 영상 인증이 필요한 경우 첨부해 주세요.')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('교환')
    .setDescription('리디파인 포인트로 교환할 항목을 선택합니다.')
    .addStringOption((option) =>
      option
        .setName('항목')
        .setDescription('신청 코드를 알고 있다면 입력해 주세요. 비워두면 목록에서 선택할 수 있어요.')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('메모')
        .setDescription('운영진에게 남길 메모가 있으면 입력해 주세요.')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('포인트관리')
    .setDescription('운영진이 참여자 리디파인 포인트를 지급하거나 정정합니다.')
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
    .setName('게임지급')
    .setDescription('운영진이 웹게임 주간 랭킹·참여·공동 목표 보상을 확인 후 지급합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('주차')
        .setDescription('지급할 주차를 선택해 주세요. 기본값은 지난 주입니다.')
        .setRequired(false)
        .addChoices(
          { name: '지난 주', value: 'last' },
          { name: '이번 주', value: 'current' }
        )
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
    .setName('인증관리')
    .setDescription('운영자가 미션 인증을 승인 또는 반려합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('제출id')
        .setDescription('처리할 인증 제출 ID를 입력해 주세요.')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('처리')
        .setDescription('인증 처리 상태를 선택해 주세요.')
        .setRequired(true)
        .addChoices(
          { name: '승인', value: 'approve' },
          { name: '반려', value: 'reject' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('메모')
        .setDescription('운영 메모가 있으면 입력해 주세요.')
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
    .setName('운영현황')
    .setDescription('운영자가 포인트, 교환, 인증 현황을 요약 확인합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('확인할 운영 현황 종류를 선택해 주세요.')
        .setRequired(false)
        .addChoices(
          { name: '요약', value: 'summary' },
          { name: '첫날점검', value: 'firstDayCheck' },
          { name: '교환대기', value: 'pendingRedemptions' },
          { name: '인증대기', value: 'pendingSubmissions' },
          { name: '반응후속확인', value: 'reactionFollowUps' },
          { name: '도움필요신호', value: 'onboardingSignals' },
          { name: 'FAQ후보', value: 'faqCandidates' },
          { name: 'DM대화', value: 'dmChat' },
          { name: '미션', value: 'missions' },
          { name: '상점', value: 'shop' },
          { name: '미니게임', value: 'minigames' }
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
    .setName('운영내보내기')
    .setDescription('운영자가 포인트 운영 데이터를 내보내거나 백업합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('종류')
        .setDescription('내보낼 운영 데이터 종류를 선택해 주세요.')
        .setRequired(true)
        .addChoices(
          { name: '전체', value: 'all' },
          { name: '포인트', value: 'points' },
          { name: '교환', value: 'redemptions' },
          { name: '인증', value: 'submissions' },
          { name: '미션', value: 'missions' },
          { name: '상점', value: 'shopItems' },
          { name: '요약', value: 'summary' },
          { name: '던전월드', value: 'dungeonworld' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('형식')
        .setDescription('내보내기 형식을 선택해 주세요.')
        .setRequired(false)
        .addChoices(
          { name: '요약', value: 'summary' },
          { name: 'JSON', value: 'json' },
          { name: 'CSV', value: 'csv' }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName('개수')
        .setDescription('포함할 항목 수를 선택해 주세요. 기본값은 50개입니다.')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(200)
    ),

  new SlashCommandBuilder()
    .setName('미션관리')
    .setDescription('운영자가 미션을 추가하거나 상태를 변경합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('작업')
        .setDescription('미션 관리 작업을 선택해 주세요.')
        .setRequired(true)
        .addChoices(
          { name: '목록', value: 'list' },
          { name: '추가', value: 'create' },
          { name: '수정', value: 'update' },
          { name: '활성화', value: 'activate' },
          { name: '일시중지', value: 'pause' },
          { name: '종료', value: 'close' }
        )
    )
    .addStringOption((option) =>
      option.setName('미션id').setDescription('대상 미션 ID를 입력해 주세요.').setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('제목').setDescription('미션 제목을 입력해 주세요.').setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('설명').setDescription('미션 설명을 입력해 주세요.').setRequired(false)
    )
    .addIntegerOption((option) =>
      option.setName('포인트').setDescription('지급 포인트를 입력해 주세요.').setRequired(false).setMinValue(1)
    )
    .addBooleanOption((option) =>
      option.setName('인증필요').setDescription('인증 제출이 필요한 미션인지 선택해 주세요.').setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('날짜').setDescription('미션 날짜를 YYYY-MM-DD 형식으로 입력해 주세요.').setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('메모').setDescription('운영 메모를 입력해 주세요.').setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('상점관리')
    .setDescription('운영자가 상점 항목을 추가하거나 상태를 변경합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('작업')
        .setDescription('상점 관리 작업을 선택해 주세요.')
        .setRequired(true)
        .addChoices(
          { name: '목록', value: 'list' },
          { name: '추가', value: 'create' },
          { name: '수정', value: 'update' },
          { name: '활성화', value: 'activate' },
          { name: '일시중지', value: 'pause' },
          { name: '품절', value: 'soldOut' },
          { name: '숨김', value: 'hide' }
        )
    )
    .addStringOption((option) =>
      option.setName('항목id').setDescription('대상 상점 항목 ID를 입력해 주세요.').setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('이름').setDescription('상점 항목 이름을 입력해 주세요.').setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('설명').setDescription('상점 항목 설명을 입력해 주세요.').setRequired(false)
    )
    .addIntegerOption((option) =>
      option.setName('비용').setDescription('필요 포인트를 입력해 주세요.').setRequired(false).setMinValue(1)
    )
    .addIntegerOption((option) =>
      option.setName('재고').setDescription('재고 수량을 입력해 주세요.').setRequired(false).setMinValue(0)
    )
    .addIntegerOption((option) =>
      option.setName('월한도').setDescription('월별 신청 한도를 입력해 주세요.').setRequired(false).setMinValue(0)
    )
    .addStringOption((option) =>
      option
        .setName('유형')
        .setDescription('상점 항목 유형을 선택해 주세요.')
        .setRequired(false)
        .addChoices(
          { name: '청년동포인트', value: 'youthCenterPoint' },
          { name: '리워드', value: 'reward' },
          { name: '굿즈', value: 'goods' },
          { name: '이벤트', value: 'event' }
        )
    )
    .addStringOption((option) =>
      option.setName('메모').setDescription('운영 메모를 입력해 주세요.').setRequired(false)
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

if (require.main === module) {
  main();
}

module.exports = { commands };
