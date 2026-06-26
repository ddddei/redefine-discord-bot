const {
  buildDungeonworldIntroEmbed,
  buildDungeonworldResultEmbed,
} = require('./embeds');
const {
  DUNGEONWORLD_CHOICE_PREFIX,
  OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS,
  OPERATOR_DUNGEONWORLD_MANAGE_PREFIX,
  createDungeonworldChoiceRow,
} = require('./components');
const {
  CLOSING_NOTE: DUNGEONWORLD_CLOSING_NOTE,
  getChoice: getDungeonworldChoice,
  getCurrentSessionId: getCurrentDungeonworldSessionId,
  getPreviousSessionId: getPreviousDungeonworldSessionId,
  getSession: getDungeonworldSession,
  listChoices: listDungeonworldChoices,
  listSessions: listDungeonworldSessions,
  playChoice: playDungeonworldChoice,
} = require('./dungeonworld');
const { createDungeonworldPayloads } = require('./dungeonworldPayloads');

function createDungeonworldHandlers(dependencies) {
  const {
    dungeonworldRepository,
    dungeonworldConfigRepository,
    getMemberDisplayName,
    isOperator,
  } = dependencies;
  const {
    createDungeonworldManagePayload,
    createDungeonworldRecordEmbed,
  } = createDungeonworldPayloads({
    dungeonworldRepository,
    dungeonworldConfigRepository,
  });

  function getDungeonworldPreviousTier(userId, currentSessionId) {
    const previousSessionId = getPreviousDungeonworldSessionId(currentSessionId);
    if (!previousSessionId) {
      return null;
    }

    const previousPlay = dungeonworldRepository.getLastPlayForUserInSession(userId, previousSessionId);
    return previousPlay ? previousPlay.tier : null;
  }

  async function handleDungeonworldRecordCommand(interaction) {
    try {
      await interaction.reply({
        embeds: [createDungeonworldRecordEmbed(interaction.user.id)],
        ephemeral: true,
      });
    } catch (error) {
      console.error('던전월드 기록 조회 실패:', error.message);
      await interaction.reply({
        content: `던전월드 기록을 확인하지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }

  async function handleDungeonworldCommand(interaction) {
    const currentSessionId = getCurrentDungeonworldSessionId(dungeonworldConfigRepository);
    const previousTier = getDungeonworldPreviousTier(interaction.user.id, currentSessionId);
    const session = getDungeonworldSession(currentSessionId, { previousTier });
    const choices = listDungeonworldChoices(currentSessionId);

    await interaction.reply({
      embeds: [buildDungeonworldIntroEmbed(session, choices)],
      components: [createDungeonworldChoiceRow(choices)],
      ephemeral: true,
    });
  }

  async function handleDungeonworldButton(interaction) {
    try {
      const currentSessionId = getCurrentDungeonworldSessionId(dungeonworldConfigRepository);
      const choiceId = interaction.customId.slice(DUNGEONWORLD_CHOICE_PREFIX.length);
      const choice = getDungeonworldChoice(choiceId, currentSessionId);
      if (!choice) {
        await interaction.reply({
          content: '선택지를 찾지 못했어요. `/던전월드`를 다시 실행해 주세요.',
          ephemeral: true,
        });
        return;
      }

      const result = playDungeonworldChoice(choiceId, currentSessionId);
      dungeonworldRepository.recordPlay({
        userId: interaction.user.id,
        displayName: getMemberDisplayName(interaction.user, interaction.member),
        sessionId: result.sessionId,
        sessionTitle: result.sessionTitle,
        choiceId: result.choice.id,
        choiceLabel: result.choice.label,
        die1: result.die1,
        die2: result.die2,
        total: result.total,
        tier: result.tier,
        tierLabel: result.tierLabel,
        outcomeText: result.outcomeText,
      });

      await interaction.reply({
        embeds: [buildDungeonworldResultEmbed(result, DUNGEONWORLD_CLOSING_NOTE)],
        ephemeral: true,
      });
    } catch (error) {
      console.error('던전월드 처리 실패:', error.message);
      await interaction.reply({
        content: `던전월드를 진행하지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }

  async function handleDungeonworldManageCommand(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '이 명령어는 운영진 권한이 필요해요.',
        ephemeral: true,
      });
      return;
    }

    try {
      const sessionIdInput = interaction.options.getString('회차');
      const reset = interaction.options.getBoolean('초기화');
      let statusLine = null;

      if (reset) {
        dungeonworldConfigRepository.clearOverride(interaction.user.id);
        statusLine = '수동 설정을 해제하고 자동 회차 계산으로 되돌렸어요.';
      } else if (sessionIdInput) {
        dungeonworldConfigRepository.setOverride(sessionIdInput, interaction.user.id);
        statusLine = `수동 회차를 \`${sessionIdInput}\`로 설정했어요.`;
      }

      await interaction.reply({
        ...createDungeonworldManagePayload(statusLine),
        ephemeral: true,
      });
    } catch (error) {
      console.error('던전월드 회차 관리 실패:', error.message);
      await interaction.reply({
        content: `던전월드 회차 설정을 처리하지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }

  async function handleDungeonworldManageButton(interaction) {
    if (!isOperator(interaction)) {
      await interaction.reply({
        content: '이 메뉴는 운영진 권한이 필요해요.',
        ephemeral: true,
      });
      return;
    }

    try {
      const action = interaction.customId.slice(OPERATOR_DUNGEONWORLD_MANAGE_PREFIX.length);
      const sessions = listDungeonworldSessions();
      const sessionIds = sessions.map((session) => session.id);
      const currentSessionId = getCurrentDungeonworldSessionId(dungeonworldConfigRepository);
      const currentIndex = Math.max(0, sessionIds.indexOf(currentSessionId));
      let statusLine = null;

      if (interaction.customId === OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.previous) {
        const targetIndex = Math.max(0, currentIndex - 1);
        const targetSession = sessions[targetIndex];
        dungeonworldConfigRepository.setOverride(targetSession.id, interaction.user.id);
        statusLine = targetIndex === currentIndex
          ? `이미 첫 회차라 \`${targetSession.id}\`에 머물렀어요.`
          : `이전 회차 \`${targetSession.id}\`로 수동 설정했어요.`;
      } else if (interaction.customId === OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.next) {
        const targetIndex = Math.min(sessions.length - 1, currentIndex + 1);
        const targetSession = sessions[targetIndex];
        dungeonworldConfigRepository.setOverride(targetSession.id, interaction.user.id);
        statusLine = targetIndex === currentIndex
          ? `이미 마지막 회차라 \`${targetSession.id}\`에 머물렀어요.`
          : `다음 회차 \`${targetSession.id}\`로 수동 설정했어요.`;
      } else if (interaction.customId === OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.clearOverride) {
        dungeonworldConfigRepository.clearOverride(interaction.user.id);
        statusLine = '수동 설정을 해제하고 자동 회차 계산으로 되돌렸어요.';
      } else if (interaction.customId === OPERATOR_DUNGEONWORLD_MANAGE_BUTTON_IDS.refresh) {
        statusLine = '던전월드 회차 관리 화면을 새로고침했어요.';
      } else {
        await interaction.reply({
          content: `지원하지 않는 던전월드 관리 작업이에요: ${action || 'unknown'}`,
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        ...createDungeonworldManagePayload(statusLine),
        ephemeral: true,
      });
    } catch (error) {
      console.error('던전월드 회차 관리 버튼 처리 실패:', error.message);
      await interaction.reply({
        content: `던전월드 회차 관리 작업을 완료하지 못했어요. ${error.message}`,
        ephemeral: true,
      });
    }
  }

  return {
    handleDungeonworldButton,
    handleDungeonworldCommand,
    handleDungeonworldManageButton,
    handleDungeonworldManageCommand,
    handleDungeonworldRecordCommand,
  };
}

module.exports = {
  createDungeonworldHandlers,
};
