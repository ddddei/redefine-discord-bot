const minigameData = require('./minigameData');
const {
  createCardResult,
  createDiceResult,
  createDoorResult,
  createExploreResult,
  createInitialDetail,
  createInitialResult,
  createMemoryDetail,
  createMemoryResult,
  createNumberResult,
  createRogueResult,
  createRpsResult,
  deterministicNumber,
} = require('./minigameResults');

const { MINIGAMES } = minigameData;

function createMinigameResult(input) {
  if (input.gameId === MINIGAMES.card.id) {
    return createCardResult(input);
  }

  if (input.gameId === MINIGAMES.rps.id) {
    return createRpsResult(input);
  }

  if (input.gameId === MINIGAMES.dice.id) {
    return createDiceResult(input);
  }

  if (input.gameId === MINIGAMES.number.id) {
    return createNumberResult(input);
  }

  if (input.gameId === MINIGAMES.door.id) {
    return createDoorResult(input);
  }

  if (input.gameId === MINIGAMES.memory.id) {
    return createMemoryResult(input);
  }

  if (input.gameId === MINIGAMES.initial.id) {
    return createInitialResult(input);
  }

  if (input.gameId === MINIGAMES.explore.id) {
    return createExploreResult(input);
  }

  if (input.gameId === MINIGAMES.rogue.id) {
    return createRogueResult(input);
  }

  return null;
}

module.exports = {
  ...minigameData,
  createInitialDetail,
  createMemoryDetail,
  createMinigameResult,
  deterministicNumber,
};
