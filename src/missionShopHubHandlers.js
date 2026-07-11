const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const {
  OPERATOR_CHECK_FOOTER, createGuideEmbed, formatPoints, getShopTypeLabel, truncateText,
} = require('./embeds');
const {
  OPERATOR_MISSION_HUB_BUTTON_IDS, OPERATOR_SHOP_HUB_BUTTON_IDS,
  createOperatorMissionHubToken, createOperatorMissionTemplateToken, createOperatorShopHubToken,
  createOperatorMissionHubRows, createOperatorMissionTemplateRows, createOperatorShopHubRows,
  createOperatorHubSelectRow,
} = require('./components');
const { createMissionAdminResultEmbed, createShopAdminResultEmbed, formatNullableCount } = require('./operatorInteractionUi');
const {
  buildTodayMissionNoticeEmbed,
  buildTodayMissionNoticePayload,
  createAdminMissionHubEmbed,
  createAdminMissionListEmbed,
  createAdminShopHubEmbed,
  createAdminShopListEmbed,
  createMissionHubModal,
  createShopHubModal,
  getMissionHubModalInput,
  getMissionHubSelection,
  getMissionHubStatusInput,
  getMissionHubTokenFromCustomId,
  getMissionTemplateIdFromCustomId,
  getShopHubModalInput,
  getShopHubSelection,
  getShopHubStatusInput,
  getShopHubTokenFromCustomId,
  getShopHubTypeInput,
} = require('./missionShopHubUi');

function getOptionalStringOption(options, name) {
  try { return options.getString(name); } catch (error) { return null; }
}

function createMissionShopHubHandlers({
  pointsRepository, isOperator, getMemberDisplayName, sendEphemeralAfterUpdate,
  resolveConfiguredChannel, getConfiguredEnvValue,
}) {
  function getTodayMissionNoticeMission() {
    return pointsRepository.findTodayActiveMission();
  }

  async function handleTodayMissionNoticePreview(interaction) {
    const mission = getTodayMissionNoticeMission();
    if (!mission) {
      await interaction.reply({
        content: '오늘 게시할 active 미션이 없어요. 템플릿을 오늘의 미션으로 적용하거나 미션을 active 상태로 만든 뒤 다시 확인해 주세요.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      embeds: [createGuideEmbed(
        '오늘의 미션 공지 미리보기',
        buildTodayMissionNoticeEmbed(mission).data.description,
        {
          footer: OPERATOR_CHECK_FOOTER,
        }
      )],
      ephemeral: true,
    });
  }

  async function handleTodayMissionNoticePublish(interaction) {
    const mission = getTodayMissionNoticeMission();
    if (!mission) {
      await interaction.reply({
        content: '오늘 게시할 active 미션이 없어요. 템플릿을 오늘의 미션으로 적용하거나 미션을 active 상태로 만든 뒤 다시 시도해 주세요.',
        ephemeral: true,
      });
      return;
    }

    if (pointsRepository.hasTodayMissionNoticeBeenPublished()) {
      await interaction.reply({
        content: '이미 오늘의 미션을 게시했어요. 중복 게시하지 않았습니다.',
        ephemeral: true,
      });
      return;
    }

    const channelId = getConfiguredEnvValue('TODAY_MISSION_CHANNEL_ID');
    if (!channelId) {
      await interaction.reply({
        content: 'TODAY_MISSION_CHANNEL_ID가 설정되지 않아 오늘의 미션을 게시할 수 없어요.',
        ephemeral: true,
      });
      return;
    }

    const channel = await resolveConfiguredChannel(interaction, channelId);
    if (!channel || typeof channel.send !== 'function') {
      await interaction.reply({
        content: '오늘의 미션 채널을 찾지 못했거나 메시지를 보낼 수 없어요. 채널 ID와 봇 권한을 확인해 주세요.',
        ephemeral: true,
      });
      return;
    }

    const reservation = pointsRepository.reserveTodayMissionNoticePublication({
      missionId: mission.id,
      missionTitle: mission.title || null,
      channelId,
      publishedBy: interaction.user && interaction.user.id ? interaction.user.id : null,
    });

    if (!reservation.ok && reservation.reason === 'ALREADY_RESERVED') {
      await interaction.reply({
        content: '이미 오늘의 미션을 게시했어요. 중복 게시하지 않았습니다.',
        ephemeral: true,
      });
      return;
    }

    let message;
    try {
      message = await channel.send(buildTodayMissionNoticePayload(mission));
    } catch (error) {
      pointsRepository.failTodayMissionNoticePublication(reservation.record.id, error.message);
      await interaction.reply({
        content: `오늘의 미션 게시에 실패했어요. ${error.message}`,
        ephemeral: true,
      });
      return;
    }

    pointsRepository.completeTodayMissionNoticePublication(reservation.record.id, {
      messageId: message && message.id ? message.id : null,
      messageUrl: message && message.url ? message.url : null,
    });

    await interaction.reply({
      content: '오늘의 미션을 게시했어요.',
      ephemeral: true,
    });
  }

  function createMissionHubPayload(selectedMissionId = null, selectedTemplateId = null) {
    const missions = pointsRepository.listMissionsForAdmin({ limit: 25 });
    const selectedMission = getMissionHubSelection(missions, selectedMissionId);
    const baseTemplates = pointsRepository.listMissionTemplates({ limit: 25 });
    const recommendations = pointsRepository.listWeekdayMissionRecommendations();
    const todayRecommendation = pointsRepository.getTodayMissionRecommendation();
    const selectedRecommendationTemplate = todayRecommendation && todayRecommendation.template
      ? todayRecommendation.template
      : null;
    const templates = selectedRecommendationTemplate && !baseTemplates.some((template) => template.id === selectedRecommendationTemplate.id)
      ? [selectedRecommendationTemplate, ...baseTemplates.slice(0, 24)]
      : baseTemplates;
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)
      || selectedRecommendationTemplate
      || templates[0]
      || null;

    return {
      embeds: [createAdminMissionHubEmbed(
        missions,
        selectedMission ? selectedMission.id : null,
        templates,
        selectedTemplate ? selectedTemplate.id : null,
        recommendations,
        todayRecommendation
      )],
      components: [
        createOperatorHubSelectRow('mission_management'),
        ...createOperatorMissionHubRows(missions, selectedMission ? selectedMission.id : null),
        ...createOperatorMissionTemplateRows(templates, selectedTemplate ? selectedTemplate.id : null),
      ],
    };
  }

  function resolveMissionHubToken(token) {
    const missions = pointsRepository.listMissionsForAdmin({ limit: 200 });
    return missions.find((mission) => createOperatorMissionHubToken(mission.id) === token) || null;
  }

  function resolveMissionTemplateToken(token) {
    const templates = pointsRepository.listMissionTemplates({ limit: 200 });
    return templates.find((template) => createOperatorMissionTemplateToken(template.id) === token) || null;
  }

  function createShopHubPayload(selectedItemId = null) {
    const items = pointsRepository.listShopItemsForAdmin({ limit: 25 });
    const selectedItem = getShopHubSelection(items, selectedItemId);

    return {
      embeds: [createAdminShopHubEmbed(items, selectedItem ? selectedItem.id : null)],
      components: [
        createOperatorHubSelectRow('shop_management'),
        ...createOperatorShopHubRows(items, selectedItem ? selectedItem.id : null),
      ],
    };
  }

  function resolveShopHubToken(token) {
    const items = pointsRepository.listShopItemsForAdmin({ limit: 200 });
    return items.find((item) => createOperatorShopHubToken(item.id) === token) || null;
  }

  async function handleShopHubSelect(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '이 메뉴는 운영진 권한이 필요해요.',
        ephemeral: true,
      });
      return;
    }

    try {
      const selectedItemToken = interaction.values && interaction.values[0] ? interaction.values[0] : null;
      const selectedItem = selectedItemToken ? resolveShopHubToken(selectedItemToken) : null;
      await interaction.update(createShopHubPayload(selectedItem ? selectedItem.id : null));
    } catch (error) {
      console.error('상점 관리 허브 선택 실패:', error.message);
      await interaction.reply({
        content: `상점 관리 허브를 불러오지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }

  async function handleShopHubButton(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '이 메뉴는 운영진 권한이 필요해요.',
        ephemeral: true,
      });
      return;
    }

    try {
      if (interaction.customId === OPERATOR_SHOP_HUB_BUTTON_IDS.create) {
        await interaction.showModal(createShopHubModal('create'));
        return;
      }

      if (interaction.customId === OPERATOR_SHOP_HUB_BUTTON_IDS.refresh) {
        await interaction.update(createShopHubPayload());
        return;
      }

      const itemToken = getShopHubTokenFromCustomId(interaction.customId);
      const item = itemToken ? resolveShopHubToken(itemToken) : null;

      if (interaction.customId.startsWith(OPERATOR_SHOP_HUB_BUTTON_IDS.editPrefix)) {
        if (!item) {
          await interaction.reply({
            content: '수정할 상점 항목을 찾지 못했어요. 새로고침 후 다시 시도해 주세요.',
            ephemeral: true,
          });
          return;
        }

        await interaction.showModal(createShopHubModal('update', item));
        return;
      }

      if (!item) {
        await interaction.reply({
          content: '대상 상점 항목을 찾지 못했어요. 새로고침 후 다시 시도해 주세요.',
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId.startsWith(OPERATOR_SHOP_HUB_BUTTON_IDS.togglePrefix)) {
        const updatedItem = pointsRepository.setShopItemStatus(item.id, item.status === 'active' ? 'paused' : 'active');
        await interaction.update(createShopHubPayload(updatedItem.id));
        return;
      }

      if (interaction.customId.startsWith(OPERATOR_SHOP_HUB_BUTTON_IDS.soldOutPrefix)) {
        const updatedItem = pointsRepository.setShopItemStatus(item.id, 'soldOut');
        await interaction.update(createShopHubPayload(updatedItem.id));
        return;
      }

      if (interaction.customId.startsWith(OPERATOR_SHOP_HUB_BUTTON_IDS.hidePrefix)) {
        const updatedItem = pointsRepository.setShopItemStatus(item.id, 'hidden');
        await interaction.update(createShopHubPayload(updatedItem.id));
        return;
      }
    } catch (error) {
      console.error('상점 관리 허브 처리 실패:', error.message);
      await interaction.reply({
        content: `상점 관리 허브 작업을 완료하지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }

  async function handleShopHubModal(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '이 메뉴는 운영진 권한이 필요해요.',
        ephemeral: true,
      });
      return;
    }

    try {
      let item;

      if (interaction.customId === 'admin_shop_hub_modal:create') {
        item = pointsRepository.createShopItem(getShopHubModalInput(interaction));
      } else {
        const itemToken = getShopHubTokenFromCustomId(interaction.customId);
        const currentItem = itemToken ? resolveShopHubToken(itemToken) : null;
        if (!currentItem) {
          await interaction.reply({
            content: '수정할 상점 항목을 찾지 못했어요. 새로고침 후 다시 시도해 주세요.',
            ephemeral: true,
          });
          return;
        }

        item = pointsRepository.updateShopItem(
          currentItem.id,
          getShopHubModalInput(interaction, currentItem.type || 'reward', currentItem.status || 'paused')
        );
      }

      await interaction.reply({
        ...createShopHubPayload(item.id),
        ephemeral: true,
      });
    } catch (error) {
      console.error('상점 관리 허브 저장 실패:', error.message);
      await interaction.reply({
        content: `상점 항목을 저장하지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }


  async function handleMissionHubSelect(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '이 메뉴는 운영진 권한이 필요해요.',
        ephemeral: true,
      });
      return;
    }

    try {
      const selectedMissionId = interaction.values && interaction.values[0] ? interaction.values[0] : null;
      const selectedMission = selectedMissionId ? resolveMissionHubToken(selectedMissionId) : null;
      await interaction.update(createMissionHubPayload(selectedMission ? selectedMission.id : null));
    } catch (error) {
      console.error('미션 관리 허브 선택 실패:', error.message);
      await interaction.reply({
        content: `미션 관리 허브를 불러오지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }


  async function handleMissionTemplateSelect(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '이 메뉴는 운영진 권한이 필요해요.',
        ephemeral: true,
      });
      return;
    }

    try {
      const templateToken = interaction.values && interaction.values[0] ? interaction.values[0] : null;
      const selectedTemplate = templateToken ? resolveMissionTemplateToken(templateToken) : null;
      await interaction.update(createMissionHubPayload(null, selectedTemplate ? selectedTemplate.id : null));
    } catch (error) {
      console.error('미션 템플릿 선택 실패:', error.message);
      await interaction.reply({
        content: `미션 템플릿을 불러오지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }

  async function handleMissionHubButton(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '이 메뉴는 운영진 권한이 필요해요.',
        ephemeral: true,
      });
      return;
    }

    try {
      if (interaction.customId === OPERATOR_MISSION_HUB_BUTTON_IDS.create) {
        await interaction.showModal(createMissionHubModal('create'));
        return;
      }

      if (interaction.customId === OPERATOR_MISSION_HUB_BUTTON_IDS.refresh) {
        await interaction.update(createMissionHubPayload());
        return;
      }

      if (interaction.customId === OPERATOR_MISSION_HUB_BUTTON_IDS.previewTodayNotice) {
        await handleTodayMissionNoticePreview(interaction);
        return;
      }

      if (interaction.customId === OPERATOR_MISSION_HUB_BUTTON_IDS.publishTodayNotice) {
        await handleTodayMissionNoticePublish(interaction);
        return;
      }

      if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.applyTemplatePrefix)) {
        const templateToken = getMissionTemplateIdFromCustomId(interaction.customId);
        const template = resolveMissionTemplateToken(templateToken);
        if (!template) {
          await interaction.reply({
            content: '선택한 템플릿을 찾지 못했어요. 허브를 새로고침한 뒤 다시 시도해 주세요.',
            ephemeral: true,
          });
          return;
        }

        const result = pointsRepository.createMissionFromTemplateForToday(template.id);
        if (!result.ok && result.reason === 'TODAY_MISSION_EXISTS') {
          await interaction.update(createMissionHubPayload(result.mission.id, template.id));
          await sendEphemeralAfterUpdate(interaction, {
            content: `이미 오늘의 active 미션이 있어요: ${result.mission.title || result.mission.id}. 중복 생성하지 않았습니다.`,
          });
          return;
        }

        if (!result.ok) {
          await interaction.reply({
            content: '선택한 템플릿을 찾지 못했어요. 허브를 새로고침한 뒤 다시 시도해 주세요.',
            ephemeral: true,
          });
          return;
        }

        await interaction.update(createMissionHubPayload(result.mission.id, result.template.id));
        await sendEphemeralAfterUpdate(interaction, {
          content: `${result.template.title || result.template.id} 템플릿을 오늘의 미션으로 저장했어요. 이제 공지 미리보기 후 게시할 수 있어요.${result.template.isExample ? ' 이 템플릿은 예시 템플릿입니다.' : ''}`,
        });
        return;
      }

      const missionToken = getMissionHubTokenFromCustomId(interaction.customId);
      const mission = missionToken ? resolveMissionHubToken(missionToken) : null;
      if (!mission) {
        await interaction.reply({
          content: '대상 미션을 찾지 못했어요. 허브를 새로고침한 뒤 다시 선택해 주세요.',
          ephemeral: true,
        });
        return;
      }

      if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.editPrefix)) {
        await interaction.showModal(createMissionHubModal('update', mission));
        return;
      }

      if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.togglePrefix)) {
        const nextStatus = mission.status === 'active' ? 'paused' : 'active';
        const updatedMission = pointsRepository.setMissionStatus(mission.id, nextStatus);
        await interaction.update(createMissionHubPayload(updatedMission.id));
        await sendEphemeralAfterUpdate(interaction, {
          content: `${updatedMission.title || updatedMission.id} 상태를 ${updatedMission.status}로 변경했어요.`,
        });
        return;
      }

      if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.closePrefix)) {
        const updatedMission = pointsRepository.setMissionStatus(mission.id, 'closed');
        await interaction.update(createMissionHubPayload(updatedMission.id));
        await sendEphemeralAfterUpdate(interaction, {
          content: `${updatedMission.title || updatedMission.id} 미션을 종료 상태로 변경했어요.`,
        });
        return;
      }

      if (interaction.customId.startsWith(OPERATOR_MISSION_HUB_BUTTON_IDS.toggleSubmissionPrefix)) {
        const nextRequiresSubmission = mission.requiresSubmission === false;
        const updatedMission = pointsRepository.updateMission(mission.id, { requiresSubmission: nextRequiresSubmission });
        await interaction.update(createMissionHubPayload(updatedMission.id));
        await sendEphemeralAfterUpdate(interaction, {
          content: `${updatedMission.title || updatedMission.id} 인증 필요 여부를 ${updatedMission.requiresSubmission === false ? '아니오' : '예'}로 변경했어요.`,
        });
        return;
      }

      await interaction.reply({
        content: '지원하지 않는 미션 관리 허브 버튼이에요. 허브를 새로고침한 뒤 다시 시도해 주세요.',
        ephemeral: true,
      });
    } catch (error) {
      console.error('미션 관리 허브 버튼 처리 실패:', error.message);
      await interaction.reply({
        content: `미션 관리 허브 작업을 완료하지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }

  async function handleMissionHubModal(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '이 메뉴는 운영진 권한이 필요해요.',
        ephemeral: true,
      });
      return;
    }

    try {
      const parts = interaction.customId.split(':');
      const action = parts[1];
      const missionToken = parts.slice(2).join(':');
      let mission;

      if (action === 'create') {
        mission = pointsRepository.createMission({
          ...getMissionHubModalInput(interaction, 'draft'),
          requiresSubmission: true,
        });
      } else if (action === 'update') {
        const currentMission = resolveMissionHubToken(missionToken);
        if (!currentMission) {
          throw new Error('수정할 미션을 찾을 수 없습니다.');
        }
        mission = pointsRepository.updateMission(
          currentMission.id,
          getMissionHubModalInput(interaction, currentMission.status || 'draft', currentMission.activeDate || null)
        );
      } else {
        throw new Error('지원하지 않는 미션 허브 작업입니다.');
      }

      await interaction.reply({
        embeds: [createMissionAdminResultEmbed(action === 'create' ? '미션 생성 완료' : '미션 수정 완료', mission, [
          '',
          mission.status === 'active'
            ? '이 미션은 참여자 `/미션`에 노출됩니다.'
            : 'active 상태가 아니므로 참여자 `/미션`에는 노출되지 않습니다.',
        ])],
        components: [
          createOperatorHubSelectRow('mission_management'),
          ...createOperatorMissionHubRows(pointsRepository.listMissionsForAdmin({ limit: 25 }), mission.id),
          ...createOperatorMissionTemplateRows(pointsRepository.listMissionTemplates({ limit: 25 })),
        ],
        ephemeral: true,
      });
    } catch (error) {
      console.error('미션 관리 허브 모달 처리 실패:', error.message);
      await interaction.reply({
        content: `미션 저장을 완료하지 못했어요. ${error.message}`,
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


  return {
    buildTodayMissionNoticePayload,
    createAdminMissionHubEmbed,
    createAdminMissionListEmbed,
    createAdminShopHubEmbed,
    createAdminShopListEmbed,
    createMissionHubPayload,
    createShopHubPayload,
    handleMissionHubButton,
    handleMissionHubModal,
    handleMissionHubSelect,
    handleMissionManageCommand,
    handleMissionTemplateSelect,
    handleShopHubButton,
    handleShopHubModal,
    handleShopHubSelect,
    handleShopManageCommand,
  };
}

module.exports = { createMissionShopHubHandlers };
