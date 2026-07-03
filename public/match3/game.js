(function () {
  'use strict';

  var Board = window.Match3Board;

  var TILE_EMOJI = {
    strawberry: '🍓',
    orange: '🍊',
    candy: '🍬',
    cookie: '🍪',
    cupcake: '🧁',
    jelly: '🍇',
  };

  var TILE_LABEL = {
    strawberry: '딸기',
    orange: '오렌지',
    candy: '사탕',
    cookie: '쿠키',
    cupcake: '컵케이크',
    jelly: '젤리',
  };

  var boardEl = document.getElementById('board');
  var movesValueEl = document.getElementById('moves-value');
  var scoreValueEl = document.getElementById('score-value');
  var comboValueEl = document.getElementById('combo-value');
  var statusMessageEl = document.getElementById('status-message');
  var restartButton = document.getElementById('restart-button');
  var resultModal = document.getElementById('result-modal');
  var resultTitleEl = document.getElementById('result-title');
  var resultCopyEl = document.getElementById('result-copy');
  var resultScoreEl = document.getElementById('result-score');
  var resultComboEl = document.getElementById('result-combo');
  var resultTopTileEl = document.getElementById('result-top-tile');
  var resultRetryButton = document.getElementById('result-retry-button');

  var state = null;
  var busy = false;

  function getSeedFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var seedParam = params.get('seed');
    if (seedParam === null || seedParam === '') {
      return undefined;
    }
    var parsed = Number(seedParam);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  function createGameState() {
    var seed = getSeedFromUrl();
    var rng = Board.createRng(seed);
    var grid = Board.generateBoard(seed).grid;

    return {
      grid: grid,
      rng: rng,
      movesLeft: Board.MAX_MOVES,
      score: 0,
      combo: 1,
      bestCombo: 1,
      clearedByType: {},
      selected: null,
      gameOver: false,
    };
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    for (var row = 0; row < Board.BOARD_SIZE; row += 1) {
      for (var col = 0; col < Board.BOARD_SIZE; col += 1) {
        var type = state.grid[row][col];
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'tile tile-' + type;
        button.dataset.row = String(row);
        button.dataset.col = String(col);
        button.setAttribute('aria-label', TILE_LABEL[type] + ' 타일, ' + (row + 1) + '행 ' + (col + 1) + '열');
        button.textContent = TILE_EMOJI[type];
        button.addEventListener('click', onTileClick);
        boardEl.appendChild(button);
      }
    }
    updateSelectionStyles();
  }

  function getTileButton(row, col) {
    return boardEl.querySelector('[data-row="' + row + '"][data-col="' + col + '"]');
  }

  function updateSelectionStyles() {
    var buttons = boardEl.querySelectorAll('.tile');
    buttons.forEach(function (button) {
      button.classList.remove('selected');
    });
    if (state.selected) {
      var el = getTileButton(state.selected.row, state.selected.col);
      if (el) {
        el.classList.add('selected');
      }
    }
  }

  function updateHud() {
    movesValueEl.textContent = String(state.movesLeft);
    scoreValueEl.textContent = String(state.score);
    comboValueEl.textContent = '×' + state.combo;
  }

  function setStatusMessage(message) {
    statusMessageEl.textContent = message;
  }

  function onTileClick(event) {
    if (busy || state.gameOver) {
      return;
    }

    var row = Number(event.currentTarget.dataset.row);
    var col = Number(event.currentTarget.dataset.col);

    if (!state.selected) {
      state.selected = { row: row, col: col };
      updateSelectionStyles();
      return;
    }

    if (state.selected.row === row && state.selected.col === col) {
      state.selected = null;
      updateSelectionStyles();
      return;
    }

    var first = state.selected;
    var second = { row: row, col: col };
    state.selected = null;
    updateSelectionStyles();
    attemptSwap(first, second);
  }

  function attemptSwap(first, second) {
    if (!Board.isAdjacent(first, second)) {
      state.selected = second;
      updateSelectionStyles();
      return;
    }

    var swapResult = Board.tryApplySwap(state.grid, first, second);

    if (!swapResult.valid) {
      flashInvalidSwap(first, second);
      return;
    }

    busy = true;
    state.grid = swapResult.grid;
    state.movesLeft -= 1;
    renderBoard();
    updateHud();
    setStatusMessage('매치를 확인하고 있어요…');

    window.setTimeout(function () {
      resolveBoard();
    }, 160);
  }

  function flashInvalidSwap(first, second) {
    var firstEl = getTileButton(first.row, first.col);
    var secondEl = getTileButton(second.row, second.col);
    [firstEl, secondEl].forEach(function (el) {
      if (!el) return;
      el.classList.add('invalid-swap');
      window.setTimeout(function () {
        el.classList.remove('invalid-swap');
      }, 280);
    });
    setStatusMessage('그 자리로는 매치를 만들 수 없어요. 다른 조합을 시도해 보세요.');
  }

  function resolveBoard() {
    var cascadeResult = Board.resolveCascades(state.grid, state.rng);

    state.grid = cascadeResult.grid;
    state.score += cascadeResult.score;
    state.combo = cascadeResult.maxMultiplier;
    state.bestCombo = Math.max(state.bestCombo, cascadeResult.maxMultiplier);

    if (cascadeResult.steps) {
      cascadeResult.steps.forEach(function (step) {
        step.groups.forEach(function (group) {
          state.clearedByType[group.type] = (state.clearedByType[group.type] || 0) + group.cells.length;
        });
      });
    }

    renderBoard();
    updateHud();

    if (cascadeResult.cascadeCount > 1) {
      setStatusMessage(cascadeResult.cascadeCount + '연쇄가 이어졌어요! 배수 ×' + cascadeResult.maxMultiplier + '.');
    } else if (cascadeResult.cascadeCount === 1) {
      setStatusMessage('매치 성공! ' + cascadeResult.score + '점을 얻었어요.');
    }

    checkForShuffleNeeded();
  }

  function checkForShuffleNeeded() {
    if (!Board.hasAvailableMove(state.grid)) {
      state.grid = Board.shuffleBoard(state.grid, state.rng);
      renderBoard();
      setStatusMessage('간식을 새로 섞었어요. 이동 횟수는 차감되지 않았어요.');
    }

    busy = false;

    if (state.movesLeft <= 0) {
      endGame();
    }
  }

  function getTopClearedTileLabel() {
    var topType = null;
    var topCount = 0;
    Object.keys(state.clearedByType).forEach(function (type) {
      if (state.clearedByType[type] > topCount) {
        topCount = state.clearedByType[type];
        topType = type;
      }
    });
    if (!topType) {
      return '-';
    }
    return TILE_LABEL[topType] + ' ' + topCount + '개';
  }

  function getScoreVerdict(score) {
    if (score >= 3000) {
      return '손이 빨라졌네요. 다음 판은 더 높은 점수에 도전해 보세요.';
    }
    if (score >= 1500) {
      return '안정적으로 매치를 잘 이어갔어요.';
    }
    if (score >= 600) {
      return '괜찮은 시작이에요. 연쇄를 노려 보면 점수가 더 오를 거예요.';
    }
    return '몸풀기로 나쁘지 않아요. 한 판 더 해보세요.';
  }

  function endGame() {
    state.gameOver = true;
    resultTitleEl.textContent = '이동을 모두 사용했어요';
    resultCopyEl.textContent = getScoreVerdict(state.score);
    resultScoreEl.textContent = String(state.score);
    resultComboEl.textContent = '×' + state.bestCombo;
    resultTopTileEl.textContent = getTopClearedTileLabel();
    resultModal.classList.remove('hidden');
  }

  function startNewGame() {
    resultModal.classList.add('hidden');
    busy = false;
    state = createGameState();
    renderBoard();
    updateHud();
    setStatusMessage('인접한 두 간식을 순서대로 클릭해 자리를 바꿔 보세요.');
  }

  restartButton.addEventListener('click', startNewGame);
  resultRetryButton.addEventListener('click', startNewGame);

  startNewGame();

  // Exposed for manual/local QA only; not used by automated tests.
  window.Match3Game = {
    getState: function () {
      return state;
    },
  };
})();
