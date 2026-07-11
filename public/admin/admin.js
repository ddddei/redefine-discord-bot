(function () {
  const endpoints = {
    capabilities: '/api/admin/capabilities',
    summary: '/api/admin/summary',
    todayQueue: '/api/admin/today-queue?limit=10',
    firstDayCheck: '/api/admin/first-day-check?limit=10',
    reactionFollowUps: '/api/admin/reaction-follow-ups?limit=10',
    onboardingSignals: '/api/admin/onboarding-signals?limit=10',
    faqCandidates: '/api/admin/faq-candidates?limit=10',
    redemptions: '/api/admin/redemptions?status=pending&limit=10',
    submissions: '/api/admin/submissions?status=pending&limit=10',
    transactions: '/api/admin/point-transactions?limit=10',
    missions: '/api/admin/missions?limit=10',
    shopItems: '/api/admin/shop-items?limit=10',
    reactions: '/api/admin/reaction-approvals?limit=10',
    dmSafetyReviews: '/api/admin/dm-safety-reviews?limit=10',
  };
  let writeEnabled = false;
  let writeToken = '';
  let pendingWrite = null;
  let payoutPreview = null;

  const webgameLabels = {
    match3: '간식 맞추기',
    deck: '간식 수호대',
    idle: '간식 공방 키우기',
    word: '오늘의 간식 단어',
  };

  const queueLabels = {
    pendingRedemptions: '교환 대기',
    pendingSubmissions: '인증 대기',
    todayReactionApprovals: '오늘 반응 승인',
    todayPointTransactions: '오늘 포인트 거래',
    followUps: '후속 확인',
    qaWarnings: 'QA 경고',
  };

  const labels = {
    usersCount: '사용자 수',
    todayPointTransactionsCount: '오늘 포인트 거래',
    todayEarnedPoints: '오늘 지급 포인트',
    pendingRedemptionsCount: '교환 대기',
    pendingSubmissionsCount: '인증 대기',
    reviewedSubmissionsCount: '인증 처리',
    activeMissionsCount: '활성 미션',
    activeShopItemsCount: '활성 상점 항목',
    todayReactionApprovalsCount: '오늘 반응 승인',
    reactionFollowUpsCount: '반응 후속 확인',
  };

  function $(id) {
    return document.getElementById(id);
  }

  function text(value, fallback) {
    if (value === null || value === undefined || value === '') {
      return fallback || '-';
    }

    return String(value);
  }

  function shortId(value) {
    const raw = text(value);
    return raw.length > 18 ? raw.slice(0, 8) + '...' + raw.slice(-6) : raw;
  }

  function formatDate(value) {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  }

  function badge(value) {
    const safeValue = text(value);
    return '<span class="badge ' + escapeHtml(safeValue) + '">' + escapeHtml(safeValue) + '</span>';
  }

  function safetyBadge(detection) {
    if (!detection) {
      return '<span class="badge">-</span>';
    }

    const label = [detection.category, detection.severity].filter(Boolean).join(' / ');
    return '<span class="badge safety">' + escapeHtml(label || '감지됨') + '</span>';
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error('HTTP ' + response.status);
    }

    return response.json();
  }

  async function postJson(url, body) {
    if (!writeToken) writeToken = window.prompt('관리자 쓰기 토큰을 입력해 주세요.') || '';
    if (!writeToken) throw new Error('쓰기 토큰이 필요합니다.');
    const response = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Admin-Write-Token': writeToken },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      if (response.status === 403) writeToken = '';
      const error = new Error(response.status === 409 ? '이미 처리된 건입니다 — 새로고침해 주세요.' : (payload.message || '처리하지 못했습니다.'));
      error.status = response.status;
      error.code = payload.error;
      error.serverMessage = payload.message;
      throw error;
    }
    return payload;
  }

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.hidden = false;
    window.setTimeout(function () { toast.hidden = true; }, 4000);
  }

  function requestWrite(config) {
    pendingWrite = config;
    $('write-dialog-summary').textContent = config.summary;
    $('write-reason').value = config.reason || '';
    $('write-reason-label').hidden = config.showReason === false;
    $('write-reason').required = Boolean(config.reasonRequired);
    $('write-dialog').showModal();
  }

  function actionButtons(actions) {
    if (!writeEnabled) return '-';
    return '<div class="action-group">' + actions.map(function (action) {
      return '<button type="button" class="action-button" data-write-action="' + escapeHtml(action.name) + '" data-write-id="' + escapeHtml(action.id) + '" data-write-label="' + escapeHtml(action.label) + '">' + escapeHtml(action.label) + '</button>';
    }).join('') + '</div>';
  }

  function getDmChatLogsEndpoint() {
    const params = new URLSearchParams();
    const userFilter = $('dm-chat-user-filter');
    const safetyFilter = $('dm-chat-safety-filter');
    const limitFilter = $('dm-chat-limit-filter');
    const userId = userFilter && userFilter.value ? userFilter.value.trim() : '';
    const limit = limitFilter && limitFilter.value ? limitFilter.value : '20';

    params.set('limit', limit);

    if (userId) {
      params.set('userId', userId);
    }

    if (safetyFilter && safetyFilter.checked) {
      params.set('safetyOnly', 'true');
    }

    return '/api/admin/dm-chat-logs?' + params.toString();
  }

  function getWebgameEndpoint() {
    const params = new URLSearchParams();
    const weekFilter = $('webgame-week-filter');
    const dayFilter = $('webgame-day-filter');
    const limitFilter = $('webgame-limit-filter');
    const weekKey = weekFilter && weekFilter.value ? weekFilter.value.trim() : '';
    const dayKey = dayFilter && dayFilter.value ? dayFilter.value.trim() : '';
    const limit = limitFilter && limitFilter.value ? limitFilter.value : '10';

    params.set('limit', limit);

    if (weekKey) {
      params.set('weekKey', weekKey);
    }

    if (dayKey) {
      params.set('dayKey', dayKey);
    }

    return '/api/admin/webgames?' + params.toString();
  }

  function rowsFromResponse(response) {
    return response && Array.isArray(response.data) ? response.data : response;
  }

  function renderQueueCard(label, value) {
    return '<article class="summary-card queue-card"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(text(value, 0)) + '</strong></article>';
  }

  function renderQueueItem(kind, title, meta, command) {
    return [
      '<article class="queue-item ' + escapeHtml(kind) + '">',
      '<strong>' + escapeHtml(title) + '</strong>',
      '<span>' + escapeHtml(meta) + '</span>',
      command ? '<code>' + escapeHtml(command) + '</code>' : '',
      '</article>',
    ].join('');
  }

  function renderQueueList(targetId, items, emptyMessage) {
    $(targetId).innerHTML = items.length > 0
      ? items.join('')
      : '<p class="empty">' + escapeHtml(emptyMessage) + '</p>';
  }

  function renderTodayQueue(queue) {
    const counts = queue.counts || {};
    $('today-queue-cards').innerHTML = Object.keys(queueLabels).map(function (key) {
      return renderQueueCard(queueLabels[key], counts[key]);
    }).join('');

    const workItems = [];
    (queue.pendingRedemptions || []).slice(0, 5).forEach(function (row) {
      workItems.push(renderQueueItem(
        'pending',
        '교환 대기 · ' + text(row.itemName || row.itemId, '항목 확인 필요'),
        text(row.displayName || row.userDisplayName || shortId(row.userId), '신청자 확인 필요') + ' · ' + formatDate(row.requestedAt || row.createdAt),
        '/교환관리'
      ));
    });
    (queue.pendingSubmissions || []).slice(0, 5).forEach(function (row) {
      workItems.push(renderQueueItem(
        'pending',
        '인증 대기 · ' + text(row.missionTitle || row.missionId, '미션 확인 필요'),
        text(row.displayName || shortId(row.userId), '제출자 확인 필요') + ' · ' + formatDate(row.createdAt),
        '/인증관리'
      ));
    });
    (queue.todayReactionApprovals || []).slice(0, 3).forEach(function (row) {
      workItems.push(renderQueueItem(
        row.status === 'rejected' ? 'rejected' : 'approved',
        '오늘 반응 처리 · ' + text(row.status, '상태 확인 필요'),
        text(row.authorDisplayName || shortId(row.authorId), '참여자 확인 필요') + ' · ' + formatDate(row.reviewedAt || row.createdAt),
        '/운영현황'
      ));
    });
    (queue.todayPointTransactions || []).slice(0, 3).forEach(function (row) {
      workItems.push(renderQueueItem(
        Number(row.amount || 0) >= 0 ? 'approved' : 'rejected',
        '오늘 포인트 거래 · ' + text(row.amount, 0) + 'P',
        text(row.reason, '사유 없음') + ' · ' + formatDate(row.createdAt),
        '/포인트로그'
      ));
    });

    const alertItems = [];
    (queue.followUps || []).forEach(function (item) {
      alertItems.push(renderQueueItem('warning', '후속 확인', item.message, item.recordId || ''));
    });
    (queue.qaWarnings || []).forEach(function (item) {
      alertItems.push(renderQueueItem('warning', 'QA 경고', item.message, item.recordId || ''));
    });

    renderQueueList('today-queue-work', workItems, '오늘 바로 처리할 대기 항목이 없습니다.');
    renderQueueList('today-queue-alerts', alertItems, '후속 확인이나 QA 경고가 없습니다.');
    $('today-queue-status').textContent = '읽기 전용 · example 데이터 제외'
      + (queue.meta && queue.meta.exampleRecordsExcluded > 0 ? ' ' + queue.meta.exampleRecordsExcluded + '건' : '');
  }

  function renderFirstDayCheck(check) {
    const sheets = check.googleSheetsCheck || {};
    const riskLabels = {
      critical: '치명',
      warning: '주의',
      optional: '선택',
    };
    const lines = [
      '채널 점검: ' + text(check.channelReadyCount, 0) + '/' + text(check.channelCheckCount, 0) + '개 전송 가능',
      'Google Sheets: ' + (sheets.loggingEnabled ? '켜짐' : '꺼짐') + ' / URL ' + (sheets.webAppUrlConfigured ? '설정됨' : '미설정'),
      'active 미션 ' + text(check.activeMissionsCount, 0) + '개 · active 상점 ' + text(check.activeShopItemsCount, 0) + '개',
      '교환 대기 ' + text(check.pendingRedemptionsCount, 0) + '건 · 인증 대기 ' + text(check.pendingSubmissionsCount, 0) + '건',
      '예시 데이터 제외 ' + text(check.exampleRecordsExcluded, 0) + '건',
      (check.backupReminderEnabled ? '백업 리마인더 켜짐' : '백업 리마인더 꺼짐') + ' · /운영내보내기 확인',
    ];
    const riskLines = (check.riskChecks || []).slice(0, 8).map(function (risk) {
      const label = riskLabels[risk.level] || '확인';
      const command = risk.command ? ' · ' + risk.command : '';
      return '[' + label + '] ' + text(risk.title, '점검 항목') + ': ' + text(risk.detail, '') + command;
    });
    $('first-day-check').innerHTML = lines.concat(riskLines).map(function (line) {
      return '<li>' + escapeHtml(line) + '</li>';
    }).join('');
    $('first-day-actions').innerHTML = (check.todayActions || [
      '/미션관리와 /상점관리에서 active 항목을 확인합니다.',
      '/운영내보내기 종류:전체 형식:JSON으로 백업 파일을 확보합니다.',
    ]).slice(0, 5).map(function (line) {
      return '<li>' + escapeHtml(line) + '</li>';
    }).join('');
  }

  function renderReactionFollowUps(queue) {
    const items = (queue.followUps || []).map(function (item) {
      return renderQueueItem('warning', '반응 승인 후속 확인', item.message, item.recordId || '');
    });
    renderQueueList('reaction-follow-ups', items, '반응 승인 후속 확인 항목이 없습니다.');
  }

  function renderOnboardingSignals(signals) {
    const counts = signals.commandCounts || {};
    const lines = [
      '기록된 사용자 ' + text(signals.trackedUsersCount, 0) + '명',
      '/안내 ' + text(counts['안내'], 0) + '명 · /포인트 ' + text(counts['포인트'], 0) + '명 · /미션 ' + text(counts['미션'], 0) + '명 · /상점 ' + text(counts['상점'], 0) + '명',
      '미션 인증 채널 1회 안내 ' + text(signals.guidanceSentCount, 0) + '건',
    ];
    const signalItems = (signals.helpSignals || []).slice(0, 5).map(function (signal) {
      return '<li><span class="mono">' + escapeHtml(shortId(signal.userId)) + '</span> · 아직 안 쓴 기본 명령어: '
        + escapeHtml((signal.missingCommands || []).join(', ') || '없음') + '</li>';
    });

    $('onboarding-signals').innerHTML = lines.map(function (line) {
      return '<li>' + escapeHtml(line) + '</li>';
    }).concat(signalItems).join('');
  }

  function renderFaqCandidates(queue) {
    renderTable('faq-candidates', queue.faqCandidates || [], [
      { label: '반복', render: function (row) { return escapeHtml(row.count || 1) + '회'; } },
      { label: '질문', render: function (row) { return escapeHtml(row.sampleQuestion || row.latestQuestion || '-'); } },
      { label: '마지막 확인', render: function (row) { return escapeHtml(formatDate(row.lastSeenAt)); } },
    ], '아직 FAQ 후보로 묶인 fallback 질문이 없습니다.');
  }

  function renderWebgameRankingTable(targetId, rows, emptyMessage) {
    renderTable(targetId, rows || [], [
      { label: '순위', render: function (row) { return escapeHtml(row.rank); } },
      { label: '참여자', render: function (row) { return escapeHtml(row.displayName || shortId(row.discordId)); } },
      { label: '점수', render: function (row) { return escapeHtml(row.score); } },
      { label: '응원', render: function (row) { return escapeHtml(row.cheers || 0); } },
    ], emptyMessage);
  }

  function renderWordDistribution(distribution) {
    const rows = Object.keys(distribution || {}).sort().map(function (tries) {
      return { tries: tries, count: distribution[tries] };
    });
    renderTable('webgame-word-distribution', rows, [
      { label: '성공 시도 횟수', render: function (row) { return escapeHtml(row.tries) + '회'; } },
      { label: '인원', render: function (row) { return escapeHtml(row.count || 0) + '명'; } },
    ], '오늘 아직 성공한 참여자가 없습니다.');
  }

  function renderFlaggedScores(rows) {
    renderTable('webgame-flagged-scores', rows || [], [
      { label: '제출 시각', render: function (row) { return escapeHtml(formatDate(row.submittedAt)); } },
      { label: '참여자', render: function (row) { return escapeHtml(row.displayName || shortId(row.discordId)); } },
      { label: '게임', render: function (row) { return escapeHtml(webgameLabels[row.gameId] || row.gameId); } },
      { label: '점수', render: function (row) { return escapeHtml(row.score); } },
      { label: '모드', render: function (row) { return badge(row.mode); } },
      { label: '주차/날짜', render: function (row) { return escapeHtml(row.weekKey || row.dayKey || '-'); } },
      { label: '판정', render: function (row) { return row.resolution ? badge(row.resolution.status) : actionButtons([
        { name: 'webgame-score-valid', id: row.scoreId, label: '정상 판정' },
        { name: 'webgame-score-invalid', id: row.scoreId, label: '무효 확정' },
      ]); } },
    ], '현재 flagged 기록이 없습니다.');
  }

  function renderPayoutPreview(preview) {
    payoutPreview = preview;
    const totals = preview.totals || {};
    const winnerLines = (preview.games || []).map(function (game) {
      const pending = (game.winners || []).filter(function (winner) { return !winner.alreadyPaid; });
      return (webgameLabels[game.gameId] || game.gameId) + ' 순위 보상 ' + pending.length + '건';
    });
    $('webgame-payout-preview').innerHTML = '<ul>' + [
      '주차 ' + text(preview.weekKey, '-'),
      '지급 예정 ' + text(totals.payableCount, 0) + '건 · ' + text(totals.payableAmount, 0) + 'P',
      '이미 지급 ' + text(totals.alreadyPaidCount, 0) + '건',
    ].concat(winnerLines).map(function (line) { return '<li>' + escapeHtml(line) + '</li>'; }).join('') + '</ul>';
    $('webgame-payout-execute-button').hidden = Number(totals.payableCount || 0) === 0;
  }

  async function loadPayoutPreview() {
    const weekKey = $('webgame-payout-week').value.trim();
    if (!/^\d{4}-W\d{2}$/.test(weekKey)) {
      showToast('주차를 YYYY-Www 형식으로 입력해 주세요.');
      return;
    }
    payoutPreview = null;
    $('webgame-payout-execute-button').hidden = true;
    $('webgame-payout-preview').innerHTML = '<p class="empty">지급안을 계산하는 중입니다.</p>';
    try {
      renderPayoutPreview(await fetchJson('/api/admin/webgames/payout-preview?weekKey=' + encodeURIComponent(weekKey)));
    } catch (error) {
      $('webgame-payout-preview').innerHTML = '<p class="empty">지급안을 불러오지 못했습니다.</p>';
      showToast(error.message);
    }
  }

  function renderRecentMismatches(rows) {
    renderTable('webgame-replay-mismatches', rows || [], [
      { label: '시각', render: function (row) { return escapeHtml(formatDate(row.at)); } },
      { label: '참여자', render: function (row) { return escapeHtml(row.displayName || shortId(row.discordId)); } },
      { label: '게임', render: function (row) { return escapeHtml(webgameLabels[row.gameId] || row.gameId); } },
      { label: '제출 점수', render: function (row) { return escapeHtml(row.score); } },
      { label: '재현 점수', render: function (row) { return escapeHtml(row.replayScore); } },
    ], '최근 리플레이 불일치 기록이 없습니다.');
  }

  function renderCheerStats(rows) {
    renderTable('webgame-cheer-stats', rows || [], [
      { label: '게임', render: function (row) { return escapeHtml(row.label || webgameLabels[row.gameId] || row.gameId); } },
      { label: '이번 주 응원', render: function (row) { return escapeHtml(row.cheersThisWeek || 0) + '회'; } },
      { label: '오늘 응원', render: function (row) { return escapeHtml(row.cheersToday || 0) + '회'; } },
    ], '아직 응원 기록이 없습니다.');
  }

  function renderCommunalGoal(goal) {
    if (!goal) {
      $('webgame-communal-goal').innerHTML = '<li>공동 목표 데이터를 불러오지 못했습니다.</li>';
      return;
    }

    const ratio = goal.goal > 0 ? Math.min(100, Math.round((goal.total / goal.goal) * 1000) / 10) : 0;
    const lines = [
      '주차: ' + text(goal.weekKey, '-'),
      '누적: ' + text(goal.total, 0) + ' / 목표 ' + text(goal.goal, 0) + ' (' + ratio + '%)',
      '참여자: ' + text(goal.participants, 0) + '명',
      '달성 여부: ' + (goal.achieved ? '달성' : '진행 중'),
    ];
    $('webgame-communal-goal').innerHTML = lines.map(function (line) {
      return '<li>' + escapeHtml(line) + '</li>';
    }).join('');
  }

  function renderWebgameOperations(summary) {
    const counts = summary.counts || {};
    const weeklyParticipants = counts.weeklyParticipants || {};
    const dailyParticipants = counts.dailyParticipants || {};
    const summaryCards = [
      { label: '연결된 사용자', value: counts.linkedUsers },
      { label: 'flagged 기록', value: counts.flaggedScores },
      { label: '이번 주 참여 · 간식 맞추기', value: weeklyParticipants.match3 },
      { label: '이번 주 참여 · 간식 수호대', value: weeklyParticipants.deck },
      { label: '이번 주 참여 · 간식 공방', value: weeklyParticipants.idle },
      { label: '이번 주 참여 · 오늘의 단어', value: weeklyParticipants.word },
      { label: '오늘 참여 · 간식 맞추기', value: dailyParticipants.match3 },
      { label: '오늘 참여 · 간식 수호대', value: dailyParticipants.deck },
      { label: '오늘 참여 · 오늘의 단어', value: dailyParticipants.word },
      { label: '이번 주 응원', value: counts.cheersThisWeek },
      { label: '오늘 응원', value: counts.cheersToday },
      { label: '리플레이 검증(이번 주)', value: (counts.replayStatus && counts.replayStatus.verified) || 0 },
      { label: '리플레이 불일치(이번 주)', value: (counts.replayStatus && counts.replayStatus.mismatch) || 0 },
      { label: '리플레이 로그 없음(이번 주)', value: (counts.replayStatus && counts.replayStatus.missing) || 0 },
    ];
    $('webgame-summary-cards').innerHTML = summaryCards.map(function (card) {
      return '<article class="summary-card"><span>' + escapeHtml(card.label) + '</span><strong>' + text(card.value, 0) + '</strong></article>';
    }).join('');

    const weeklyRankings = summary.weeklyRankings || {};
    renderWebgameRankingTable('webgame-weekly-match3', weeklyRankings.match3, '이번 주 아직 기록이 없습니다.');
    renderWebgameRankingTable('webgame-weekly-deck', weeklyRankings.deck, '이번 주 아직 기록이 없습니다.');

    const dailyChallenges = summary.dailyChallenges || {};
    const dailyMatch3 = dailyChallenges.match3 || {};
    const dailyDeck = dailyChallenges.deck || {};
    const dailyWord = dailyChallenges.word || {};
    $('webgame-daily-match3-status').textContent = '오늘 참여 ' + text(dailyMatch3.participants, 0) + '명';
    $('webgame-daily-deck-status').textContent = '오늘 참여 ' + text(dailyDeck.participants, 0) + '명';
    $('webgame-word-status').textContent = '오늘 참여 ' + text(dailyWord.participants, 0) + '명';
    renderWebgameRankingTable('webgame-daily-match3', dailyMatch3.ranking, '오늘 아직 기록이 없습니다.');
    renderWebgameRankingTable('webgame-daily-deck', dailyDeck.ranking, '오늘 아직 기록이 없습니다.');
    renderWordDistribution(dailyWord.distribution);

    renderCommunalGoal(summary.communalGoal);
    renderFlaggedScores(summary.flaggedScores);
    renderCheerStats(summary.cheerStats);
    renderRecentMismatches(summary.recentMismatches);

    if (writeEnabled) {
      $('webgame-payout-tools').hidden = false;
      if (!$('webgame-payout-week').value) $('webgame-payout-week').value = summary.weekKey || '';
    }

    const meta = summary.meta || {};
    const excluded = Number(meta.exampleRecordsExcluded || 0);
    $('webgame-status').textContent = '읽기 전용 · ' + text(meta.storageMode, 'local-json')
      + ' · 주차 ' + text(summary.weekKey, '-') + ' · 날짜 ' + text(summary.dayKey, '-')
      + ' · example 데이터 제외' + (excluded > 0 ? ' ' + excluded + '건' : '');
  }

  async function loadWebgameOperations() {
    $('webgame-status').textContent = '웹게임 운영 데이터를 불러오는 중입니다.';
    try {
      renderWebgameOperations(await fetchJson(getWebgameEndpoint()));
    } catch (error) {
      $('webgame-status').textContent = '웹게임 운영 데이터를 불러오지 못했습니다.';
      ['webgame-weekly-match3', 'webgame-weekly-deck', 'webgame-daily-match3', 'webgame-daily-deck', 'webgame-word-distribution', 'webgame-flagged-scores', 'webgame-cheer-stats', 'webgame-replay-mismatches'].forEach(function (id) {
        $(id).innerHTML = '<p class="empty">데이터를 불러오지 못했습니다.</p>';
      });
    }
  }

  function renderSummary(summary) {
    if (summary.title) {
      $('dashboard-title').textContent = summary.title;
      document.title = summary.title;
    }

    $('summary-cards').innerHTML = Object.keys(labels).map(function (key) {
      const suffix = key === 'todayEarnedPoints' ? 'P' : '';
      return '<article class="summary-card"><span>' + labels[key] + '</span><strong>' + text(summary[key], 0) + suffix + '</strong></article>';
    }).join('');

    const meta = summary.meta || summary;
    const excluded = Number(meta.exampleRecordsExcluded || 0);
    const notice = '읽기 전용 · ' + text(meta.storageMode, 'local-json') + ' · example 데이터 제외'
      + (excluded > 0 ? ' ' + excluded + '건' : '');
    $('global-status').textContent = notice;

    const statusCounts = summary.submissionStatusCounts || {};
    $('submission-status-summary').textContent = [
      '대기 ' + text(statusCounts.pending, 0) + '건',
      '승인 ' + text(statusCounts.approved, 0) + '건',
      '반려 ' + text(statusCounts.rejected, 0) + '건',
    ].join(' · ');
  }

  function renderTable(targetId, rows, headers, emptyMessage) {
    if (!Array.isArray(rows) || rows.length === 0) {
      $(targetId).innerHTML = '<p class="empty">' + emptyMessage.replace(/\n/g, '<br>') + '</p>';
      return;
    }

    const head = headers.map(function (header) {
      return '<th>' + escapeHtml(header.label) + '</th>';
    }).join('');
    const body = rows.map(function (row) {
      const cells = headers.map(function (header) {
        return '<td>' + header.render(row) + '</td>';
      }).join('');
      const rowClass = typeof row.rowClass === 'function' ? row.rowClass(row) : '';
      return '<tr class="' + escapeHtml(rowClass) + '">' + cells + '</tr>';
    }).join('');

    $(targetId).innerHTML = '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function renderRedemptions(rows) {
    renderTable('redemptions', rows, [
      { label: '신청 시각', render: function (row) { return escapeHtml(formatDate(row.requestedAt || row.createdAt)); } },
      { label: '신청자', render: function (row) { return escapeHtml(row.displayName || row.userDisplayName || shortId(row.userId)); } },
      { label: '항목', render: function (row) { return escapeHtml(row.itemName || row.itemId); } },
      { label: '포인트', render: function (row) { return escapeHtml(row.cost || 0) + 'P'; } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '신청 ID', render: function (row) { return '<span class="mono">' + escapeHtml(shortId(row.id)) + '</span>'; } },
      { label: '처리', render: function (row) { return actionButtons([
        { name: 'redemption-complete', id: row.id, label: '지급완료' },
        { name: 'redemption-cancel', id: row.id, label: '취소' },
      ]); } },
    ], '현재 교환 대기 항목이 없습니다.\n실제 신청이 접수되면 이곳에 표시됩니다.');
  }

  function renderSubmissions(rows) {
    renderTable('submissions', rows, [
      { label: '제출 시각', render: function (row) { return escapeHtml(formatDate(row.createdAt)); } },
      { label: '제출자', render: function (row) { return escapeHtml(row.displayName || shortId(row.userId)); } },
      { label: '미션', render: function (row) { return escapeHtml(row.missionTitle || row.missionId || '-'); } },
      { label: '예정 포인트', render: function (row) { return escapeHtml(row.rewardPoints || 0) + 'P'; } },
      { label: '첨부', render: function (row) { return row.attachment ? '있음' : '없음'; } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '제출 ID', render: function (row) { return '<span class="mono">' + escapeHtml(shortId(row.id)) + '</span>'; } },
      { label: '처리', render: function (row) { return actionButtons([
        { name: 'submission-approve', id: row.id, label: '승인' },
        { name: 'submission-reject', id: row.id, label: '반려' },
      ]); } },
    ], '현재 인증 대기 항목이 없습니다.\n참여자가 /인증으로 제출하면 이곳에 표시됩니다.');
  }

  function renderTransactions(rows) {
    renderTable('point-transactions', rows, [
      { label: '거래 시각', render: function (row) { return escapeHtml(formatDate(row.createdAt)); } },
      { label: '사용자', render: function (row) { return escapeHtml(row.displayName || shortId(row.userId)); } },
      { label: '타입', render: function (row) { return badge(row.type); } },
      { label: '변화량', render: function (row) { return escapeHtml(row.amount || 0) + 'P'; } },
      { label: '잔액', render: function (row) { return escapeHtml(row.balanceAfter || 0) + 'P'; } },
      { label: '사유', render: function (row) { return escapeHtml(row.reason); } },
      { label: '출처', render: function (row) { return escapeHtml(row.relatedType || '-'); } },
    ], '아직 표시할 포인트 로그가 없습니다.\n체크인, 미션 승인, 교환 처리 후 기록이 표시됩니다.');
  }

  function renderMissions(rows) {
    renderTable('missions', rows, [
      { label: '미션명', render: function (row) { return escapeHtml(row.title || row.id); } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '포인트', render: function (row) { return escapeHtml(row.rewardPoints || 0) + 'P'; } },
      { label: '인증 필요', render: function (row) { return row.requiresSubmission === false ? '아니오' : '예'; } },
      { label: '최근 변경', render: function (row) { return escapeHtml(formatDate(row.updatedAt || row.createdAt)); } },
      { label: '처리', render: function (row) { return actionButtons([
        { name: 'mission-active', id: row.id, label: '활성' },
        { name: 'mission-paused', id: row.id, label: '일시중지' },
      ]); } },
    ], '등록된 운영 미션이 없습니다.\n운영 전 /미션관리 명령어로 미션을 등록해 주세요.');
  }

  function renderShopItems(rows) {
    renderTable('shop-items', rows, [
      { label: '항목명', render: function (row) { return escapeHtml(row.name || row.id); } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '비용', render: function (row) { return escapeHtml(row.cost || 0) + 'P'; } },
      { label: '재고', render: function (row) { return escapeHtml(row.stock === null || row.stock === undefined ? '제한 없음' : row.stock); } },
      { label: '최근 변경', render: function (row) { return escapeHtml(formatDate(row.updatedAt || row.createdAt)); } },
      { label: '처리', render: function (row) { return actionButtons([
        { name: 'shop-active', id: row.id, label: '활성' },
        { name: 'shop-paused', id: row.id, label: '일시중지' },
      ]); } },
    ], '등록된 운영 상점 항목이 없습니다.\n운영 전 /상점관리 명령어로 항목을 등록해 주세요.');
  }

  function renderReactions(rows) {
    renderTable('reaction-approvals', rows, [
      { label: '처리 시각', render: function (row) { return escapeHtml(formatDate(row.reviewedAt || row.createdAt)); } },
      { label: '참여자', render: function (row) { return escapeHtml(row.authorDisplayName || shortId(row.authorId)); } },
      { label: '처리자', render: function (row) { return escapeHtml(row.reviewedByDisplayName || shortId(row.reviewedBy)); } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '포인트', render: function (row) { return escapeHtml(row.rewardPoints || 0) + 'P'; } },
      { label: '원본', render: function (row) { return row.messageUrl ? '<a href="' + escapeHtml(row.messageUrl) + '" target="_blank" rel="noreferrer">열기</a>' : '-'; } },
    ], '아직 반응 승인 기록이 없습니다.\n미션 인증 채널에서 운영자가 승인/반려하면 이곳에 표시됩니다.');
  }

  function renderDmChatLogs(response) {
    const rows = rowsFromResponse(response).map(function (row) {
      return {
        ...row,
        rowClass: function () {
          return row.hasSafetyDetection ? 'safety-row' : '';
        },
      };
    });
    const meta = response && response.meta ? response.meta : {};
    const filters = meta.filters || {};
    const filterText = [
      filters.userId ? '사용자 ' + shortId(filters.userId) : '전체 사용자',
      filters.safetyOnly ? '안전 감지만' : '전체 메시지',
      '최대 ' + text(filters.limit, 20) + '건',
    ].join(' · ');
    $('dm-chat-status').textContent = '읽기 전용 · ' + text(meta.storageMode, 'local-json') + ' · ' + filterText + ' · example 데이터 제외'
      + (Number(meta.exampleRecordsExcluded || 0) > 0 ? ' ' + meta.exampleRecordsExcluded + '건' : '');

    renderTable('dm-chat-logs', rows, [
      { label: '시간', render: function (row) { return escapeHtml(formatDate(row.createdAt)); } },
      { label: '사용자', render: function (row) {
        return '<strong>' + escapeHtml(row.displayName || shortId(row.userId)) + '</strong><br><span class="mono muted">' + escapeHtml(shortId(row.userId)) + '</span>';
      } },
      { label: '역할', render: function (row) { return badge(row.role); } },
      { label: '안전', render: function (row) { return safetyBadge(row.safetyDetection); } },
      { label: '메시지 일부', render: function (row) { return '<span class="message-preview">' + escapeHtml(row.content || '-') + '</span>'; } },
    ], '아직 표시할 DM 대화 로그가 없습니다.\n참여자가 DM 대화 연습을 시작하면 이곳에 최근 메시지가 표시됩니다.');
  }

  function renderDmSafetyReviews(response) {
    const rows = rowsFromResponse(response);
    const counts = response && response.counts ? response.counts : {};
    $('dm-safety-review-status').textContent = '읽기 전용 · pending ' + text(counts.pending, 0)
      + ' · reviewed ' + text(counts.reviewed, 0) + ' · followUp ' + text(counts.followUp, 0)
      + ' · closed ' + text(counts.closed, 0);
    renderTable('dm-safety-reviews', rows, [
      { label: '감지 시각', render: function (row) { return escapeHtml(formatDate(row.detectedAt)); } },
      { label: '사용자', render: function (row) { return escapeHtml(shortId(row.userId)); } },
      { label: '방향', render: function (row) { return badge(row.direction); } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '원본 로그 ID', render: function (row) { return '<span class="mono">' + escapeHtml(shortId(row.sourceLogId)) + '</span>'; } },
    ], '안전 확인 큐 기록이 없습니다. 상태 변경은 Discord /운영현황에서만 진행합니다.');
  }

  async function loadDmChatLogs() {
    $('dm-chat-status').textContent = '읽기 전용 로그를 불러오는 중입니다.';
    try {
      renderDmChatLogs(await fetchJson(getDmChatLogsEndpoint()));
    } catch (error) {
      $('dm-chat-status').textContent = 'DM 대화 로그를 불러오지 못했습니다.';
      $('dm-chat-logs').innerHTML = '<p class="empty">DM 대화 로그를 불러오지 못했습니다.</p>';
    }
  }

  async function loadDashboard() {
    $('global-status').textContent = '데이터를 불러오는 중입니다.';
    try {
      const results = await Promise.all([
        fetchJson(endpoints.capabilities),
        fetchJson(endpoints.summary),
        fetchJson(endpoints.todayQueue),
        fetchJson(endpoints.firstDayCheck),
        fetchJson(endpoints.reactionFollowUps),
        fetchJson(endpoints.onboardingSignals),
        fetchJson(endpoints.faqCandidates),
        fetchJson(endpoints.redemptions),
        fetchJson(endpoints.submissions),
        fetchJson(endpoints.transactions),
        fetchJson(endpoints.missions),
        fetchJson(endpoints.shopItems),
        fetchJson(endpoints.reactions),
        fetchJson(getDmChatLogsEndpoint()),
        fetchJson(endpoints.dmSafetyReviews),
        fetchJson(getWebgameEndpoint()),
      ]);

      writeEnabled = Boolean(results[0].writeEnabled);
      $('console-mode').textContent = writeEnabled ? 'WRITE ENABLED' : 'READ ONLY';
      $('write-tools').hidden = !writeEnabled;
      renderSummary(results[1]);
      renderTodayQueue(results[2]);
      renderFirstDayCheck(results[3]);
      renderReactionFollowUps(results[4]);
      renderOnboardingSignals(results[5]);
      renderFaqCandidates(results[6]);
      renderRedemptions(rowsFromResponse(results[7]));
      renderSubmissions(rowsFromResponse(results[8]));
      renderTransactions(rowsFromResponse(results[9]));
      renderMissions(rowsFromResponse(results[10]));
      renderShopItems(rowsFromResponse(results[11]));
      renderReactions(rowsFromResponse(results[12]));
      renderDmChatLogs(results[13]);
      renderDmSafetyReviews(results[14]);
      renderWebgameOperations(results[15]);

      $('last-updated').textContent = '마지막 갱신: ' + formatDate(new Date().toISOString());
    } catch (error) {
      $('global-status').textContent = '데이터를 불러오지 못했습니다.';
      $('first-day-check').innerHTML = '<li>데이터를 불러오지 못했습니다.</li>';
      $('first-day-actions').innerHTML = '<li>데이터를 불러오지 못했습니다.</li>';
      $('onboarding-signals').innerHTML = '<li>데이터를 불러오지 못했습니다.</li>';
      $('webgame-status').textContent = '웹게임 운영 데이터를 불러오지 못했습니다.';
      ['today-queue-work', 'today-queue-alerts', 'reaction-follow-ups', 'faq-candidates', 'redemptions', 'submissions', 'point-transactions', 'missions', 'shop-items', 'reaction-approvals', 'dm-chat-logs', 'dm-safety-reviews', 'webgame-weekly-match3', 'webgame-weekly-deck', 'webgame-daily-match3', 'webgame-daily-deck', 'webgame-word-distribution', 'webgame-flagged-scores', 'webgame-cheer-stats', 'webgame-replay-mismatches'].forEach(function (id) {
        $(id).innerHTML = '<p class="empty">데이터를 불러오지 못했습니다.</p>';
      });
    }
  }

  $('refresh-button').addEventListener('click', loadDashboard);
  document.addEventListener('click', function (event) {
    const button = event.target.closest('[data-write-action]');
    if (!button) return;
    const action = button.dataset.writeAction;
    const id = button.dataset.writeId;
    const label = button.dataset.writeLabel;
    let url;
    let body;
    let reasonRequired = false;
    if (action.indexOf('redemption-') === 0) {
      url = '/api/admin/redemptions/' + encodeURIComponent(id) + '/status';
      body = { status: action.replace('redemption-', '') };
    } else if (action.indexOf('submission-') === 0) {
      const decision = action.replace('submission-', '');
      url = '/api/admin/submissions/' + encodeURIComponent(id) + '/decision';
      body = { decision: decision };
      reasonRequired = decision === 'reject';
    } else if (action.indexOf('webgame-score-') === 0) {
      url = '/api/admin/webgames/scores/' + encodeURIComponent(id) + '/resolve';
      body = { resolution: action.replace('webgame-score-', '') };
      reasonRequired = true;
    } else if (action.indexOf('mission-') === 0) {
      url = '/api/admin/missions/' + encodeURIComponent(id) + '/status';
      body = { status: action.replace('mission-', '') };
    } else {
      url = '/api/admin/shop-items/' + encodeURIComponent(id) + '/status';
      body = { status: action.replace('shop-', '') };
    }
    requestWrite({ url: url, body: body, summary: label + ' · ' + id, reasonRequired: reasonRequired });
  });
  $('write-cancel').addEventListener('click', function () { $('write-dialog').close(); pendingWrite = null; });
  $('write-dialog-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!pendingWrite) return;
    const reason = $('write-reason').value.trim();
    if (pendingWrite.reasonRequired && !reason) {
      showToast('사유를 입력해 주세요.');
      return;
    }
    const request = pendingWrite;
    pendingWrite = null;
    $('write-dialog').close();
    try {
      const response = await postJson(request.url, { ...request.body, reason: reason || undefined });
      if (response.manualReconciliationRequired) {
        showToast('판정은 저장됐습니다. 이미 지급된 주차이므로 수동 포인트 정정이 필요합니다.');
      } else if (response.partialFailure) {
        showToast('일부 지급이 실패했습니다. 새 미리보기로 실패 건만 다시 시도해 주세요.');
      } else {
        showToast('처리가 완료되었습니다.');
      }
      payoutPreview = null;
      await loadDashboard();
      if (request.url === '/api/admin/webgames/payout') {
        await loadPayoutPreview();
      }
    } catch (error) {
      if (error.code === 'PAYOUT_SNAPSHOT_CHANGED') {
        await loadPayoutPreview();
        showToast('지급 대상이 변경되어 미리보기를 갱신했습니다. 다시 확인해 주세요.');
      } else {
        showToast(error.serverMessage || error.message);
      }
    }
  });
  $('webgame-payout-preview-button').addEventListener('click', loadPayoutPreview);
  $('webgame-payout-execute-button').addEventListener('click', function () {
    if (!payoutPreview) return;
    const totals = payoutPreview.totals || {};
    requestWrite({
      url: '/api/admin/webgames/payout',
      body: { weekKey: payoutPreview.weekKey, snapshotToken: payoutPreview.snapshotToken },
      summary: payoutPreview.weekKey + ' · ' + text(totals.payableCount, 0) + '건 · ' + text(totals.payableAmount, 0) + 'P 지급',
      reasonRequired: true,
    });
  });
  $('points-adjust-form').addEventListener('submit', function (event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    requestWrite({
      url: '/api/admin/points/adjust',
      body: {
        discordId: String(form.get('discordId') || '').trim(),
        displayName: String(form.get('displayName') || '').trim(),
        amount: Number(form.get('amount')),
      },
      reason: String(form.get('reason') || '').trim(),
      summary: '포인트 ' + String(form.get('amount')) + 'P · ' + String(form.get('discordId')),
      reasonRequired: true,
    });
  });
  $('dm-chat-filter-button').addEventListener('click', loadDmChatLogs);
  $('dm-chat-safety-filter').addEventListener('change', loadDmChatLogs);
  $('dm-chat-limit-filter').addEventListener('change', loadDmChatLogs);
  $('dm-chat-user-filter').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      loadDmChatLogs();
    }
  });
  $('webgame-filter-button').addEventListener('click', loadWebgameOperations);
  $('webgame-limit-filter').addEventListener('change', loadWebgameOperations);
  $('webgame-week-filter').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      loadWebgameOperations();
    }
  });
  $('webgame-day-filter').addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      loadWebgameOperations();
    }
  });
  loadDashboard();
}());
