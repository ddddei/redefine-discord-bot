const EXPORT_KIND_ALIASES = {
  all: 'all',
  전체: 'all',
  points: 'points',
  포인트: 'points',
  redemptions: 'redemptions',
  교환: 'redemptions',
  submissions: 'submissions',
  인증: 'submissions',
  missions: 'missions',
  미션: 'missions',
  shop: 'shopItems',
  shopItems: 'shopItems',
  상점: 'shopItems',
  summary: 'summary',
  요약: 'summary',
};

const EXPORT_FORMAT_ALIASES = {
  summary: 'summary',
  요약: 'summary',
  json: 'json',
  JSON: 'json',
  csv: 'csv',
  CSV: 'csv',
};

const KIND_LABELS = {
  all: '전체',
  points: '포인트',
  redemptions: '교환',
  submissions: '인증',
  missions: '미션',
  shopItems: '상점',
  summary: '요약',
};

const FORMAT_LABELS = {
  summary: '요약',
  json: 'JSON',
  csv: 'CSV',
};

const CSV_COLUMNS = {
  points: [
    ['id', '거래ID'],
    ['userId', '사용자ID'],
    ['type', '유형'],
    ['amount', '증감'],
    ['balanceAfter', '잔액'],
    ['reason', '사유'],
    ['relatedType', '연결유형'],
    ['relatedId', '연결ID'],
    ['createdBy', '생성자'],
    ['createdAt', '생성일시'],
    ['note', '메모'],
  ],
  redemptions: [
    ['id', '신청ID'],
    ['userId', '사용자ID'],
    ['itemId', '항목ID'],
    ['cost', '비용'],
    ['status', '상태'],
    ['requestedAt', '신청일시'],
    ['completedAt', '완료일시'],
    ['cancelledAt', '취소일시'],
    ['refundedAt', '환불일시'],
    ['reviewedAt', '처리일시'],
    ['reviewedBy', '처리자'],
    ['transactionId', '거래ID'],
    ['refundTransactionId', '환불거래ID'],
    ['note', '메모'],
    ['reviewNote', '운영처리메모'],
    ['reviewHistory', '처리이력'],
  ],
  submissions: [
    ['id', '제출ID'],
    ['type', '유형'],
    ['missionId', '미션ID'],
    ['userId', '사용자ID'],
    ['displayName', '표시이름'],
    ['content', '내용'],
    ['status', '상태'],
    ['reviewedBy', '검토자'],
    ['createdAt', '제출일시'],
    ['reviewedAt', '검토일시'],
    ['rewardTransactionId', '지급거래ID'],
    ['note', '메모'],
  ],
  missions: [
    ['id', '미션ID'],
    ['title', '제목'],
    ['description', '설명'],
    ['rewardPoints', '지급포인트'],
    ['activeDate', '날짜'],
    ['startAt', '시작일시'],
    ['endAt', '종료일시'],
    ['status', '상태'],
    ['requiresSubmission', '인증필요'],
    ['maxPerUser', '사용자별최대'],
    ['createdAt', '생성일시'],
    ['updatedAt', '수정일시'],
    ['note', '메모'],
  ],
  shopItems: [
    ['id', '항목ID'],
    ['name', '이름'],
    ['description', '설명'],
    ['cost', '비용'],
    ['stock', '재고'],
    ['monthlyLimit', '월한도'],
    ['status', '상태'],
    ['type', '유형'],
    ['createdAt', '생성일시'],
    ['updatedAt', '수정일시'],
    ['note', '메모'],
  ],
  summary: [
    ['metric', '항목'],
    ['value', '값'],
  ],
  all: [
    ['collection', '종류'],
    ['id', 'ID'],
    ['status', '상태'],
    ['userId', '사용자ID'],
    ['createdAt', '생성일시'],
    ['data', '데이터'],
  ],
};

function truncateForDiscord(text, limit = 1900) {
  const value = String(text || '');

  if (value.length <= limit) {
    return value;
  }

  const suffix = '\n\n... Discord 표시 길이에 맞춰 일부만 표시했어요.';
  if (suffix.length >= limit) {
    return value.slice(0, limit);
  }

  return `${value.slice(0, limit - suffix.length)}${suffix}`;
}

function toSafeJson(data) {
  return JSON.stringify(data, null, 2);
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const normalized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

function toCsv(rows, columns) {
  const header = columns.map(([, label]) => csvEscape(label)).join(',');
  const body = rows.map((row) => {
    return columns.map(([key]) => csvEscape(row[key])).join(',');
  });

  return [header, ...body].join('\n');
}

function normalizeExportKind(kind) {
  return EXPORT_KIND_ALIASES[kind] || 'summary';
}

function normalizeExportFormat(format) {
  return EXPORT_FORMAT_ALIASES[format] || 'summary';
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTimestampForFilename(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    '-',
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join('');
}

function buildExportFilename(kind, format, now = new Date()) {
  const normalizedKind = normalizeExportKind(kind);
  const normalizedFormat = normalizeExportFormat(format);
  const extension = normalizedFormat === 'csv' ? 'csv' : 'json';
  return `operation-export-${normalizedKind}-${formatTimestampForFilename(now)}.${extension}`;
}

function getRowsForKind(data, kind) {
  if (kind === 'points') return data.pointTransactions || [];
  if (kind === 'redemptions') return data.redemptions || [];
  if (kind === 'submissions') return data.submissions || [];
  if (kind === 'missions') return data.missions || [];
  if (kind === 'shopItems') return data.shopItems || [];
  if (kind === 'summary') return summaryToRows(data.summary || data);
  if (kind === 'all') return allToRows(data);
  return [];
}

function summaryToRows(summary) {
  return [
    ['사용자 수', summary.usersCount],
    ['포인트 거래 수', summary.pointTransactionsCount],
    ['교환 신청 수', summary.redemptionsCount],
    ['교환 대기 수', summary.pendingRedemptionsCount],
    ['인증 제출 수', summary.submissionsCount],
    ['인증 대기 수', summary.pendingSubmissionsCount],
    ['미션 수', summary.missionsCount],
    ['활성 미션 수', summary.activeMissionsCount],
    ['상점 항목 수', summary.shopItemsCount],
    ['활성 상점 항목 수', summary.activeShopItemsCount],
    ['오늘 체크인 수', summary.todayCheckinsCount],
  ].map(([metric, value]) => ({ metric, value: value ?? 0 }));
}

function allToRows(data) {
  const collections = [
    ['points', data.points && data.points.pointTransactions],
    ['redemptions', data.redemptions && data.redemptions.redemptions],
    ['submissions', data.submissions && data.submissions.submissions],
    ['missions', data.missions && data.missions.missions],
    ['shopItems', data.shopItems && data.shopItems.shopItems],
  ];
  const rows = [];

  for (const [collection, items] of collections) {
    for (const item of Array.isArray(items) ? items : []) {
      rows.push({
        collection,
        id: item.id || '',
        status: item.status || item.type || '',
        userId: item.userId || '',
        createdAt: item.createdAt || item.requestedAt || item.updatedAt || '',
        data: item,
      });
    }
  }

  return rows;
}

function buildSummaryExport(data, options = {}) {
  const kind = normalizeExportKind(options.kind || data.kind);
  const rows = getRowsForKind(data, kind);
  const summary = data.summary || data;
  const lines = [
    `종류: ${KIND_LABELS[kind] || kind}`,
    `포함 개수: ${rows.length}`,
    `생성 시간: ${options.generatedAt || data.generatedAt || new Date().toISOString()}`,
    '',
    '운영 요약',
    `- 사용자: ${summary.usersCount ?? 0}명`,
    `- 포인트 거래: ${summary.pointTransactionsCount ?? 0}건`,
    `- 교환 신청: ${summary.redemptionsCount ?? 0}건 (대기 ${summary.pendingRedemptionsCount ?? 0}건)`,
    `- 인증 제출: ${summary.submissionsCount ?? 0}건 (대기 ${summary.pendingSubmissionsCount ?? 0}건)`,
    `- 미션: ${summary.missionsCount ?? 0}개 (활성 ${summary.activeMissionsCount ?? 0}개)`,
    `- 상점 항목: ${summary.shopItemsCount ?? 0}개 (활성 ${summary.activeShopItemsCount ?? 0}개)`,
    `- 오늘 체크인: ${summary.todayCheckinsCount ?? 0}건`,
    '',
    '내보낸 파일과 내용에는 개인정보 또는 운영 데이터가 포함될 수 있어요.',
    '안전한 내부 저장소에 보관하고 외부 공유 전 포함 정보를 반드시 확인해 주세요.',
  ];

  return truncateForDiscord(lines.join('\n'), options.limit || 3900);
}

function buildJsonExport(data, options = {}) {
  const generatedAt = options.generatedAt || data.generatedAt || new Date().toISOString();
  return toSafeJson({
    exportedAt: generatedAt,
    kind: normalizeExportKind(options.kind || data.kind),
    limit: options.limit,
    data,
  });
}

function buildCsvExport(data, options = {}) {
  const kind = normalizeExportKind(options.kind || data.kind);
  const rows = getRowsForKind(data, kind);
  return toCsv(rows, CSV_COLUMNS[kind] || CSV_COLUMNS.summary);
}

function buildOperationExportPayload(repository, options = {}) {
  const now = options.now || new Date();
  const generatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const kind = normalizeExportKind(options.kind);
  const format = normalizeExportFormat(options.format);
  const limit = Math.min(200, Math.max(1, Number(options.limit || 50)));
  const data = repository.getExportData(kind, limit);
  const summaryText = buildSummaryExport(data, {
    kind,
    generatedAt,
    limit: 3900,
  });

  if (format === 'summary') {
    return {
      kind,
      kindLabel: KIND_LABELS[kind] || kind,
      format,
      formatLabel: FORMAT_LABELS[format],
      limit,
      generatedAt,
      content: summaryText,
      summaryText,
      data,
      isAttachment: false,
      rowCount: getRowsForKind(data, kind).length,
    };
  }

  const content = format === 'csv'
    ? buildCsvExport(data, { kind, limit, generatedAt })
    : buildJsonExport(data, { kind, limit, generatedAt });
  const filename = buildExportFilename(kind, format, now);

  return {
    kind,
    kindLabel: KIND_LABELS[kind] || kind,
    format,
    formatLabel: FORMAT_LABELS[format],
    limit,
    generatedAt,
    filename,
    content,
    buffer: Buffer.from(content, 'utf8'),
    summaryText,
    data,
    isAttachment: true,
    rowCount: getRowsForKind(data, kind).length,
  };
}

module.exports = {
  buildCsvExport,
  buildExportFilename,
  buildJsonExport,
  buildOperationExportPayload,
  buildSummaryExport,
  formatTimestampForFilename,
  normalizeExportFormat,
  normalizeExportKind,
  toCsv,
  toSafeJson,
  truncateForDiscord,
};
