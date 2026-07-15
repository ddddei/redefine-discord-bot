const { OPERATOR_CHECK_FOOTER, createGuideEmbed, createPointBalanceEmbed, createShopEmbed, formatPoints, getShopTypeLabel } = require('./embeds');
const { getUser, getUserPoints, listPointTransactions, validateUserBalance } = require('./pointsStore');
const { CHECKIN_REWARD_POINTS } = require('./pointsRepository');
const {
  createInsufficientPointsDescription, createMissionSelectRow, createMissionSubmissionModal,
  createRedemptionCancelConfirmRow, createRedemptionConfirmRow, createShopSelectRow,
  getRedemptionFailureMessage,
} = require('./participantInteractionUi');

function getOptionalStringOption(options, name) {
  try { return options.getString(name); } catch (error) { return null; }
}

function createActivityParticipantHandlers({
  pointsRepository, getMemberDisplayName, recordParticipantCommandUse,
  sendMissionSubmissionReviewAlert, sendRedemptionReviewAlert,
}) {
  async function replyWithShopSelection(interaction) {
    const items = pointsRepository.listActiveShopItemsWithCodes();

    if (items.length === 0) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '리디파인 포인트 상점',
            [
              '지금 교환할 수 있는 항목이 없어요.',
              '',
              '운영진이 새 항목을 열면 이곳에서 확인할 수 있어요.',
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
  }

  async function replyWithMissionSelection(interaction) {
    const missions = pointsRepository.listActiveMissions();

    if (missions.length === 0) {
      await interaction.reply({
        embeds: [
          createGuideEmbed(
            '오늘 참여 가능한 미션',
            [
              '지금 바로 참여할 수 있는 미션은 없어요.',
              '',
              '운영진이 새 미션을 열면 이곳에서 확인할 수 있어요.',
              '오늘은 `/체크인`으로 가볍게 기록을 남겨도 괜찮아요.',
            ].join('\n')
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const lines = missions.slice(0, 10).map((mission) => {
      const submissionText = mission.requiresSubmission === false ? '운영진 안내' : '글로 인증';
      return [
        `🌱 ${mission.title || '미션'}`,
        `지급 포인트 ${formatPoints(mission.rewardPoints || 0)} · ${submissionText}`,
      ].join('\n');
    });

    await interaction.reply({
      embeds: [
        createGuideEmbed(
          '오늘 참여 가능한 미션',
          [
            ...lines.join('\n\n').split('\n'),
            '',
            '미션은 선택형 활동이에요.',
            '글로 남길 수 있는 미션은 아래에서 선택해 제출할 수 있어요.',
            '사진이나 영상이 필요한 경우 `/인증`에서 첨부파일을 함께 올려 주세요.',
          ].join('\n')
        ),
      ],
      components: [createMissionSelectRow(missions)],
      ephemeral: true,
    });
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


  function createPointBalanceEmbedForUser(userId) {
    const { pointsData } = pointsRepository.loadState();
    const user = getUser(pointsData, userId);
    const currentPoints = getUserPoints(pointsData, userId);
    const transactions = listPointTransactions(pointsData, userId, {
      latestFirst: true,
    });
    const balanceCheck = user ? validateUserBalance(pointsData, userId) : null;

    return createPointBalanceEmbed({
      currentPoints,
      transactions,
      balanceCheck,
    });
  }


  async function handlePointCommand(interaction) {
    try {
      recordParticipantCommandUse(interaction, '포인트');
      await interaction.reply({
        embeds: [createPointBalanceEmbedForUser(interaction.user.id)],
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
      recordParticipantCommandUse(interaction, '상점');
      await replyWithShopSelection(interaction);
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
      recordParticipantCommandUse(interaction, '미션');
      await replyWithMissionSelection(interaction);
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
            '아직 포인트가 조금 부족해요',
            [
              `${getShopTypeLabel(item.type)} ${item.name}`,
              '',
              createInsufficientPointsDescription({
                currentPoints,
                requiredPoints: item.cost,
              }),
            ].join('\n'),
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
            `${getShopTypeLabel(item.type)}`,
            `${item.name}`,
            '',
            `필요 포인트: ${formatPoints(item.cost)}`,
            `현재 포인트: ${formatPoints(currentPoints)}`,
            `신청 후 포인트: ${formatPoints(balanceAfter)}`,
            '',
            '신청하면 포인트가 차감돼요.',
            '단순 변심에 따른 취소나 환불은 원칙적으로 어렵습니다.',
            '',
            `직접 입력용 신청 코드: ${item.displayCode}`,
          ].join('\n'),
          { footer: OPERATOR_CHECK_FOOTER }
        ),
      ],
      components: [createRedemptionConfirmRow(item.displayCode)],
    });
  }

  async function handleRedemptionConfirmButton(interaction) {
    const displayCode = interaction.customId.split(':')[1];

    if (interaction.customId.startsWith('participant_redeem_cancel_check:')) {
      await interaction.update({
        embeds: [
          createGuideEmbed(
            '교환 신청을 종료할까요?',
            [
              '아직 포인트는 차감되지 않았어요.',
            ].join('\n')
          ),
        ],
        components: [createRedemptionCancelConfirmRow(displayCode)],
      });
      return;
    }

    if (interaction.customId.startsWith('participant_redeem_cancel_back:')) {
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

      await interaction.update({
        embeds: [
          createGuideEmbed(
            '교환 신청 전 확인해 주세요',
            [
              `${getShopTypeLabel(item.type)}`,
              `${item.name}`,
              '',
              `필요 포인트: ${formatPoints(item.cost)}`,
              `현재 포인트: ${formatPoints(currentPoints)}`,
              `신청 후 포인트: ${formatPoints(balanceAfter)}`,
              '',
              '신청하면 포인트가 차감돼요.',
              '단순 변심에 따른 취소나 환불은 원칙적으로 어렵습니다.',
              '',
              `직접 입력용 신청 코드: ${item.displayCode}`,
            ].join('\n'),
            { footer: OPERATOR_CHECK_FOOTER }
          ),
        ],
        components: [createRedemptionConfirmRow(displayCode)],
      });
      return;
    }

    if (interaction.customId.startsWith('participant_redeem_cancel_done:')) {
      await interaction.update({
        embeds: [
          createGuideEmbed(
            '교환 신청을 진행하지 않았어요',
            [
              '포인트는 차감되지 않았어요.',
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
              `신청한 항목: ${result.item.name}`,
              `차감 포인트: ${formatPoints(result.item.cost)}`,
              `현재 잔액: ${formatPoints(result.transaction.balanceAfter)}`,
              '',
              '운영진이 순차적으로 확인할게요.',
            ].join('\n'),
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
              `미션: ${result.mission.title || result.mission.id}`,
              '',
              '운영진 확인 후 포인트가 지급돼요.',
              '사진이나 영상이 필요한 미션은 `/인증` 첨부파일 옵션으로 제출해 주세요.',
            ].join('\n'),
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
      const missionId = getOptionalStringOption(interaction.options, '미션')
        || getOptionalStringOption(interaction.options, '미션id');
      const content = getOptionalStringOption(interaction.options, '내용');
      const attachment = typeof interaction.options.getAttachment === 'function'
        ? serializeAttachment(interaction.options.getAttachment('첨부파일'))
        : null;

      if (!missionId) {
        await replyWithMissionSelection(interaction);
        return;
      }

      if (!content && !attachment) {
        const mission = pointsRepository.resolveActiveMission(missionId);

        if (!mission) {
          const existingMission = pointsRepository.findMission(missionId);
          await interaction.reply({
            embeds: [
              createGuideEmbed(
                '인증 제출을 접수하지 못했어요',
                getSubmissionFailureMessage(existingMission ? 'MISSION_NOT_ACTIVE' : 'MISSION_NOT_FOUND'),
                { footer: OPERATOR_CHECK_FOOTER }
              ),
            ],
            ephemeral: true,
          });
          return;
        }

        await interaction.showModal(createMissionSubmissionModal(mission));
        return;
      }

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
              `미션: ${result.mission.title || result.mission.id}`,
              attachment ? `첨부파일: ${attachment.name || '있음'}` : '첨부파일: 없음',
              '',
              '운영진 확인 후 포인트가 지급돼요.',
              '글로 남길 수 있는 미션은 `/미션`에서 선택해 제출할 수 있어요.',
              '사진이나 영상이 필요한 경우 `/인증`에서 첨부파일을 함께 올려 주세요.',
            ].join('\n'),
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


  async function handleRedemptionCommand(interaction) {
    try {
      const itemId = getOptionalStringOption(interaction.options, '항목');
      const note = getOptionalStringOption(interaction.options, '메모');

      if (!itemId) {
        await replyWithShopSelection(interaction);
        return;
      }

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

  return {
    createPointBalanceEmbedForUser, handleCheckinCommand, handleMissionCommand,
    handleMissionSelect, handleMissionSubmissionModal, handlePointCommand,
    handleRedemptionCommand, handleRedemptionConfirmButton, handleShopCommand,
    handleShopSelect, handleSubmissionCommand,
  };
}

module.exports = { createActivityParticipantHandlers };
