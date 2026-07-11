const { filterOperationalRecords } = require('./operationalRecords');
const { buildOpsDelaySummary } = require('./opsDelayPolicy');

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function parseWeekOffset(value) {
  const raw = value === null || value === undefined || value === '' ? 0 : Number(value);
  if (!Number.isInteger(raw) || raw < -12 || raw > 0) throw Object.assign(new Error('weekOffset은 0~-12 정수여야 합니다.'), { code: 'INVALID_WEEK_OFFSET' });
  return raw;
}

function getKstWeekRange(now = new Date(), weekOffset = 0) {
  const offset = parseWeekOffset(weekOffset);
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  const weekday = shifted.getUTCDay() || 7;
  const startKstMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - (weekday - 1) * DAY_MS + offset * 7 * DAY_MS;
  const start = new Date(startKstMs - KST_OFFSET_MS);
  const naturalEnd = new Date(start.getTime() + 7 * DAY_MS);
  const end = offset === 0 && now < naturalEnd ? now : naturalEnd;
  return { weekOffset: offset, weekStartDateKst: new Date(startKstMs).toISOString().slice(0, 10), startAt: start.toISOString(), endAt: end.toISOString() };
}

function timestampOf(record) {
  return record.createdAt || record.requestedAt || record.submittedAt || record.checkedInAt || record.updatedAt || null;
}

function inRange(record, range) {
  const timestamp = new Date(timestampOf(record) || '');
  return !Number.isNaN(timestamp.getTime()) && timestamp >= new Date(range.startAt) && timestamp < new Date(range.endAt);
}

function records(value) {
  return filterOperationalRecords(Array.isArray(value) ? value : []).data;
}

function statusCounts(items, statuses) {
  return Object.fromEntries(statuses.map((status) => [status, items.filter((item) => item.status === status).length]));
}

function readRepositoryInput(repository) {
  const state = repository.loadState();
  const reactions = typeof repository.getReactionApprovalData === 'function' ? records(repository.getReactionApprovalData().records) : [];
  const followUps = reactions.flatMap((record) => {
    const results = record.notificationResults || {};
    const failures = ['dmUser', 'publicReply'].filter((key) => results[key] === 'failed');
    if (record.status === 'approved' && Number(record.rewardPoints || 0) > 0 && !record.transactionId) failures.push('missingTransaction');
    return failures.map((kind) => ({ id: `${record.id || 'reaction'}:${kind}`, createdAt: record.reviewedAt || record.createdAt }));
  });
  return {
    users: state.pointsData && state.pointsData.users,
    transactions: state.pointsData && state.pointsData.pointTransactions,
    redemptions: state.redemptionsData && state.redemptionsData.redemptions,
    submissions: state.submissionsData && state.submissionsData.submissions,
    missions: state.missionsData && state.missionsData.missions,
    followUps,
  };
}

function buildWeeklyOpsReport(input = {}, options = {}) {
  const now = options.now || new Date();
  const range = getKstWeekRange(now, options.weekOffset);
  const submissions = records(input.submissions).filter((item) => inRange(item, range));
  const checkins = submissions.filter((item) => item.type === 'checkin');
  const missionSubmissions = submissions.filter((item) => item.type !== 'checkin');
  const transactions = records(input.transactions).filter((item) => inRange(item, range));
  const redemptions = records(input.redemptions).filter((item) => inRange(item, range));
  const participantIds = new Set(checkins.map((item) => item.userId).filter(Boolean));
  const delay = buildOpsDelaySummary({ redemptions: input.redemptions, submissions: input.submissions, missions: input.missions, followUps: input.followUps }, { now, env: options.env });
  return {
    generatedAt: now.toISOString(), range,
    participation: { participantCount: participantIds.size, checkinCount: checkins.length },
    submissions: { total: missionSubmissions.length, ...statusCounts(missionSubmissions, ['pending', 'approved', 'rejected']) },
    points: {
      transactionCount: transactions.length,
      earned: transactions.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0),
      deducted: transactions.reduce((sum, item) => sum + Math.abs(Math.min(0, Number(item.amount) || 0)), 0),
    },
    redemptions: { total: redemptions.length, ...statusCounts(redemptions, ['pending', 'completed', 'cancelled', 'refunded']) },
    delays: {
      redemptions: delay.redemptions.overdue, submissions: delay.submissions.overdue,
      followUps: delay.followUps.overdue, missionsDueSoon: delay.missions.dueSoon, missionsOverdue: delay.missions.overdue,
    },
  };
}

function buildWeeklyOpsReportFromRepository(repository, options = {}) {
  return buildWeeklyOpsReport(readRepositoryInput(repository), options);
}

function formatWeeklyOpsReportMessage(report, dashboardUrl) {
  const message = [
    `[주간 운영 리포트 ${report.range.weekStartDateKst}]`,
    `체크인 ${report.participation.participantCount}명·${report.participation.checkinCount}건`,
    `인증 ${report.submissions.total}건(대기 ${report.submissions.pending}·승인 ${report.submissions.approved}·반려 ${report.submissions.rejected})`,
    `포인트 지급 ${report.points.earned}·차감 ${report.points.deducted} (${report.points.transactionCount}건)`,
    `교환 ${report.redemptions.total}건(대기 ${report.redemptions.pending}·완료 ${report.redemptions.completed})`,
    `지연 교환 ${report.delays.redemptions}·인증 ${report.delays.submissions}·후속 ${report.delays.followUps} / 미션 임박 ${report.delays.missionsDueSoon}·경과 ${report.delays.missionsOverdue}`,
  ];
  if (/^https:\/\//.test(String(dashboardUrl || ''))) message.push(`콘솔 ${dashboardUrl}`);
  return message.join('\n');
}

module.exports = { buildWeeklyOpsReport, buildWeeklyOpsReportFromRepository, formatWeeklyOpsReportMessage, getKstWeekRange, parseWeekOffset, readRepositoryInput };
