const fs = require('fs');
const { getOperationDataPaths } = require('./operationDataPaths');
const { saveJsonFileAtomic } = require('./jsonStorage');
const { buildOpsDelaySummary, normalizeInteger } = require('./opsDelayPolicy');

const MAX_HISTORY = 120;
let activeScheduler = null;
let tickRunning = false;

function normalizeSlots(value) {
  const valid = String(value || '10:00').split(',').map((item) => item.trim())
    .filter((item) => /^([01]\d|2[0-3]):[0-5]\d$/.test(item));
  return [...new Set(valid)].slice(0, 4).sort().length ? [...new Set(valid)].slice(0, 4).sort() : ['10:00'];
}

function warnForInvalidConfig(env) {
  const configuredSlots = String(env.OPS_REMINDER_SLOTS || '10:00').split(',').map((item) => item.trim()).filter(Boolean);
  if (configuredSlots.some((item) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(item)) || configuredSlots.length > 4) {
    console.warn('OPS_REMINDER_SLOTS 값 일부가 유효하지 않아 안전한 슬롯으로 정규화합니다.');
  }
  const numericRules = [
    ['OPS_REMINDER_SLOT_WINDOW_MINUTES', 1, 15],
    ['OPS_REMINDER_REDEMPTION_HOURS', 1, 720],
    ['OPS_REMINDER_SUBMISSION_HOURS', 1, 720],
    ['OPS_REMINDER_FOLLOWUP_HOURS', 1, 720],
    ['OPS_REMINDER_MISSION_DEADLINE_HOURS', 1, 168],
  ];
  numericRules.forEach(([key, minimum, maximum]) => {
    if (!env[key]) return;
    const value = Number(env[key]);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      console.warn(`${key} 값이 범위를 벗어나 안전한 기본값을 사용합니다.`);
    }
  });
}

function getKstParts(now) {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const dateKst = shifted.toISOString().slice(0, 10);
  return { dateKst, hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

function findDueSlot(now, slots, windowMinutes) {
  const parts = getKstParts(now);
  const current = parts.hour * 60 + parts.minute;
  const slot = slots.find((item) => {
    const [hour, minute] = item.split(':').map(Number);
    const delta = current - (hour * 60 + minute);
    return delta >= 0 && delta < windowMinutes;
  });
  return slot ? { dateKst: parts.dateKst, slot } : null;
}

function createHistory() {
  return { version: 1, isExample: false, records: [] };
}

function readHistory(historyPath) {
  if (!fs.existsSync(historyPath)) return createHistory();
  try {
    const parsed = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    if (parsed && parsed.isExample === true) {
      throw new Error('example 이력은 운영 리마인더에 사용할 수 없습니다.');
    }
    return { ...createHistory(), ...parsed, records: Array.isArray(parsed.records) ? parsed.records : [] };
  } catch (error) {
    throw new Error(`운영 리마인더 이력 읽기 실패: ${error.message}`);
  }
}

function saveHistory(historyPath, history) {
  saveJsonFileAtomic(historyPath, { ...history, records: history.records.slice(-MAX_HISTORY) });
}

function reserveSlot(historyPath, key, now) {
  const history = readHistory(historyPath);
  if (history.records.some((record) => record.dateKst === key.dateKst && record.slot === key.slot)) return null;
  const record = { ...key, status: 'reserved', reservedAt: now.toISOString() };
  saveHistory(historyPath, { ...history, records: [...history.records, record] });
  return record;
}

function finishSlot(historyPath, key, status, now, detail = null) {
  const history = readHistory(historyPath);
  history.records = history.records.map((record) => record.dateKst === key.dateKst && record.slot === key.slot
    ? { ...record, status, finishedAt: now.toISOString(), detail } : record);
  saveHistory(historyPath, history);
}

function safelyFinishSlot(historyPath, key, status, now, detail = null) {
  try {
    finishSlot(historyPath, key, status, now, detail);
    return true;
  } catch (error) {
    console.warn('운영 리마인더 이력 완료 상태 저장 실패:', error.message);
    return false;
  }
}

function formatOpsReminderMessage(summary, key, dashboardUrl) {
  const missionCount = summary.missions.dueSoon + summary.missions.overdue;
  const parts = [
    `[운영 리마인더 ${key.dateKst.slice(5)} ${key.slot}]`,
    `교환 ${summary.redemptions.total}건(지연 ${summary.redemptions.overdue}, 최장 ${summary.redemptions.longestWaitingHours}시간)`,
    `인증 ${summary.submissions.total}건(지연 ${summary.submissions.overdue}, 최장 ${summary.submissions.longestWaitingHours}시간)`,
    `후속 ${summary.followUps.total}건(지연 ${summary.followUps.overdue})`,
    `마감 임박·경과 미션 ${missionCount}건`,
  ];
  if (/^https:\/\//.test(String(dashboardUrl || ''))) parts.push(`콘솔 ${dashboardUrl}`);
  return parts.join(' · ');
}

function readRepositoryInput(repository) {
  const state = repository.loadState();
  const reactions = typeof repository.getReactionApprovalData === 'function'
    ? repository.getReactionApprovalData().records || [] : [];
  const followUps = reactions.flatMap((record) => {
    const results = record.notificationResults || {};
    const failures = ['dmUser', 'publicReply'].filter((key) => results[key] === 'failed');
    if (record.status === 'approved' && Number(record.rewardPoints || 0) > 0 && !record.transactionId) {
      failures.push('missingTransaction');
    }
    return failures.map((kind) => ({ id: `${record.id || 'reaction'}:${kind}`, createdAt: record.reviewedAt || record.createdAt }));
  });
  return {
    redemptions: state.redemptionsData && state.redemptionsData.redemptions,
    submissions: state.submissionsData && state.submissionsData.submissions,
    missions: state.missionsData && state.missionsData.missions,
    followUps,
  };
}

async function fetchChannel(client, channelId) {
  const cached = client && client.channels && client.channels.cache && client.channels.cache.get(channelId);
  if (cached) return cached;
  return client && client.channels && typeof client.channels.fetch === 'function' ? client.channels.fetch(channelId) : null;
}

async function runOpsReminderTick(options = {}) {
  if (tickRunning) return { ok: false, reason: 'TICK_RUNNING' };
  tickRunning = true;
  const env = options.env || process.env;
  const now = options.now || new Date();
  try {
    if (String(env.OPS_REMINDER_ENABLED || '').toLowerCase() !== 'true') return { ok: false, reason: 'DISABLED' };
    const due = findDueSlot(now, normalizeSlots(env.OPS_REMINDER_SLOTS), normalizeInteger(env.OPS_REMINDER_SLOT_WINDOW_MINUTES, 5, 1, 15));
    if (!due) return { ok: false, reason: 'NOT_DUE' };
    const historyPath = options.historyPath || getOperationDataPaths(env).opsReminders;
    let reservation;
    try { reservation = reserveSlot(historyPath, due, now); } catch (error) { return { ok: false, reason: 'RESERVATION_FAILED', error }; }
    if (!reservation) return { ok: false, reason: 'ALREADY_RESERVED' };
    let summary;
    try { summary = buildOpsDelaySummary(readRepositoryInput(options.repository), { now, env }); } catch (error) {
      safelyFinishSlot(historyPath, due, 'failed', now, 'DATA_READ_FAILED');
      return { ok: false, reason: 'DATA_READ_FAILED' };
    }
    const signalCount = summary.redemptions.total + summary.submissions.total + summary.followUps.total
      + summary.missions.dueSoon + summary.missions.overdue;
    if (signalCount === 0) {
      safelyFinishSlot(historyPath, due, 'skipped-empty', now);
      return { ok: false, reason: 'EMPTY', summary };
    }
    const channelId = env.OPS_REMINDER_CHANNEL_ID || env.ADMIN_CONSOLE_LOG_CHANNEL_ID || env.LOG_CHANNEL_ID;
    if (!channelId) {
      safelyFinishSlot(historyPath, due, 'skipped', now, 'MISSING_CHANNEL');
      return { ok: false, reason: 'MISSING_CHANNEL' };
    }
    let channel;
    try { channel = await fetchChannel(options.client, channelId); } catch (error) {
      safelyFinishSlot(historyPath, due, 'failed', now, 'CHANNEL_FETCH_FAILED');
      return { ok: false, reason: 'CHANNEL_FETCH_FAILED' };
    }
    if (!channel || typeof channel.send !== 'function') {
      safelyFinishSlot(historyPath, due, 'skipped', now, 'CHANNEL_NOT_FOUND');
      return { ok: false, reason: 'CHANNEL_NOT_FOUND' };
    }
    try {
      await channel.send({ content: formatOpsReminderMessage(summary, due, env.ADMIN_DASHBOARD_URL), allowedMentions: { parse: [] } });
    } catch (error) {
      safelyFinishSlot(historyPath, due, 'failed', now, 'SEND_FAILED');
      return { ok: false, reason: 'SEND_FAILED' };
    }
    safelyFinishSlot(historyPath, due, 'sent', now);
    return { ok: true, reason: 'SENT', summary };
  } finally {
    tickRunning = false;
  }
}

function startOpsReminder(options = {}) {
  const env = options.env || process.env;
  if (String(env.OPS_REMINDER_ENABLED || '').toLowerCase() !== 'true') return { started: false, stop() {}, runNow: () => Promise.resolve({ ok: false, reason: 'DISABLED' }) };
  if (activeScheduler) return activeScheduler;
  warnForInvalidConfig(env);
  const runNow = () => runOpsReminderTick({ ...options, env });
  Promise.resolve(runNow()).catch((error) => console.warn('운영 리마인더 실행 실패:', error.message));
  const timer = setInterval(() => Promise.resolve(runNow()).catch((error) => console.warn('운영 리마인더 실행 실패:', error.message)), 30000);
  if (typeof timer.unref === 'function') timer.unref();
  activeScheduler = { started: true, runNow, stop() { clearInterval(timer); activeScheduler = null; } };
  return activeScheduler;
}

function resetOpsReminderForTests() {
  if (activeScheduler) activeScheduler.stop();
  tickRunning = false;
}

module.exports = { findDueSlot, formatOpsReminderMessage, normalizeSlots, readHistory, resetOpsReminderForTests, runOpsReminderTick, startOpsReminder };
