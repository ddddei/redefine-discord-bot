const fs = require('fs');
const os = require('os');
const path = require('path');
const { isExampleLikeRecord, isExampleLikeValue } = require('./operationalRecords');

const REPOSITORY_DATA_DIR = path.join(__dirname, '..', 'data');

const DEFINITIONS = {
  points: ['POINTS_DATA_PATH', 'points.local.json'],
  shopItems: ['SHOP_ITEMS_DATA_PATH', 'shop-items.local.json'],
  redemptions: ['REDEMPTIONS_DATA_PATH', 'redemptions.local.json'],
  missions: ['MISSIONS_DATA_PATH', 'missions.local.json'],
  missionTemplates: ['MISSION_TEMPLATES_DATA_PATH', 'mission-templates.local.json'],
  submissions: ['SUBMISSIONS_DATA_PATH', 'submissions.local.json'],
  reactionApprovals: ['REACTION_APPROVALS_DATA_PATH', 'reaction-approvals.local.json'],
  operatorSupport: ['OPERATOR_SUPPORT_DATA_PATH', 'operator-support.local.json'],
  dailyMissionAnnouncements: ['DAILY_MISSION_ANNOUNCEMENTS_DATA_PATH', 'daily-mission-announcements.local.json'],
  operationBackupState: ['OPERATION_BACKUP_STATE_PATH', 'operation-backups.local.json'],
  dmChatLogs: ['DM_CHAT_LOG_PATH', 'dm-chat-logs.local.json'],
  dmCleanupState: ['DM_CLEANUP_STATE_PATH', 'dm-cleanup-state.local.json'],
  dmSafetyReviews: ['DM_SAFETY_REVIEWS_PATH', 'dm-safety-reviews.local.json'],
  dungeonworldLogs: ['DUNGEONWORLD_LOG_PATH', 'dungeonworld-logs.local.json'],
  dungeonworldConfig: ['DUNGEONWORLD_CONFIG_PATH', 'dungeonworld-config.local.json'],
  webgameLinks: ['WEBGAME_LINKS_DATA_PATH', 'webgame-links.local.json'],
  webgameScores: ['WEBGAME_SCORES_DATA_PATH', 'webgame-scores.local.json'],
  webgameSocial: ['WEBGAME_SOCIAL_DATA_PATH', 'webgame-social.local.json'],
  webgameReplayMismatch: ['WEBGAME_REPLAY_MISMATCH_DATA_PATH', 'webgame-replay-mismatch.local.json'],
};

function configuredValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveOperationDataDir(env = process.env) {
  return configuredValue(env.OPERATION_DATA_DIR) || REPOSITORY_DATA_DIR;
}

function getOperationDataPaths(env = process.env) {
  const dataDir = resolveOperationDataDir(env);
  return Object.fromEntries(Object.entries(DEFINITIONS).map(([key, [envName, filename]]) => {
    return [key, configuredValue(env[envName]) || path.join(dataDir, filename)];
  }));
}

function isProductionDataStrict(env = process.env) {
  return String(env.PRODUCTION_DATA_STRICT || '').trim().toLowerCase() === 'true';
}

function containsExampleLike(value, key = '') {
  if (isExampleLikeValue(value, key)) return true;
  if (Array.isArray(value)) return value.some((item) => containsExampleLike(item, key));
  if (value && typeof value === 'object') {
    if (isExampleLikeRecord(value)) return true;
    return Object.entries(value).some(([childKey, child]) => containsExampleLike(child, childKey));
  }
  return false;
}

function describePath(filePath) {
  return path.basename(filePath || 'unknown');
}

function checkDirectoryWritable(directory, issues) {
  const probe = path.join(directory, `.operation-data-probe-${process.pid}-${Date.now()}`);
  const renamed = `${probe}.renamed`;
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(probe, os.platform(), 'utf8');
    fs.renameSync(probe, renamed);
  } catch (error) {
    issues.push(`운영 데이터 디렉터리 쓰기/rename 점검 실패 (${path.basename(directory)}): ${error.code || error.message}`);
  } finally {
    try { fs.rmSync(probe, { force: true }); } catch (error) { /* best effort */ }
    try { fs.rmSync(renamed, { force: true }); } catch (error) { /* best effort */ }
  }
}

function runOperationDataPreflight(options = {}) {
  const env = options.env || process.env;
  const paths = options.paths || getOperationDataPaths(env);
  const strict = options.strict === undefined ? isProductionDataStrict(env) : options.strict;
  const issues = [];
  const warnings = [];
  const entries = Object.entries(paths).filter(([, filePath]) => configuredValue(filePath));
  const pathsByResolvedName = new Map();

  for (const [key, filePath] of entries) {
    const resolved = path.resolve(filePath);
    const previous = pathsByResolvedName.get(resolved);
    if (previous) issues.push(`서로 다른 데이터 종류가 같은 파일을 사용합니다: ${previous}, ${key}`);
    pathsByResolvedName.set(resolved, key);
  }

  for (const directory of new Set(entries.map(([, filePath]) => path.dirname(filePath)))) {
    checkDirectoryWritable(directory, issues);
  }

  for (const [key, filePath] of entries) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data && data.isExample === true) {
        issues.push(`${key}(${describePath(filePath)}): isExample=true`);
      }
      if (containsExampleLike(data)) {
        issues.push(`${key}(${describePath(filePath)}): example-like 레코드 혼입 의심`);
      }
    } catch (error) {
      issues.push(`${key}(${describePath(filePath)}): JSON parse 실패 (${error.message})`);
    }
  }

  if (!strict) warnings.push(...issues);
  return { ok: issues.length === 0, strict, issues, warnings, paths };
}

function enforceOperationDataPreflight(options = {}) {
  const result = runOperationDataPreflight(options);
  if (!result.ok && result.strict) {
    throw new Error(`운영 데이터 strict 점검 실패: ${result.issues.join(' / ')}`);
  }
  result.warnings.forEach((warning) => console.warn(`운영 데이터 점검 경고: ${warning}`));
  return result;
}

module.exports = {
  DEFINITIONS,
  REPOSITORY_DATA_DIR,
  enforceOperationDataPreflight,
  getOperationDataPaths,
  isProductionDataStrict,
  resolveOperationDataDir,
  runOperationDataPreflight,
};
