const { filterOperationalRecords } = require('./operationalRecords');

const HOUR_MS = 60 * 60 * 1000;

function normalizeInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function getOpsDelayThresholds(env = process.env) {
  return {
    redemptionHours: normalizeInteger(env.OPS_REMINDER_REDEMPTION_HOURS, 48, 1, 720),
    submissionHours: normalizeInteger(env.OPS_REMINDER_SUBMISSION_HOURS, 24, 1, 720),
    followUpHours: normalizeInteger(env.OPS_REMINDER_FOLLOWUP_HOURS, 24, 1, 720),
    missionDeadlineHours: normalizeInteger(env.OPS_REMINDER_MISSION_DEADLINE_HOURS, 24, 1, 168),
  };
}

function getWaitingMetadata(value, thresholdHours, now = new Date()) {
  const timestamp = new Date(value || '');
  if (Number.isNaN(timestamp.getTime()) || timestamp.getTime() > now.getTime()) {
    return { waitingHours: 0, overdue: false, invalidTimestamp: true };
  }
  const waitingHours = Math.max(0, Math.floor((now.getTime() - timestamp.getTime()) / HOUR_MS));
  return { waitingHours, overdue: waitingHours >= thresholdHours, invalidTimestamp: false };
}

function parseMissionDeadline(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999+09:00`);
  }
  return new Date(value || '');
}

function getMissionDeadlineMetadata(value, thresholdHours, now = new Date()) {
  if (!value) return { deadlineStatus: 'none', hoursUntilDeadline: null, invalidTimestamp: false };
  const deadline = parseMissionDeadline(value);
  if (Number.isNaN(deadline.getTime())) {
    return { deadlineStatus: 'none', hoursUntilDeadline: null, invalidTimestamp: true };
  }
  const hoursUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / HOUR_MS);
  return {
    deadlineStatus: hoursUntilDeadline < 0 ? 'overdue' : hoursUntilDeadline <= thresholdHours ? 'dueSoon' : 'upcoming',
    hoursUntilDeadline,
    invalidTimestamp: false,
  };
}

function addWaitingMetadata(records, fields, threshold, now) {
  return filterOperationalRecords(records).data.map((record) => ({
    ...record,
    ...getWaitingMetadata(fields.map((field) => record[field]).find(Boolean), threshold, now),
  }));
}

function addMissionDeadlineMetadata(records, threshold, now) {
  return filterOperationalRecords(records).data.map((mission) => ({
    ...mission,
    ...getMissionDeadlineMetadata(mission.endDate || mission.endsAt, threshold, now),
  }));
}

function summarizeWaiting(items) {
  const valid = items.filter((item) => !item.invalidTimestamp);
  return {
    total: items.length,
    overdue: valid.filter((item) => item.overdue).length,
    longestWaitingHours: valid.reduce((max, item) => Math.max(max, item.waitingHours), 0),
  };
}

function buildOpsDelaySummary(input = {}, options = {}) {
  const now = options.now || new Date();
  const thresholds = options.thresholds || getOpsDelayThresholds(options.env);
  const redemptions = addWaitingMetadata(input.redemptions || [], ['requestedAt', 'createdAt'], thresholds.redemptionHours, now)
    .filter((item) => item.status === 'pending');
  const submissions = addWaitingMetadata(input.submissions || [], ['createdAt'], thresholds.submissionHours, now)
    .filter((item) => item.status === 'pending' && item.type !== 'checkin');
  const followUps = addWaitingMetadata(input.followUps || [], ['createdAt', 'reviewedAt'], thresholds.followUpHours, now);
  const missions = addMissionDeadlineMetadata(input.missions || [], thresholds.missionDeadlineHours, now)
    .filter((item) => item.status === 'active');
  return {
    generatedAt: now.toISOString(), thresholds,
    redemptions: summarizeWaiting(redemptions), submissions: summarizeWaiting(submissions),
    followUps: summarizeWaiting(followUps),
    missions: {
      active: missions.length,
      dueSoon: missions.filter((item) => item.deadlineStatus === 'dueSoon').length,
      overdue: missions.filter((item) => item.deadlineStatus === 'overdue').length,
    },
    items: { redemptions, submissions, followUps, missions },
  };
}

module.exports = {
  addMissionDeadlineMetadata,
  addWaitingMetadata,
  buildOpsDelaySummary,
  getMissionDeadlineMetadata,
  getOpsDelayThresholds,
  getWaitingMetadata,
  normalizeInteger,
};
