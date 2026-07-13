(function () {
  'use strict';

  var Board = window.Match3Board;
  var Scoring = window.Match3Scoring;
  var MAX_REPLAY_ACTIONS = 30;

  // 타일 아트(표시 전용 매핑, 로직 board.js와 무관).
  // visual-polish v1: v3 원화(webp 정물화)가 전부 어두운 세피아 톤이라 종류 판별을
  // 해쳐, v2 라인 캐릭터 SVG로 회귀했다(2026-07-13 사용자 결정). 원화 webp는
  // shared/art/에 보존 — 다른 용도(연출·도감류) 재사용 후보.
  var TILE_ASSET = {
    strawberry: '../shared/assets/match3-tile-strawberry.svg',
    orange: '../shared/assets/match3-tile-orange.svg',
    candy: '../shared/assets/match3-tile-candy.svg',
    cookie: '../shared/assets/match3-tile-cookie.svg',
    cupcake: '../shared/assets/match3-tile-cupcake.svg',
    jelly: '../shared/assets/match3-tile-jelly.svg',
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
  var variantChipEl = document.getElementById('variant-chip');
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
  var goalsButton = document.getElementById('goals-button');
  var goalsModal = document.getElementById('goals-modal');
  var goalsModalCloseButton = document.getElementById('goals-modal-close');
  var goalsListEl = document.getElementById('goals-list');
  var goalResultModal = document.getElementById('goal-result-modal');
  var goalResultTitleEl = document.getElementById('goal-result-title');
  var goalResultCopyEl = document.getElementById('goal-result-copy');
  var goalResultRetryButton = document.getElementById('goal-result-retry-button');
  var goalResultNextButton = document.getElementById('goal-result-next-button');
  var goalResultListButton = document.getElementById('goal-result-list-button');

  // 목표 판 완료 기록(계획서 3절) - 랭킹과 무관한 로컬 저장. 실패 기록은 남기지 않는다.
  var GOALS_STORAGE_KEY = 'redefine-match3-goals-v1';

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

    // 오늘의 도전 요일 변형(docs/match3-improvement-plan.md 2절). 서버가 유일
    // 소스 - variant를 받지 못하면(구버전 서버·자유 플레이) standard로 폴백한다.
    var variant = normalizeVariant(options.variant);

    // 목표 판 모드(계획서 3절): 서버 제출 없는 랭킹 무관 완료형. options.goal이
    // 있으면 그 판의 수 제한을 쓰고, variant/오늘의 도전 개념은 적용하지 않는다.
    var goal = options.goal || null;
    var movesLeft = goal ? goal.moves : variant.movesLimit;
    var mode = goal ? 'goal' : (options.mode === 'daily' ? 'daily' : 'free');

    return {
      grid: grid,
      rng: rng,
      // 특수 타일 상태(docs/match3-improvement-plan.md 1절). generateBoard가
      // 만든 빈 specialGrid에서 시작해, 서버 검증기(webgameReplay.js)와 완전히
      // 같은 경로(scoring.js)로 갱신된다.
      specialGrid: initial.specialGrid,
      movesLeft: movesLeft,
      score: 0,
      combo: 1,
      bestCombo: 1,
      clearedByType: {},
      specialActivationCount: 0,
      selected: null,
      gameOver: false,
      seed: seed,
      mode: mode,
      dayKey: options.dayKey || null,
      variant: variant,
      goal: goal,
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

  // 서버 응답의 variant를 정규화한다. 구버전 서버(variant 없음)나 자유 플레이는
  // standard로 폴백한다(계획서 2.3 - 클라이언트는 요일을 스스로 계산하지 않는다).
  function normalizeVariant(rawVariant) {
    if (!rawVariant || typeof rawVariant !== 'object' || typeof rawVariant.id !== 'string') {
      return { id: 'standard', movesLimit: Board.MAX_MOVES, label: null };
    }
    return {
      id: rawVariant.id,
      movesLimit: Number.isInteger(rawVariant.movesLimit) ? rawVariant.movesLimit : Board.MAX_MOVES,
      label: rawVariant.label || null,
      targetTile: rawVariant.targetTile || null,
      targetCount: rawVariant.targetCount || null,
      bonusScore: rawVariant.bonusScore || null,
      comboMultiplierBonus: rawVariant.comboMultiplierBonus || null,
    };
  }

  function updateVariantChip() {
    if (!variantChipEl) {
      return;
    }
    var variant = state && state.mode === 'daily' ? state.variant : null;
    if (!variant || variant.id === 'standard') {
      variantChipEl.classList.add('hidden');
      variantChipEl.textContent = '';
      return;
    }

    var text = variant.label || '';
    if (variant.id === 'collect' && variant.targetTile) {
      var collected = state.clearedByType[variant.targetTile] || 0;
      text = TILE_LABEL[variant.targetTile] + ' ' + collected + '/' + variant.targetCount;
    }
    variantChipEl.textContent = text;
    variantChipEl.classList.remove('hidden');
  }

  // 변형 보너스 계산(계획서 2.1). collect는 목표 간식 수집량이 기준치 이상이면
  // 고정 보너스, combo는 최고 콤보 x 배율이다. standard/sprint20은 보너스 없음.
  function computeVariantBonus() {
    var variant = state.variant;
    if (!variant || state.mode !== 'daily') {
      return { amount: 0, label: null };
    }
    if (variant.id === 'collect' && variant.targetTile) {
      var collected = state.clearedByType[variant.targetTile] || 0;
      if (collected >= variant.targetCount) {
        return { amount: variant.bonusScore, label: TILE_LABEL[variant.targetTile] + ' ' + collected + '개 수집 보너스' };
      }
      return { amount: 0, label: TILE_LABEL[variant.targetTile] + ' ' + collected + '/' + variant.targetCount + ' (기준 미달)' };
    }
    if (variant.id === 'combo') {
      var bonus = state.bestCombo * variant.comboMultiplierBonus;
      return { amount: bonus, label: '최고 콤보 ×' + state.bestCombo + ' 보너스' };
    }
    return { amount: 0, label: null };
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

  // 드래그 중 타일 따라오기(계획서 4절): 판정 로직(24px 임계값·busy 가드)은 전혀
  // 건드리지 않는 표시 전용 계층이다. prefers-reduced-motion이면 비활성화한다.
  var prefersReducedMotionQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function prefersReducedMotion() {
    return Boolean(prefersReducedMotionQuery && prefersReducedMotionQuery.matches);
  }

  // 주축 방향만 따라오게 하고, 최대 이동량은 타일 1칸의 60%로 제한한다.
  function applyDragFollowTransform(el, deltaX, deltaY) {
    if (!el || prefersReducedMotion()) {
      return;
    }
    var cellSize = boardEl.clientWidth / Board.BOARD_SIZE;
    var maxOffset = cellSize * 0.6;
    var absX = Math.abs(deltaX);
    var absY = Math.abs(deltaY);
    var offsetX = 0;
    var offsetY = 0;
    if (Math.max(absX, absY) > 0) {
      if (absX >= absY) {
        offsetX = Math.max(-maxOffset, Math.min(maxOffset, deltaX));
      } else {
        offsetY = Math.max(-maxOffset, Math.min(maxOffset, deltaY));
      }
    }
    el.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px)';
    el.classList.add('tile-dragging');
  }

  function clearDragFollowTransform(el) {
    if (!el) {
      return;
    }
    el.style.transform = '';
    el.classList.remove('tile-dragging');
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
      dragEl: event.currentTarget,
    };

    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function onTilePointerMove(event) {
    if (!swipeStart || swipeStart.pointerId !== event.pointerId) {
      return;
    }
    var deltaX = event.clientX - swipeStart.x;
    var deltaY = event.clientY - swipeStart.y;
    swipeStart.direction = getSwipeDirection(deltaX, deltaY);
    applyDragFollowTransform(swipeStart.dragEl, deltaX, deltaY);
  }

  function onTilePointerUp(event) {
    if (!swipeStart || swipeStart.pointerId !== event.pointerId) {
      return;
    }

    clearDragFollowTransform(swipeStart.dragEl);

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
      clearDragFollowTransform(swipeStart.dragEl);
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
    updateVariantChip();

    if (cascadeResult.cascadeCount > 1) {
      setStatusMessage(cascadeResult.cascadeCount + '연쇄가 이어졌어요! 배수 ×' + cascadeResult.maxMultiplier + '.');
    } else if (cascadeResult.cascadeCount === 1) {
      setStatusMessage('매치 성공! ' + cascadeResult.score + '점을 얻었어요.');
    }

    showScorePopupsForSteps(cascadeResult.steps);

    if (cascadeResult.maxMultiplier >= 2) {
      pulseComboChip();
    }

    busy = false;

    // 목표 판(계획서 3절)은 수를 다 쓰기 전에도 목표를 달성하면 즉시 성공 처리한다
    // (일반 판/오늘의 도전의 셔플·수 소진 처리보다 먼저 검사).
    if (state.mode === 'goal' && !state.gameOver && window.Match3Goals
      && window.Match3Goals.isGoalAchieved(state.goal, state)) {
      endGoal(true);
      return;
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
      if (state.mode === 'goal') {
        endGoal(false);
      } else {
        endGame();
      }
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

    // 변형 보너스(계획서 2.1)는 게임 종료 시 1회만 점수에 합산해 제출한다.
    var variantBonus = computeVariantBonus();
    if (variantBonus.amount > 0) {
      state.score += variantBonus.amount;
    }

    resultTitleEl.textContent = '이동을 모두 사용했어요';
    resultCopyEl.textContent = getScoreVerdict(state.score);
    resultScoreEl.textContent = String(state.score);
    resultComboEl.textContent = '×' + state.bestCombo;
    resultTopTileEl.textContent = getTopClearedTileLabel();

    var variantRowEl = document.getElementById('result-variant-row');
    var variantLabelEl = document.getElementById('result-variant-label');
    var variantValueEl = document.getElementById('result-variant-value');
    if (variantRowEl && variantValueEl && variantBonus.label) {
      variantLabelEl.textContent = '변형 보너스';
      variantValueEl.textContent = variantBonus.amount > 0 ? ('+' + variantBonus.amount + '점 · ' + variantBonus.label) : variantBonus.label;
      variantRowEl.classList.remove('hidden');
    } else if (variantRowEl) {
      variantRowEl.classList.add('hidden');
    }

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

  // ---- 목표 판 모드(docs/match3-improvement-plan.md 3절) ----
  // 랭킹 무관 완료형 - 서버 제출이 전혀 없고, 완료 여부만 로컬(localStorage)에 남는다.

  function readCompletedGoalIds() {
    try {
      var raw = window.localStorage.getItem(GOALS_STORAGE_KEY);
      if (!raw) {
        return [];
      }
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('[Match3Goals] 완료 기록을 읽지 못했어요.', error);
      return [];
    }
  }

  function markGoalCompleted(goalId) {
    try {
      var completed = readCompletedGoalIds();
      if (completed.indexOf(goalId) === -1) {
        completed.push(goalId);
        window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(completed));
      }
    } catch (error) {
      console.warn('[Match3Goals] 완료 기록을 저장하지 못했어요.', error);
    }
  }

  function isGoalCompleted(goalId) {
    return readCompletedGoalIds().indexOf(goalId) !== -1;
  }

  function renderGoalsList() {
    if (!goalsListEl || !window.Match3Goals) {
      return;
    }
    goalsListEl.innerHTML = '';
    var completed = readCompletedGoalIds();

    window.Match3Goals.getGoalBoards().forEach(function (goal) {
      var item = document.createElement('li');
      item.className = 'goals-list-item';

      var info = document.createElement('div');
      info.className = 'goals-list-item-info';
      var title = document.createElement('span');
      title.className = 'goals-list-item-title';
      title.textContent = goal.id + '. ' + goal.title;
      var desc = document.createElement('span');
      desc.className = 'goals-list-item-desc';
      desc.textContent = goal.description;
      info.appendChild(title);
      info.appendChild(desc);

      var actionArea = document.createElement('div');
      actionArea.className = 'goals-list-item-check';

      var isDone = completed.indexOf(goal.id) !== -1;
      if (isDone) {
        actionArea.textContent = '✅';
      } else {
        var startButton = document.createElement('button');
        startButton.type = 'button';
        startButton.className = 'gk-button secondary';
        startButton.textContent = '도전';
        startButton.addEventListener('click', function () {
          closeModal(goalsModal);
          startGoal(goal.id);
        });
        actionArea.appendChild(startButton);
      }

      item.appendChild(info);
      item.appendChild(actionArea);
      goalsListEl.appendChild(item);
    });
  }

  function startGoal(goalId) {
    if (!window.Match3Goals) {
      return;
    }
    var goal = window.Match3Goals.getGoalBoardById(goalId);
    if (!goal) {
      return;
    }
    startNewGame({ seed: goal.seed, goal: goal });
  }

  function endGoal(achieved) {
    state.gameOver = true;
    closeModal(resultModal);

    if (achieved) {
      markGoalCompleted(state.goal.id);
      goalResultTitleEl.textContent = '해냈어요!';
      goalResultCopyEl.textContent = state.goal.title + ' 목표를 달성했어요.';
      goalResultNextButton.classList.remove('hidden');
    } else {
      // 배려 원칙(계획서 3절): 실패 횟수·비난 없이 차분하게 안내하고, 재도전은 무제한이다.
      goalResultTitleEl.textContent = '이번엔 여기까지예요';
      goalResultCopyEl.textContent = '이번엔 여기까지예요. 같은 판으로 다시 할 수 있어요.';
      goalResultNextButton.classList.add('hidden');
    }

    openModal(goalResultModal);
  }

  function startNewGame(options) {
    closeModal(resultModal);
    busy = false;
    state = createGameState(options);
    renderBoard();
    updateHud();
    updateChallengeChip();
    updateVariantChip();
    var introMessage;
    if (state.mode === 'daily' && state.variant && state.variant.label) {
      introMessage = state.variant.label;
    } else if (state.mode === 'daily') {
      introMessage = '오늘의 간식판이에요. 같은 판에서 편하게 다시 도전할 수 있어요.';
    } else {
      introMessage = '인접한 두 간식을 순서대로 클릭해 자리를 바꿔 보세요.';
    }
    setStatusMessage(introMessage);
  }

  function startDailyGameFromSeed(seed, daily) {
    startNewGame({
      seed: seed,
      mode: 'daily',
      dayKey: daily && daily.dayKey,
      variant: daily && daily.variant,
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

  if (goalsButton) {
    goalsButton.addEventListener('click', function () {
      renderGoalsList();
      openModal(goalsModal);
    });
  }

  if (goalsModalCloseButton) {
    goalsModalCloseButton.addEventListener('click', function () {
      closeModal(goalsModal);
    });
  }

  if (goalResultRetryButton) {
    goalResultRetryButton.addEventListener('click', function () {
      closeModal(goalResultModal);
      startGoal(state.goal.id);
    });
  }

  if (goalResultNextButton) {
    goalResultNextButton.addEventListener('click', function () {
      closeModal(goalResultModal);
      var nextId = state.goal.id + 1;
      var nextGoal = window.Match3Goals && window.Match3Goals.getGoalBoardById(nextId);
      if (nextGoal) {
        startGoal(nextId);
      } else {
        renderGoalsList();
        openModal(goalsModal);
      }
    });
  }

  if (goalResultListButton) {
    goalResultListButton.addEventListener('click', function () {
      closeModal(goalResultModal);
      renderGoalsList();
      openModal(goalsModal);
    });
  }

  startNewGame();

  // Exposed for manual/local QA only; not used by automated tests.
  window.Match3Game = {
    getState: function () {
      return state;
    },
  };
})();
