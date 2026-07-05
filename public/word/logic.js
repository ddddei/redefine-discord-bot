(function (root) {
  'use strict';

  var EMPTY_JAMO = '_';
  var CHOSEONG = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
    'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
  ];
  var JUNGSEONG = [
    'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
    'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
  ];
  var JONGSEONG = [
    EMPTY_JAMO, 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
    'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ',
    'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
  ];
  var HANGUL_BASE = 0xac00;
  var HANGUL_END = 0xd7a3;
  var JUNGSEONG_COUNT = 21;
  var JONGSEONG_COUNT = 28;
  var SYLLABLE_SIZE = JUNGSEONG_COUNT * JONGSEONG_COUNT;
  var EMOJI_BY_STATE = {
    exact: '🟩',
    present: '🟨',
    absent: '⬜',
    empty: '⬛',
  };

  function isHangulSyllable(value) {
    var code = value.codePointAt(0);
    return code >= HANGUL_BASE && code <= HANGUL_END;
  }

  function normalizeGuess(input) {
    if (typeof input !== 'string') {
      return { valid: false, value: '', reason: 'not_string' };
    }

    var value = input.trim().normalize('NFC');
    var chars = Array.from(value);
    if (chars.length !== 2) {
      return { valid: false, value: value, reason: 'not_two_syllables' };
    }

    if (!chars.every(isHangulSyllable)) {
      return { valid: false, value: value, reason: 'not_hangul_syllables' };
    }

    return { valid: true, value: value, reason: null };
  }

  function validateGuess(input) {
    return normalizeGuess(input);
  }

  function decomposeSyllable(syllable) {
    var offset = syllable.codePointAt(0) - HANGUL_BASE;
    var choseongIndex = Math.floor(offset / SYLLABLE_SIZE);
    var jungseongIndex = Math.floor((offset % SYLLABLE_SIZE) / JONGSEONG_COUNT);
    var jongseongIndex = offset % JONGSEONG_COUNT;
    return [
      CHOSEONG[choseongIndex],
      JUNGSEONG[jungseongIndex],
      JONGSEONG[jongseongIndex],
    ];
  }

  function decomposeWord(word) {
    var normalized = normalizeGuess(word);
    if (!normalized.valid) {
      throw new Error('Invalid two-syllable Hangul word: ' + normalized.reason);
    }

    return Array.from(normalized.value).reduce(function (cells, syllable) {
      return cells.concat(decomposeSyllable(syllable));
    }, []);
  }

  function assertCells(cells, name) {
    if (!Array.isArray(cells) || cells.length !== 6) {
      throw new Error(name + ' must be an array of six jamo cells');
    }
  }

  function createCellLabels(cells) {
    assertCells(cells, 'cells');
    return cells.map(function (cell) {
      return cell === EMPTY_JAMO ? '' : cell;
    });
  }

  function calculateFeedback(answerCells, guessCells) {
    assertCells(answerCells, 'answerCells');
    assertCells(guessCells, 'guessCells');

    var states = new Array(guessCells.length).fill(null);
    var remaining = {};

    guessCells.forEach(function (guessCell, index) {
      var answerCell = answerCells[index];
      if (guessCell !== EMPTY_JAMO && guessCell === answerCell) {
        states[index] = 'exact';
        return;
      }

      if (guessCell === EMPTY_JAMO) {
        states[index] = 'empty';
      }

      if (answerCell !== EMPTY_JAMO) {
        remaining[answerCell] = (remaining[answerCell] || 0) + 1;
      }
    });

    guessCells.forEach(function (guessCell, index) {
      if (states[index] !== null) {
        return;
      }

      if (remaining[guessCell] > 0) {
        states[index] = 'present';
        remaining[guessCell] -= 1;
        return;
      }

      states[index] = 'absent';
    });

    return guessCells.map(function (cell, index) {
      return {
        cell: cell,
        label: cell === EMPTY_JAMO ? '' : cell,
        state: states[index],
      };
    });
  }

  function createEmojiGrid(rows) {
    return rows.map(function (row) {
      return row.map(function (cell) {
        return EMOJI_BY_STATE[cell.state] || EMOJI_BY_STATE.absent;
      }).join('');
    }).join('\n');
  }

  var WordLogic = {
    EMPTY_JAMO: EMPTY_JAMO,
    decomposeWord: decomposeWord,
    createCellLabels: createCellLabels,
    composeCellLabels: createCellLabels,
    calculateFeedback: calculateFeedback,
    normalizeGuess: normalizeGuess,
    validateGuess: validateGuess,
    createEmojiGrid: createEmojiGrid,
  };

  root.WordLogic = WordLogic;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WordLogic;
  }
})(typeof window !== 'undefined' ? window : this);
