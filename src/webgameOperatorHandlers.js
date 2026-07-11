const { OPERATOR_CHECK_FOOTER, createGuideEmbed } = require('./embeds');
const { WEBGAME_PAYOUT_CANCEL_ID, WEBGAME_PAYOUT_CONFIRM_PREFIX, createWebgamePayoutPreviewPayload } = require('./operatorInteractionUi');
const { buildPayoutResultLines, buildWeeklyPayoutPlan, executeWeeklyPayoutPlan, getPayoutWeekKey } = require('./webgamePayout');

function createWebgameOperatorHandlers({ pointsRepository, createWebgameRepository, isOperator }) {
  async function handleWebgamePayoutCommand(interaction) {
    try {
      if (!isOperator(interaction)) {
        await interaction.reply({
          content: '이 명령은 운영진만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const period = interaction.options.getString('주차') || 'last';
      const weekKey = getPayoutWeekKey(period);
      const plan = buildWeeklyPayoutPlan({
        webgameRepository: createWebgameRepository(),
        pointsRepository,
        weekKey,
      });

      await interaction.reply(createWebgamePayoutPreviewPayload(plan));
    } catch (error) {
      console.error('웹게임 지급 미리보기 실패:', error.message);
      await interaction.reply({
        content: '지급 내역을 불러오지 못했어요. 운영진에게 알려주세요.',
        ephemeral: true,
      });
    }
  }

  async function handleWebgamePayoutConfirmButton(interaction) {
    try {
      if (!isOperator(interaction)) {
        await interaction.reply({
          content: '이 버튼은 운영진만 사용할 수 있어요.',
          ephemeral: true,
        });
        return;
      }

      const weekKey = interaction.customId.slice(WEBGAME_PAYOUT_CONFIRM_PREFIX.length);
      // 미리보기 이후 상태가 바뀌었을 수 있으므로 승인 시점에 계획을 재계산해 실행한다.
      // 이미 지급된 항목은 awardWebgameWeeklyReward의 중복 차단으로 건너뛰어진다.
      const plan = buildWeeklyPayoutPlan({
        webgameRepository: createWebgameRepository(),
        pointsRepository,
        weekKey,
      });
      const result = executeWeeklyPayoutPlan(plan, {
        pointsRepository,
        operatorId: interaction.user.id,
      });

      await interaction.update({
        embeds: [
          createGuideEmbed('웹게임 주간 보상 지급 완료', buildPayoutResultLines(weekKey, result).join('\n'), {
            footer: OPERATOR_CHECK_FOOTER,
          }),
        ],
        components: [],
      });
    } catch (error) {
      console.error('웹게임 지급 실행 실패:', error.message);
      await interaction.reply({
        content: '지급을 처리하지 못했어요. /포인트로그에서 지급된 내역을 확인한 뒤 다시 시도해 주세요.',
        ephemeral: true,
      });
    }
  }

  async function handleWebgamePayoutCancelButton(interaction) {
    await interaction.update({
      embeds: [
        createGuideEmbed('웹게임 주간 보상 지급 취소', '지급하지 않았어요. 필요하면 /게임지급을 다시 실행해 주세요.', {
          footer: OPERATOR_CHECK_FOOTER,
        }),
      ],
      components: [],
    });
  }


  return { handleWebgamePayoutCancelButton, handleWebgamePayoutCommand, handleWebgamePayoutConfirmButton };
}

module.exports = { createWebgameOperatorHandlers };
