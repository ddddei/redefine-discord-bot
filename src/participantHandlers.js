const {
  OPERATOR_CHECK_FOOTER, createChannelGuideEmbed, createGuideEmbed, createGuideHubDetailEmbed,
  createKnowledgeEmbed,
} = require('./embeds');
const { GUIDE_HUB_SELECT_ID, createGuideHubSelectRow } = require('./components');
const { PARTICIPANT_MENU_BUTTON_IDS, createParticipantMenuButtonRows, createParticipantOnboardingNextStepRow } = require('./participantInteractionUi');
const { createNoticeEmbed } = require('./operatorInteractionUi');
const { createMinigameChannelGuidePayload, createMinigameHubPayload } = require('./minigameInteractions');
const { getChannelGuideRoleNote, getOnboardingGuideMessage, getOnboardingRoleType } = require('./onboardingRoles');
const { getUserPoints } = require('./pointsStore');
const { findFaqAnswer, findKnowledgeAnswer } = require('./search');
const { detectSensitiveQuestion, getSensitiveQuestionUserMessage } = require('./safety');
const { getAiFallbackAnswer } = require('./ai');
const { runLinkCommand, runRankingCommand } = require('./webgameLink');

function createParticipantHandlers({
  pointsRepository, createPointBalanceEmbedForUser, sendSensitiveQuestionAlert,
  sendUnansweredQuestionLog,
}) {
  function recordParticipantCommandUse(interaction, commandName) {
    if (!interaction || !interaction.user || !interaction.user.id) {
      return;
    }

    try {
      pointsRepository.recordParticipantCommandFirstUse({
        userId: interaction.user.id,
        commandName,
      });
    } catch (error) {
      console.warn('참여자 기본 명령어 첫 사용 기록 실패:', error.message);
    }
  }

  function recordFaqFallbackQuestion(question) {
    try {
      recordFaqFallbackQuestion(question);
    } catch (error) {
      console.warn('FAQ 후보 질문 기록 실패:', error.message);
    }
  }


  async function handleGuideCommand(interaction) {
    recordParticipantCommandUse(interaction, '안내');
    const roleType = getOnboardingRoleType(interaction.member);
    const roleGuideMessage = getOnboardingGuideMessage(roleType);

    await interaction.reply({
      embeds: [createGuideEmbed(
        '📌 리디파인 이용 메뉴',
        [
          '필요한 내용을 버튼으로 바로 확인할 수 있어요.',
          '내 포인트 같은 개인 정보는 본인에게만 보여요.',
          roleGuideMessage ? '' : null,
          roleGuideMessage || null,
          '',
          '더 자세한 안내가 필요하면 아래 선택 메뉴도 함께 사용할 수 있어요.',
        ].filter((line) => line !== null).join('\n')
      )],
      components: [...createParticipantMenuButtonRows(), createGuideHubSelectRow()],
      ephemeral: true,
    });
  }

  async function handleParticipantMenuButton(interaction) {
    if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.onboarding) {
      await interaction.reply({
        embeds: [createGuideEmbed(
          '처음 왔다면 여기부터',
          [
            '처음엔 모든 채널과 기능을 한 번에 다 보지 않아도 괜찮아요. 아래 순서대로만 확인해도 시작하기에 충분합니다.',
            '',
            '1. 참여동의 확인 채널 확인',
            '#참여동의-확인 채널이나 운영진이 안내한 참여동의 안내를 먼저 확인해 주세요. 동의 확인 방식이 헷갈리면 운영진에게 물어봐도 됩니다.',
            '',
            '2. 이름표/색상 고르기',
            '이름표나 색상 선택 채널에서 나를 편하게 알아볼 수 있는 표시를 골라 주세요. 꼭 화려하게 꾸미지 않아도 괜찮아요.',
            '',
            '3. `/안내` 메뉴 살펴보기',
            '`/안내`를 열면 오늘의 미션, 내 포인트, 상점/교환, 미니게임, 문의 방법을 버튼으로 다시 볼 수 있어요.',
            '',
            '4. 오늘의 미션 확인과 인증 방법',
            '`오늘의 미션 보기` 버튼을 눌러 오늘 할 수 있는 활동을 확인해 주세요. 오늘의 미션 채널에 글이나 사진을 올리면 인증이 접수되고, 운영자가 확인한 뒤 포인트가 지급됩니다.',
            '',
            '5. 포인트, 미니게임, 상점은 선택 활동',
            '`내 포인트 확인`으로 현재 포인트를 볼 수 있고, `미니게임`은 가볍게 즐기는 선택 활동이에요. 상점/교환은 포인트를 사용하고 싶을 때 천천히 확인하면 됩니다.',
            '',
            '처음엔 여기까지만 해도 충분해요. 지금은 아래 버튼 중 하나만 눌러 다음 안내를 이어서 봐도 됩니다.',
          ].join('\n')
        )],
        components: [createParticipantOnboardingNextStepRow()],
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.todayMission) {
      await interaction.reply({
        embeds: [createGuideEmbed(
          '오늘의 미션 보기',
          [
            '오늘의 미션 채널에 사진을 올리면 인증이 자동으로 접수돼요.',
            '접수되면 원본 메시지에 확인 반응이 남고, 안내는 DM으로 보내드려요.',
            '',
            '운영자가 확인한 뒤 포인트가 지급돼요.',
            '오늘의 미션 포인트는 하루 1회만 지급됩니다.',
          ].join('\n')
        )],
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.points) {
      await interaction.reply({
        embeds: [createPointBalanceEmbedForUser(interaction.user.id)],
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.ranking) {
      await interaction.reply({
        embeds: [createGuideEmbed(
          '랭킹 확인',
          [
            '랭킹 기능은 준비 중입니다.',
            '',
            '포인트와 랭킹은 비교나 평가가 아니라 가볍게 즐기는 요소예요.',
            '지금은 내 포인트를 먼저 확인해 주세요.',
          ].join('\n')
        )],
        ephemeral: true,
      });
      return;
    }

    if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.minigames) {
      if (!process.env.MINIGAME_CHANNEL_ID || interaction.channelId === process.env.MINIGAME_CHANNEL_ID) {
        await interaction.reply(createMinigameHubPayload());
        return;
      }

      await interaction.reply(createMinigameChannelGuidePayload());
      return;
    }

    if (interaction.customId === PARTICIPANT_MENU_BUTTON_IDS.help) {
      await interaction.reply({
        embeds: [createGuideEmbed(
          '이용 방법 보기',
          [
            '1. 오늘의 미션 채널에 사진을 올리면 인증이 접수돼요.',
            '2. 운영자가 확인하면 포인트가 지급돼요.',
            '3. 오늘의 미션 포인트는 하루 1회만 지급돼요.',
            '4. 이미 지급된 뒤에는 중복 지급 없이 확인만 될 수 있어요.',
            '5. 반려된 경우 안내 내용을 확인한 뒤 다시 제출해주세요.',
          ].join('\n')
        )],
        ephemeral: true,
      });
    }
  }

  async function handleGuideHubSelect(interaction) {
    const selectedValue = interaction.values[0];
    const pointsData = pointsRepository.loadState().pointsData;
    const currentPoints = getUserPoints(pointsData, interaction.user.id);
    const activeMissionCount = pointsRepository.listActiveMissions().length;

    await interaction.update({
      embeds: [
        createGuideHubDetailEmbed(selectedValue, {
          currentPoints,
          activeMissionCount,
        }),
      ],
      components: [createGuideHubSelectRow(selectedValue)],
    });
  }

  async function handleChannelGuideCommand(interaction) {
    const roleType = getOnboardingRoleType(interaction.member);
    const roleNote = getChannelGuideRoleNote(roleType);

    await interaction.reply({ embeds: [createChannelGuideEmbed({ roleNote })] });
  }

  async function handleQuestionCommand(interaction) {
    const question = interaction.options.getString('내용');
    const sensitiveDetection = detectSensitiveQuestion(question);

    if (sensitiveDetection) {
      const embed = createGuideEmbed(
        '운영진 확인이 필요한 질문이에요',
        getSensitiveQuestionUserMessage(sensitiveDetection),
        {
          footer: OPERATOR_CHECK_FOOTER,
        }
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      await sendSensitiveQuestionAlert(interaction, question, sensitiveDetection);
      return;
    }

    const matchedFaq = findFaqAnswer(question);

    if (matchedFaq) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            matchedFaq.question,
            matchedFaq.answer
          ),
        ],
      });
      return;
    }

    const matchedKnowledge = findKnowledgeAnswer(question);

    if (matchedKnowledge) {
      await interaction.reply({ embeds: [createKnowledgeEmbed(matchedKnowledge)] });
      return;
    }

    const aiFallbackAnswer = getAiFallbackAnswer(question);

    if (aiFallbackAnswer) {
      const embed = createGuideEmbed(
        '운영진 확인이 필요한 질문이에요',
        aiFallbackAnswer,
        {
          footer: OPERATOR_CHECK_FOOTER,
        }
      );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      pointsRepository.recordFaqFallbackCandidate({ question });
      await sendUnansweredQuestionLog(interaction, question);
      return;
    }

    const embed = createGuideEmbed(
      '운영진 확인이 필요한 질문이에요',
      [
        '지금 등록된 FAQ와 지식창고에서는 딱 맞는 답변을 찾지 못했어요.',
        '',
        '질문을 조금 다르게 적어 다시 물어보거나,',
        '문의 채널에 남겨 주세요.',
        '운영진이 확인 후 순차적으로 안내드릴게요.',
        '',
        '예시:',
        '`/질문 내용: 처음 왔는데 뭐부터 해요?`',
        '`/질문 내용: 참여동의 어디서 해요?`',
        '`/질문 내용: 오늘 못 갈 것 같아요`',
        '`/질문 내용: 포인트 어떻게 얻어요?`',
        '`/질문 내용: 음성채널 꼭 들어가야 해요?`',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed], ephemeral: true });
    recordFaqFallbackQuestion(question);
    await sendUnansweredQuestionLog(interaction, question);
  }

  async function handleNoticeCommand(interaction) {
    const type = interaction.options.getString('종류');

    await interaction.reply({
      embeds: [createNoticeEmbed(type)],
      ephemeral: true,
    });
  }

  async function handleWebgameLinkCommand(interaction) {
    try {
      recordParticipantCommandUse(interaction, '게임연결');
      await runLinkCommand(interaction);
    } catch (error) {
      console.error('웹게임 연결 코드 발급 실패:', error.message);
      await interaction.reply({
        content: '연결 코드를 발급하지 못했어요. 운영진에게 알려주세요.',
        ephemeral: true,
      });
    }
  }

  async function handleWebgameRankingCommand(interaction) {
    try {
      recordParticipantCommandUse(interaction, '게임랭킹');
      await runRankingCommand(interaction);
    } catch (error) {
      console.error('웹게임 랭킹 조회 실패:', error.message);
      await interaction.reply({
        content: '랭킹 정보를 불러오지 못했어요. 운영진에게 알려주세요.',
        ephemeral: true,
      });
    }
  }


  async function handleRediHelpCommand(interaction) {
    const embed = createGuideEmbed(
      '리디파인 안내 봇 사용법',
      [
        '필요한 안내를 편한 순서로 확인할 수 있어요.',
        '처음이라 낯설다면 `/안내`부터 천천히 봐 주세요.',
        '',
        '`/안내` 처음 온 참여자용 안내',
        '`/채널안내` 주요 채널 용도 안내',
        '`/질문 내용:궁금한 내용` 자주 묻는 질문 검색',
        '`/공지 종류:일정안내` 운영진용 공지 템플릿',
        '`/공지 종류:봇사용안내` 운영진용 안내 봇 사용법 공지 템플릿',
        '`/리디 일정` 프로그램 일정 안내',
        '`/리디 규칙` 참여 규칙 안내',
        '`/리디 문의` 문의 방법 안내',
        '',
        '봇이 답하기 어려운 내용은 운영진 확인이 필요할 수 있어요.',
        '세부 내용은 운영진 안내를 기준으로 확인해 주세요.',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
  }

  async function handleRediScheduleCommand(interaction) {
    const embed = createGuideEmbed(
      '리디파인 일정 안내',
      [
        '리디파인 프로그램은 운영진이 안내한 회차별 일정에 따라 진행돼요.',
        '',
        '정확한 날짜와 시간은 공지 채널에서 확인해 주세요.',
        '일정이 바뀌면 운영진이 디스코드 공지로 다시 안내드릴게요.',
        '',
        '참여가 어렵거나 늦을 것 같다면 가능한 때에 운영진에게 알려주세요.',
        '세부 내용은 운영진 안내를 기준으로 확인해 주세요.',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
  }

  async function handleRediRulesCommand(interaction) {
    const embed = createGuideEmbed(
      '프로젝트 리디파인 커뮤니티 약속',
      [
        '리디파인은 서로의 속도와 안전을 함께 살피는 공간이에요.',
        '처음부터 활발하게 말하지 않아도 괜찮아요.',
        '',
        '1. 서로 존댓말로 이야기해 주세요.',
        '2. 욕설, 비하, 조롱처럼 상대를 힘들게 할 수 있는 표현은 피해주세요.',
        '3. 개인적인 이야기와 채팅 캡처는 허락 없이 외부에 공유하지 말아 주세요.',
        '4. 반복 DM이나 사적인 접근은 상대에게 부담이 될 수 있으니 조심해 주세요.',
        '5. 건의나 불편한 점은 운영진에게 알려주세요.',
        '6. 각 채널의 성격에 맞게 대화해 주세요.',
        '7. 혐오, 차별, 성적 콘텐츠, 폭력적 표현, 사칭, 광고, 스팸, 금전 거래, 불법 링크 공유는 운영진 확인 후 조치될 수 있어요.',
        '8. 참여 중단이나 탈퇴를 고민할 때는 운영진에게 먼저 알려 주세요.',
        '9. 읽기, 이모지 반응, 짧은 질문도 모두 참여의 방식이에요.',
        '',
        '어렵거나 불편한 일이 생기면 혼자 해결하려고 애쓰지 않아도 괜찮아요.',
        '필요한 만큼 운영진에게 알려주세요.',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
  }

  async function handleRediContactCommand(interaction) {
    const embed = createGuideEmbed(
      '문의 방법',
      [
        '궁금한 점이나 확인이 필요한 내용은 디스코드 문의 채널에 남겨주세요.',
        '',
        '운영진이 확인 후 순차적으로 답변드릴게요.',
        '급한 내용이라면 공지된 연락 방법도 함께 확인해 주세요.',
        '',
        '개인정보가 있거나 공개 채널에 쓰기 어려운 내용은',
        '운영진이 안내한 개별 연락 방법을 이용해 주세요.',
      ].join('\n')
    );

    await interaction.reply({ embeds: [embed] });
  }

  async function handleRediCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === '도움') {
      await handleRediHelpCommand(interaction);
      return;
    }

    if (subcommand === '일정') {
      await handleRediScheduleCommand(interaction);
      return;
    }

    if (subcommand === '규칙') {
      await handleRediRulesCommand(interaction);
      return;
    }

    if (subcommand === '문의') {
      await handleRediContactCommand(interaction);
    }
  }



  return {
    recordFaqFallbackQuestion,
    recordParticipantCommandUse,
    handleChannelGuideCommand,
    handleGuideCommand,
    handleGuideHubSelect,
    handleNoticeCommand,
    handleParticipantMenuButton,
    handleQuestionCommand,
    handleRediCommand,
    handleRediContactCommand,
    handleRediHelpCommand,
    handleRediRulesCommand,
    handleRediScheduleCommand,
    handleWebgameLinkCommand,
    handleWebgameRankingCommand,
  };
}

module.exports = { createParticipantHandlers };
