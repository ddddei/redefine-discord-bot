const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
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
  truncateText,
} = require('./embeds');
const {
  sendMissionSubmissionReviewAlert,
  sendRedemptionReviewAlert,
  sendSensitiveQuestionAlert,
  sendUnansweredQuestionLog,
} = require('./logging');
const { getAiFallbackAnswer } = require('./ai');
const {
  getChannelGuideRoleNote,
  getOnboardingGuideMessage,
  getOnboardingRoleType,
} = require('./onboardingRoles');
const {
  getUser,
  getUserPoints,
  listPointTransactions,
  validateUserBalance,
} = require('./pointsStore');
const {
  CHECKIN_REWARD_POINTS,
  createPointsRepository,
} = require('./pointsRepository');
const { buildOperationExportPayload, truncateForDiscord } = require('./exportUtils');
const { findFaqAnswer, findKnowledgeAnswer } = require('./search');
const { detectSensitiveQuestion, getSensitiveQuestionUserMessage } = require('./safety');

const pointsRepository = createPointsRepository();

function getMemberDisplayName(user, member) {
  return member && member.displayName ? member.displayName : user.username;
}

function memberHasPermission(member, permission) {
  return Boolean(member && member.permissions && typeof member.permissions.has === 'function'
    && member.permissions.has(permission));
}

function isOperator(interaction) {
  return memberHasPermission(interaction.member, PermissionFlagsBits.ManageMessages)
    || memberHasPermission(interaction.member, PermissionFlagsBits.Administrator);
}

function getRedemptionFailureMessage(reason) {
  const messages = {
    USER_NOT_FOUND: '아직 포인트 기록이 없어 교환 신청을 접수할 수 없어요.',
    ITEM_NOT_FOUND: '해당 항목을 찾지 못했어요. `/상점`에서 신청 코드를 다시 확인해 주세요.',
    SOLD_OUT: '해당 항목은 현재 재고가 없어 신청할 수 없어요.',
    ITEM_NOT_ACTIVE: '해당 항목은 현재 신청 가능한 상태가 아니에요.',
    INSUFFICIENT_POINTS: '현재 보유 포인트가 조금 부족해요.',
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

function createEmptyListEmbed(title, guideText) {
  return createGuideEmbed(title, guideText, {
    footer: OPERATOR_CHECK_FOOTER,
  });
}

function formatNullableCount(value, unit) {
  return typeof value === 'number' ? `${value}${unit}` : '운영진 확인';
}

function formatShopLimit(item) {
  const stockText = typeof item.stock === 'number'
    ? `재고 ${item.stock}개`
    : '재고 운영진 확인';
  const monthlyLimitText = typeof item.monthlyLimit === 'number'
    ? `월 한도 ${item.monthlyLimit}회`
    : '월 한도 운영진 확인';

  return `${stockText} / ${monthlyLimitText}`;
}

function createShopSelectRow(items) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('participant_shop_select')
      .setPlaceholder('교환할 항목을 선택해 주세요')
      .addOptions(items.slice(0, 25).map((item) => ({
        label: truncateText(`${item.displayCode} ${item.name}`, 100, item.displayCode || item.id),
        description: truncateText(`필요 포인트 ${formatPoints(item.cost)}`, 100, '상점 항목'),
        value: item.displayCode || item.id,
      })))
  );
}

function createRedemptionConfirmRow(displayCode) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`participant_redeem_confirm:${displayCode}`)
      .setLabel('교환 신청하기')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`participant_redeem_cancel:${displayCode}`)
      .setLabel('신청하지 않기')
      .setStyle(ButtonStyle.Secondary)
  );
}

function createMissionSelectRow(missions) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('participant_mission_select')
      .setPlaceholder('인증할 미션을 선택해 주세요')
      .addOptions(missions.slice(0, 25).map((mission) => ({
        label: truncateText(`${mission.displayCode} ${mission.title || mission.id}`, 100, mission.displayCode || mission.id),
        description: truncateText(`지급 포인트 ${formatPoints(mission.rewardPoints || 0)}`, 100, '미션'),
        value: mission.displayCode || mission.id,
      })))
  );
}

function createMissionSubmissionModal(mission) {
  return new ModalBuilder()
    .setCustomId(`participant_mission_submit:${mission.displayCode || mission.id}`)
    .setTitle(truncateText(`${mission.displayCode} 미션 인증`, 45, '미션 인증'))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('content')
          .setLabel('인증 내용')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(2)
          .setMaxLength(1000)
          .setPlaceholder('수행 내용을 필요한 만큼만 적어 주세요.')
      )
    );
}

function serializeAttachment(attachment) {
  if (!attachment) {
    return null;
  }

  return {
    id: attachment.id || null,
    name: attachment.name || null,
    url: attachment.url || null,
    contentType: attachment.contentType || null,
    size: typeof attachment.size === 'number' ? attachment.size : null,
  };
}

function formatAdminMissionLine(mission) {
  return [
    `- ID: \`${mission.id}\``,
    `  제목: ${mission.title || '제목 없음'}`,
    `  상태: ${mission.status || '상태 없음'} / 포인트: ${formatPoints(mission.rewardPoints || 0)} / 날짜: ${mission.activeDate || '미지정'}`,
  ].join('\n');
}

function formatAdminShopItemLine(item) {
  return [
    `- ID: \`${item.id}\``,
    `  이름: ${item.name || '이름 없음'}`,
    `  상태: ${item.status || '상태 없음'} / 비용: ${formatPoints(item.cost || 0)} / 재고: ${formatNullableCount(item.stock, '개')} / 유형: ${item.type || '미지정'}`,
  ].join('\n');
}

function createOperationSummaryEmbed(summary) {
  const recentLogLines = summary.recentTransactions.length > 0
    ? summary.recentTransactions.map((transaction) => {
      return `- ${formatTransactionDate(transaction.createdAt)} ${transaction.userId} ${formatTransactionAmount(transaction.amount)} ${transaction.reason}`;
    })
    : ['최근 포인트 로그가 없어요.'];

  return createGuideEmbed(
    '운영 현황 요약',
    [
      `교환 대기: ${summary.pendingRedemptionsCount}건`,
      `인증 대기: ${summary.pendingSubmissionsCount}건`,
      `활성 미션: ${summary.activeMissionsCount}개`,
      `활성 상점 항목: ${summary.activeShopItemsCount}개`,
      `오늘 체크인: ${summary.todayCheckinsCount}건`,
      '',
      '최근 포인트 로그',
      ...recentLogLines,
      '',
      '다음 확인',
      '`/운영현황 종류:교환대기`',
      '`/운영현황 종류:인증대기`',
      '`/미션관리 작업:목록`',
      '`/상점관리 작업:목록`',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function createPendingRedemptionsEmbed(redemptions) {
  if (redemptions.length === 0) {
    return createEmptyListEmbed('교환 대기 목록', '현재 pending 교환 신청이 없어요.');
  }

  const lines = redemptions.map((redemption) => {
    return [
      `- 신청 ID: \`${redemption.id}\``,
      `  사용자: ${redemption.displayName || redemption.userId}`,
      `  항목 ID: \`${redemption.itemId}\` / 비용: ${formatPoints(redemption.cost || 0)}`,
      `  신청 시간: ${formatTransactionDate(redemption.requestedAt)}`,
      `  처리: \`/교환관리 신청id:${redemption.id} 처리:지급완료\` 또는 취소`,
    ].join('\n');
  });

  return createGuideEmbed('교환 대기 목록', lines.join('\n\n'), {
    footer: OPERATOR_CHECK_FOOTER,
  });
}

function createPendingSubmissionsEmbed(submissions) {
  if (submissions.length === 0) {
    return createEmptyListEmbed('인증 대기 목록', '현재 pending 인증 제출이 없어요.');
  }

  const lines = submissions.map((submission) => {
    const content = truncateText(submission.content, 80, '제출 내용 없음');
    return [
      `- 제출 ID: \`${submission.id}\``,
      `  사용자: ${submission.displayName || submission.userId}`,
      `  미션 ID: \`${submission.missionId}\``,
      `  내용: ${content}`,
      `  제출 시간: ${formatTransactionDate(submission.createdAt)}`,
      `  처리: \`/인증관리 제출id:${submission.id} 처리:승인\` 또는 반려`,
    ].join('\n');
  });

  return createGuideEmbed('인증 대기 목록', lines.join('\n\n'), {
    footer: OPERATOR_CHECK_FOOTER,
  });
}

function createAdminMissionListEmbed(missions) {
  if (missions.length === 0) {
    return createEmptyListEmbed('미션 관리 목록', '등록된 미션이 없어요. `/미션관리 작업:추가`로 먼저 생성해 주세요.');
  }

  return createGuideEmbed(
    '미션 관리 목록',
    [
      ...missions.map(formatAdminMissionLine),
      '',
      'status가 active인 미션만 참여자 `/미션`에 노출됩니다.',
    ].join('\n\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function createAdminShopListEmbed(items) {
  if (items.length === 0) {
    return createEmptyListEmbed('상점 관리 목록', '등록된 상점 항목이 없어요. `/상점관리 작업:추가`로 먼저 생성해 주세요.');
  }

  return createGuideEmbed(
    '상점 관리 목록',
    [
      ...items.map(formatAdminShopItemLine),
      '',
      'status가 active인 항목만 참여자 `/상점`에 노출됩니다.',
    ].join('\n\n'),
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
    const items = pointsRepository.listActiveShopItemsWithCodes();

    if (items.length === 0) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '여정 포인트 상점',
            [
              '현재 표시할 수 있는 상점 항목이 없어요.',
              '',
              '상점 항목이 열리면 `/상점` 선택 메뉴에서 교환 신청까지 이어갈 수 있어요.',
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
      components: [createShopSelectRow(items)],
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

async function handleCheckinCommand(interaction) {
  try {
    const content = interaction.options.getString('내용');
    const result = pointsRepository.createCheckin({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      content,
    });

    if (!result.ok && result.reason === 'ALREADY_CHECKED_IN') {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '오늘은 이미 체크인을 완료했어요',
            [
              '내일 다시 체크인할 수 있어요.',
              '중복 포인트는 지급되지 않아요.',
              '',
              '체크인은 경쟁이나 출석 압박이 아니라 가벼운 참여 기록이에요.',
            ].join('\n')
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '오늘의 체크인이 기록됐어요',
          [
            `지급 포인트: ${formatPoints(CHECKIN_REWARD_POINTS)}`,
            `현재 보유 포인트: ${formatPoints(result.transaction.balanceAfter)}`,
            `오늘 남긴 한마디: ${content || '남긴 한마디 없음'}`,
            '',
            '체크인은 참여를 돕는 가벼운 기록이에요. 운영 기준에 따라 지급 포인트는 조정될 수 있어요.',
          ].join('\n')
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('체크인 처리 실패:', error.message);
    await interaction.reply({
      content: '체크인을 처리하지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleMissionCommand(interaction) {
  try {
    const missions = pointsRepository.listActiveMissions();

    if (missions.length === 0) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '오늘 참여 가능한 미션',
            [
              '현재 표시할 수 있는 active 미션이 없어요.',
              '',
              '미션은 강제 과제가 아니라 선택형 활동이에요. 세부 기준은 운영진 안내를 확인해 주세요.',
            ].join('\n')
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const lines = missions.slice(0, 10).map((mission) => {
      const submissionMethod = mission.requiresSubmission === false ? '선택' : '글로 남기기';
      return [
        `**${mission.displayCode} · ${mission.title || mission.id}**`,
        `지급 포인트: ${formatPoints(mission.rewardPoints || 0)}`,
        `인증 방법: ${submissionMethod}`,
      ].join('\n');
    });

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '오늘 참여 가능한 미션',
          [
            ...lines.join('\n\n').split('\n'),
            '',
            '가능한 범위에서 가볍게 참여해 주세요.',
            '아래 선택 메뉴에서 인증할 미션을 고를 수 있어요.',
            '사진이나 영상 인증이 필요한 경우 `/인증` 명령어에서 첨부파일을 함께 올릴 수 있어요.',
          ].join('\n')
        ),
      ],
      components: [createMissionSelectRow(missions)],
      ephemeral: true,
    });
  } catch (error) {
    console.error('미션 목록 조회 실패:', error.message);
    await interaction.reply({
      content: '미션 목록을 불러오지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleShopSelect(interaction) {
  const displayCode = interaction.values[0];
  const item = pointsRepository.resolveActiveShopItem(displayCode);

  if (!item) {
    await interaction.update({
      embeds: [
        createGuideEmbed(
          '상점 항목을 찾지 못했어요',
          '`/상점`을 다시 실행해 현재 선택 가능한 항목을 확인해 주세요.',
          { footer: OPERATOR_CHECK_FOOTER }
        ),
      ],
      components: [],
    });
    return;
  }

  const currentPoints = getUserPoints(pointsRepository.loadState().pointsData, interaction.user.id);
  const balanceAfter = currentPoints - item.cost;

  if (balanceAfter < 0) {
    await interaction.update({
      embeds: [
        createGuideEmbed(
          '현재 보유 포인트가 조금 부족해요',
          [
            `신청 항목: ${item.displayCode} · ${item.name}`,
            `필요 포인트: ${formatPoints(item.cost)}`,
            `현재 보유 포인트: ${formatPoints(currentPoints)}`,
            '',
            '포인트가 충분해진 뒤 다시 신청할 수 있어요.',
          ].join('\n'),
          { footer: OPERATOR_CHECK_FOOTER }
        ),
      ],
      components: [],
    });
    return;
  }

  await interaction.update({
    embeds: [
      createGuideEmbed(
        '교환 신청 전 확인해 주세요',
        [
          `신청 항목: ${item.displayCode} · ${item.name}`,
          `필요 포인트: ${formatPoints(item.cost)}`,
          `현재 보유 포인트: ${formatPoints(currentPoints)}`,
          `신청 후 예상 잔액: ${formatPoints(balanceAfter)}`,
          '',
          '신청이 완료되면 포인트가 차감돼요.',
          '단순 변심에 따른 취소나 환불은 원칙적으로 어렵습니다.',
        ].join('\n'),
        { footer: OPERATOR_CHECK_FOOTER }
      ),
    ],
    components: [createRedemptionConfirmRow(item.displayCode)],
  });
}

async function handleRedemptionConfirmButton(interaction) {
  const displayCode = interaction.customId.split(':')[1];

  if (interaction.customId.startsWith('participant_redeem_cancel:')) {
    await interaction.update({
      embeds: [
        createGuideEmbed(
          '교환 신청을 진행하지 않았어요',
          [
            '포인트는 차감되지 않았습니다.',
            '',
            '`/상점`에서 다시 항목을 선택할 수 있어요.',
          ].join('\n')
        ),
      ],
      components: [],
    });
    return;
  }

  try {
    const result = pointsRepository.requestRedemption({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      itemId: displayCode,
      note: `participant ux flow ${displayCode}`,
    });

    if (!result.ok) {
      await interaction.update({
        embeds: [
          createGuideEmbed(
            '교환 신청을 접수하지 못했어요',
            getRedemptionFailureMessage(result.reason),
            { footer: OPERATOR_CHECK_FOOTER }
          ),
        ],
        components: [],
      });
      return;
    }

    await interaction.update({
      embeds: [
        createGuideEmbed(
          '교환 신청이 접수됐어요',
          [
            `신청 코드: \`${result.item.displayCode || displayCode}\``,
            `신청 ID: \`${result.redemption.id}\``,
            `항목: ${result.item.name}`,
            `차감 포인트: ${formatPoints(result.item.cost)}`,
            `현재 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
            '',
            '운영진이 순차적으로 확인할게요.',
            '신청 코드는 `/상점`에서 확인할 수 있어요.',
          ].join('\n'),
          { footer: OPERATOR_CHECK_FOOTER }
        ),
      ],
      components: [],
    });
    await sendRedemptionReviewAlert(interaction, result.redemption, result.item, result.user, result.transaction);
  } catch (error) {
    console.error('교환 확인 버튼 처리 실패:', error.message);
    await interaction.update({
      embeds: [
        createGuideEmbed(
          '교환 신청을 처리하지 못했어요',
          '운영진에게 알려주세요.',
          { footer: OPERATOR_CHECK_FOOTER }
        ),
      ],
      components: [],
    });
  }
}

async function handleMissionSelect(interaction) {
  const displayCode = interaction.values[0];
  const mission = pointsRepository.resolveActiveMission(displayCode);

  if (!mission) {
    await interaction.reply({
      content: '`/미션`을 다시 실행해 현재 선택 가능한 미션을 확인해 주세요.',
      ephemeral: true,
    });
    return;
  }

  await interaction.showModal(createMissionSubmissionModal(mission));
}

async function handleMissionSubmissionModal(interaction) {
  const displayCode = interaction.customId.split(':')[1];
  const content = interaction.fields.getTextInputValue('content');

  try {
    const result = pointsRepository.createMissionSubmission({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      missionId: displayCode,
      content,
      attachment: null,
    });

    if (!result.ok) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '인증 제출을 접수하지 못했어요',
            getSubmissionFailureMessage(result.reason),
            { footer: OPERATOR_CHECK_FOOTER }
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '인증 제출이 접수됐어요',
          [
            `미션 코드: \`${result.mission.displayCode || displayCode}\``,
            `제출 ID: \`${result.submission.id}\``,
            `미션: ${result.mission.title || result.mission.id}`,
            '상태: pending',
            '',
            '운영진 확인 후 포인트가 지급돼요.',
            '사진이나 영상이 필요한 미션은 `/인증` 첨부파일 옵션으로 제출해 주세요.',
          ].join('\n'),
          { footer: OPERATOR_CHECK_FOOTER }
        ),
      ],
      ephemeral: true,
    });
    await sendMissionSubmissionReviewAlert(interaction, result.submission, result.mission);
  } catch (error) {
    console.error('인증 입력 모달 처리 실패:', error.message);
    await interaction.reply({
      content: '인증 제출을 처리하지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

function getSubmissionFailureMessage(reason) {
  const messages = {
    MISSION_NOT_FOUND: '해당 미션을 찾지 못했어요. `/미션`에서 현재 참여 가능한 미션을 확인해 주세요.',
    MISSION_NOT_ACTIVE: '해당 미션은 현재 인증을 접수하는 상태가 아니에요.',
    DUPLICATE_SUBMISSION: '이 미션은 이미 제출한 기록이 있어요. 운영진 확인을 기다려 주세요.',
  };

  return messages[reason] || '인증 제출 조건을 확인하지 못했어요. 운영진에게 알려주세요.';
}

async function handleSubmissionCommand(interaction) {
  try {
    const missionId = interaction.options.getString('미션id');
    const content = interaction.options.getString('내용');
    const attachment = typeof interaction.options.getAttachment === 'function'
      ? serializeAttachment(interaction.options.getAttachment('첨부파일'))
      : null;
    const result = pointsRepository.createMissionSubmission({
      user: {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      missionId,
      content,
      attachment,
    });

    if (!result.ok) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '인증 제출을 접수하지 못했어요',
            getSubmissionFailureMessage(result.reason),
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
          '인증 제출이 접수됐어요',
          [
            `제출 ID: \`${result.submission.id}\``,
            `미션: ${result.mission.title || result.mission.id}`,
            attachment ? `첨부파일: ${attachment.name || '있음'}` : '첨부파일: 없음',
            '상태: pending',
            '',
            '운영진 확인 후 포인트가 지급돼요.',
            '사진이나 영상이 필요한 미션은 첨부파일을 함께 올려 주세요.',
            '인증 내용과 첨부파일에는 개인정보가 자세히 드러나지 않도록 주의해 주세요.',
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
    await sendMissionSubmissionReviewAlert(interaction, result.submission, result.mission);
  } catch (error) {
    console.error('인증 제출 처리 실패:', error.message);
    await interaction.reply({
      content: '인증 제출을 처리하지 못했어요. 운영진에게 알려주세요.',
      ephemeral: true,
    });
  }
}

async function handleSubmissionManageCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 명령어는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const submissionId = interaction.options.getString('제출id');
    const action = interaction.options.getString('처리');
    const note = interaction.options.getString('메모');
    const result = pointsRepository.reviewSubmissionById(
      submissionId,
      action,
      {
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
      },
      note
    );
    const pointLines = result.transaction
      ? [
        `지급 포인트: ${formatPoints(result.transaction.amount)}`,
        `지급 후 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
        `거래 ID: \`${result.transaction.id}\``,
      ]
      : ['포인트는 지급하지 않았어요.'];

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          action === 'approve' ? '인증 승인 완료' : '인증 반려 완료',
          [
            `제출 ID: \`${result.submission.id}\``,
            `상태: ${result.submission.status}`,
            `미션 ID: ${result.submission.missionId}`,
            ...pointLines,
            `처리자 ID: ${interaction.user.id}`,
            ...(note ? [`메모: ${note}`] : []),
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
  } catch (error) {
    console.error('인증 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `인증 처리를 완료하지 못했어요. ${error.message}`,
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
            `신청 코드: \`${result.item.displayCode || itemId}\``,
            `항목: ${result.item.name}`,
            `차감 포인트: ${formatPoints(result.item.cost)}`,
            `현재 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
            '',
            '운영진이 순차적으로 확인할게요.',
            '신청 코드는 `/상점`에서 확인할 수 있어요.',
            '청년동 포인트 전환권은 청년동 내부 사용처에 한정된 운영진 처리 항목이며, 현금 환급이나 외부 교환 대상이 아니에요.',
          ].join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      ephemeral: true,
    });
    await sendRedemptionReviewAlert(interaction, result.redemption, result.item, result.user, result.transaction);
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

async function handleOperationStatusCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 명령어는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const type = interaction.options.getString('종류') || 'summary';
    const limit = interaction.options.getInteger('개수') || 10;
    let embed;

    if (type === 'pendingRedemptions') {
      embed = createPendingRedemptionsEmbed(pointsRepository.listPendingRedemptions(limit));
    } else if (type === 'pendingSubmissions') {
      embed = createPendingSubmissionsEmbed(pointsRepository.listPendingSubmissions(limit));
    } else if (type === 'missions') {
      embed = createAdminMissionListEmbed(pointsRepository.listMissionsForAdmin({ limit }));
    } else if (type === 'shop') {
      embed = createAdminShopListEmbed(pointsRepository.listShopItemsForAdmin({ limit }));
    } else {
      embed = createOperationSummaryEmbed(pointsRepository.getOperationSummary());
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error('운영 현황 조회 실패:', error.message);
    await interaction.reply({
      content: `운영 현황을 불러오지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

function createOperationExportEmbed(payload) {
  return createGuideEmbed(
    '운영 데이터 내보내기',
    [
      `종류: ${payload.kindLabel}`,
      `형식: ${payload.formatLabel}`,
      `포함 개수: ${payload.rowCount}`,
      `생성 시간: ${payload.generatedAt}`,
      '',
      payload.format === 'summary'
        ? payload.content
        : `파일명: \`${payload.filename}\``,
      '',
      '파일을 안전한 위치에 보관해 주세요.',
      '외부 공유 시 개인정보 포함 여부를 반드시 확인해 주세요.',
      '이 내보내기는 운영자 백업용이며 공개 채널에 공유하지 않는 것을 권장합니다.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

async function handleOperationExportCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '운영진 전용 명령어예요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const kind = interaction.options.getString('종류');
    const format = interaction.options.getString('형식') || 'summary';
    const limit = interaction.options.getInteger('개수') || 50;
    const payload = buildOperationExportPayload(pointsRepository, {
      kind,
      format,
      limit,
    });

    if (payload.isAttachment) {
      const attachment = new AttachmentBuilder(payload.buffer, {
        name: payload.filename,
      });

      await interaction.reply({
        embeds: [createOperationExportEmbed(payload)],
        files: [attachment],
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createOperationExportEmbed(payload)],
      ephemeral: true,
    });
  } catch (error) {
    console.error('운영 데이터 내보내기 실패:', error.message);
    const fallback = truncateForDiscord(
      [
        '운영 데이터 내보내기를 완료하지 못했어요.',
        error.message,
        '',
        '파일 첨부 또는 데이터 조회 과정에서 문제가 발생했습니다. 공개 채널에는 운영 데이터를 올리지 말아 주세요.',
      ].join('\n'),
      1900
    );

    await interaction.reply({
      content: fallback,
      ephemeral: true,
    });
  }
}

function getMissionUpdatesFromOptions(options) {
  const updates = {};
  const title = options.getString('제목');
  const description = options.getString('설명');
  const rewardPoints = options.getInteger('포인트');
  const requiresSubmission = options.getBoolean('인증필요');
  const activeDate = options.getString('날짜');
  const note = options.getString('메모');

  if (title !== null) updates.title = title;
  if (description !== null) updates.description = description;
  if (rewardPoints !== null) updates.rewardPoints = rewardPoints;
  if (requiresSubmission !== null) updates.requiresSubmission = requiresSubmission;
  if (activeDate !== null) updates.activeDate = activeDate;
  if (note !== null) updates.note = note;

  return updates;
}

function createMissionAdminResultEmbed(title, mission, extraLines = []) {
  const requiresSubmission = mission.requiresSubmission === false ? '아니오' : '예';
  return createGuideEmbed(
    title,
    [
      `미션 ID: \`${mission.id}\``,
      `제목: ${mission.title || '제목 없음'}`,
      `상태: ${mission.status}`,
      `지급 포인트: ${formatPoints(mission.rewardPoints || 0)}`,
      `인증 필요: ${requiresSubmission}`,
      `날짜: ${mission.activeDate || '미지정'}`,
      ...extraLines,
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

async function handleMissionManageCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 명령어는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const action = interaction.options.getString('작업');
    const missionId = interaction.options.getString('미션id');
    let embed;

    if (action === 'list') {
      embed = createAdminMissionListEmbed(pointsRepository.listMissionsForAdmin({ limit: 20 }));
    } else if (action === 'create') {
      const mission = pointsRepository.createMission({
        title: interaction.options.getString('제목'),
        description: interaction.options.getString('설명'),
        rewardPoints: interaction.options.getInteger('포인트'),
        requiresSubmission: interaction.options.getBoolean('인증필요') ?? true,
        activeDate: interaction.options.getString('날짜') || undefined,
        note: interaction.options.getString('메모'),
      });
      embed = createMissionAdminResultEmbed('미션 생성 완료', mission, [
        '',
        `참여자에게 노출하려면 \`/미션관리 작업:활성화 미션id:${mission.id}\`를 실행해 주세요.`,
      ]);
    } else if (action === 'update') {
      const mission = pointsRepository.updateMission(missionId, getMissionUpdatesFromOptions(interaction.options));
      embed = createMissionAdminResultEmbed('미션 수정 완료', mission);
    } else {
      const statusByAction = {
        activate: 'active',
        pause: 'paused',
        close: 'closed',
      };
      const mission = pointsRepository.setMissionStatus(missionId, statusByAction[action]);
      embed = createMissionAdminResultEmbed('미션 상태 변경 완료', mission, [
        mission.status === 'active' ? '이 미션은 참여자 `/미션`에 노출됩니다.' : '이 미션은 참여자 `/미션`에 노출되지 않습니다.',
      ]);
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error('미션 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `미션 관리를 완료하지 못했어요. ${error.message}`,
      ephemeral: true,
    });
  }
}

function getShopUpdatesFromOptions(options) {
  const updates = {};
  const name = options.getString('이름');
  const description = options.getString('설명');
  const cost = options.getInteger('비용');
  const stock = options.getInteger('재고');
  const monthlyLimit = options.getInteger('월한도');
  const type = options.getString('유형');
  const note = options.getString('메모');

  if (name !== null) updates.name = name;
  if (description !== null) updates.description = description;
  if (cost !== null) updates.cost = cost;
  if (stock !== null) updates.stock = stock;
  if (monthlyLimit !== null) updates.monthlyLimit = monthlyLimit;
  if (type !== null) updates.type = type;
  if (note !== null) updates.note = note;

  return updates;
}

function createShopAdminResultEmbed(title, item, extraLines = []) {
  return createGuideEmbed(
    title,
    [
      `항목 ID: \`${item.id}\``,
      `이름: ${item.name || '이름 없음'}`,
      `상태: ${item.status}`,
      `비용: ${formatPoints(item.cost || 0)}`,
      `재고: ${formatNullableCount(item.stock, '개')}`,
      `월한도: ${formatNullableCount(item.monthlyLimit, '회')}`,
      `유형: ${item.type || '미지정'}`,
      ...extraLines,
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

async function handleShopManageCommand(interaction) {
  if (!isOperator(interaction)) {
    await interaction.reply({
      content: '이 명령어는 운영진 권한이 필요해요.',
      ephemeral: true,
    });
    return;
  }

  try {
    const action = interaction.options.getString('작업');
    const itemId = interaction.options.getString('항목id');
    let embed;

    if (action === 'list') {
      embed = createAdminShopListEmbed(pointsRepository.listShopItemsForAdmin({ limit: 20 }));
    } else if (action === 'create') {
      const item = pointsRepository.createShopItem({
        name: interaction.options.getString('이름'),
        description: interaction.options.getString('설명'),
        cost: interaction.options.getInteger('비용'),
        stock: interaction.options.getInteger('재고'),
        monthlyLimit: interaction.options.getInteger('월한도'),
        type: interaction.options.getString('유형'),
        note: interaction.options.getString('메모'),
      });
      embed = createShopAdminResultEmbed('상점 항목 생성 완료', item, [
        '',
        `참여자에게 노출하려면 \`/상점관리 작업:활성화 항목id:${item.id}\`를 실행해 주세요.`,
        item.type === 'youthCenterPoint' ? '청년동 포인트 전환권은 청년동 내부 사용처에 한정된 운영진 처리 항목입니다.' : '',
      ].filter(Boolean));
    } else if (action === 'update') {
      const item = pointsRepository.updateShopItem(itemId, getShopUpdatesFromOptions(interaction.options));
      embed = createShopAdminResultEmbed('상점 항목 수정 완료', item);
    } else {
      const statusByAction = {
        activate: 'active',
        pause: 'paused',
        soldOut: 'soldOut',
        hide: 'hidden',
      };
      const item = pointsRepository.setShopItemStatus(itemId, statusByAction[action]);
      embed = createShopAdminResultEmbed('상점 항목 상태 변경 완료', item, [
        item.status === 'active' ? '이 항목은 참여자 `/상점`에 노출됩니다.' : '이 항목은 참여자 `/상점`에 노출되지 않습니다.',
      ]);
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  } catch (error) {
    console.error('상점 관리 처리 실패:', error.message);
    await interaction.reply({
      content: `상점 관리를 완료하지 못했어요. ${error.message}`,
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
  if (interaction.isStringSelectMenu && interaction.isStringSelectMenu()) {
    if (interaction.customId === 'participant_shop_select') {
      await handleShopSelect(interaction);
      return;
    }

    if (interaction.customId === 'participant_mission_select') {
      await handleMissionSelect(interaction);
      return;
    }
  }

  if (interaction.isButton && interaction.isButton()) {
    if (interaction.customId.startsWith('participant_redeem_confirm:')
      || interaction.customId.startsWith('participant_redeem_cancel:')) {
      await handleRedemptionConfirmButton(interaction);
      return;
    }
  }

  if (interaction.isModalSubmit && interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('participant_mission_submit:')) {
      await handleMissionSubmissionModal(interaction);
      return;
    }
  }

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

  if (interaction.commandName === '체크인') {
    await handleCheckinCommand(interaction);
    return;
  }

  if (interaction.commandName === '미션') {
    await handleMissionCommand(interaction);
    return;
  }

  if (interaction.commandName === '인증') {
    await handleSubmissionCommand(interaction);
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

  if (interaction.commandName === '인증관리') {
    await handleSubmissionManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '포인트로그') {
    await handlePointLogCommand(interaction);
    return;
  }

  if (interaction.commandName === '운영현황') {
    await handleOperationStatusCommand(interaction);
    return;
  }

  if (interaction.commandName === '운영내보내기') {
    await handleOperationExportCommand(interaction);
    return;
  }

  if (interaction.commandName === '미션관리') {
    await handleMissionManageCommand(interaction);
    return;
  }

  if (interaction.commandName === '상점관리') {
    await handleShopManageCommand(interaction);
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
  createOperationSummaryEmbed,
  createPendingRedemptionsEmbed,
  createPendingSubmissionsEmbed,
  handleChannelGuideCommand,
  handleCheckinCommand,
  handleGuideCommand,
  handleInteractionCreate,
  handleMissionManageCommand,
  handleMissionCommand,
  handleMissionSelect,
  handleMissionSubmissionModal,
  handleNoticeCommand,
  handleOperationStatusCommand,
  handleOperationExportCommand,
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
  handleRedemptionConfirmButton,
  handleRedemptionManageCommand,
  handleShopSelect,
  handleSubmissionCommand,
  handleSubmissionManageCommand,
  handleShopManageCommand,
  handleShopCommand,
};
