const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { RPS_CHOICES } = require('./minigameData');

function createMinigameHubRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_select:card').setLabel('🎴 행운 카드 뒤집기').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_select:rps').setLabel('✊ 가위바위보').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_select:dice').setLabel('🎲 주사위 대결').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_select:number').setLabel('🔢 숫자 맞히기').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_select:door').setLabel('🚪 문 하나 고르기').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_select:memory').setLabel('🧠 이모지 기억력').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_select:initial').setLabel('🧩 초성 퀴즈').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('participant_minigame_select:explore').setLabel('🧭 리디파인 탐험').setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function createCardChoiceRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('participant_minigame_card:1').setLabel('1번 카드').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_card:2').setLabel('2번 카드').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('participant_minigame_card:3').setLabel('3번 카드').setStyle(ButtonStyle.Primary)
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
      new ButtonBuilder().setCustomId('participant_minigame_dice').setLabel('🎲 주사위 굴리기').setStyle(ButtonStyle.Primary)
    ),
  ];
}

function createNumberChoiceRows() {
  return [
    new ActionRowBuilder().addComponents(
      ...[1, 2, 3, 4, 5].map((number) => {
        return new ButtonBuilder()
          .setCustomId(`participant_minigame_number:${number}`)
          .setLabel(String(number))
          .setStyle(ButtonStyle.Secondary);
      })
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

module.exports = {
  createCardChoiceRows,
  createDiceChoiceRows,
  createDoorChoiceRows,
  createExploreChoiceRows,
  createInitialChoiceRows,
  createMemoryChoiceRows,
  createMinigameHubRows,
  createNumberChoiceRows,
  createRpsChoiceRows,
};
