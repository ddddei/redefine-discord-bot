const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const GUIDE_HUB_SELECT_ID = 'guide_hub_select';

const GUIDE_HUB_OPTIONS = [
  {
    label: '처음 안내',
    value: 'start',
    description: '처음 왔을 때 보면 좋은 흐름을 확인해요.',
  },
  {
    label: '오늘 할 일',
    value: 'today',
    description: '오늘 가볍게 시작할 수 있는 일을 확인해요.',
  },
  {
    label: '포인트',
    value: 'points',
    description: '여정 포인트의 의미와 확인 방법을 봐요.',
  },
  {
    label: '상점과 교환',
    value: 'shop',
    description: '상점 이용과 교환 신청 흐름을 확인해요.',
  },
  {
    label: '미션과 인증',
    value: 'mission',
    description: '미션 참여와 인증 방법을 확인해요.',
  },
  {
    label: '문의하기',
    value: 'question',
    description: '질문하거나 운영진에게 문의하는 방법을 봐요.',
  },
];

function createGuideHubSelectRow(selectedValue = null) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(GUIDE_HUB_SELECT_ID)
      .setPlaceholder('궁금한 내용을 선택해 주세요')
      .addOptions(GUIDE_HUB_OPTIONS.map((option) => ({
        ...option,
        default: option.value === selectedValue,
      })))
  );
}

module.exports = {
  GUIDE_HUB_OPTIONS,
  GUIDE_HUB_SELECT_ID,
  createGuideHubSelectRow,
};
