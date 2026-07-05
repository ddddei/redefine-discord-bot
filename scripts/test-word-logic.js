'use strict';

const assert = require('assert');
const path = require('path');

const logicPath = path.join(__dirname, '..', 'public', 'word', 'logic.js');
let WordLogic;

try {
  WordLogic = require(logicPath);
} catch (error) {
  throw new assert.AssertionError({
    message: 'word logic module must be loadable and export the required pure functions',
    actual: error.code || error.message,
    expected: 'CommonJS exports',
  });
}

[
  'EMPTY_JAMO',
  'decomposeWord',
  'createCellLabels',
  'calculateFeedback',
  'normalizeGuess',
  'validateGuess',
  'createEmojiGrid',
].forEach((name) => {
  assert.strictEqual(typeof WordLogic[name], name === 'EMPTY_JAMO' ? 'string' : 'function', `${name} export`);
});

function testDecomposeWordWhenNoFinalConsonant() {
  // Given: a two-syllable Hangul word whose syllables have no jongseong.
  const word = '사과';

  // When: the word is decomposed into game cells.
  const cells = WordLogic.decomposeWord(word);

  // Then: each syllable contributes choseong, jungseong, and the stable empty marker.
  assert.deepStrictEqual(cells, ['ㅅ', 'ㅏ', WordLogic.EMPTY_JAMO, 'ㄱ', 'ㅘ', WordLogic.EMPTY_JAMO]);
}

function testCreateCellLabelsWhenCellsContainEmptyMarker() {
  // Given: decomposed cells that include the no-jongseong marker.
  const cells = ['ㅅ', 'ㅏ', WordLogic.EMPTY_JAMO, 'ㄱ', 'ㅘ', WordLogic.EMPTY_JAMO];

  // When: labels are prepared for display.
  const labels = WordLogic.createCellLabels(cells);

  // Then: real jamo are preserved and empty markers display as a stable blank label.
  assert.deepStrictEqual(labels, ['ㅅ', 'ㅏ', '', 'ㄱ', 'ㅘ', '']);
}

function testCalculateFeedbackWhenGuessHasDuplicateJamo() {
  // Given: the answer contains one ㄱ and the guess contains ㄱ twice.
  const answer = WordLogic.decomposeWord('가나');
  const guess = WordLogic.decomposeWord('가가');

  // When: feedback is calculated using Wordle duplicate rules.
  const feedback = WordLogic.calculateFeedback(answer, guess);

  // Then: exact matches are consumed first and the second ㄱ is absent.
  assert.deepStrictEqual(feedback.map((cell) => cell.state), [
    'exact',
    'exact',
    'empty',
    'absent',
    'exact',
    'empty',
  ]);
}

function testCalculateFeedbackWhenOneDuplicateCanBePresent() {
  // Given: one non-exact ㄱ remains available after exact matches are consumed.
  const answer = WordLogic.decomposeWord('각나');
  const guess = WordLogic.decomposeWord('가가');

  // When: feedback is calculated.
  const feedback = WordLogic.calculateFeedback(answer, guess);

  // Then: only one duplicate guess jamo receives a non-absent mark.
  assert.deepStrictEqual(feedback.map((cell) => cell.state), [
    'exact',
    'exact',
    'empty',
    'present',
    'exact',
    'empty',
  ]);
}

function testNormalizeAndValidateGuessWhenInputIsInvalid() {
  // Given: mixed invalid inputs around the two-syllable Hangul boundary.
  const inputs = [' 사과 ', '사', '사과!', 'abc', '닭고기', 'ㄱㅏ'];

  // When: each input is normalized or validated.
  const normalized = WordLogic.normalizeGuess(inputs[0]);
  const invalidResults = inputs.slice(1).map((input) => WordLogic.validateGuess(input));

  // Then: whitespace is trimmed and only exactly two precomposed Hangul syllables are accepted.
  assert.deepStrictEqual(normalized, { valid: true, value: '사과', reason: null });
  assert.deepStrictEqual(invalidResults.map((result) => result.valid), [false, false, false, false, false]);
}

function testCreateEmojiGridWhenRowsContainFeedback() {
  // Given: feedback rows for two guesses.
  const rows = [
    WordLogic.calculateFeedback(WordLogic.decomposeWord('사과'), WordLogic.decomposeWord('사자')),
    WordLogic.calculateFeedback(WordLogic.decomposeWord('사과'), WordLogic.decomposeWord('사과')),
  ];

  // When: an answer-free emoji grid is created.
  const grid = WordLogic.createEmojiGrid(rows);

  // Then: the grid contains only feedback emoji and no answer text or jamo labels.
  assert.strictEqual(grid, '🟩🟩⬛⬜⬜⬛\n🟩🟩⬛🟩🟩⬛');
  assert.strictEqual(grid.includes('사과'), false);
  assert.strictEqual(/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(grid), false);
}

testDecomposeWordWhenNoFinalConsonant();
testCreateCellLabelsWhenCellsContainEmptyMarker();
testCalculateFeedbackWhenGuessHasDuplicateJamo();
testCalculateFeedbackWhenOneDuplicateCanBePresent();
testNormalizeAndValidateGuessWhenInputIsInvalid();
testCreateEmojiGridWhenRowsContainFeedback();

console.log('word logic tests passed');
