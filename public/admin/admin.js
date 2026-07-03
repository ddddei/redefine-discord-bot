(function () {
  const endpoints = {
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
    dmChatLogs: '/api/admin/dm-chat-logs?limit=20',
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
    ], '등록된 운영 미션이 없습니다.\n운영 전 /미션관리 명령어로 미션을 등록해 주세요.');
  }

  function renderShopItems(rows) {
    renderTable('shop-items', rows, [
      { label: '항목명', render: function (row) { return escapeHtml(row.name || row.id); } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '비용', render: function (row) { return escapeHtml(row.cost || 0) + 'P'; } },
      { label: '재고', render: function (row) { return escapeHtml(row.stock === null || row.stock === undefined ? '제한 없음' : row.stock); } },
      { label: '최근 변경', render: function (row) { return escapeHtml(formatDate(row.updatedAt || row.createdAt)); } },
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
    $('dm-chat-status').textContent = '읽기 전용 · ' + text(meta.storageMode, 'local-json') + ' · example 데이터 제외'
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

  async function loadDashboard() {
    $('global-status').textContent = '데이터를 불러오는 중입니다.';
    try {
      const results = await Promise.all([
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
        fetchJson(endpoints.dmChatLogs),
      ]);

      renderSummary(results[0]);
      renderTodayQueue(results[1]);
      renderFirstDayCheck(results[2]);
      renderReactionFollowUps(results[3]);
      renderOnboardingSignals(results[4]);
      renderFaqCandidates(results[5]);
      renderRedemptions(rowsFromResponse(results[6]));
      renderSubmissions(rowsFromResponse(results[7]));
      renderTransactions(rowsFromResponse(results[8]));
      renderMissions(rowsFromResponse(results[9]));
      renderShopItems(rowsFromResponse(results[10]));
      renderReactions(rowsFromResponse(results[11]));
      renderDmChatLogs(results[12]);

      $('last-updated').textContent = '마지막 갱신: ' + formatDate(new Date().toISOString());
    } catch (error) {
      $('global-status').textContent = '데이터를 불러오지 못했습니다.';
      $('first-day-check').innerHTML = '<li>데이터를 불러오지 못했습니다.</li>';
      $('first-day-actions').innerHTML = '<li>데이터를 불러오지 못했습니다.</li>';
      $('onboarding-signals').innerHTML = '<li>데이터를 불러오지 못했습니다.</li>';
      ['today-queue-work', 'today-queue-alerts', 'reaction-follow-ups', 'faq-candidates', 'redemptions', 'submissions', 'point-transactions', 'missions', 'shop-items', 'reaction-approvals', 'dm-chat-logs'].forEach(function (id) {
        $(id).innerHTML = '<p class="empty">데이터를 불러오지 못했습니다.</p>';
      });
    }
  }

  $('refresh-button').addEventListener('click', loadDashboard);
  loadDashboard();
}());
