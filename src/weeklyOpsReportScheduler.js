const fs = require('fs');
const { getOperationDataPaths } = require('./operationDataPaths');
const { saveJsonFileAtomic } = require('./jsonStorage');
const { buildWeeklyOpsReportFromRepository, formatWeeklyOpsReportMessage, getKstWeekRange } = require('./weeklyOpsReport');

let activeScheduler = null;
let tickRunning = false;

function createHistory() { return { version: 1, isExample: false, records: [] }; }
function readHistory(filePath) {
  if (!fs.existsSync(filePath)) return createHistory();
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed.isExample === true) throw new Error('example 이력은 사용할 수 없습니다.');
  return { ...createHistory(), ...parsed, records: Array.isArray(parsed.records) ? parsed.records : [] };
}
function saveHistory(filePath, history) { saveJsonFileAtomic(filePath, { ...history, records: history.records.slice(-120) }); }
function reserveWeek(filePath, weekStartDateKst, now, store = {}) {
  const read = store.readHistory || readHistory;
  const save = store.saveHistory || saveHistory;
  const history = read(filePath);
  if (history.records.some((item) => item.weekStartDateKst === weekStartDateKst)) return null;
  const record = { weekStartDateKst, status: 'reserved', reservedAt: now.toISOString() };
  save(filePath, { ...history, records: [...history.records, record] });
  return record;
}
function finishWeek(filePath, weekStartDateKst, status, now, detail, store = {}) {
  const read = store.readHistory || readHistory;
  const save = store.saveHistory || saveHistory;
  const history = read(filePath);
  history.records = history.records.map((item) => item.weekStartDateKst === weekStartDateKst ? { ...item, status, finishedAt: now.toISOString(), detail: detail || null } : item);
  save(filePath, history);
}
function safelyFinishWeek(filePath, weekStartDateKst, status, now, detail, store) {
  try {
    finishWeek(filePath, weekStartDateKst, status, now, detail, store);
    return true;
  } catch (error) {
    console.warn('주간 운영 리포트 이력 완료 상태 저장 실패:', error.message);
    return false;
  }
}
function parseSchedule(env) {
  const rawWeekday = env.WEEKLY_OPS_REPORT_WEEKDAY;
  const rawTime = env.WEEKLY_OPS_REPORT_TIME_KST;
  const weekday = Number(rawWeekday || 1);
  const time = String(rawTime || '10:00');
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    console.warn('WEEKLY_OPS_REPORT_WEEKDAY/TIME_KST 값이 유효하지 않아 월요일 10:00 KST를 사용합니다.');
    return { weekday: 1, time: '10:00' };
  }
  return { weekday, time };
}
function isDue(now, env) {
  const shifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const weekday = shifted.getUTCDay() || 7;
  const time = `${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}`;
  const schedule = parseSchedule(env);
  return weekday === schedule.weekday && time === schedule.time;
}
async function fetchChannel(client, id) {
  const cached = client && client.channels && client.channels.cache && client.channels.cache.get(id);
  return cached || (client && client.channels && client.channels.fetch ? client.channels.fetch(id) : null);
}
async function sendWeeklyOpsReport(options = {}) {
  const env = options.env || process.env;
  const now = options.now || new Date();
  const weekOffset = options.weekOffset === undefined ? 0 : options.weekOffset;
  const weekStartDateKst = getKstWeekRange(now, weekOffset).weekStartDateKst;
  const historyPath = options.historyPath || getOperationDataPaths(env).weeklyOpsReports;
  const historyStore = options.historyStore || {};
  try { if (!reserveWeek(historyPath, weekStartDateKst, now, historyStore)) return { ok: false, reason: 'ALREADY_RESERVED' }; } catch (error) { return { ok: false, reason: 'RESERVATION_FAILED' }; }
  const channelId = env.WEEKLY_OPS_REPORT_CHANNEL_ID || env.OPS_REMINDER_CHANNEL_ID || env.ADMIN_CONSOLE_LOG_CHANNEL_ID || env.LOG_CHANNEL_ID;
  if (!channelId) { safelyFinishWeek(historyPath, weekStartDateKst, 'skipped', now, 'MISSING_CHANNEL', historyStore); return { ok: false, reason: 'MISSING_CHANNEL' }; }
  let channel;
  try { channel = await fetchChannel(options.client, channelId); } catch (error) { safelyFinishWeek(historyPath, weekStartDateKst, 'failed', now, 'CHANNEL_FETCH_FAILED', historyStore); return { ok: false, reason: 'CHANNEL_FETCH_FAILED' }; }
  if (!channel || typeof channel.send !== 'function') { safelyFinishWeek(historyPath, weekStartDateKst, 'failed', now, 'CHANNEL_NOT_FOUND', historyStore); return { ok: false, reason: 'CHANNEL_NOT_FOUND' }; }
  let report;
  try { report = buildWeeklyOpsReportFromRepository(options.repository, { now, env, weekOffset }); } catch (error) { safelyFinishWeek(historyPath, weekStartDateKst, 'failed', now, 'DATA_READ_FAILED', historyStore); return { ok: false, reason: 'DATA_READ_FAILED' }; }
  try { await channel.send({ content: formatWeeklyOpsReportMessage(report, env.ADMIN_DASHBOARD_URL), allowedMentions: { parse: [] } }); }
  catch (error) { safelyFinishWeek(historyPath, weekStartDateKst, 'failed', now, 'SEND_FAILED', historyStore); return { ok: false, reason: 'SEND_FAILED' }; }
  if (!safelyFinishWeek(historyPath, weekStartDateKst, 'sent', now, null, historyStore)) {
    return { ok: false, reason: 'SENT_HISTORY_FAILED' };
  }
  return { ok: true, reason: 'SENT', report };
}
async function runWeeklyOpsReportTick(options = {}) {
  if (tickRunning) return { ok: false, reason: 'TICK_RUNNING' };
  tickRunning = true;
  try {
    const env = options.env || process.env;
    if (String(env.WEEKLY_OPS_REPORT_ENABLED || '').toLowerCase() !== 'true') return { ok: false, reason: 'DISABLED' };
    if (!isDue(options.now || new Date(), env)) return { ok: false, reason: 'NOT_DUE' };
    return await sendWeeklyOpsReport({ ...options, weekOffset: -1 });
  } finally { tickRunning = false; }
}
function startWeeklyOpsReportScheduler(options = {}) {
  const env = options.env || process.env;
  if (String(env.WEEKLY_OPS_REPORT_ENABLED || '').toLowerCase() !== 'true') return { started: false, stop() {} };
  if (activeScheduler) return activeScheduler;
  const runNow = () => runWeeklyOpsReportTick({ ...options, env });
  Promise.resolve(runNow()).catch((error) => console.warn('주간 운영 리포트 실행 실패:', error.message));
  const timer = setInterval(() => runNow().catch((error) => console.warn('주간 운영 리포트 실행 실패:', error.message)), 30000);
  if (timer.unref) timer.unref();
  activeScheduler = { started: true, runNow, stop() { clearInterval(timer); activeScheduler = null; } };
  return activeScheduler;
}
function resetWeeklyOpsReportForTests() { if (activeScheduler) activeScheduler.stop(); tickRunning = false; }

module.exports = { isDue, parseSchedule, readHistory, reserveWeek, resetWeeklyOpsReportForTests, runWeeklyOpsReportTick, sendWeeklyOpsReport, startWeeklyOpsReportScheduler };
