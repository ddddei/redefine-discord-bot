const { EmbedBuilder } = require('discord.js');
const {
  fallbackChannelGuide,
  fallbackContactNoticeTemplate,
  loadChannelGuide,
  noticeTemplates,
} = require('./data');

const EMBED_COLOR = 0x8f7a5f;
const EMBED_DESCRIPTION_LIMIT = 4096;
const EMBED_FIELD_VALUE_LIMIT = 1024;
const EMBED_FOOTER_LIMIT = 2048;
const TRUNCATED_SUFFIX = '\n\n내용이 길어 일부만 표시했어요. 필요한 경우 운영진에게 알려주세요.';
const DEFAULT_FOOTER = '리디파인 가이드 봇';
const OPERATOR_CHECK_FOOTER = '세부 내용은 운영진 안내를 기준으로 확인해 주세요.';

function truncateText(text, maxLength, fallbackText = '') {
  const value = String(text || '').trim();

  if (!value) {
    return fallbackText;
  }

  if (value.length <= maxLength) {
    return value;
  }

  const suffix = TRUNCATED_SUFFIX.length < maxLength ? TRUNCATED_SUFFIX : '...';
  return `${value.slice(0, maxLength - suffix.length)}${suffix}`;
}

function truncateEmbedValue(text, maxLength = 1000) {
  return truncateText(text, Math.min(maxLength, EMBED_FIELD_VALUE_LIMIT), '(질문 내용 없음)');
}

function createGuideEmbed(title, description, options = {}) {
  return new EmbedBuilder()
    .setColor(options.color || EMBED_COLOR)
    .setTitle(truncateText(title, 256, '리디파인 안내'))
    .setDescription(truncateText(description, EMBED_DESCRIPTION_LIMIT, '안내 내용을 불러오지 못했어요. 운영진에게 알려주세요.'))
    .setFooter({
      text: truncateText(options.footer || DEFAULT_FOOTER, EMBED_FOOTER_LIMIT, DEFAULT_FOOTER),
    });
}

function createKnowledgeEmbed(item) {
  return createGuideEmbed(
    item.title,
    [
      item.summary,
      '',
      item.content,
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function formatPoints(points) {
  const value = typeof points === 'number' && Number.isFinite(points) ? points : 0;
  return `${value}P`;
}

function formatTransactionAmount(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '0P';
  }

  return `${amount > 0 ? '+' : ''}${amount}P`;
}

function formatTransactionDate(createdAt) {
  if (!createdAt) {
    return '날짜 없음';
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '날짜 없음';
  }

  return date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatTransactionDateTime(createdAt) {
  if (!createdAt) {
    return '날짜 없음';
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return '날짜 없음';
  }

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatStatusCounts(counts = {}) {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return '없음';
  }

  return entries.map(([status, count]) => `${status} ${count}개`).join(' / ');
}

function formatAttachmentSummary(attachment) {
  if (!attachment) {
    return '없음';
  }

  if (typeof attachment === 'string') {
    return attachment.trim() ? '있음' : '없음';
  }

  if (attachment.url || attachment.name || attachment.id) {
    return attachment.name ? `있음(${truncateText(attachment.name, 40, '첨부파일')})` : '있음';
  }

  return '없음';
}

function createPointBalanceEmbed({ currentPoints, transactions = [], balanceCheck }) {
  const recentTransactions = transactions.slice(0, 3);
  const transactionLines = recentTransactions.length > 0
    ? recentTransactions.map((transaction) => {
      const amount = formatTransactionAmount(transaction.amount);
      const reason = truncateText(transaction.reason, 80, '포인트 기록');
      return `- ${formatTransactionDate(transaction.createdAt)} ${amount} ${reason}`;
    })
    : ['아직 기록된 여정 포인트가 없어요.'];
  const balanceNote = balanceCheck && balanceCheck.ok === false
    ? [
      '',
      '저장된 포인트와 기록 합계가 달라 운영진 확인이 필요해요.',
    ]
    : [];

  return createGuideEmbed(
    '내 여정 포인트',
    [
      `현재 보유 여정 포인트: **${formatPoints(currentPoints)}**`,
      '',
      '최근 기록',
      ...transactionLines,
      ...balanceNote,
      '',
      '여정 포인트는 참여를 돕는 선택형 요소이며, 비교나 경쟁을 위한 점수가 아니에요.',
      '체크인, 미션, 상점 이용 내역을 여기에서 가볍게 확인할 수 있어요.',
    ].join('\n')
  );
}

function createGuideHubEmbed() {
  return createGuideEmbed(
    '처음 오셨다면 여기서 시작해요',
    [
      '리디파인 봇은 미션, 포인트, 상점 이용을 도와주는 안내 봇이에요.',
      '아래 메뉴에서 궁금한 내용을 골라 확인해 주세요.',
      '',
      '처음에는 `/안내`, `/포인트`, `/미션`, `/상점`, `/체크인` 정도만 기억해도 충분해요.',
    ].join('\n')
  );
}

function createGuideHubDetailEmbed(value, options = {}) {
  const currentPoints = formatPoints(options.currentPoints);
  const activeMissionCount = typeof options.activeMissionCount === 'number'
    ? options.activeMissionCount
    : null;

  const details = {
    start: {
      title: '처음 안내',
      description: [
        '처음에는 천천히 둘러봐도 괜찮아요.',
        '',
        '리디파인 디스코드는 안내, 미션, 포인트, 상점, 문의가 한곳에 모여 있는 공간이에요.',
        '모든 활동은 강제 과제가 아니라, 가능한 범위에서 참여하는 선택형 활동입니다.',
        '',
        '먼저 해볼 수 있는 것:',
        '- `/체크인`으로 오늘의 상태를 가볍게 남기기',
        '- `/미션`에서 참여 가능한 활동 확인하기',
        '- `/포인트`로 내 여정 포인트 확인하기',
        '- `/상점`에서 교환 가능한 항목 둘러보기',
      ].join('\n'),
    },
    today: {
      title: '오늘 뭐 하면 되나요?',
      description: [
        '오늘은 이렇게 시작해도 좋아요.',
        '',
        ...(activeMissionCount === null ? [] : [`현재 참여 가능한 미션: ${activeMissionCount}개`, '']),
        '1. `/체크인`으로 오늘의 상태를 가볍게 남겨요.',
        '2. `/미션`에서 참여 가능한 미션을 확인해요.',
        '3. 인증이 필요한 활동은 미션 인증 채널에 올려요.',
        '4. 운영진 확인 후 포인트가 지급돼요.',
        '5. `/포인트`로 내 포인트를 확인해요.',
      ].join('\n'),
    },
    points: {
      title: '내 포인트',
      description: [
        '여정 포인트는 참여를 기록하기 위한 작은 보상이에요.',
        '',
        '포인트는 경쟁이나 순위를 위한 점수가 아니에요.',
        '체크인, 미션 참여, 프로그램 활동 등을 통해 받을 수 있고, 운영진이 정한 항목으로 교환할 수 있어요.',
        '',
        `현재 내 포인트: ${currentPoints}`,
        '',
        '확인 방법:',
        '- `/포인트`로 내 포인트 확인',
        '- `/상점`으로 교환 가능한 항목 확인',
      ].join('\n'),
    },
    shop: {
      title: '상점/교환',
      description: [
        '상점에서는 여정 포인트로 교환 가능한 항목을 볼 수 있어요.',
        '',
        '사용 방법:',
        '1. `/상점` 또는 `/교환`을 입력해요.',
        '2. 목록에서 원하는 항목을 선택해요.',
        '3. 신청 전 내용을 한 번 더 확인해요.',
        '4. 교환 신청이 접수되면 운영진이 순차적으로 확인해요.',
        '',
        '안내:',
        '- 선택만으로는 포인트가 차감되지 않아요.',
        '- 교환 신청을 완료하면 포인트가 차감돼요.',
        '- 단순 변심에 따른 취소나 환불은 원칙적으로 어려울 수 있어요.',
      ].join('\n'),
    },
    mission: {
      title: '미션/인증',
      description: [
        '미션은 가능한 범위에서 참여하는 선택형 활동이에요.',
        '',
        '기본 참여 방법:',
        '1. `/미션`으로 참여 가능한 미션을 확인해요.',
        '2. 미션 인증 채널에 글, 사진, 영상을 올려요.',
        '3. 운영진이 확인하면 ✅ 반응으로 승인해요.',
        '4. 승인되면 여정 포인트가 지급돼요.',
        '5. 지급 여부는 DM 또는 `/포인트`에서 확인할 수 있어요.',
        '',
        '보조 방법:',
        '직접 제출이 필요한 경우에는 `/인증` 명령어를 사용할 수 있어요.',
      ].join('\n'),
    },
    question: {
      title: '문의하기',
      description: [
        '궁금한 점은 편하게 남겨 주세요.',
        '',
        '가벼운 질문은 `/질문`으로 물어볼 수 있어요.',
        '운영진 확인이 필요한 내용은 운영진 문의 채널을 이용해 주세요.',
        '',
        '예시:',
        '- 프로그램 일정이 궁금해요.',
        '- 포인트가 지급되지 않은 것 같아요.',
        '- 교환 신청을 확인하고 싶어요.',
        '- 미션 인증 방법이 헷갈려요.',
        '',
        '민감한 개인정보는 공개 채널에 자세히 남기지 않는 편이 좋아요.',
        '위기 표현이나 긴급한 안전 문제가 담긴 문의는 운영진이 확인할 수 있어요.',
      ].join('\n'),
    },
  };

  const detail = details[value] || details.start;

  return createGuideEmbed(detail.title, detail.description);
}

function buildOperatorHubEmbed(summary = {}) {
  const recentLogLines = Array.isArray(summary.recentTransactions) && summary.recentTransactions.length > 0
    ? summary.recentTransactions.slice(0, 3).map((transaction) => {
      return `- ${formatTransactionDate(transaction.createdAt)} ${truncateText(transaction.userId, 24, '사용자')} ${formatTransactionAmount(transaction.amount)} ${truncateText(transaction.reason, 50, '포인트 기록')}`;
    })
    : ['최근 포인트 로그가 없어요.'];
  const needs = [
    `교환 대기 ${summary.pendingRedemptionsCount || 0}건`,
    `인증 대기 ${summary.pendingSubmissionsCount || 0}건`,
    `오늘 반응 승인 ${summary.todayReactionApprovalsCount || 0}건`,
  ];

  return createGuideEmbed(
    '운영 현황 허브',
    [
      '현재 운영 상태를 한눈에 확인할 수 있어요.',
      '아래 요약을 확인한 뒤 필요한 메뉴를 선택해 주세요.',
      '',
      '오늘의 운영 큐',
      `- 교환 대기 ${summary.pendingRedemptionsCount || 0}건`,
      `- 인증 대기 ${summary.pendingSubmissionsCount || 0}건`,
      `- 오늘 반응 승인 ${summary.todayReactionApprovalsCount || 0}건`,
      `- 오늘 포인트 거래 ${summary.todayPointTransactionsCount || 0}건`,
      '',
      `전체 사용자: ${summary.usersCount || 0}명`,
      `총 포인트 거래: ${summary.pointTransactionsCount || 0}건`,
      `교환 대기: ${summary.pendingRedemptionsCount || 0}건`,
      `인증 대기: ${summary.pendingSubmissionsCount || 0}건`,
      `인증 처리: 승인 ${(summary.submissionStatusCounts && summary.submissionStatusCounts.approved) || 0}건 / 반려 ${(summary.submissionStatusCounts && summary.submissionStatusCounts.rejected) || 0}건`,
      `활성 미션: ${summary.activeMissionsCount || 0}개`,
      `활성 상점 항목: ${summary.activeShopItemsCount || 0}개`,
      `오늘 체크인: ${summary.todayCheckinsCount || 0}건`,
      `오늘 반응 승인: ${summary.todayReactionApprovalsCount || 0}건`,
      `오늘 포인트 거래: ${summary.todayPointTransactionsCount || 0}건`,
      '',
      '확인 필요 항목',
      ...needs.map((line) => `- ${line}`),
      '',
      '최근 포인트 로그',
      ...recentLogLines,
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function formatQueueItemDate(record, fields) {
  const value = fields.map((field) => record && record[field]).find(Boolean);
  return formatTransactionDateTime(value);
}

function buildOperatorTodayQueueEmbed(queue = {}) {
  const counts = queue.counts || {};
  const redemptions = Array.isArray(queue.pendingRedemptions) ? queue.pendingRedemptions : [];
  const submissions = Array.isArray(queue.pendingSubmissions) ? queue.pendingSubmissions : [];
  const reactions = Array.isArray(queue.todayReactionApprovals) ? queue.todayReactionApprovals : [];
  const transactions = Array.isArray(queue.todayPointTransactions) ? queue.todayPointTransactions : [];
  const followUps = Array.isArray(queue.followUps) ? queue.followUps : [];
  const qaWarnings = Array.isArray(queue.qaWarnings) ? queue.qaWarnings : [];
  const redemptionLines = redemptions.length > 0
    ? redemptions.slice(0, 3).map((redemption) => {
      return `- ${truncateText(redemption.itemName || redemption.itemId, 42, '교환 항목')} / ${truncateText(redemption.displayName || redemption.userId, 32, '신청자')} / \`${truncateText(redemption.id, 48, '신청 ID')}\``;
    })
    : ['- 교환 대기 없음'];
  const submissionLines = submissions.length > 0
    ? submissions.slice(0, 3).map((submission) => {
      return `- ${truncateText(submission.missionTitle || submission.missionId, 42, '미션')} / ${truncateText(submission.displayName || submission.userId, 32, '제출자')} / \`${truncateText(submission.id, 48, '제출 ID')}\``;
    })
    : ['- 인증 대기 없음'];
  const reactionLines = reactions.length > 0
    ? reactions.slice(0, 3).map((record) => {
      return `- ${formatQueueItemDate(record, ['reviewedAt', 'createdAt'])} / ${truncateText(record.authorDisplayName || record.authorId, 28, '참여자')} / ${record.status || '상태 없음'}`;
    })
    : ['- 오늘 처리된 반응 승인/반려 없음'];
  const transactionLines = transactions.length > 0
    ? transactions.slice(0, 3).map((transaction) => {
      return `- ${formatQueueItemDate(transaction, ['createdAt'])} / ${formatTransactionAmount(transaction.amount)} / ${truncateText(transaction.reason, 42, '사유')}`;
    })
    : ['- 오늘 포인트 거래 없음'];
  const followUpLines = followUps.length > 0
    ? followUps.slice(0, 3).map((item) => `- ${truncateText(item.message, 90, '후속 확인')}`)
    : ['- 알림 실패 후속 확인 없음'];
  const warningLines = qaWarnings.length > 0
    ? qaWarnings.slice(0, 4).map((warning) => `- ${truncateText(warning.message, 90, 'QA 경고')}`)
    : ['- 오래된 pending 또는 중복 경고 없음'];

  return createGuideEmbed(
    '오늘의 운영 큐',
    [
      '운영자가 오늘 먼저 확인할 읽기 전용 큐입니다.',
      '지금 처리할 항목을 보고 실제 처리는 기존 관리 명령어에서 진행해 주세요.',
      '',
      `교환 대기 ${counts.pendingRedemptions || 0}건 / 인증 대기 ${counts.pendingSubmissions || 0}건`,
      `오늘 반응 승인 ${counts.todayReactionApprovals || 0}건 / 오늘 포인트 거래 ${counts.todayPointTransactions || 0}건`,
      `후속 확인 ${counts.followUps || 0}건 / QA 경고 ${counts.qaWarnings || 0}건`,
      '',
      '교환 대기',
      ...redemptionLines,
      '',
      '인증 대기',
      ...submissionLines,
      '',
      '오늘 반응 승인/반려',
      ...reactionLines,
      '',
      '오늘 포인트 거래',
      ...transactionLines,
      '',
      '후속 확인',
      ...followUpLines,
      '',
      'QA 경고',
      ...warningLines,
      '',
      '처리 명령어: `/교환관리`, `/인증관리`, `/포인트로그`, `/운영내보내기`',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function formatChannelReadySummary(checks = []) {
  if (!checks.length) {
    return 'Discord 채널 실시간 점검은 `/운영현황` Discord 화면에서 확인해 주세요.';
  }

  const readyCount = checks.filter(isChannelReady).length;
  const issueLines = checks
    .filter((check) => !isChannelReady(check) && check.required)
    .slice(0, 4)
    .map((check) => `- ${check.envName}: ${check.configured ? '권한 확인 필요' : '미설정'}`);

  return [
    `점검 채널 ${checks.length}개 중 ${readyCount}개 전송 가능`,
    ...(issueLines.length > 0 ? issueLines : ['- 필수 채널 설정에서 큰 경고 없음']),
  ].join('\n');
}

function buildOperatorFirstDayCheckEmbed(check = {}) {
  const sheets = check.googleSheetsCheck || {};
  const backupLine = check.backupReminderEnabled
    ? '백업 리마인더: 켜짐'
    : '백업 리마인더: 꺼짐 - 운영 종료 전 `/운영내보내기`를 직접 확인해 주세요.';
  const riskLabels = {
    critical: '치명',
    warning: '주의',
    optional: '선택',
  };
  const riskLines = Array.isArray(check.riskChecks) && check.riskChecks.length > 0
    ? check.riskChecks.slice(0, 8).map((risk) => {
      const label = riskLabels[risk.level] || '확인';
      const command = risk.command ? ` (${risk.command})` : '';
      return `- [${label}] ${risk.title}: ${risk.detail}${command}`;
    })
    : ['- [선택] 큰 사전 경고 없음: 실제 Discord 리허설로 마지막 흐름을 확인해 주세요.'];
  const actionLines = Array.isArray(check.todayActions) && check.todayActions.length > 0
    ? check.todayActions.slice(0, 5).map((action) => `- ${action}`)
    : [
      '- `/미션관리`와 `/상점관리`에서 active 항목을 확인합니다.',
      '- `/운영내보내기 종류:전체 형식:JSON`으로 백업 파일을 확보합니다.',
    ];

  return createGuideEmbed(
    '첫날 점검',
    [
      '첫 운영 전 불안을 줄이기 위한 읽기 전용 점검 화면입니다.',
      '이 화면은 설정이나 데이터를 수정하지 않습니다.',
      '',
      '환경변수/채널 설정',
      formatChannelReadySummary(check.channelChecks || []),
      `Google Sheets 보조 로그: ${sheets.loggingEnabled ? '켜짐' : '꺼짐'} / Web App URL ${sheets.webAppUrlConfigured ? '설정됨' : '미설정'}`,
      '',
      '운영 데이터',
      `- active 미션: ${check.activeMissionsCount || 0}개`,
      `- active 상점: ${check.activeShopItemsCount || 0}개`,
      `- 교환 대기: ${check.pendingRedemptionsCount || 0}건`,
      `- 인증 대기: ${check.pendingSubmissionsCount || 0}건`,
      `- 반응 승인 후속 확인: ${check.reactionFollowUpsCount || 0}건`,
      '',
      '예시 데이터 제외',
      `example/demo/sample/2030년대 예시 데이터 제외: 적용됨 (${check.exampleRecordsExcluded || 0}건 제외)`,
      check.exampleDataWarning || '예시 데이터 혼입 경고 없음',
      '',
      '백업',
      backupLine,
      `수동 백업 명령어: \`${check.exportGuideCommand || '/운영내보내기 종류:전체 형식:JSON'}\``,
      '',
      '운영 리스크',
      ...riskLines,
      '',
      '오늘 해야 할 일',
      ...actionLines,
      '',
      '참여자 도움 신호',
      `- 기본 명령어 첫 사용 기록 사용자: ${check.onboardingTrackedUsersCount || 0}명`,
      `- 미션 인증 채널 1회 안내 전송: ${check.missionGuidanceSentCount || 0}건`,
      `- FAQ 후보 묶음: ${check.faqCandidateCount || 0}건`,
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorReactionFollowUpsEmbed(queue = {}) {
  const followUps = Array.isArray(queue.followUps) ? queue.followUps : [];
  const lines = followUps.length > 0
    ? followUps.slice(0, 10).map((item, index) => {
      return [
        `${index + 1}. ${truncateText(item.message, 120, '후속 확인')}`,
        `   기록 ID: \`${truncateText(item.recordId, 80, '기록 ID 없음')}\``,
        item.source ? `   원본: ${truncateText(item.source, 140, '원본')}` : null,
      ].filter(Boolean).join('\n');
    })
    : ['현재 별도 확인할 반응 승인 후속 항목이 없습니다.'];

  return createGuideEmbed(
    '반응 승인 후속 확인',
    [
      'DM 실패, 공개 답글 실패, 승인 기록의 포인트 거래 누락을 모아 보여주는 읽기 전용 화면입니다.',
      `후속 확인 항목: ${(queue.counts && queue.counts.followUps) || followUps.length || 0}건`,
      '',
      ...lines,
      '',
      '처리는 원본 인증 글, `/포인트로그`, `/운영내보내기`를 대조해 확인해 주세요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorOnboardingSignalsEmbed(signals = {}) {
  const counts = signals.commandCounts || {};
  const helpSignals = Array.isArray(signals.helpSignals) ? signals.helpSignals : [];
  const lines = helpSignals.length > 0
    ? helpSignals.slice(0, 10).map((signal, index) => {
      return [
        `${index + 1}. 사용자 ${truncateText(signal.userId, 24, '알 수 없음')}`,
        `   사용: ${(signal.usedCommands || []).join(', ') || '없음'}`,
        `   아직 안 쓴 기본 명령어: ${(signal.missingCommands || []).join(', ') || '없음'}`,
      ].join('\n');
    })
    : ['아직 도움 필요 신호로 볼 기본 명령어 첫 사용 기록이 없습니다.'];

  return createGuideEmbed(
    '도움 필요 신호',
    [
      '참여자 첫 입장 흐름을 감시가 아니라 안내 보조 신호로만 봅니다.',
      '저장 항목은 사용자 ID와 기본 명령어 첫 사용 여부로 최소화합니다.',
      '',
      `기록된 사용자: ${signals.trackedUsersCount || 0}명`,
      `기본 명령어 첫 사용: /안내 ${counts['안내'] || 0}명 / /포인트 ${counts['포인트'] || 0}명 / /미션 ${counts['미션'] || 0}명 / /상점 ${counts['상점'] || 0}명`,
      `미션 인증 채널 1회 안내: ${signals.guidanceSentCount || 0}건`,
      '',
      ...lines,
      '',
      '운영자가 먼저 말을 걸 때는 “필요하면 안내드릴게요” 정도의 낮은 압력으로 확인해 주세요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorFaqCandidatesEmbed(queue = {}) {
  const candidates = Array.isArray(queue.faqCandidates) ? queue.faqCandidates : [];
  const lines = candidates.length > 0
    ? candidates.slice(0, 10).map((candidate, index) => {
      return [
        `${index + 1}. 반복 ${candidate.count || 1}회`,
        `   질문: ${truncateText(candidate.sampleQuestion || candidate.latestQuestion, 180, '질문 내용 없음')}`,
        `   마지막 확인: ${formatTransactionDateTime(candidate.lastSeenAt)}`,
      ].join('\n');
    })
    : ['아직 FAQ 후보로 묶인 fallback 질문이 없습니다.'];

  return createGuideEmbed(
    'FAQ 개선 후보',
    [
      '`/질문`에서 답을 찾지 못한 반복 질문을 운영자가 검토하기 쉽게 묶은 읽기 전용 화면입니다.',
      '자동으로 FAQ에 반영하지 않습니다.',
      '',
      ...lines,
      '',
      '복사 후 `data/faq.json` 또는 `data/knowledge.json` 반영 여부를 운영자가 직접 검토해 주세요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorRedemptionsEmbed(redemptions = []) {
  if (redemptions.length === 0) {
    return createGuideEmbed('교환 대기', '현재 대기 중인 교환 신청은 없어요.', {
      footer: OPERATOR_CHECK_FOOTER,
    });
  }

  const lines = redemptions.slice(0, 10).map((redemption, index) => {
    return [
      `${index + 1}. ${truncateText(redemption.itemName || redemption.itemId, 80, '교환 항목')}`,
      `   신청자: ${truncateText(redemption.displayName || redemption.userId, 60, '사용자')}`,
      `   신청 ID: \`${truncateText(redemption.id, 80, '신청 ID')}\``,
      `   필요 포인트: ${formatPoints(redemption.cost || 0)} / 상태: ${redemption.status || 'pending'}`,
      `   신청 시각: ${formatTransactionDateTime(redemption.requestedAt || redemption.createdAt)}`,
    ].join('\n');
  });

  return createGuideEmbed(
    '교환 대기',
    [
      `대기 중인 교환 신청 ${redemptions.length}건`,
      '',
      ...lines,
      '',
      '처리는 `/교환관리` 명령어에서 진행할 수 있어요.',
    ].join('\n\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorSubmissionsEmbed(submissions = []) {
  if (submissions.length === 0) {
    return createGuideEmbed('인증 대기', '표시할 인증 대기 건이 없어요.', {
      footer: OPERATOR_CHECK_FOOTER,
    });
  }

  const lines = submissions.slice(0, 10).map((submission, index) => {
    return [
      `${index + 1}. ${truncateText(submission.missionTitle || submission.missionId, 80, '미션')}`,
      `   제출자: ${truncateText(submission.displayName || submission.userId, 60, '사용자')}`,
      `   제출 ID: \`${truncateText(submission.id, 80, '제출 ID')}\``,
      `   지급 예정: ${formatPoints(submission.rewardPoints || 0)} / 상태: ${submission.status || 'pending'}`,
      `   첨부파일: ${formatAttachmentSummary(submission.attachment)} / 제출 시각: ${formatTransactionDateTime(submission.createdAt)}`,
    ].join('\n');
  });

  return createGuideEmbed(
    '인증 대기',
    [
      `확인할 인증 제출 ${submissions.length}건`,
      '',
      ...lines,
      '',
      '처리는 `/인증관리` 명령어에서 진행할 수 있어요.',
      '미션 인증 채널 반응 승인으로 처리된 건은 별도 반응 승인 기록에서 확인할 수 있어요.',
    ].join('\n\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorPointLogsEmbed(transactions = []) {
  if (transactions.length === 0) {
    return createGuideEmbed('최근 포인트 로그', '아직 표시할 실제 포인트 로그가 없습니다.', {
      footer: OPERATOR_CHECK_FOOTER,
    });
  }

  const lines = transactions.slice(0, 10).map((transaction) => {
    return [
      `- ${formatTransactionDateTime(transaction.createdAt)}`,
      `${truncateText(transaction.userId, 32, '사용자')} / ${transaction.type || 'type 없음'} / ${formatTransactionAmount(transaction.amount)}`,
      `사유: ${truncateText(transaction.reason, 80, '포인트 기록')} / 잔액: ${formatPoints(transaction.balanceAfter || 0)}`,
    ].join('\n  ');
  });

  return createGuideEmbed(
    '최근 포인트 로그',
    [
      ...lines,
      '',
      '자세한 기록은 `/포인트로그` 또는 `/운영내보내기`로 확인할 수 있어요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorMissionsShopEmbed(summary = {}) {
  const missionLines = Array.isArray(summary.recentMissions) && summary.recentMissions.length > 0
    ? summary.recentMissions.slice(0, 5).map((mission) => `- ${truncateText(mission.title || mission.id, 70, '미션')} / ${mission.status || 'unknown'} / ${formatPoints(mission.rewardPoints || 0)}`)
    : ['- 최근 등록된 미션이 없어요.'];
  const shopLines = Array.isArray(summary.recentShopItems) && summary.recentShopItems.length > 0
    ? summary.recentShopItems.slice(0, 5).map((item) => `- ${truncateText(item.name || item.id, 70, '상점 항목')} / ${item.status || 'unknown'} / ${formatPoints(item.cost || 0)}`)
    : ['- 최근 등록된 상점 항목이 없어요.'];

  return createGuideEmbed(
    '미션/상점 상태',
    [
      '미션',
      `- 활성 미션: ${summary.activeMissionsCount || 0}개`,
      `- 상태별: ${formatStatusCounts(summary.missionStatusCounts)}`,
      ...missionLines,
      '',
      '상점',
      `- 활성 상점 항목: ${summary.activeShopItemsCount || 0}개`,
      `- 상태별: ${formatStatusCounts(summary.shopItemStatusCounts)}`,
      ...shopLines,
      '',
      '미션은 `/미션관리`, 상점은 `/상점관리`에서 수정할 수 있어요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorReactionApprovalsEmbed(records = []) {
  if (records.length === 0) {
    return createGuideEmbed(
      '반응 승인 기록',
      [
        '아직 표시할 반응 승인 기록이 없어요.',
        '',
        '반응 승인 기록은 미션 인증 채널에서 운영자가 이모지로 확인한 내역이에요.',
        '전체 백업은 `/운영내보내기`를 활용해 주세요.',
      ].join('\n'),
      {
        footer: OPERATOR_CHECK_FOOTER,
      }
    );
  }

  const lines = records.slice(0, 10).map((record) => {
    const messageLine = record.messageUrl ? ` / 원본: ${record.messageUrl}` : '';
    return [
      `- ${record.status || 'unknown'} / ${formatPoints(record.rewardPoints || 0)}`,
      `참여자: ${truncateText(record.authorDisplayName || record.authorId, 40, '참여자')}`,
      `처리자: ${truncateText(record.reviewedByDisplayName || record.reviewedBy, 40, '운영자')}`,
      `시각: ${formatTransactionDateTime(record.reviewedAt || record.createdAt)}${messageLine}`,
    ].join('\n  ');
  });

  return createGuideEmbed(
    '반응 승인 기록',
    [
      ...lines,
      '',
      '반응 승인 기록은 미션 인증 채널에서 운영자가 이모지로 확인한 내역이에요.',
      '전체 백업은 `/운영내보내기`를 활용해 주세요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorInvitationNoticeEmbed() {
  const shortNotice = [
    '리디파인 Discord에 오신 것을 환영합니다.',
    '',
    '처음 들어오셨다면 먼저 참여동의 확인 채널을 확인하고, 이름표/색상 선택을 마쳐 주세요.',
    '그다음 `/안내`를 실행해 `🌱 처음 왔다면 여기부터` 버튼을 눌러 보면 됩니다.',
    '',
    '오늘의 미션은 가능한 만큼 참여하는 선택 활동이에요. 오늘의 미션 채널에 글이나 사진으로 인증을 남기면 운영진 확인 후 포인트가 지급됩니다.',
    '포인트, 미니게임, 상점은 필수가 아니라 천천히 둘러봐도 되는 선택 활동입니다.',
    '',
    '헷갈리거나 불편한 점이 있으면 운영진에게 편하게 말해 주세요.',
  ].join('\n');
  const detailedNotice = [
    '리디파인 Discord에 오신 것을 환영합니다.',
    '',
    '처음엔 모든 채널과 기능을 한 번에 다 확인하지 않아도 괜찮아요. 아래 순서대로만 살펴봐도 충분합니다.',
    '',
    '1. 참여동의 확인',
    '참여동의 확인 채널에서 안내를 먼저 확인해 주세요. 확인 방식이 헷갈리면 운영진에게 물어봐도 됩니다.',
    '',
    '2. 이름표/색상 고르기',
    '이름표나 색상 선택 채널에서 나를 편하게 알아볼 수 있는 표시를 골라 주세요. 꼭 화려하게 꾸미지 않아도 괜찮습니다.',
    '',
    '3. `/안내` 열기',
    '`/안내`를 실행하면 필요한 기능을 버튼으로 볼 수 있어요. 처음이라면 `🌱 처음 왔다면 여기부터` 버튼부터 눌러 주세요.',
    '',
    '4. 오늘의 미션 참여',
    '오늘의 미션은 가능한 만큼 참여하는 선택 활동입니다. 오늘의 미션 채널에 글이나 사진을 올리면 인증이 접수되고, 운영진 확인 후 포인트가 지급됩니다.',
    '',
    '5. 포인트/미니게임/상점은 선택 활동',
    '`내 포인트 확인`으로 현재 포인트를 볼 수 있고, 미니게임은 가볍게 즐기는 활동입니다. 상점은 포인트를 사용하고 싶을 때 천천히 확인해 주세요.',
    '',
    '문의가 필요하거나 공개 채널에 쓰기 어려운 내용이 있으면 운영진에게 말해 주세요. 처음부터 완벽하게 참여하지 않아도 괜찮습니다.',
  ].join('\n');

  return createGuideEmbed(
    '참여자 초대 안내문',
    [
      '아래 문구를 운영 상황에 맞게 다듬은 뒤 복사해서 공지 채널에 붙여넣어 주세요.',
      '실제 채널 ID나 비공개 링크는 넣지 말고, 서버에서 보이는 채널명 중심으로 안내합니다.',
      '',
      '짧은 초대 공지 버전',
      '```text',
      shortNotice,
      '```',
      '',
      '자세한 첫 입장 안내 버전',
      '```text',
      detailedNotice,
      '```',
      '',
      '자동 게시 기능은 후속 작업입니다. 이번 MVP에서는 운영자가 확인 후 직접 복사/게시합니다.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function formatCheckBoolean(value, trueLabel = '가능', falseLabel = '불가') {
  if (value === null || typeof value === 'undefined') {
    return '확인 안 됨';
  }

  return value ? trueLabel : falseLabel;
}

function formatChannelCheckLine(check) {
  const configuredLabel = check.configured ? '설정됨' : '미설정';
  const channelId = check.channelId ? `\`${truncateText(check.channelId, 64, '채널 ID')}\`` : '없음';
  const missingOptionalNote = !check.configured && !check.required
    ? ' / 선택 항목이라 오류는 아니에요'
    : '';

  return [
    `- ${check.envName} (${check.requirementLabel})`,
    `  용도: ${check.label || '운영 채널'}`,
    `  설정: ${configuredLabel}${missingOptionalNote} / 채널 ID: ${channelId}`,
    `  Discord 채널: ${formatCheckBoolean(check.found, '찾음', '못 찾음')} / 접근: ${formatCheckBoolean(check.accessible)} / 메시지 전송: ${formatCheckBoolean(check.canSendMessages)}`,
  ].join('\n');
}

function buildOperatorEnvironmentCheckEmbed({ channelChecks = [], googleSheetsCheck = {} } = {}) {
  const channelLines = channelChecks.length > 0
    ? channelChecks.map(formatChannelCheckLine)
    : ['- 점검할 채널 환경변수 목록을 불러오지 못했어요.'];
  const sheetsEnabled = googleSheetsCheck.loggingEnabled ? 'true' : 'false';
  const webAppUrlConfigured = googleSheetsCheck.webAppUrlConfigured ? '설정됨' : '미설정';

  return createGuideEmbed(
    '환경 설정 점검',
    [
      'Discord 채널 환경변수',
      ...channelLines,
      '',
      'Google Sheets 보조 로그',
      `- GOOGLE_SHEETS_LOGGING_ENABLED: ${sheetsEnabled}`,
      `- GOOGLE_SHEETS_WEB_APP_URL: ${webAppUrlConfigured}`,
      '',
      '민감한 전체값은 이 화면에 표시하지 않습니다.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function getChannelCheck(channelChecks = [], envName) {
  return channelChecks.find((check) => check.envName === envName) || null;
}

function isChannelReady(check) {
  return Boolean(check && check.configured && check.found && check.accessible && check.canSendMessages);
}

function formatReadyStatus(ready, readyText, actionText) {
  return ready
    ? `✅ 준비됨: ${readyText}`
    : `⚠️ 확인 필요: ${actionText}`;
}

function formatOptionalStatus(ready, readyText, actionText) {
  return ready
    ? `✅ 준비됨: ${readyText}`
    : `ℹ️ 선택 항목: ${actionText}`;
}

function formatPrelaunchChannelLine(label, check, options = {}) {
  if (isChannelReady(check)) {
    return `✅ 준비됨 ${label}: 설정됨 / 채널 접근 가능 / 메시지 전송 가능`;
  }

  if (check && check.configured) {
    return `⚠️ 확인 필요 ${label}: 설정됨 / 채널 접근 또는 메시지 전송 권한 확인 필요`;
  }

  if (options.optional) {
    return `ℹ️ 선택 항목 ${label}: 미설정 - ${options.note || '별도 채널을 운영할 때만 설정해도 됩니다.'}`;
  }

  return `⚠️ 확인 필요 ${label}: 미설정 - ${options.note || 'Railway Variables와 Discord 채널 권한을 확인해 주세요.'}`;
}

function getOperatorPrelaunchCheckIssues({
  channelChecks = [],
  todayMissionCheck = {},
  operationSummary = {},
  googleSheetsCheck = {},
} = {}) {
  const logChannel = getChannelCheck(channelChecks, 'LOG_CHANNEL_ID');
  const todayMissionChannel = getChannelCheck(channelChecks, 'TODAY_MISSION_CHANNEL_ID');
  const reviewChannel = getChannelCheck(channelChecks, 'ACTIVITY_REVIEW_CHANNEL_ID');
  const minigameChannel = getChannelCheck(channelChecks, 'MINIGAME_CHANNEL_ID');
  const redeemChannel = getChannelCheck(channelChecks, 'POINT_REDEEM_CHANNEL_ID');
  const activeMissionExists = Boolean(todayMissionCheck.activeMissionExists);
  const publishChannelReady = Boolean(todayMissionCheck.publishChannelReady);
  const duplicateGuardReady = todayMissionCheck.duplicateGuardReady !== false;
  const activeShopItemsCount = operationSummary.activeShopItemsCount || 0;
  const sheetsReady = Boolean(googleSheetsCheck.loggingEnabled && googleSheetsCheck.webAppUrlConfigured);

  return {
    hasEnvironmentIssue: !isChannelReady(logChannel)
      || !isChannelReady(todayMissionChannel)
      || !isChannelReady(reviewChannel)
      || !isChannelReady(minigameChannel)
      || !isChannelReady(redeemChannel)
      || !sheetsReady,
    hasMissionIssue: !activeMissionExists || !publishChannelReady || !duplicateGuardReady,
    hasShopIssue: activeShopItemsCount === 0,
  };
}

function buildOperatorPrelaunchCheckEmbed({
  channelChecks = [],
  todayMissionCheck = {},
  operationSummary = {},
  googleSheetsCheck = {},
} = {}) {
  const logChannel = getChannelCheck(channelChecks, 'LOG_CHANNEL_ID');
  const todayMissionChannel = getChannelCheck(channelChecks, 'TODAY_MISSION_CHANNEL_ID');
  const reviewChannel = getChannelCheck(channelChecks, 'ACTIVITY_REVIEW_CHANNEL_ID');
  const minigameChannel = getChannelCheck(channelChecks, 'MINIGAME_CHANNEL_ID');
  const redeemChannel = getChannelCheck(channelChecks, 'POINT_REDEEM_CHANNEL_ID');
  const separateSubmissionChannel = getChannelCheck(channelChecks, 'MISSION_SUBMISSION_CHANNEL_ID');
  const activeMissionExists = Boolean(todayMissionCheck.activeMissionExists);
  const publishChannelReady = Boolean(todayMissionCheck.publishChannelReady);
  const alreadyPublishedToday = Boolean(todayMissionCheck.alreadyPublishedToday);
  const duplicateGuardReady = todayMissionCheck.duplicateGuardReady !== false;
  const activeShopItemsCount = operationSummary.activeShopItemsCount || 0;
  const sheetsReady = Boolean(googleSheetsCheck.loggingEnabled && googleSheetsCheck.webAppUrlConfigured);

  return createGuideEmbed(
    '초대 전 점검',
    [
      '운영자가 실제 참여자를 초대하기 전에 확인하는 읽기 전용 체크리스트입니다.',
      '이 화면은 자동 수정이나 자동 게시를 하지 않습니다.',
      '',
      '참여자 안내/온보딩',
      '✅ 준비됨 /안내 참여자 메뉴: 구성됨 - 버튼과 선택 메뉴로 안내가 열립니다.',
      '✅ 준비됨 시작 가이드: `처음 왔다면 여기부터` 버튼이 있습니다.',
      '✅ 준비됨 참여자 초대 안내문: `/운영현황`에서 복사용 안내문을 확인할 수 있습니다.',
      '',
      '필수 채널/환경변수',
      formatPrelaunchChannelLine('운영 로그 채널', logChannel),
      formatPrelaunchChannelLine('오늘의 미션 채널', todayMissionChannel),
      formatPrelaunchChannelLine('미션 인증 검토 채널', reviewChannel),
      formatPrelaunchChannelLine('미니게임 채널', minigameChannel),
      formatPrelaunchChannelLine('교환 신청 알림 채널', redeemChannel),
      '',
      '오늘의 미션',
      formatReadyStatus(activeMissionExists, 'active 상태의 오늘의 미션이 있습니다.', 'active 미션 없음 - 오늘의 미션을 먼저 적용하거나 새 미션을 active로 만들어주세요.'),
      formatReadyStatus(publishChannelReady, '오늘의 미션 채널에 게시 가능한 상태입니다.', '오늘의 미션 게시 전 채널 설정과 봇 메시지 전송 권한을 확인해 주세요.'),
      alreadyPublishedToday
        ? '✅ 준비됨 오늘 게시 기록: 이미 오늘 게시된 기록이 있어 중복 게시 방지가 작동합니다.'
        : 'ℹ️ 선택 항목 오늘 게시 기록: 아직 오늘 게시된 기록은 없습니다. 게시 시 중복 게시 방지 기록이 생성됩니다.',
      formatReadyStatus(duplicateGuardReady, '오늘의 미션 하루 1회 지급 차단 흐름이 정상 작동 중입니다.', '오늘 한 참여자에게 중복 지급된 기록이 발견되었습니다. 미션 검토 내역을 확인해 주세요.'),
      '',
      '미션 인증/검토',
      formatPrelaunchChannelLine('검토 알림 채널', reviewChannel),
      formatOptionalStatus(
        isChannelReady(separateSubmissionChannel),
        '별도 인증 제출 채널이 준비되어 있습니다.',
        '별도 인증 제출 채널은 미설정입니다 - 현재 #오늘의-미션 채널에 인증을 함께 올리는 운영이라면 괜찮습니다.'
      ),
      formatReadyStatus(isChannelReady(todayMissionChannel), '승인/반려 반응 흐름에 필요한 오늘의 미션 채널 접근이 가능합니다.', '승인/반려 전 오늘의 미션 채널 접근과 메시지 보기 권한을 확인해 주세요.'),
      '',
      '포인트/교환',
      '✅ 준비됨 포인트 확인: `/포인트`와 포인트 기록 저장소를 사용할 수 있습니다.',
      activeShopItemsCount > 0
        ? `✅ 준비됨 상점 항목: active 항목 ${activeShopItemsCount}개가 있습니다.`
        : '⚠️ 확인 필요 상점 항목: active 항목이 없습니다 - 교환 전 `/상점관리`에서 항목을 준비해 주세요.',
      formatPrelaunchChannelLine('교환 신청 알림', redeemChannel, {
        note: 'POINT_REDEEM_CHANNEL_ID가 없으면 교환 신청 알림을 받을 채널 확인이 필요합니다.',
      }),
      '',
      '미니게임',
      formatPrelaunchChannelLine('미니게임 전용 채널', minigameChannel),
      isChannelReady(minigameChannel)
        ? '✅ 준비됨 미니게임 안내: 전용 채널 기준으로 안내할 수 있습니다.'
        : '⚠️ 확인 필요 미니게임 안내: MINIGAME_CHANNEL_ID와 채널 권한을 확인해 주세요.',
      'ℹ️ 선택 항목 이용 제한: 미니게임은 하루 4회, 하루 최대 40P 제한으로 운영됩니다.',
      '',
      'Google Sheets 기록',
      sheetsReady
        ? '✅ 준비됨 기록 연동: Google Sheets 보조 기록이 켜져 있고 Web App URL도 설정되어 있습니다.'
        : '⚠️ 확인 필요 기록 연동: GOOGLE_SHEETS_LOGGING_ENABLED와 GOOGLE_SHEETS_WEB_APP_URL 설정을 확인해 주세요.',
      'ℹ️ 선택 항목 민감한 설정값: 실제 URL과 검증 값은 이 화면에 표시하지 않습니다.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorExportGuideEmbed() {
  return createGuideEmbed(
    '내보내기 안내',
    [
      '운영 데이터는 정기적으로 백업하는 것을 권장합니다.',
      '',
      '확인 가능한 데이터',
      '- 포인트 로그',
      '- 교환 신청',
      '- 인증 제출',
      '- 반응 승인 기록',
      '- 전체 운영 요약',
      '',
      '사용 방법',
      '- `/운영내보내기 종류:포인트 형식:CSV`',
      '- `/운영내보내기 종류:교환 형식:JSON`',
      '- `/운영내보내기 종류:인증 형식:JSON`',
      '- `/운영내보내기 종류:전체 형식:JSON`',
      '',
      '내보낸 파일에는 개인정보와 운영 메모가 포함될 수 있으니 외부 공유 전 확인해 주세요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function buildOperatorChecklistEmbed() {
  return createGuideEmbed(
    '운영 체크리스트',
    [
      '운영 전',
      '- `/안내`가 정상 작동하는지 확인',
      '- 미션 인증 채널 ID가 설정되어 있는지 확인',
      '- 운영자 역할/권한이 정상인지 확인',
      '- 반응 승인 ✅/❌가 정상 작동하는지 확인',
      '',
      '운영 중',
      '- 교환 대기 건 확인',
      '- 인증 대기 건 확인',
      '- 포인트 로그 확인',
      '- 미션/상점 활성 상태 확인',
      '',
      '운영 후',
      '- `/운영내보내기`로 데이터 백업',
      '- 이상 지급/중복 지급 여부 확인',
      '',
      '자세한 기준은 `docs/operator-dashboard-guide.md`를 확인해 주세요.',
    ].join('\n'),
    {
      footer: OPERATOR_CHECK_FOOTER,
    }
  );
}

function getShopTypeLabel(type) {
  const normalizedType = String(type || '').trim();
  const lowercaseType = normalizedType.toLowerCase();
  const labels = {
    youthCenterPoint: '🟢 청년동 포인트',
    reward: '🎁 리워드',
    goods: '🎁 굿즈',
    event: '✨ 이벤트',
    subscription: '🎟️ 구독권',
  };

  if (labels[normalizedType]) {
    return labels[normalizedType];
  }

  if (/subscription|구독/.test(lowercaseType)) {
    return '🎟️ 구독권';
  }

  return '🎁 리워드';
}

function formatShopParticipantSummary(item) {
  if (String(item.type || '').trim() === 'youthCenterPoint') {
    return `필요 포인트 ${formatPoints(item.cost)} · 청년동 내부 사용`;
  }

  if (String(item.type || '').trim() === 'goods') {
    return `필요 포인트 ${formatPoints(item.cost)} · 수량 운영진 확인`;
  }

  return `필요 포인트 ${formatPoints(item.cost)} · 운영진 확인 후 지급`;
}

function createShopEmbed(items) {
  const embed = createGuideEmbed(
    '여정 포인트 상점',
    [
      '교환할 항목을 아래에서 골라주세요.',
      '선택만으로는 포인트가 차감되지 않아요.',
    ].join('\n')
  );

  const fields = items.slice(0, 10).map((item) => ({
    name: truncateText(`${getShopTypeLabel(item.type)}\n${item.name}`, 256, '상점 항목'),
    value: truncateEmbedValue(formatShopParticipantSummary(item), 80),
  }));

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  if (items.length > fields.length) {
    embed.addFields({
      name: '추가 항목',
      value: '표시 가능한 길이를 넘어 일부 항목만 보여드렸어요. 운영진 공지를 함께 확인해 주세요.',
    });
  }

  return embed;
}

function getNoticeTemplate(type) {
  const template = noticeTemplates[type] || noticeTemplates.contact;

  if (Array.isArray(template)) {
    return template.join('\n');
  }

  if (typeof template === 'string' && template.trim()) {
    return template;
  }

  return fallbackContactNoticeTemplate;
}

function formatChannelCategory(category) {
  return (category.channels || [])
    .map((channel) => `**#${channel.name}** - ${channel.description}`)
    .join('\n');
}

function createChannelGuideEmbed(options = {}) {
  const guide = loadChannelGuide();
  const intro = Array.isArray(guide.intro)
    ? guide.intro.join('\n')
    : String(guide.intro || fallbackChannelGuide.intro.join('\n'));
  const description = options.roleNote
    ? [intro, '', options.roleNote].join('\n')
    : intro;

  const embed = createGuideEmbed(guide.title || fallbackChannelGuide.title, description);
  const fields = (guide.categories || [])
    .map((category) => ({
      name: truncateText(category.name, 256),
      value: truncateEmbedValue(formatChannelCategory(category), EMBED_FIELD_VALUE_LIMIT),
    }))
    .filter((field) => field.name && field.value);

  if (fields.length > 0) {
    embed.addFields(fields);
  }

  return embed;
}

function buildDungeonworldIntroEmbed(session, choices) {
  return createGuideEmbed(
    session.title,
    [
      session.intro,
      '',
      '어떻게 하시겠어요?',
      ...choices.map((choice) => `- ${choice.label}`),
      '',
      '포인트가 지급되지 않는 가벼운 솔로 모험이에요. 편하게 골라 보세요.',
    ].join('\n')
  );
}

function buildDungeonworldResultEmbed(result, closingNote) {
  return createGuideEmbed(
    `${result.choice.label} → ${result.tierLabel}`,
    [
      `🎲 ${result.die1} + ${result.die2} = ${result.total}`,
      '',
      result.outcomeText,
      '',
      closingNote,
    ].join('\n')
  );
}

module.exports = {
  OPERATOR_CHECK_FOOTER,
  buildDungeonworldIntroEmbed,
  buildDungeonworldResultEmbed,
  buildOperatorChecklistEmbed,
  buildOperatorEnvironmentCheckEmbed,
  buildOperatorExportGuideEmbed,
  buildOperatorFaqCandidatesEmbed,
  buildOperatorFirstDayCheckEmbed,
  buildOperatorHubEmbed,
  buildOperatorInvitationNoticeEmbed,
  buildOperatorOnboardingSignalsEmbed,
  buildOperatorPrelaunchCheckEmbed,
  getOperatorPrelaunchCheckIssues,
  buildOperatorMissionsShopEmbed,
  buildOperatorPointLogsEmbed,
  buildOperatorReactionApprovalsEmbed,
  buildOperatorReactionFollowUpsEmbed,
  buildOperatorRedemptionsEmbed,
  buildOperatorSubmissionsEmbed,
  buildOperatorTodayQueueEmbed,
  createChannelGuideEmbed,
  createGuideHubDetailEmbed,
  createGuideHubEmbed,
  createGuideEmbed,
  createPointBalanceEmbed,
  createShopEmbed,
  createKnowledgeEmbed,
  formatPoints,
  formatTransactionAmount,
  formatTransactionDate,
  formatTransactionDateTime,
  getShopTypeLabel,
  getNoticeTemplate,
  truncateEmbedValue,
  truncateText,
};
