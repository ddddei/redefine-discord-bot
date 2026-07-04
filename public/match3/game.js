(function () {
  'use strict';

  var Board = window.Match3Board;

  // v3 원화(webp 정물화). 로직(board.js)과 무관한 표시 전용 매핑이다.
  var TILE_ASSET = {
    strawberry: '../shared/art/match3-tile-strawberry.webp',
    orange: '../shared/art/match3-tile-orange.webp',
    candy: '../shared/art/match3-tile-candy.webp',
    cookie: '../shared/art/match3-tile-cookie.webp',
    cupcake: '../shared/art/match3-tile-cupcake.webp',
    jelly: '../shared/art/match3-tile-jelly.webp',
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
  var comboChipEl = document.getElementById('combo-chip');
  var statusMessageEl = document.getElementById('status-message');
  var restartButton = document.getElementById('restart-button');
  var helpButton = document.getElementById('help-button');
  var helpModal = document.getElementById('help-modal');
  var helpModalCloseButton = document.getElementById('help-modal-close');
  var resultModal = document.getElementById('result-modal');
  var resultTitleEl = document.getElementById('result-title');
  var resultCopyEl = document.getElementById('result-copy');
  var resultScoreEl = document.getElementById('result-score');
  var resultComboEl = document.getElementById('result-combo');
  var resultTopTileEl = document.getElementById('result-top-tile');
  var resultRetryButton = document.getElementById('result-retry-button');

  var state = null;
  var busy = false;
  var swipeStart = null;
  var suppressNextClick = false;
  var SWIPE_THRESHOLD_PX = 24;

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
        var tileImg = document.createElement('img');
        tileImg.className = 'tile-asset';
        tileImg.src = TILE_ASSET[type];
        tileImg.alt = '';
        tileImg.decoding = 'async';
        button.appendChild(tileImg);
        button.addEventListener('click', onTileClick);
        button.addEventListener('pointerdown', onTilePointerDown);
        button.addEventListener('pointermove', onTilePointerMove);
        button.addEventListener('pointerup', onTilePointerUp);
        button.addEventListener('pointercancel', onTilePointerCancel);
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

  function openModal(modalEl) {
    modalEl.classList.remove('hidden');
    modalEl.classList.remove('gk-modal-opening');
    // 강제 리플로우로 재시작 가능한 애니메이션 트리거.
    void modalEl.offsetWidth;
    modalEl.classList.add('gk-modal-opening');
  }

  function closeModal(modalEl) {
    modalEl.classList.add('hidden');
  }

  function pulseComboChip() {
    comboChipEl.classList.remove('pulse');
    void comboChipEl.offsetWidth;
    comboChipEl.classList.add('pulse');
  }

  function showScorePopup(amount, row, col) {
    var cellSize = boardEl.clientWidth / Board.BOARD_SIZE;
    var popup = document.createElement('span');
    popup.className = 'gk-float-num';
    popup.textContent = '+' + amount;
    popup.style.left = (col * cellSize + cellSize / 2) + 'px';
    popup.style.top = (row * cellSize) + 'px';
    boardEl.appendChild(popup);
    window.setTimeout(function () {
      popup.remove();
    }, 700);
  }

  function setStatusMessage(message) {
    statusMessageEl.textContent = message;
  }

  function getTileFromButton(button) {
    return {
      row: Number(button.dataset.row),
      col: Number(button.dataset.col),
    };
  }

  function onTileClick(event) {
    if (suppressNextClick) {
      suppressNextClick = false;
      event.preventDefault();
      return;
    }

    if (busy || state.gameOver) {
      return;
    }

    var tile = getTileFromButton(event.currentTarget);
    var row = tile.row;
    var col = tile.col;

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

  function getSwipeDirection(deltaX, deltaY) {
    var absX = Math.abs(deltaX);
    var absY = Math.abs(deltaY);
    if (Math.max(absX, absY) < SWIPE_THRESHOLD_PX) {
      return null;
    }
    if (absX >= absY) {
      return deltaX > 0 ? 'right' : 'left';
    }
    return deltaY > 0 ? 'down' : 'up';
  }

  function getAdjacentTile(tile, direction) {
    var target = { row: tile.row, col: tile.col };
    if (direction === 'left') {
      target.col -= 1;
    } else if (direction === 'right') {
      target.col += 1;
    } else if (direction === 'up') {
      target.row -= 1;
    } else if (direction === 'down') {
      target.row += 1;
    }

    if (target.row < 0 || target.row >= Board.BOARD_SIZE || target.col < 0 || target.col >= Board.BOARD_SIZE) {
      return null;
    }
    return target;
  }

  function onTilePointerDown(event) {
    if (busy || state.gameOver || (event.button !== undefined && event.button !== 0)) {
      return;
    }

    swipeStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      tile: getTileFromButton(event.currentTarget),
      direction: null,
    };

    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function onTilePointerMove(event) {
    if (!swipeStart || swipeStart.pointerId !== event.pointerId) {
      return;
    }
    swipeStart.direction = getSwipeDirection(event.clientX - swipeStart.x, event.clientY - swipeStart.y);
  }

  function onTilePointerUp(event) {
    if (!swipeStart || swipeStart.pointerId !== event.pointerId) {
      return;
    }

    var direction = swipeStart.direction || getSwipeDirection(event.clientX - swipeStart.x, event.clientY - swipeStart.y);
    if (!direction) {
      swipeStart = null;
      return;
    }

    var target = getAdjacentTile(swipeStart.tile, direction);
    suppressNextClick = true;
    event.preventDefault();

    if (target) {
      state.selected = null;
      updateSelectionStyles();
      attemptSwap(swipeStart.tile, target);
    }
    swipeStart = null;
  }

  function onTilePointerCancel(event) {
    if (swipeStart && swipeStart.pointerId === event.pointerId) {
      swipeStart = null;
    }
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

    showScorePopupsForSteps(cascadeResult.steps);

    if (cascadeResult.maxMultiplier >= 2) {
      pulseComboChip();
    }

    checkForShuffleNeeded();
  }

  function showScorePopupsForSteps(steps) {
    if (!steps) {
      return;
    }
    steps.forEach(function (step) {
      step.groups.forEach(function (group) {
        var groupScore = Board.scoreForGroup(group) * step.multiplier;
        var anchorCell = group.cells[0];
        showScorePopup(groupScore, anchorCell[0], anchorCell[1]);
      });
    });
  }

  function checkForShuffleNeeded() {
    if (!Board.hasAvailableMove(state.grid)) {
      state.grid = Board.shuffleBoard(state.grid, state.rng);
      renderBoard();
      setStatusMessage('간식을 새로 섞었어요. 이동 횟수는 차감되지 않았어요.');
      boardEl.classList.remove('shuffling');
      void boardEl.offsetWidth;
      boardEl.classList.add('shuffling');
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

  function renderLinkAndRanking() {
    var linkSectionEl = document.getElementById('result-link-section');
    var rankingSectionEl = document.getElementById('result-ranking-section');

    if (window.GameLink && linkSectionEl) {
      window.GameLink.renderLinkSection(linkSectionEl, {
        onChange: function () {
          if (rankingSectionEl) {
            window.GameLink.renderRankingSection(rankingSectionEl, 'match3');
          }
        },
      });
    }

    if (window.GameLink && rankingSectionEl) {
      window.GameLink.renderRankingSection(rankingSectionEl, 'match3');
    }
  }

  function endGame() {
    state.gameOver = true;
    resultTitleEl.textContent = '이동을 모두 사용했어요';
    resultCopyEl.textContent = getScoreVerdict(state.score);
    resultScoreEl.textContent = String(state.score);
    resultComboEl.textContent = '×' + state.bestCombo;
    resultTopTileEl.textContent = getTopClearedTileLabel();
    openModal(resultModal);

    // 연동은 부가 기능: 미연결이거나 네트워크 오류여도 게임 진행에는 영향이 없다(fire-and-forget).
    if (window.GameLink) {
      window.GameLink.submitScore('match3', state.score, getSeedFromUrl());
    }
    renderLinkAndRanking();
  }

  function startNewGame() {
    closeModal(resultModal);
    busy = false;
    state = createGameState();
    renderBoard();
    updateHud();
    setStatusMessage('인접한 두 간식을 순서대로 클릭해 자리를 바꿔 보세요.');
  }

  restartButton.addEventListener('click', startNewGame);
  resultRetryButton.addEventListener('click', startNewGame);

  helpButton.addEventListener('click', function () {
    openModal(helpModal);
  });

  helpModalCloseButton.addEventListener('click', function () {
    closeModal(helpModal);
  });

  startNewGame();

  // Exposed for manual/local QA only; not used by automated tests.
  window.Match3Game = {
    getState: function () {
      return state;
    },
  };
})();
