(function (root) {
  'use strict';

  var MAX_ATTEMPTS = 6;
  var CELL_COUNT = 6;
  var GAME_ID = 'word';
  var API_BASE = '/game/api';
  var STORAGE_PREFIX = 'redefine-word-daily-v1:';
  var STATE_PRIORITY = { absent: 1, present: 2, exact: 3 };
  var EMPTY_JAMO = root.WordLogic.EMPTY_JAMO;
  var CHOSEONG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  var JUNGSEONG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  var JONGSEONG = [EMPTY_JAMO, 'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  var KEY_ROWS = {
    choseong: [
      ['ㅂ', 'ㅃ', 'ㅈ', 'ㅉ', 'ㄷ', 'ㄸ', 'ㄱ', 'ㄲ', 'ㅅ', 'ㅆ'],
      ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ'],
    ],
    jungseong: [
      ['ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ', 'ㅒ', 'ㅖ'],
      ['ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅓ', 'ㅏ', 'ㅣ'],
      ['ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ'],
    ],
    jongseong: [
      ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅆ'],
      ['ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'],
    ],
  };

  var el = {
    dayLabel: document.getElementById('dayLabel'),
    participantCount: document.getElementById('participantCount'),
    statusText: document.getElementById('statusText'),
    grid: document.getElementById('grid'),
    keyboard: document.getElementById('keyboard'),
    eraseButton: document.getElementById('eraseButton'),
    emptyButton: document.getElementById('emptyButton'),
    enterButton: document.getElementById('enterButton'),
    resultPanel: document.getElementById('resultPanel'),
    resultTitle: document.getElementById('resultTitle'),
    resultText: document.getElementById('resultText'),
    copyButton: document.getElementById('copyButton'),
    distributionBars: document.getElementById('distributionBars'),
    distributionCaption: document.getElementById('distributionCaption'),
    linkSection: document.getElementById('linkSection'),
  };

  var state = createInitialState(null);

  function createInitialState(dayKey) {
    return {
      dayKey: dayKey,
      status: dayKey ? 'playing' : 'loading',
      rows: [],
      currentCells: [],
      participants: 0,
      distribution: normalizeDistribution(null),
      submitted: false,
      message: '',
      myResult: null,
    };
  }

  function normalizeDistribution(distribution) {
    var normalized = {};
    for (var index = 1; index <= MAX_ATTEMPTS; index += 1) {
      var key = String(index);
      var value = distribution && Number(distribution[key]);
      normalized[key] = Number.isFinite(value) && value > 0 ? value : 0;
    }
    return normalized;
  }

  function getStorageKey(dayKey) {
    return STORAGE_PREFIX + dayKey;
  }

  function safeParseJson(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function loadProgress(dayKey) {
    var saved = safeParseJson(root.localStorage.getItem(getStorageKey(dayKey)));
    if (!saved || saved.dayKey !== dayKey || !Array.isArray(saved.rows)) {
      return null;
    }

    return {
      dayKey: dayKey,
      status: saved.status === 'won' || saved.status === 'lost' ? saved.status : 'playing',
      rows: saved.rows.slice(0, MAX_ATTEMPTS),
      currentCells: Array.isArray(saved.currentCells) ? saved.currentCells.slice(0, CELL_COUNT) : [],
      participants: 0,
      distribution: normalizeDistribution(null),
      submitted: saved.submitted === true,
      message: '',
      myResult: null,
    };
  }

  function saveProgress() {
    if (!state.dayKey || state.status === 'loading' || state.status === 'error' || state.status === 'recorded') {
      return;
    }

    root.localStorage.setItem(getStorageKey(state.dayKey), JSON.stringify({
      dayKey: state.dayKey,
      status: state.status,
      rows: state.rows,
      currentCells: state.currentCells,
      submitted: state.submitted,
    }));
  }

  function formatDayLabel(dayKey) {
    return dayKey ? dayKey.replace(/-/g, '.') : '오늘의 단어';
  }

  function getToken() {
    return root.GameLink && typeof root.GameLink.getToken === 'function'
      ? root.GameLink.getToken()
      : null;
  }

  function requestJson(path, options) {
    options = options || {};
    return fetch(path, options).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (data) {
        return { response: response, data: data };
      });
    });
  }

  function fetchDaily() {
    var headers = {};
    var token = getToken();
    if (token) {
      headers.Authorization = 'Bearer ' + token;
    }

    return requestJson(API_BASE + '/daily?gameId=' + encodeURIComponent(GAME_ID), { headers: headers });
  }

  function loadDaily() {
    state = createInitialState(null);
    render();

    fetchDaily()
      .then(function (result) {
        if (!result.response.ok) {
          state.status = 'error';
          state.message = '오늘의 단어를 불러오지 못했어요. 잠시 후 다시 와 주세요.';
          render();
          return;
        }

        var data = result.data || {};
        var saved = loadProgress(data.dayKey);
        state = saved || createInitialState(data.dayKey);
        state.participants = Number(data.participants) || 0;
        state.distribution = normalizeDistribution(data.distribution);
        state.myResult = data.myResult || null;

        if (!saved && data.myResult) {
          state.status = 'recorded';
        }

        render();
      })
      .catch(function () {
        state.status = 'error';
        state.message = '오늘의 단어를 불러오지 못했어요. 잠시 후 다시 와 주세요.';
        render();
      });
  }

  function getCellType(index) {
    if (index % 3 === 0) {
      return 'choseong';
    }
    if (index % 3 === 1) {
      return 'jungseong';
    }
    return 'jongseong';
  }

  function getCurrentCellType() {
    return getCellType(state.currentCells.length);
  }

  function includesValue(list, value) {
    return list.indexOf(value) !== -1;
  }

  function isAllowedCell(value, index) {
    var type = getCellType(index);
    if (type === 'choseong') {
      return includesValue(CHOSEONG, value);
    }
    if (type === 'jungseong') {
      return includesValue(JUNGSEONG, value);
    }
    return includesValue(JONGSEONG, value);
  }

  function isPlaying() {
    return state.status === 'playing';
  }

  function setMessage(message) {
    state.message = message;
    renderStatus();
  }

  function displayCell(value) {
    return value === EMPTY_JAMO ? '없음' : value;
  }

  function createCell(value, classNames, rowIndex, cellIndex) {
    var cell = document.createElement('div');
    cell.className = classNames.join(' ');
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', (rowIndex + 1) + '번째 시도 ' + (cellIndex + 1) + '번째 칸');
    cell.textContent = value ? displayCell(value) : '';
    if (value === EMPTY_JAMO) {
      cell.classList.add('empty-label');
    }
    return cell;
  }

  function renderGrid() {
    el.grid.innerHTML = '';

    for (var rowIndex = 0; rowIndex < MAX_ATTEMPTS; rowIndex += 1) {
      var row = document.createElement('div');
      row.className = 'word-row';
      row.setAttribute('role', 'row');

      for (var cellIndex = 0; cellIndex < CELL_COUNT; cellIndex += 1) {
        var classNames = ['word-cell'];
        var value = '';
        var completedRow = state.rows[rowIndex];

        if (completedRow) {
          var feedback = completedRow.feedback[cellIndex] || {};
          value = feedback.cell;
          classNames.push(feedback.state || 'absent');
        } else if (rowIndex === state.rows.length && isPlaying()) {
          value = state.currentCells[cellIndex] || '';
          if (value) {
            classNames.push('filled');
          }
          if (cellIndex === state.currentCells.length) {
            classNames.push('current');
          }
        }

        row.appendChild(createCell(value, classNames, rowIndex, cellIndex));
      }

      el.grid.appendChild(row);
    }
  }

  function collectKeyStates() {
    var keyStates = {};
    state.rows.forEach(function (row) {
      row.feedback.forEach(function (cell) {
        if (!cell.cell || cell.cell === EMPTY_JAMO || !cell.state) {
          return;
        }
        var currentPriority = STATE_PRIORITY[keyStates[cell.cell]] || 0;
        var nextPriority = STATE_PRIORITY[cell.state] || 0;
        if (nextPriority > currentPriority) {
          keyStates[cell.cell] = cell.state;
        }
      });
    });
    return keyStates;
  }

  function addCell(value) {
    if (!isPlaying() || state.currentCells.length >= CELL_COUNT) {
      return;
    }

    if (!isAllowedCell(value, state.currentCells.length)) {
      setMessage('이 칸에 맞는 자모를 골라 주세요.');
      return;
    }

    state.currentCells.push(value);
    state.message = '';
    saveProgress();
    render();
  }

  function eraseCell() {
    if (!isPlaying() || state.currentCells.length === 0) {
      return;
    }
    state.currentCells.pop();
    state.message = '';
    saveProgress();
    render();
  }

  function renderKeyboard() {
    var keyStates = collectKeyStates();
    var type = getCurrentCellType();
    var rows = KEY_ROWS[type] || [];

    el.keyboard.innerHTML = '';
    rows.forEach(function (letters) {
      var row = document.createElement('div');
      row.className = 'word-key-row';
      row.style.gridTemplateColumns = 'repeat(' + letters.length + ', minmax(0, 1fr))';
      letters.forEach(function (letter) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'word-key';
        if (keyStates[letter]) {
          button.classList.add(keyStates[letter]);
        }
        button.textContent = letter;
        button.disabled = !isPlaying() || state.currentCells.length >= CELL_COUNT;
        button.addEventListener('click', function () {
          addCell(letter);
        });
        row.appendChild(button);
      });
      el.keyboard.appendChild(row);
    });
  }

  function getResultTries() {
    if (state.status === 'won') {
      return state.rows.length;
    }
    if (state.status === 'recorded' && state.myResult && Number.isInteger(state.myResult.tries)) {
      return state.myResult.tries;
    }
    return null;
  }

  function renderDistribution() {
    var tries = getResultTries();
    var maxValue = 1;
    Object.keys(state.distribution).forEach(function (key) {
      maxValue = Math.max(maxValue, state.distribution[key]);
    });

    el.distributionBars.innerHTML = '';
    for (var index = 1; index <= MAX_ATTEMPTS; index += 1) {
      var key = String(index);
      var value = state.distribution[key] || 0;
      var row = document.createElement('div');
      row.className = 'distribution-row' + (tries === index ? ' mine' : '');

      var label = document.createElement('span');
      label.className = 'distribution-label';
      label.textContent = key;
      row.appendChild(label);

      var track = document.createElement('div');
      track.className = 'distribution-track';
      var fill = document.createElement('div');
      fill.className = 'distribution-fill';
      fill.style.width = value > 0 ? Math.max(8, Math.round((value / maxValue) * 100)) + '%' : '0';
      track.appendChild(fill);
      row.appendChild(track);

      var count = document.createElement('span');
      count.className = 'distribution-count';
      count.textContent = value.toLocaleString('ko-KR') + '명';
      row.appendChild(count);

      el.distributionBars.appendChild(row);
    }
  }

  function renderStatus() {
    if (state.message) {
      el.statusText.textContent = state.message;
      return;
    }
    if (state.status === 'loading') {
      el.statusText.textContent = '오늘의 단어를 불러오는 중...';
      return;
    }
    if (state.status === 'error') {
      el.statusText.textContent = '오늘의 단어를 불러오지 못했어요. 잠시 후 다시 와 주세요.';
      return;
    }
    if (state.status === 'won') {
      el.statusText.textContent = '정답이에요. 결과는 정답 없이 공유할 수 있어요.';
      return;
    }
    if (state.status === 'lost') {
      el.statusText.textContent = '오늘은 여기까지예요. 내일 새 단어로 만나요.';
      return;
    }
    if (state.status === 'recorded') {
      el.statusText.textContent = '오늘 기록은 이미 반영됐어요.';
      return;
    }
    el.statusText.textContent = (state.rows.length + 1) + '번째 시도예요.';
  }

  function renderResult() {
    var visible = state.status === 'won' || state.status === 'lost' || state.status === 'recorded';
    el.resultPanel.hidden = !visible;
    if (!visible) {
      return;
    }

    var tries = getResultTries();
    if (state.status === 'won') {
      el.resultTitle.textContent = '정답이에요!';
      el.resultText.textContent = tries + '번 만에 만났네요.';
    } else if (state.status === 'lost') {
      el.resultTitle.textContent = '오늘은 여기까지예요.';
      el.resultText.textContent = '내일 새 단어로 만나요.';
    } else if (tries) {
      el.resultTitle.textContent = '오늘 기록은 이미 반영됐어요.';
      el.resultText.textContent = tries + '번 만에 만난 기록이에요.';
    } else {
      el.resultTitle.textContent = '오늘 기록은 이미 반영됐어요.';
      el.resultText.textContent = '내일 새 단어로 만나요.';
    }

    el.copyButton.hidden = state.rows.length === 0;
  }

  function renderControls() {
    var canPlay = isPlaying();
    el.eraseButton.disabled = !canPlay || state.currentCells.length === 0;
    el.emptyButton.disabled = !canPlay || getCurrentCellType() !== 'jongseong';
    el.enterButton.disabled = !canPlay || state.currentCells.length !== CELL_COUNT;
  }

  function render() {
    el.dayLabel.textContent = formatDayLabel(state.dayKey);
    el.participantCount.textContent = state.participants.toLocaleString('ko-KR');
    el.distributionCaption.textContent = state.participants > 0
      ? '성공한 기록만 보여요.'
      : '아직 성공 기록이 없어요.';
    renderStatus();
    renderGrid();
    renderKeyboard();
    renderControls();
    renderResult();
    renderDistribution();
  }

  function submitGuess() {
    if (!isPlaying()) {
      return;
    }

    if (state.currentCells.length !== CELL_COUNT) {
      setMessage('여섯 칸을 모두 채워 주세요.');
      return;
    }

    var guess;
    try {
      guess = root.WordLogic.composeWord(state.currentCells);
    } catch (error) {
      setMessage('자모 조합을 다시 확인해 주세요.');
      return;
    }

    el.enterButton.disabled = true;
    requestJson(API_BASE + '/word/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayKey: state.dayKey, guess: guess }),
    })
      .then(function (result) {
        if (!result.response.ok) {
          state.message = result.data && result.data.message
            ? result.data.message
            : '오늘의 단어를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';
          render();
          return;
        }

        if (!result.data.valid) {
          state.message = result.data.message || '사전에 있는 두 글자 단어를 입력해 주세요.';
          render();
          return;
        }

        state.rows.push({ guess: guess, feedback: result.data.feedback });
        state.currentCells = [];
        state.message = '';

        if (result.data.solved) {
          state.status = 'won';
        } else if (state.rows.length >= MAX_ATTEMPTS) {
          state.status = 'lost';
        }

        saveProgress();
        render();

        if (state.status === 'won' || state.status === 'lost') {
          submitResult();
        }
      })
      .catch(function () {
        state.message = '오늘의 단어를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.';
        render();
      });
  }

  function submitResult() {
    var token = getToken();
    if (!token || state.submitted || (state.status !== 'won' && state.status !== 'lost')) {
      return;
    }

    var score = state.status === 'won' ? 7 - state.rows.length : 0;
    requestJson(API_BASE + '/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        gameId: GAME_ID,
        score: score,
        challenge: 'daily',
        dayKey: state.dayKey,
      }),
    }).then(function (result) {
      if (result.response.ok) {
        state.submitted = true;
        saveProgress();
        refreshDailyMeta();
      }
    });
  }

  function refreshDailyMeta() {
    fetchDaily().then(function (result) {
      if (!result.response.ok) {
        return;
      }
      state.participants = Number(result.data.participants) || state.participants;
      state.distribution = normalizeDistribution(result.data.distribution);
      state.myResult = result.data.myResult || state.myResult;
      render();
    });
  }

  function buildShareText() {
    var grid = root.WordLogic.createEmojiGrid(state.rows.map(function (row) {
      return row.feedback;
    }));
    var result = state.status === 'won' ? state.rows.length + '/6' : 'X/6';
    return '오늘의 간식 단어 ' + state.dayKey + ' ' + result + '\n' + grid;
  }

  function copyResult() {
    var text = buildShareText();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        setMessage('결과를 복사했어요.');
      }).catch(function () {
        setMessage(text);
      });
      return;
    }
    setMessage(text);
  }

  function handleKeydown(event) {
    if (!isPlaying()) {
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      eraseCell();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      submitGuess();
      return;
    }
    if (event.key === ' ' && getCurrentCellType() === 'jongseong') {
      event.preventDefault();
      addCell(EMPTY_JAMO);
      return;
    }
    if (/^[ㄱ-ㅎㅏ-ㅣ]$/.test(event.key)) {
      event.preventDefault();
      addCell(event.key);
    }
  }

  el.eraseButton.addEventListener('click', eraseCell);
  el.emptyButton.addEventListener('click', function () {
    addCell(EMPTY_JAMO);
  });
  el.enterButton.addEventListener('click', submitGuess);
  el.copyButton.addEventListener('click', copyResult);
  document.addEventListener('keydown', handleKeydown);

  if (root.GameLink && typeof root.GameLink.renderLinkSection === 'function') {
    root.GameLink.renderLinkSection(el.linkSection, {
      onChange: function () {
        submitResult();
        refreshDailyMeta();
      },
    });
  }

  loadDaily();
})(window);
