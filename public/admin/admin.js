(function () {
  const endpoints = {
    summary: '/api/admin/summary',
    redemptions: '/api/admin/redemptions?status=pending&limit=10',
    submissions: '/api/admin/submissions?status=pending&limit=10',
    transactions: '/api/admin/point-transactions?limit=10',
    missions: '/api/admin/missions?limit=10',
    shopItems: '/api/admin/shop-items?limit=10',
    reactions: '/api/admin/reaction-approvals?limit=10',
  };

  const labels = {
    usersCount: '사용자 수',
    todayPointTransactionsCount: '오늘 포인트 거래',
    todayEarnedPoints: '오늘 지급 포인트',
    pendingRedemptionsCount: '교환 대기',
    pendingSubmissionsCount: '인증 대기',
    activeMissionsCount: '활성 미션',
    activeShopItemsCount: '활성 상점 항목',
    todayReactionApprovalsCount: '오늘 반응 승인',
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

  function renderSummary(summary) {
    if (summary.title) {
      $('dashboard-title').textContent = summary.title;
      document.title = summary.title;
    }

    $('summary-cards').innerHTML = Object.keys(labels).map(function (key) {
      const suffix = key === 'todayEarnedPoints' ? 'P' : '';
      return '<article class="summary-card"><span>' + labels[key] + '</span><strong>' + text(summary[key], 0) + suffix + '</strong></article>';
    }).join('');
  }

  function renderTable(targetId, rows, headers, emptyMessage) {
    if (!Array.isArray(rows) || rows.length === 0) {
      $(targetId).innerHTML = '<p class="empty">' + emptyMessage + '</p>';
      return;
    }

    const head = headers.map(function (header) {
      return '<th>' + escapeHtml(header.label) + '</th>';
    }).join('');
    const body = rows.map(function (row) {
      const cells = headers.map(function (header) {
        return '<td>' + header.render(row) + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
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
    ], '현재 교환 대기 항목이 없습니다.');
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
    ], '현재 인증 대기 항목이 없습니다.');
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
    ], '최근 포인트 로그가 없습니다.');
  }

  function renderMissions(rows) {
    renderTable('missions', rows, [
      { label: '미션명', render: function (row) { return escapeHtml(row.title || row.id); } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '포인트', render: function (row) { return escapeHtml(row.rewardPoints || 0) + 'P'; } },
      { label: '인증 필요', render: function (row) { return row.requiresSubmission === false ? '아니오' : '예'; } },
      { label: '최근 변경', render: function (row) { return escapeHtml(formatDate(row.updatedAt || row.createdAt)); } },
    ], '등록된 미션이 없습니다.');
  }

  function renderShopItems(rows) {
    renderTable('shop-items', rows, [
      { label: '항목명', render: function (row) { return escapeHtml(row.name || row.id); } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '비용', render: function (row) { return escapeHtml(row.cost || 0) + 'P'; } },
      { label: '재고', render: function (row) { return escapeHtml(row.stock === null || row.stock === undefined ? '제한 없음' : row.stock); } },
      { label: '최근 변경', render: function (row) { return escapeHtml(formatDate(row.updatedAt || row.createdAt)); } },
    ], '등록된 상점 항목이 없습니다.');
  }

  function renderReactions(rows) {
    renderTable('reaction-approvals', rows, [
      { label: '처리 시각', render: function (row) { return escapeHtml(formatDate(row.reviewedAt || row.createdAt)); } },
      { label: '참여자', render: function (row) { return escapeHtml(row.authorDisplayName || shortId(row.authorId)); } },
      { label: '처리자', render: function (row) { return escapeHtml(row.reviewedByDisplayName || shortId(row.reviewedBy)); } },
      { label: '상태', render: function (row) { return badge(row.status); } },
      { label: '포인트', render: function (row) { return escapeHtml(row.rewardPoints || 0) + 'P'; } },
      { label: '원본', render: function (row) { return row.messageUrl ? '<a href="' + escapeHtml(row.messageUrl) + '" target="_blank" rel="noreferrer">열기</a>' : '-'; } },
    ], '최근 반응 승인 기록이 없습니다.');
  }

  async function loadDashboard() {
    $('global-status').textContent = '데이터를 불러오는 중입니다.';
    try {
      const results = await Promise.all([
        fetchJson(endpoints.summary),
        fetchJson(endpoints.redemptions),
        fetchJson(endpoints.submissions),
        fetchJson(endpoints.transactions),
        fetchJson(endpoints.missions),
        fetchJson(endpoints.shopItems),
        fetchJson(endpoints.reactions),
      ]);

      renderSummary(results[0]);
      renderRedemptions(results[1]);
      renderSubmissions(results[2]);
      renderTransactions(results[3]);
      renderMissions(results[4]);
      renderShopItems(results[5]);
      renderReactions(results[6]);

      $('last-updated').textContent = '마지막 갱신: ' + formatDate(new Date().toISOString());
      $('global-status').textContent = '읽기 전용 데이터입니다.';
    } catch (error) {
      $('global-status').textContent = '데이터를 불러오지 못했습니다.';
      ['redemptions', 'submissions', 'point-transactions', 'missions', 'shop-items', 'reaction-approvals'].forEach(function (id) {
        $(id).innerHTML = '<p class="empty">데이터를 불러오지 못했습니다.</p>';
      });
    }
  }

  $('refresh-button').addEventListener('click', loadDashboard);
  loadDashboard();
}());
