const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const GUIDE_HUB_SELECT_ID = 'guide_hub_select';
const OPERATOR_HUB_SELECT_ID = 'operator_hub_select';

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

const OPERATOR_HUB_OPTIONS = [
  {
    label: '전체 요약',
    value: 'overview',
    description: '핵심 운영 숫자와 확인 필요 항목',
  },
  {
    label: '교환 대기',
    value: 'redemptions',
    description: 'pending 교환 신청 목록',
  },
  {
    label: '인증 대기',
    value: 'submissions',
    description: 'pending 미션 인증 제출 목록',
  },
  {
    label: '최근 포인트 로그',
    value: 'points',
    description: '최근 포인트 거래 기록',
  },
  {
    label: '미션/상점 상태',
    value: 'missions_shop',
    description: '미션과 상점 항목 운영 상태',
  },
  {
    label: '반응 승인 기록',
    value: 'reaction_approvals',
    description: '미션 인증 채널 이모지 처리 기록',
  },
  {
    label: '내보내기 안내',
    value: 'exports',
    description: '운영 데이터 백업 명령어 안내',
  },
  {
    label: '운영 체크리스트',
    value: 'checklist',
    description: '운영 전후 점검 항목',
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

function createOperatorHubSelectRow(selectedValue = null) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(OPERATOR_HUB_SELECT_ID)
      .setPlaceholder('확인할 운영 메뉴를 선택해 주세요')
      .addOptions(OPERATOR_HUB_OPTIONS.map((option) => ({
        ...option,
        default: option.value === selectedValue,
      })))
  );
}

module.exports = {
  GUIDE_HUB_OPTIONS,
  GUIDE_HUB_SELECT_ID,
  OPERATOR_HUB_OPTIONS,
  OPERATOR_HUB_SELECT_ID,
  createGuideHubSelectRow,
  createOperatorHubSelectRow,
};
