const {
  OPERATOR_CHECK_FOOTER,
  createChannelGuideEmbed,
  createGuideEmbed,
  createKnowledgeEmbed,
  getNoticeTemplate,
} = require('./embeds');
const { sendSensitiveQuestionAlert, sendUnansweredQuestionLog } = require('./logging');
const { getAiFallbackAnswer } = require('./ai');
const { findFaqAnswer, findKnowledgeAnswer } = require('./search');
const { detectSensitiveQuestion, getSensitiveQuestionUserMessage } = require('./safety');

function createNoticeEmbed(type) {
  const noticeText = getNoticeTemplate(type);

  return createGuideEmbed(
    '공지 템플릿',
    [
      '아래 문안을 필요한 만큼 다듬어 공지 채널에 사용해 주세요.',
      '세부 내용은 운영진 안내를 기준으로 확인해 주세요.',
      '',
      '```',
      noticeText,
      '```',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

async function handleGuideCommand(interaction) {
  const embed = createGuideEmbed(
    '처음 오셨다면 여기부터 확인해 주세요',
    [
      '안녕하세요. 여기는 프로젝트 리디파인 디스코드 공간이에요.',
      '',
      '처음부터 모든 채널을 다 살펴보지 않아도 괜찮아요.',
      '온보딩 기간에는 역할에 따라 보이는 채널이 다를 수 있어요.',
      '보이는 채널이 적어도 문제가 아니며, 각자의 속도에 맞춰 필요한 공간이 열립니다.',
      '',
      '먼저 `/채널안내`를 확인해 주세요.',
      '지금 보이는 채널 중에서 무엇부터 보면 좋을지 천천히 살펴볼 수 있어요.',
      '',
      '궁금한 점은 `/질문 내용: 궁금한 내용`으로 물어볼 수 있어요.',
      '',
      '예시:',
      '`/질문 내용: 결석하면 어떻게 하나요?`',
      '`/질문 내용: 왜 저는 채널이 적게 보여요?`',
      '`/질문 내용: 준비물이 있나요?`',
      '`/질문 내용: 처음이라 어색하면 어떡하죠?`',
      '',
      '리디파인은 완벽하게 참여해야 하는 공간이 아니에요.',
      '각자의 속도에 맞춰 천천히 이어가면 됩니다.',
      '불편하거나 어렵거나 헷갈리는 부분은 운영진에게 알려주세요.',
    ].join('\n')
  );

  await interaction.reply({ embeds: [embed] });
}

async function handleChannelGuideCommand(interaction) {
  await interaction.reply({ embeds: [createChannelGuideEmbed()] });
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
  await sendUnansweredQuestionLog(interaction, question);
}

async function handleNoticeCommand(interaction) {
  const type = interaction.options.getString('종류');

  await interaction.reply({
    embeds: [createNoticeEmbed(type)],
    ephemeral: true,
  });
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

async function handleInteractionCreate(interaction) {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === '공지') {
    await handleNoticeCommand(interaction);
    return;
  }

  if (interaction.commandName === '안내') {
    await handleGuideCommand(interaction);
    return;
  }

  if (interaction.commandName === '채널안내') {
    await handleChannelGuideCommand(interaction);
    return;
  }

  if (interaction.commandName === '질문') {
    await handleQuestionCommand(interaction);
    return;
  }

  if (interaction.commandName === '리디') {
    await handleRediCommand(interaction);
  }
}

module.exports = {
  createNoticeEmbed,
  handleChannelGuideCommand,
  handleGuideCommand,
  handleInteractionCreate,
  handleNoticeCommand,
  handleQuestionCommand,
  handleRediCommand,
  handleRediContactCommand,
  handleRediHelpCommand,
  handleRediRulesCommand,
  handleRediScheduleCommand,
};
