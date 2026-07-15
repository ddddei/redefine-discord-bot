const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  ROGUE_EXITS,
  ROGUE_ITEMS,
  ROGUE_PATHS,
  RPS_CHOICES,
} = require('./minigameData');

// 웹게임 바로가기 링크의 기준 URL. https 주소가 아니면 버튼을 생략해
// 잘못된 링크가 참여자에게 노출되지 않게 한다.
function resolveWebgamePublicBaseUrl() {
  const raw = typeof process.env.WEBGAME_PUBLIC_BASE_URL === 'string'
    ? process.env.WEBGAME_PUBLIC_BASE_URL.trim()
    : '';
  if (!raw || !/^https:\/\//i.test(raw)) return null;
  return raw.replace(/\/+$/, '');
}

function createWebgameLinkRow() {
  const baseUrl = resolveWebgamePublicBaseUrl();
  if (!baseUrl) return null;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('🧩 매치3 퍼즐').setStyle(ButtonStyle.Link).setURL(`${baseUrl}/game/match3/`),
    new ButtonBuilder().setLabel('🃏 덱 빌딩').setStyle(ButtonStyle.Link).setURL(`${baseUrl}/game/deck/`),
    new ButtonBuilder().setLabel('🏭 간식 공방').setStyle(ButtonStyle.Link).setURL(`${baseUrl}/game/idle/`),
    new ButtonBuilder().setLabel('🔔 검은 종 생존전').setStyle(ButtonStyle.Link).setURL(`${baseUrl}/game/dungeonworld-survivors/`)
  );
}

function createMinigameHubRows() {
  const webgameLinkRow = createWebgameLinkRow();
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_select:card').setLabel('🎴 행운 카드 뒤집기').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_select:rps').setLabel('✊ 가위바위보').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_select:dice').setLabel('🎲 주사위 대결').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_select:number').setLabel('🔢 숫자 맞히기').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_select:door').setLabel('🚪 문 하나 고르기').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_select:memory').setLabel('🧠 이모지 기억력').setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_select:initial').setLabel('🧩 초성 퀴즈').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_select:explore').setLabel('🧭 리디파인 탐험').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_select:rogue').setLabel('🗺️ 세 칸 탐험').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_today_record').setLabel('📊 오늘의 기록').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_today_ranking').setLabel('🏆 랭킹').setStyle(ButtonStyle.Secondary)
    ),
    ...(webgameLinkRow ? [webgameLinkRow] : []),
  ];
}

function createCardChoiceRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_card:1').setLabel('1번 카드').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_card:2').setLabel('2번 카드').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_card:3').setLabel('3번 카드').setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createRpsChoiceRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_rps:scissors').setLabel(RPS_CHOICES.scissors.label).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_rps:rock').setLabel(RPS_CHOICES.rock.label).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_rps:paper').setLabel(RPS_CHOICES.paper.label).setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createDiceChoiceRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_dice').setLabel('🎲 주사위 굴리기').setStyle(ButtonStyle.Success)
    ),
  ];
}

function createNumberChoiceRows() {
  const buttons = [1, 2, 3, 4, 5].map((number) => {
    return new ButtonBuilder()
      .setCustomId(`participant_minigame_number:${number}`)
      .setLabel(String(number))
      .setStyle(ButtonStyle.Secondary);
  });

  return [
    new ActionRowBuilder().addComponents(
      ...buttons.slice(0, 3)
    ),
    new ActionRowBuilder().addComponents(
      ...buttons.slice(3)
    ),
  ];
}

function createDoorChoiceRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_door:1').setLabel('1번 문').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_door:2').setLabel('2번 문').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_door:3').setLabel('3번 문').setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createMemoryChoiceRows(detail) {
  return [
    new ActionRowBuilder().addComponents(
      ...detail.choices.map((choice, index) => {
        return new ButtonBuilder()
          .setCustomId(`participant_minigame_memory:${index + 1}`)
          .setLabel(`${index + 1}. ${choice.join(' ')}`)
          .setStyle(ButtonStyle.Secondary);
      })
    ),
  ];
}

function createInitialChoiceRows(quiz) {
  return [
    new ActionRowBuilder().addComponents(
      ...quiz.choices.map((choice, index) => {
        return new ButtonBuilder()
          .setCustomId(`participant_minigame_initial:${index + 1}`)
          .setLabel(choice)
          .setStyle(ButtonStyle.Secondary);
      })
    ),
  ];
}

function createExploreChoiceRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_explore:forest').setLabel('숲길').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_explore:library').setLabel('도서관').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_explore:plaza').setLabel('광장').setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createRoguePathRows() {
  return [
    new ActionRowBuilder().addComponents(
      ...Object.entries(ROGUE_PATHS).map(([pathKey, path]) => {
        return new ButtonBuilder()
          .setCustomId(`participant_minigame_rogue_path:${pathKey}`)
          .setLabel(path.label)
          .setStyle(ButtonStyle.Secondary);
      })
    ),
  ];
}

function createRogueItemRows(pathKey) {
  return [
    new ActionRowBuilder().addComponents(
      ...Object.entries(ROGUE_ITEMS).map(([itemKey, item]) => {
        return new ButtonBuilder()
          .setCustomId(`participant_minigame_rogue_item:${pathKey}:${itemKey}`)
          .setLabel(item.label)
          .setStyle(ButtonStyle.Secondary);
      })
    ),
  ];
}

function createRogueExitRows(pathKey, itemKey) {
  return [
    new ActionRowBuilder().addComponents(
      ...Object.entries(ROGUE_EXITS).map(([exitKey, exit]) => {
        return new ButtonBuilder()
          .setCustomId(`participant_minigame_rogue_exit:${pathKey}:${itemKey}:${exitKey}`)
          .setLabel(exit.label)
          .setStyle(ButtonStyle.Secondary);
      })
    ),
  ];
}

module.exports = {
  createCardChoiceRows,
  createWebgameLinkRow,
  createDiceChoiceRows,
  createDoorChoiceRows,
  createExploreChoiceRows,
  createInitialChoiceRows,
  createMemoryChoiceRows,
  createMinigameHubRows,
  createNumberChoiceRows,
  createRogueExitRows,
  createRogueItemRows,
  createRoguePathRows,
  createRpsChoiceRows,
};
