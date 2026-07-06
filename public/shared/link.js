/*
 * 공용 웹게임 ↔ Discord 연동 클라이언트 모듈 (window.GameLink).
 * 매치3/덱/방치형 3종이 함께 로드하는 공용 스크립트입니다.
 * 연동은 부가 기능이며, 실패하거나 미연결이어도 게임 진행을 절대 막지 않습니다.
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'redefine-game-link-v1';
  var API_BASE = '/game/api';
  // score 엔드포인트 본문 상한(서버 32KB, docs/replay-verification-plan.md 1절)과 동일한 값.
  // 로그를 포함한 본문이 이 값을 넘으면 클라이언트가 미리 로그를 떼고 제출한다(항상 제출은 성공해야 한다).
  var SCORE_BODY_MAX_BYTES = 32 * 1024;
  var REPLAY_LOG_VERSION = 1;

  function readStoredLink() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.token === 'string' && parsed.token) {
        return parsed;
      }
      return null;
    } catch (error) {
      console.warn('[GameLink] 저장된 연결 정보를 읽지 못했어요.', error);
      return null;
    }
  }

  function writeStoredLink(link) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(link));
    } catch (error) {
      console.warn('[GameLink] 연결 정보를 저장하지 못했어요.', error);
    }
  }

  function clearStoredLink() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('[GameLink] 연결 정보를 지우지 못했어요.', error);
    }
  }

  function isLinked() {
    return Boolean(readStoredLink());
  }

  function getDisplayName() {
    var link = readStoredLink();
    return link ? link.displayName : null;
  }

  function getToken() {
    var link = readStoredLink();
    return link ? link.token : null;
  }

  function disconnect() {
    clearStoredLink();
  }

  // 코드 입력 → 서버 검증 → 토큰 저장. 실패해도 예외를 던지지 않고 결과 객체로 알린다.
  function connect(code) {
    return fetch(API_BASE + '/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { response: response, data: data };
        });
      })
      .then(function (result) {
        if (!result.response.ok) {
          return { ok: false, error: result.data && result.data.error, message: result.data && result.data.message };
        }

        writeStoredLink({ token: result.data.playerToken, displayName: result.data.displayName });
        return { ok: true, displayName: result.data.displayName };
      })
      .catch(function (error) {
        console.warn('[GameLink] 연결에 실패했어요.', error);
        return { ok: false, error: 'NETWORK_ERROR' };
      });
  }

  // 게임 종료 시 점수 제출. fire-and-forget: 실패해도 콘솔 경고만 남기고
  // 게임 진행/화면 전환을 절대 막지 않는다. 미연결이면 조용히 no-op.
  function submitScore(gameId, score, seed, options) {
    var link = readStoredLink();
    if (!link) {
      return Promise.resolve({ ok: false, reason: 'NOT_LINKED' });
    }
    var payload = { token: link.token, gameId: gameId, score: score, seed: seed };
    if (options && options.challenge) {
      payload.challenge = options.challenge;
    }
    if (options && options.replayActions && options.replayActions.length > 0) {
      var replayLog = { v: REPLAY_LOG_VERSION, actions: options.replayActions };
      var payloadWithLog = Object.assign({}, payload, { replayLog: replayLog });
      var bodyWithLog = JSON.stringify(payloadWithLog);
      // 본문 상한(32KB) 초과 시 로그만 떼고 제출한다 — 제출 자체는 항상 성공해야 한다.
      if (bodyWithLog.length <= SCORE_BODY_MAX_BYTES) {
        payload = payloadWithLog;
      } else {
        console.warn('[GameLink] 리플레이 로그가 커서 로그 없이 제출해요.');
      }
    }

    return fetch(API_BASE + '/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { response: response, data: data };
        });
      })
      .then(function (result) {
        if (!result.response.ok) {
          console.warn('[GameLink] 점수 제출이 거부됐어요.', result.data);
          return { ok: false, error: result.data && result.data.error };
        }

        if (result.data.replay === 'mismatch') {
          // 참여자 화면에는 노출하지 않는다(배려 원칙) — 콘솔 진단 전용.
          console.warn('[GameLink] 서버 리플레이 검증 결과가 제출 점수와 달라요(mismatch). 운영자가 확인할 수 있어요.');
        }

        return {
          ok: true,
          flagged: result.data.flagged,
          weekBest: result.data.weekBest,
          mode: result.data.mode,
          dayKey: result.data.dayKey,
          dayBest: result.data.dayBest,
          replay: result.data.replay,
        };
      })
      .catch(function (error) {
        console.warn('[GameLink] 점수 제출에 실패했어요.', error);
        return { ok: false, error: 'NETWORK_ERROR' };
      });
  }

  // 주간 랭킹 조회. 실패 시 빈 결과를 돌려준다(화면 표시만 영향, 게임 진행과 무관).
  function fetchRankings(gameId) {
    var link = readStoredLink();
    var headers = {};
    if (link) {
      headers['Authorization'] = 'Bearer ' + link.token;
    }

    return fetch(API_BASE + '/rankings?gameId=' + encodeURIComponent(gameId), { headers: headers })
      .then(function (response) {
        return response.json().then(function (data) {
          return { response: response, data: data };
        });
      })
      .then(function (result) {
        if (!result.response.ok) {
          return { ok: false, ranking: [], myRank: null };
        }

        return { ok: true, ranking: result.data.ranking || [], myRank: result.data.myRank || null, weekKey: result.data.weekKey };
      })
      .catch(function (error) {
        console.warn('[GameLink] 랭킹을 불러오지 못했어요.', error);
        return { ok: false, ranking: [], myRank: null };
      });
  }

  function fetchDaily(gameId) {
    var link = readStoredLink();
    var headers = {};
    if (link) {
      headers['Authorization'] = 'Bearer ' + link.token;
    }

    return fetch(API_BASE + '/daily?gameId=' + encodeURIComponent(gameId), { headers: headers })
      .then(function (response) {
        return response.json().then(function (data) {
          return { response: response, data: data };
        });
      })
      .then(function (result) {
        if (!result.response.ok) {
          return { ok: false, ranking: [] };
        }

        return {
          ok: true,
          dayKey: result.data.dayKey,
          seed: result.data.seed,
          participants: result.data.participants || 0,
          ranking: result.data.ranking || [],
          myBest: result.data.myBest,
          myRank: result.data.myRank || null,
        };
      })
      .catch(function (error) {
        console.warn('[GameLink] 오늘의 도전을 불러오지 못했어요.', error);
        return { ok: false, ranking: [] };
      });
  }

  function fetchGoal() {
    var link = readStoredLink();
    var headers = {};
    if (link) {
      headers['Authorization'] = 'Bearer ' + link.token;
    }

    return fetch(API_BASE + '/goal', { headers: headers })
      .then(function (response) {
        return response.json().then(function (data) {
          return { response: response, data: data };
        });
      })
      .then(function (result) {
        if (!result.response.ok) {
          return { ok: false };
        }

        return {
          ok: true,
          weekKey: result.data.weekKey,
          goal: result.data.goal,
          total: result.data.total,
          participants: result.data.participants,
          achieved: result.data.achieved,
          myContribution: result.data.myContribution,
        };
      })
      .catch(function (error) {
        console.warn('[GameLink] 공동 목표를 불러오지 못했어요.', error);
        return { ok: false };
      });
  }

  function sendCheer(gameId, periodKey, targetId) {
    var link = readStoredLink();
    if (!link) {
      return Promise.resolve({ ok: false, reason: 'NOT_LINKED' });
    }

    return fetch(API_BASE + '/cheer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: link.token,
        gameId: gameId,
        periodKey: periodKey,
        targetId: targetId,
      }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { response: response, data: data };
        });
      })
      .then(function (result) {
        if (!result.response.ok) {
          return { ok: false, error: result.data && result.data.error };
        }
        return {
          ok: true,
          cheers: result.data.cheers,
          alreadyCheered: Boolean(result.data.alreadyCheered),
        };
      })
      .catch(function (error) {
        console.warn('[GameLink] 응원을 보내지 못했어요.', error);
        return { ok: false, error: 'NETWORK_ERROR' };
      });
  }

  function fetchMe() {
    var link = readStoredLink();
    if (!link) {
      return Promise.resolve({ ok: false, reason: 'NOT_LINKED' });
    }

    return fetch(API_BASE + '/me', { headers: { Authorization: 'Bearer ' + link.token } })
      .then(function (response) {
        if (!response.ok) {
          if (response.status === 401) {
            clearStoredLink();
          }
          return { ok: false };
        }
        return response.json().then(function (data) {
          return { ok: true, displayName: data.displayName };
        });
      })
      .catch(function (error) {
        console.warn('[GameLink] 연결 상태를 확인하지 못했어요.', error);
        return { ok: false, error: 'NETWORK_ERROR' };
      });
  }

  // 연결 섹션 UI 렌더링 헬퍼. containerEl 안에 gk- 컴포넌트로 상태/입력폼을 그린다.
  function renderLinkSection(containerEl, options) {
    if (!containerEl) {
      return;
    }

    options = options || {};
    var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};

    function render() {
      var linked = isLinked();
      containerEl.innerHTML = '';

      var panel = document.createElement('div');
      panel.className = 'gk-panel gk-link-panel';

      if (linked) {
        var status = document.createElement('p');
        status.className = 'gk-link-status';
        status.textContent = '연결됨: ' + getDisplayName();
        panel.appendChild(status);

        var disconnectButton = document.createElement('button');
        disconnectButton.type = 'button';
        disconnectButton.className = 'gk-button secondary';
        disconnectButton.textContent = '연결 해제';
        disconnectButton.addEventListener('click', function () {
          disconnect();
          render();
          onChange();
        });
        panel.appendChild(disconnectButton);
      } else {
        var label = document.createElement('p');
        label.className = 'gk-link-status';
        label.textContent = 'Discord에서 /게임연결 명령으로 받은 코드를 입력해 주세요.';
        panel.appendChild(label);

        var form = document.createElement('form');
        form.className = 'gk-link-form';

        var input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.maxLength = 6;
        input.placeholder = '6자리 코드';
        input.className = 'gk-link-input';
        form.appendChild(input);

        var submitButton = document.createElement('button');
        submitButton.type = 'submit';
        submitButton.className = 'gk-button primary';
        submitButton.textContent = '연결';
        form.appendChild(submitButton);

        var message = document.createElement('p');
        message.className = 'gk-link-message';
        form.appendChild(message);

        form.addEventListener('submit', function (event) {
          event.preventDefault();
          submitButton.disabled = true;
          message.textContent = '연결하는 중...';

          connect(input.value.trim()).then(function (result) {
            submitButton.disabled = false;
            if (result.ok) {
              render();
              onChange();
              return;
            }

            message.textContent = '연결에 실패했어요. 코드를 다시 확인해 주세요.';
          });
        });

        panel.appendChild(form);
      }

      containerEl.appendChild(panel);
    }

    render();
  }

  function buildCheerCountEl(entry) {
    var count = document.createElement('span');
    count.className = 'gk-cheer-count';
    count.textContent = entry.cheers > 0 ? '👏 ' + entry.cheers : '';
    return count;
  }

  function buildRankingItem(entry, gameId, periodKey) {
    var item = document.createElement('li');
    item.className = 'gk-ranking-item';

    var main = document.createElement('span');
    main.className = 'gk-ranking-main';
    main.textContent = entry.displayName + ' — ' + entry.score.toLocaleString('ko-KR') + '점';
    item.appendChild(main);

    var actions = document.createElement('span');
    actions.className = 'gk-ranking-actions';
    var count = buildCheerCountEl(entry);
    actions.appendChild(count);

    if (isLinked() && entry.targetId && !entry.isMe) {
      var cheerButton = document.createElement('button');
      cheerButton.type = 'button';
      cheerButton.className = 'gk-button secondary gk-cheer-button';
      cheerButton.textContent = '응원하기';
      cheerButton.addEventListener('click', function () {
        cheerButton.disabled = true;
        sendCheer(gameId, periodKey, entry.targetId).then(function (result) {
          if (result.ok) {
            count.textContent = '👏 ' + result.cheers;
            cheerButton.textContent = '응원했어요';
            return;
          }
          cheerButton.disabled = false;
        });
      });
      actions.appendChild(cheerButton);
    }

    item.appendChild(actions);
    return item;
  }

  function appendRankingList(panel, ranking, gameId, periodKey, emptyText) {
    if (!ranking || ranking.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'gk-link-status';
      empty.textContent = emptyText;
      panel.appendChild(empty);
      return;
    }

    var list = document.createElement('ol');
    list.className = 'gk-ranking-list';
    ranking.forEach(function (entry) {
      list.appendChild(buildRankingItem(entry, gameId, periodKey));
    });
    panel.appendChild(list);
  }

  // 주간 랭킹 표시 UI 렌더링 헬퍼.
  function renderRankingSection(containerEl, gameId) {
    if (!containerEl) {
      return;
    }

    containerEl.innerHTML = '<p class="gk-link-status">랭킹을 불러오는 중...</p>';

    fetchRankings(gameId).then(function (result) {
      containerEl.innerHTML = '';

      var panel = document.createElement('div');
      panel.className = 'gk-panel gk-ranking-panel';

      var title = document.createElement('p');
      title.className = 'gk-ranking-title';
      title.textContent = '이번 주 랭킹';
      panel.appendChild(title);

      appendRankingList(panel, result.ranking, gameId, result.weekKey, '이번 주 기록이 아직 없어요.');

      if (result.myRank) {
        var myRankEl = document.createElement('p');
        myRankEl.className = 'gk-link-status';
        myRankEl.textContent = '내 순위: ' + result.myRank.rank + '위 (' + result.myRank.score.toLocaleString('ko-KR') + '점)';
        panel.appendChild(myRankEl);
      }

      containerEl.appendChild(panel);
    });
  }

  function renderDailySection(containerEl, gameId, options) {
    if (!containerEl) {
      return;
    }
    options = options || {};
    containerEl.innerHTML = '<p class="gk-link-status">오늘의 도전을 불러오는 중...</p>';

    fetchDaily(gameId).then(function (result) {
      containerEl.innerHTML = '';

      var panel = document.createElement('div');
      panel.className = 'gk-panel gk-daily-panel';

      if (!result.ok) {
        var failed = document.createElement('p');
        failed.className = 'gk-link-status';
        failed.textContent = '오늘의 도전을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
        panel.appendChild(failed);
        containerEl.appendChild(panel);
        return;
      }

      var title = document.createElement('p');
      title.className = 'gk-ranking-title';
      title.textContent = '오늘의 도전';
      panel.appendChild(title);

      var participants = document.createElement('p');
      participants.className = 'gk-daily-participants';
      participants.textContent = '오늘 ' + result.participants.toLocaleString('ko-KR') + '명이 함께 도전했어요.';
      panel.appendChild(participants);

      if (typeof options.onStart === 'function') {
        var startButton = document.createElement('button');
        startButton.type = 'button';
        startButton.className = 'gk-button primary gk-daily-start-button';
        startButton.textContent = '오늘의 도전 시작';
        startButton.addEventListener('click', function () {
          options.onStart(result.seed, result);
        });
        panel.appendChild(startButton);
      }

      appendRankingList(panel, result.ranking, gameId, result.dayKey, '오늘의 도전 기록이 아직 없어요.');

      if (isLinked()) {
        var myDaily = document.createElement('p');
        myDaily.className = 'gk-link-status';
        myDaily.textContent = result.myBest !== null && result.myBest !== undefined
          ? '내 오늘 기록: ' + result.myBest.toLocaleString('ko-KR') + '점' + (result.myRank ? ' · ' + result.myRank.rank + '위' : '')
          : '내 오늘 기록은 아직 없어요.';
        panel.appendChild(myDaily);
      }

      containerEl.appendChild(panel);
    });
  }

  root.GameLink = {
    isLinked: isLinked,
    getDisplayName: getDisplayName,
    getToken: getToken,
    connect: connect,
    disconnect: disconnect,
    submitScore: submitScore,
    fetchRankings: fetchRankings,
    fetchDaily: fetchDaily,
    fetchGoal: fetchGoal,
    sendCheer: sendCheer,
    fetchMe: fetchMe,
    renderLinkSection: renderLinkSection,
    renderRankingSection: renderRankingSection,
    renderDailySection: renderDailySection,
  };
})(typeof window !== 'undefined' ? window : this);
