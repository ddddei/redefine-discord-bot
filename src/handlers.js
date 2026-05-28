const {
  OPERATOR_CHECK_FOOTER,
  createChannelGuideEmbed,
  createGuideEmbed,
  createKnowledgeEmbed,
  createPointBalanceEmbed,
  createShopEmbed,
  formatPoints,
  formatTransactionAmount,
  formatTransactionDate,
  getNoticeTemplate,
} = require('./embeds');
const { sendSensitiveQuestionAlert, sendUnansweredQuestionLog } = require('./logging');
const { getAiFallbackAnswer } = require('./ai');
const {
  getChannelGuideRoleNote,
  getOnboardingGuideMessage,
  getOnboardingRoleType,
} = require('./onboardingRoles');
const {
  getUser,
  getUserPoints,
  listActiveShopItems,
  listPointTransactions,
  validateUserBalance,
} = require('./pointsStore');
const { createPointsRepository } = require('./pointsRepository');
const { findFaqAnswer, findKnowledgeAnswer } = require('./search');
const { detectSensitiveQuestion, getSensitiveQuestionUserMessage } = require('./safety');

const pointsRepository = createPointsRepository();

function getMemberDisplayName(user, member) {
  return member && member.displayName ? member.displayName : user.username;
}

function getRedemptionFailureMessage(reason) {
  const messages = {
    USER_NOT_FOUND: '아직 포인트 기록이 없어 교환 신청을 접수할 수 없어요.',
    ITEM_NOT_FOUND: '해당 상점 항목을 찾지 못했어요. `/상점`에서 항목 ID를 확인해 주세요.',
    SOLD_OUT: '해당 항목은 현재 재고가 없어 신청할 수 없어요.',
    ITEM_NOT_ACTIVE: '해당 항목은 현재 신청 가능한 상태가 아니에요.',
    INSUFFICIENT_POINTS: '보유 포인트가 부족해 교환 신청을 접수할 수 없어요.',
  };

  return messages[reason] || '교환 신청 조건을 확인하지 못했어요. 운영진에게 알려주세요.';
}

function createPointTransactionLogEmbed(transactions) {
  const lines = transactions.length > 0
    ? transactions.map((transaction) => {
      return [
        `- ${formatTransactionDate(transaction.createdAt)}`,
        transaction.id,
        transaction.userId,
        transaction.type,
        formatTransactionAmount(transaction.amount),
        `잔액 ${formatPoints(transaction.balanceAfter)}`,
        transaction.reason,
      ].join(' / ');
    })
    : ['표시할 포인트 로그가 없어요.'];

  return createGuideEmbed(
    '포인트 로그',
    lines.join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

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
  const roleType = getOnboardingRoleType(interaction.member);
  const roleGuideMessage = getOnboardingGuideMessage(roleType);
  const embed = createGuideEmbed(
    '처음 오셨다면 여기부터 확인해 주세요',
    [
      '안녕하세요. 여기는 프로젝트 리디파인 디스코드 공간이에요.',
      '',
      '처음부터 모든 채널을 다 살펴보지 않아도 괜찮아요.',
      '온보딩 기간에는 역할에 따라 보이는 채널이 다를 수 있어요.',
      '보이는 채널이 적어도 문제가 아니며, 각자의 속도에 맞춰 필요한 공간이 열립니다.',
      ...(roleGuideMessage ? ['', roleGuideMessage] : []),
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

async function handlePointCommand(interaction) {
  try {
    const { pointsData } = pointsRepository.loadState();
    const userId = interaction.user.id;
    const user = getUser(pointsData, userId);
    const currentPoints = getUserPoints(pointsData, userId);
    const transactions = listPointTransactions(pointsData, userId, {
      latestFirst: true,
    });
    const balanceCheck = user ? validateUserBalance(pointsData, userId) : null;

    await interaction.reply({
      embeds: [
        createPointBalanceEmbed({
          currentPoints,
          transactions,
          balanceCheck,
        }),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('포인트 정보 로드 실패:', error.message);
    await interaction.reply({
      content: '포인트 정보를 불러오지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleShopCommand(interaction) {
  try {
    const { shopItemsData } = pointsRepository.loadState();
    const items = listActiveShopItems(shopItemsData);

    if (items.length === 0) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '여정 포인트 상점',
            [
              '현재 표시할 수 있는 상점 항목이 없어요.',
              '',
              '/교환 기능은 아직 준비 중입니다.',
              '실제 항목과 비용은 운영진 확정 후 달라질 수 있어요.',
            ].join('\n')
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createShopEmbed(items)],
      ephemeral: true,
    });
  } catch (error) {
    console.error('상점 정보 로드 실패:', error.message);
    await interaction.reply({
      content: '상점 정보를 불러오지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleRedemptionCommand(interaction) {
  try {
    const itemId = interaction.options.getString('항목');
    const note = interaction.options.getString('메모');
    const result = pointsRepository.requestRedemption({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      itemId,
      note,
    });

    if (!result.ok) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '교환 신청을 접수하지 못했어요',
            getRedemptionFailureMessage(result.reason),
            {
              footer: OPERATOR_CHECK_FOOTER,
            }
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '교환 신청이 접수됐어요',
          [
            `신청 ID: \`${result.redemption.id}\``,
            `항목: ${result.item.name}`,
            `차감 포인트: ${formatPoints(result.item.cost)}`,
            `현재 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
            '',
            '운영진이 실제 지급 가능 여부를 확인한 뒤 완료 또는 취소 처리합니다.',
            '청년동 포인트 전환권은 청년동 내부 사용처에 한정된 운영진 처리 항목이며, 현금 환급이나 외부 교환 대상이 아니에요.',
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('교환 신청 처리 실패:', error.message);
    await interaction.reply({
      content: '교환 신청을 처리하지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handlePointManageCommand(interaction) {
  try {
    const target = interaction.options.getUser('대상');
    const amount = interaction.options.getInteger('증감');
    const reason = interaction.options.getString('사유');
    const result = pointsRepository.adjustUserPoints({
      user: {
        userId: target.id,
        displayName: target.username,
      },
      amount,
      reason,
      operatorId: interaction.user.id,
    });

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '포인트 조정 완료',
          [
            `대상: ${target.username}`,
            `증감: ${formatTransactionAmount(result.transaction.amount)}`,
            `조정 후 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
            `거래 ID: \`${result.transaction.id}\``,
            `사유: ${reason}`,
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('포인트 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `포인트 조정을 처리하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleRedemptionManageCommand(interaction) {
  try {
    const redemptionId = interaction.options.getString('신청id');
    const action = interaction.options.getString('처리');
    const note = interaction.options.getString('메모');
    const result = pointsRepository.reviewRedemption({
      redemptionId,
      action,
      note,
      operatorId: interaction.user.id,
    });
    const refundLine = result.refundTransaction
      ? [`환불 거래 ID: \`${result.refundTransaction.id}\``, `환불 후 잔액: ${formatPoints(result.refundTransaction.balanceAfter)}`]
      : [];

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '교환 신청 처리 완료',
          [
            `신청 ID: \`${result.redemption.id}\``,
            `상태: ${result.redemption.status}`,
            `사용자 ID: ${result.redemption.userId}`,
            ...refundLine,
            `처리자 ID: ${interaction.user.id}`,
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('교환 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `교환 신청 처리를 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handlePointLogCommand(interaction) {
  try {
    const user = interaction.options.getUser('사용자');
    const type = interaction.options.getString('종류');
    const limit = interaction.options.getInteger('개수') || 10;
    const transactions = pointsRepository.listTransactions({
      userId: user ? user.id : undefined,
      type: type || undefined,
      limit,
    });

    await interaction.reply({
      embeds: [createPointTransactionLogEmbed(transactions)],
      ephemeral: true,
    });
  } catch (error) {
    console.error('포인트 로그 조회 실패:', error.message);
    await interaction.reply({
      content: '포인트 로그를 불러오지 못했어요. 운영진에게 알려주세요.',
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

  if (interaction.commandName === '포인트') {
    await handlePointCommand(interaction);
    return;
  }

  if (interaction.commandName === '상점') {
    await handleShopCommand(interaction);
    return;
  }

  if (interaction.commandName === '교환') {
    await handleRedemptionCommand(interaction);
    return;
  }

  if (interaction.commandName === '포인트관리') {
    await handlePointManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '교환관리') {
    await handleRedemptionManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '포인트로그') {
    await handlePointLogCommand(interaction);
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
  handlePointLogCommand,
  handlePointManageCommand,
  handlePointCommand,
  handleQuestionCommand,
  handleRediCommand,
  handleRediContactCommand,
  handleRediHelpCommand,
  handleRediRulesCommand,
  handleRediScheduleCommand,
  handleRedemptionCommand,
  handleRedemptionManageCommand,
  handleShopCommand,
};
