(function () {
  'use strict';

  var Board = window.Match3Board;
  var Scoring = window.Match3Scoring;
  var MAX_REPLAY_ACTIONS = 30;

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
  var challengeChipEl = document.getElementById('challenge-chip');
  var restartButton = document.getElementById('restart-button');
  var todayChallengeButton = document.getElementById('today-challenge-button');
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

  function createGameState(options) {
    options = options || {};
    var seed = options.seed !== undefined ? Number(options.seed) : getSeedFromUrl();
    // 자유 플레이도 명시적 숫자 시드를 만들어 제출한다 — 시드 없는 판은 서버가
    // 재현할 수 없어 영원히 missing이 되고, 자동 지급의 verified 조건에서 매치3
    // 자유 플레이 전체가 빠지는 사각지대가 된다 (덱의 generateRandomSeed와 동일 접근).
    if (seed === undefined) {
      seed = Math.floor(Math.random() * 1000000000);
    }
    // generateBoard(seed)가 내부적으로 만든 rng를 그대로 이어써야 한다. 별도로
    // Board.createRng(seed)를 다시 만들면 보드 생성 중 소비된 난수만큼 어긋난
    // 스트림이 되어, generateBoard(seed).rng를 그대로 쓰는 서버 리플레이 검증기
    // (scoring.js replayMatch3)와 캐스케이드 결과가 달라진다 - 발견된 사전 버그를
    // 리플레이 검증 도입 시점에 함께 고친다.
    var initial = Board.generateBoard(seed);
    var grid = initial.grid;
    var rng = initial.rng;

    return {
      grid: grid,
      rng: rng,
      // 특수 타일 상태(docs/match3-improvement-plan.md 1절). generateBoard가
      // 만든 빈 specialGrid에서 시작해, 서버 검증기(webgameReplay.js)와 완전히
      // 같은 경로(scoring.js)로 갱신된다.
      specialGrid: initial.specialGrid,
      movesLeft: Board.MAX_MOVES,
      score: 0,
      combo: 1,
      bestCombo: 1,
      clearedByType: {},
      specialActivationCount: 0,
      selected: null,
      gameOver: false,
      seed: seed,
      mode: options.mode === 'daily' ? 'daily' : 'free',
      dayKey: options.dayKey || null,
      variant: options.variant || null,
      // 서버 리플레이 검증용 성공 스왑 기록. 되돌려진 무효 스왑은 RNG를 소비하지
      // 않으므로 포함하지 않는다(docs/replay-verification-plan.md 1절).
      replayActions: [],
    };
  }

  // 특수 타일 종류별 잉크 마크 오버레이(SVG). webgame-design-guide.md의 잉크 톤
  // (#4a3524, round join/cap)을 따른다. 원화 위에 얹는 장식이라 alt는 비운다
  // (계획서 1.4 - 표시 전용, board.js 로직과 무관).
  var SPECIAL_OVERLAY_SVG = {
    'line-h': '<svg class="tile-special-mark" viewBox="0 0 64 64" aria-hidden="true">'
      + '<path d="M12 32 L24 24 M12 32 L24 40 M52 32 L40 24 M52 32 L40 40" stroke="#4a3524" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
      + '</svg>',
    'line-v': '<svg class="tile-special-mark" viewBox="0 0 64 64" aria-hidden="true">'
      + '<path d="M32 12 L24 24 M32 12 L40 24 M32 52 L24 40 M32 52 L40 40" stroke="#4a3524" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
      + '</svg>',
    wrap: '<svg class="tile-special-mark" viewBox="0 0 64 64" aria-hidden="true">'
      + '<circle cx="32" cy="32" r="3" fill="#4a3524"/>'
      + '<path d="M32 14 L32 20 M32 44 L32 50 M14 32 L20 32 M44 32 L50 32 M20 20 L24 24 M44 20 L40 24 M20 44 L24 40 M44 44 L40 40" stroke="#4a3524" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</svg>',
    color: '<svg class="tile-special-mark" viewBox="0 0 64 64" aria-hidden="true">'
      + '<path d="M32 14 L36 27 L50 27 L38 35 L42 49 L32 40 L22 49 L26 35 L14 27 L28 27 Z" fill="none" stroke="#4a3524" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>'
      + '</svg>',
  };

  function renderBoard() {
    boardEl.innerHTML = '';
    for (var row = 0; row < Board.BOARD_SIZE; row += 1) {
      for (var col = 0; col < Board.BOARD_SIZE; col += 1) {
        var type = state.grid[row][col];
        var special = state.specialGrid ? state.specialGrid[row][col] : null;
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'tile tile-' + type + (special ? ' tile-special tile-special-' + special : '');
        button.dataset.row = String(row);
        button.dataset.col = String(col);
        var label = TILE_LABEL[type] + ' 타일, ' + (row + 1) + '행 ' + (col + 1) + '열';
        if (special) {
          label += ', 특수 타일';
        }
        button.setAttribute('aria-label', label);
        var tileImg = document.createElement('img');
        tileImg.className = 'tile-asset';
        tileImg.src = TILE_ASSET[type];
        tileImg.alt = '';
        tileImg.decoding = 'async';
        button.appendChild(tileImg);
        if (special && SPECIAL_OVERLAY_SVG[special]) {
          var overlayWrapper = document.createElement('span');
          overlayWrapper.className = 'tile-special-overlay';
          overlayWrapper.innerHTML = SPECIAL_OVERLAY_SVG[special];
          button.appendChild(overlayWrapper);
        }
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

  function updateChallengeChip() {
    if (!challengeChipEl) {
      return;
    }
    challengeChipEl.classList.toggle('hidden', !state || state.mode !== 'daily');
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

    // 클릭 경로와 동일한 가드: 연쇄 처리 중(busy)이거나 종료 후에는 스와이프도 무시한다
    // (멀티터치로 pointerdown 이후 busy가 된 경우 대비).
    if (busy || state.gameOver) {
      swipeStart = null;
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

    var swapResult = Board.tryApplySwap(state.grid, first, second, state.specialGrid);

    if (!swapResult.valid) {
      flashInvalidSwap(first, second);
      return;
    }

    busy = true;
    state.grid = swapResult.grid;
    state.pendingSwapContext = {
      specialGrid: swapResult.specialGrid,
      swapCells: swapResult.swapCells,
      triggeredSwapSpecials: swapResult.triggeredSwapSpecials,
    };
    state.movesLeft -= 1;
    // 되돌려진 무효 스왑은 RNG를 소비하지 않으므로 로그에 넣지 않는다. 여기 도달했다는
    // 것은 스왑이 유효하다는 뜻이므로 바로 기록한다(서버 리플레이 검증용, 계획서 1절).
    if (state.replayActions.length < MAX_REPLAY_ACTIONS) {
      state.replayActions.push([first.row, first.col, second.row, second.col]);
    }
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
    // 캐스케이드 점수 계산·최대 배수 판정은 Scoring.resolveCascadeStep으로 추출해
    // 서버 검증기(src/webgameReplay.js)와 공용으로 쓴다(콤보 점수 계산 이중 구현 제거).
    // pendingSwapContext: 이번 스왑이 특수 타일을 만들거나 발동시켰는지(attemptSwap이
    // 세팅) - 서버 검증기가 재생하는 순서와 정확히 같은 컨텍스트를 넘겨야 한다.
    var swapContext = state.pendingSwapContext;
    state.pendingSwapContext = null;
    var cascadeResult = Scoring.resolveCascadeStep(state.grid, state.rng, swapContext);

    state.grid = cascadeResult.grid;
    state.specialGrid = cascadeResult.specialGrid;
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

    if (cascadeResult.activations && cascadeResult.activations.length > 0) {
      state.specialActivationCount += cascadeResult.activations.length;
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
      // 셔플은 특수 타일 배치도 함께 무효화한다 - Scoring.applySwapMove(서버 검증기가
      // 쓰는 것과 같은 경로)가 셔플 시 specialGrid를 비우는 것과 동일하게 맞춘다.
      if (state.specialGrid) {
        state.specialGrid = Board.createEmptySpecialGrid();
      }
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
    var dailySectionEl = document.getElementById('result-daily-section');
    var rankingSectionEl = document.getElementById('result-ranking-section');

    if (window.GameLink && linkSectionEl) {
      window.GameLink.renderLinkSection(linkSectionEl, {
        onChange: function () {
          if (dailySectionEl) {
            window.GameLink.renderDailySection(dailySectionEl, 'match3', {
              onStart: startDailyGameFromSeed,
            });
          }
          if (rankingSectionEl) {
            window.GameLink.renderRankingSection(rankingSectionEl, 'match3');
          }
        },
      });
    }

    if (window.GameLink && dailySectionEl) {
      window.GameLink.renderDailySection(dailySectionEl, 'match3', {
        onStart: startDailyGameFromSeed,
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
      var submitOptions = {
        replayActions: state.replayActions,
      };
      if (state.mode === 'daily') {
        submitOptions.challenge = 'daily';
      }
      window.GameLink.submitScore('match3', state.score, state.seed, submitOptions);
    }
    renderLinkAndRanking();
  }

  function startNewGame(options) {
    closeModal(resultModal);
    busy = false;
    state = createGameState(options);
    renderBoard();
    updateHud();
    updateChallengeChip();
    setStatusMessage(state.mode === 'daily'
      ? '오늘의 간식판이에요. 같은 판에서 편하게 다시 도전할 수 있어요.'
      : '인접한 두 간식을 순서대로 클릭해 자리를 바꿔 보세요.');
  }

  function startDailyGameFromSeed(seed, daily) {
    startNewGame({
      seed: seed,
      mode: 'daily',
      dayKey: daily && daily.dayKey,
    });
  }

  function startDailyChallenge() {
    if (!window.GameLink || !window.GameLink.fetchDaily) {
      setStatusMessage('오늘의 도전을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }

    todayChallengeButton.disabled = true;
    setStatusMessage('오늘의 도전을 불러오는 중이에요.');
    window.GameLink.fetchDaily('match3').then(function (result) {
      todayChallengeButton.disabled = false;
      if (!result.ok) {
        setStatusMessage('오늘의 도전을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      startDailyGameFromSeed(result.seed, result);
    });
  }

  function restartCurrentMode() {
    if (state && state.mode === 'daily') {
      startNewGame({
        seed: state.seed,
        mode: 'daily',
        dayKey: state.dayKey,
      });
      return;
    }
    startNewGame();
  }

  restartButton.addEventListener('click', startNewGame);
  todayChallengeButton.addEventListener('click', startDailyChallenge);
  resultRetryButton.addEventListener('click', restartCurrentMode);

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
