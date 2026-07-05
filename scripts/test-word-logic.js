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
  'composeWord',
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
  assert.strictEqual(WordLogic.composeWord(cells), word);
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
    'exact',
    'absent',
    'exact',
    'exact',
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
    'absent',
    'present',
    'exact',
    'exact',
  ]);
}

function testCalculateFeedbackWhenEmptyJongseongNeverPresent() {
  // Given: 정답 '가방'의 첫 글자와 추측 '밥비'의 둘째 글자가 모두 종성 없음(_)이지만 자리가 다르다.
  const answer = WordLogic.decomposeWord('가방');
  const guess = WordLogic.decomposeWord('밥비');

  // When: feedback is calculated.
  const feedback = WordLogic.calculateFeedback(answer, guess);

  // Then: 종성 없음 칸은 자리 일치(exact)가 아니면 항상 absent다 — "빈 칸이 다른
  // 자리에 있다"는 present 표시는 참여자에게 의미가 없다.
  assert.strictEqual(feedback[5].cell, WordLogic.EMPTY_JAMO);
  assert.strictEqual(feedback[5].state, 'absent');
  // 자리까지 일치하는 종성 없음 칸은 여전히 exact다.
  const sameSpot = WordLogic.calculateFeedback(WordLogic.decomposeWord('나무'), WordLogic.decomposeWord('바다'));
  assert.strictEqual(sameSpot[2].state, 'exact');
  assert.strictEqual(sameSpot[5].state, 'exact');
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
  assert.strictEqual(grid, '🟫🟫🟫⬜⬜🟫\n🟫🟫🟫🟫🟫🟫');
  assert.strictEqual(grid.includes('사과'), false);
  assert.strictEqual(/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(grid), false);
}

testDecomposeWordWhenNoFinalConsonant();
testCreateCellLabelsWhenCellsContainEmptyMarker();
testCalculateFeedbackWhenGuessHasDuplicateJamo();
testCalculateFeedbackWhenOneDuplicateCanBePresent();
testCalculateFeedbackWhenEmptyJongseongNeverPresent();
testNormalizeAndValidateGuessWhenInputIsInvalid();
testCreateEmojiGridWhenRowsContainFeedback();

console.log('word logic tests passed');
