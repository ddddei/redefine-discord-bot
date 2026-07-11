const { OPERATOR_CHECK_FOOTER, createGuideEmbed, formatPoints, formatTransactionAmount } = require('./embeds');
const { buildSubmissionReviewStatusEmbed } = require('./participantInteractionUi');
const { createPointTransactionLogEmbed } = require('./operatorInteractionUi');

function createActivityOperatorHandlers({
  pointsRepository,
  isOperator,
  getMemberDisplayName,
  createSubmissionReviewActionRow,
  sendMissionSubmissionReviewLog,
}) {
  function getSubmissionReviewButtonAction(customId) {
    if (customId.startsWith('operator_submission_approve:')) return 'approve';
    if (customId.startsWith('operator_submission_reject:')) return 'reject';
    return null;
  }

  function getSubmissionIdFromReviewButton(customId) {
    const separatorIndex = customId.indexOf(':');
    return separatorIndex === -1 ? '' : customId.slice(separatorIndex + 1);
  }

  async function sendSubmissionReviewDm(interaction, result) {
    if (!interaction.client || !interaction.client.users || typeof interaction.client.users.fetch !== 'function') {
      return;
    }

    try {
      const targetUser = await interaction.client.users.fetch(result.submission.userId);

      if (!targetUser || typeof targetUser.send !== 'function') {
        return;
      }

      const approved = result.submission.status === 'approved';
      const duplicateBlocked = result.submission.duplicateRewardBlocked === true;
      const submissionLabel = result.submission.type === 'todayMission' ? '오늘의 미션 인증' : '미션 인증';
      await targetUser.send([
        approved ? `${submissionLabel}이 승인됐어요 ✅` : '이번 인증은 반려됐어요.',
        result.mission
          ? `미션: ${result.mission.title || result.mission.id}`
          : `미션 ID: ${result.submission.missionId || '확인 필요'}`,
        result.transaction
          ? `${formatPoints(result.transaction.amount)}가 지급됐어요.`
          : (duplicateBlocked ? '인증은 확인됐지만, 오늘의 미션 포인트는 이미 지급되어 추가 지급은 없어요.' : '안내 내용을 확인한 뒤 다시 제출해주세요.'),
      ].join('\n'));
    } catch (error) {
      console.warn('미션 인증 검토 DM 전송 실패:', error.message);
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

  async function sendEphemeralAfterUpdate(interaction, payload) {
    if (typeof interaction.followUp === 'function') {
      await interaction.followUp({
        ...payload,
        ephemeral: true,
      });
      return;
    }

    if (typeof interaction.reply === 'function') {
      await interaction.reply({
        ...payload,
        ephemeral: true,
      });
    }
  }

  async function handleSubmissionReviewButton(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '운영진만 처리할 수 있어요.',
        ephemeral: true,
      });
      return;
    }

    const action = getSubmissionReviewButtonAction(interaction.customId);
    const submissionId = getSubmissionIdFromReviewButton(interaction.customId);
    const reviewer = {
      userId: interaction.user.id,
      displayName: getMemberDisplayName(interaction.user, interaction.member),
    };

    try {
      const result = action === 'approve'
        ? pointsRepository.approveSubmissionById(submissionId, reviewer, '운영자 검토 버튼 처리')
        : pointsRepository.rejectSubmissionById(submissionId, reviewer, '운영자 검토 버튼 처리');
      const embed = buildSubmissionReviewStatusEmbed(
        interaction.message && interaction.message.embeds && interaction.message.embeds[0],
        result,
        reviewer.displayName
      );

      await interaction.update({
        embeds: [embed],
        components: [createSubmissionReviewActionRow(submissionId, true)],
      });
      await sendSubmissionReviewDm(interaction, result);
      await sendMissionSubmissionReviewLog(interaction.client, result, reviewer.displayName);

      const participant = result.submission.displayName || result.submission.userId;
      const duplicateBlocked = result.submission.duplicateRewardBlocked === true;
      const lines = action === 'approve'
        ? [
          '승인 완료',
          duplicateBlocked
            ? '지급 포인트: 이미 오늘 지급 완료 / 추가 지급 없음'
            : `지급 포인트: ${formatPoints(result.transaction ? result.transaction.amount : 0)}`,
          `참여자: ${participant}`,
        ]
        : [
          '반려 완료',
          `참여자: ${participant}`,
        ];

      await sendEphemeralAfterUpdate(interaction, {
        content: lines.join('\n'),
      });
    } catch (error) {
      if (/이미 처리된 인증 제출/.test(error.message)) {
        const submission = pointsRepository.findSubmission(submissionId);
        const mission = submission ? pointsRepository.findMission(submission.missionId) : null;
        const result = {
          submission: submission || {
            id: submissionId,
            status: 'reviewed',
            missionId: null,
            reviewedBy: null,
            reviewedAt: null,
          },
          mission,
          transaction: null,
        };
        const embed = buildSubmissionReviewStatusEmbed(
          interaction.message && interaction.message.embeds && interaction.message.embeds[0],
          result,
          reviewer.displayName,
          true
        );

        await interaction.update({
          embeds: [embed],
          components: [createSubmissionReviewActionRow(submissionId, true)],
        });
        await sendEphemeralAfterUpdate(interaction, {
          content: '이미 처리된 인증 제출이에요.',
        });
        return;
      }

      console.error('인증 검토 버튼 처리 실패:', error.message);
      await interaction.reply({
        content: `인증 처리를 완료하지 못했어요. ${error.message}`,
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
      const transactions = pointsRepository.listOperationalTransactions({
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


  return {
    handlePointLogCommand,
    handlePointManageCommand,
    handleRedemptionManageCommand,
    handleSubmissionManageCommand,
    handleSubmissionReviewButton,
  };
}

module.exports = { createActivityOperatorHandlers };
