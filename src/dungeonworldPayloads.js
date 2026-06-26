const {
  OPERATOR_CHECK_FOOTER,
  createGuideEmbed,
  truncateText,
} = require('./embeds');
const { createDungeonworldManageRow } = require('./components');
const {
  buildDungeonworldAnalytics,
  buildDungeonworldUserProgress,
  getCurrentSessionId: getCurrentDungeonworldSessionId,
  getSession: getDungeonworldSession,
  listSessions: listDungeonworldSessions,
} = require('./dungeonworld');

function createDungeonworldPayloads(dependencies) {
  const {
    dungeonworldRepository,
    dungeonworldConfigRepository,
  } = dependencies;

  function listAllDungeonworldLogs() {
    const totalPlayCount = dungeonworldRepository.getPlayCount();
    return totalPlayCount > 0 ? dungeonworldRepository.listRecentPlays(totalPlayCount) : [];
  }

  function buildUserProgress(userId) {
    const currentSessionId = getCurrentDungeonworldSessionId(dungeonworldConfigRepository);
    return buildDungeonworldUserProgress(
      listAllDungeonworldLogs(),
      userId,
      currentSessionId
    );
  }

  function formatDungeonworldContinuityNote(progress) {
    if (!progress.previousSessionId) {
      return '직전 회차 연속성: 첫 회차라 아직 반영할 직전 결과가 없어요.';
    }

    if (!progress.previousSessionLatestPlay) {
      return `직전 회차 연속성: ${progress.previousSessionTitle} 기록이 없어 현재 인트로는 기본 흐름으로 보여요.`;
    }

    return `직전 회차 연속성: ${progress.previousSessionTitle}의 ${progress.previousTierLabel || progress.previousTier} 결과가 현재 인트로에 반영돼요.`;
  }

  function formatDungeonworldRecordDescription(progress) {
    const latestLines = progress.latestPlayBySession.length > 0
      ? progress.latestPlayBySession.map((log) => [
        `- ${log.sessionTitle || log.sessionId}`,
        `${log.choiceLabel || log.choiceId}`,
        `${log.tierLabel || log.tier || '결과 미확인'}`,
        Number.isFinite(log.total) ? `합계 ${log.total}` : null,
      ].filter(Boolean).join(' / '))
      : ['아직 던전월드 플레이 기록이 없어요. `/던전월드`로 현재 회차를 시작할 수 있어요.'];

    return [
      `총 플레이 수: ${progress.totalPlayCount}`,
      `완료한 회차: ${progress.completedSessionCount}`,
      `현재 열린 회차: ${progress.currentSessionTitle || '확인 불가'}${progress.currentSessionId ? ` (\`${progress.currentSessionId}\`)` : ''}`,
      `현재 회차 참여: ${progress.hasPlayedCurrentSession ? '완료' : '아직 미참여'}`,
      formatDungeonworldContinuityNote(progress),
      '',
      '회차별 최신 결과',
      ...latestLines,
    ].join('\n');
  }

  function createDungeonworldRecordEmbed(userId) {
    return createGuideEmbed(
      '내 던전월드 기록',
      formatDungeonworldRecordDescription(buildUserProgress(userId))
    );
  }

  function formatDungeonworldCountItems(items, emptyText, options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      return [emptyText];
    }

    const limit = options.limit || 5;
    return items.slice(0, limit).map((item) => {
      const preferChoice = options.preferChoice === true;
      const label = preferChoice
        ? item.choiceLabel || item.choiceId || item.sessionTitle || item.sessionId || '항목'
        : item.sessionTitle || item.choiceLabel || item.sessionId || item.choiceId || '항목';
      const id = preferChoice ? item.choiceId || item.sessionId || '' : item.sessionId || item.choiceId || '';
      const suffix = id ? ` (\`${id}\`)` : '';
      const sessionContext = preferChoice && item.sessionTitle ? ` / ${truncateText(item.sessionTitle, 40)}` : '';
      return `- ${truncateText(label, 60)}${suffix}${sessionContext}: ${item.count}`;
    });
  }

  function formatDungeonworldTierCounts(tierCounts) {
    return [
      `10+: ${tierCounts.strong || 0}`,
      `7-9: ${tierCounts.mixed || 0}`,
      `6-: ${tierCounts.weak || 0}`,
      `미확인: ${tierCounts.unknown || 0}`,
    ].join(' / ');
  }

  function getDungeonworldAutoOpenContext(now = new Date()) {
    const startDateText = String(process.env.DUNGEONWORLD_START_DATE || '').trim();
    if (!startDateText) {
      return null;
    }

    const startDate = new Date(startDateText);
    if (Number.isNaN(startDate.getTime())) {
      return null;
    }

    const sessions = listDungeonworldSessions();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    const elapsedMs = now.getTime() - startDate.getTime();
    const weekIndex = elapsedMs <= 0 ? 0 : Math.floor(elapsedMs / weekMs);
    const currentIndex = Math.min(sessions.length - 1, weekIndex);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= sessions.length) {
      return '다음 자동 오픈: 마지막 회차에 도달해 자동 계산은 마지막 회차로 유지돼요.';
    }

    const nextOpenAt = new Date(startDate.getTime() + (nextIndex * weekMs)).toISOString();
    const nextSession = sessions[nextIndex];
    return `다음 자동 오픈: ${nextOpenAt} / ${nextSession.title} (\`${nextSession.id}\`)`;
  }

  function createDungeonworldManagePayload(statusLine = null) {
    const override = dungeonworldConfigRepository.getOverride();
    const currentSessionId = getCurrentDungeonworldSessionId(dungeonworldConfigRepository);
    const autoSessionId = getCurrentDungeonworldSessionId(null);
    const session = getDungeonworldSession(currentSessionId);
    const autoSession = getDungeonworldSession(autoSessionId);
    const sessions = listDungeonworldSessions();
    const analytics = buildDungeonworldAnalytics(listAllDungeonworldLogs(), {
      currentSessionId,
      recentLimit: 10,
    });
    const nextAutoOpenContext = getDungeonworldAutoOpenContext();
    const sessionLines = sessions.map((item) => `- ${item.title} (\`${item.id}\`)`);
    const progressCounts = analytics.latestSessionProgressCounts;

    return {
      embeds: [
        createGuideEmbed(
          '던전월드 회차 관리',
          [
            statusLine,
            statusLine ? '' : null,
            `현재 회차: ${session.title} (\`${session.id}\`)`,
            `자동 계산 회차: ${autoSession.title} (\`${autoSession.id}\`)`,
            `수동 설정: ${override ? `예 (\`${override}\`)` : '아니오 (자동 계산)'}`,
            nextAutoOpenContext,
            '',
            '운영 지표',
            `전체 플레이 수: ${analytics.totalPlayCount}`,
            `최근 기록 수: ${analytics.recentActivity.length}`,
            `고유 참여자 수: ${analytics.uniqueUserCount}`,
            `결과 분포: ${formatDungeonworldTierCounts(analytics.tierCounts)}`,
            progressCounts ? `현재 회차 진행: ${progressCounts.playCount}회 / ${progressCounts.uniqueUserCount}명` : '현재 회차 진행: 확인 불가',
            '',
            '인기 회차',
            ...formatDungeonworldCountItems(analytics.sessionCounts, '- 아직 플레이 기록이 없습니다.', { limit: 5 }),
            '',
            '인기 선택',
            ...formatDungeonworldCountItems(analytics.choiceCounts, '- 아직 선택 기록이 없습니다.', {
              limit: 5,
              preferChoice: true,
            }),
            '',
            '전체 회차',
            ...sessionLines,
            '',
            '버튼으로 이전/다음 회차 수동 설정, 오버라이드 해제, 새로고침만 할 수 있어요.',
          ].filter((line) => line !== null).join('\n'),
          {
            footer: OPERATOR_CHECK_FOOTER,
          }
        ),
      ],
      components: [createDungeonworldManageRow()],
    };
  }

  return {
    createDungeonworldManagePayload,
    createDungeonworldRecordEmbed,
  };
}

module.exports = {
  createDungeonworldPayloads,
};
