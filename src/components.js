const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const GUIDE_HUB_SELECT_ID = 'guide_hub_select';

const GUIDE_HUB_OPTIONS = [
  {
    label: '처음 왔어요',
    value: 'start',
    description: '처음 들어온 분을 위한 기본 안내',
  },
  {
    label: '오늘 뭐 하면 되나요?',
    value: 'today',
    description: '오늘 참여할 수 있는 흐름 보기',
  },
  {
    label: '내 포인트',
    value: 'points',
    description: '여정 포인트 확인 방법',
  },
  {
    label: '상점/교환',
    value: 'shop',
    description: '포인트 사용과 교환 신청 안내',
  },
  {
    label: '미션/인증',
    value: 'mission',
    description: '미션 참여와 인증 방법 안내',
  },
  {
    label: '문의하기',
    value: 'question',
    description: '질문과 문의 방법 안내',
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
