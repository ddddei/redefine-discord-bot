const fs = require('fs');
const path = require('path');
const { getOperationDataPaths, runOperationDataPreflight } = require('./operationDataPaths');

const REQUIRED_ENV = ['DISCORD_TOKEN', 'CLIENT_ID', 'GUILD_ID', 'OPERATION_DATA_DIR'];
const RECOMMENDED_ENV = [
  'LOG_CHANNEL_ID',
  'ACTIVITY_REVIEW_CHANNEL_ID',
  'POINT_REDEEM_CHANNEL_ID',
  'TODAY_MISSION_CHANNEL_ID',
  'MINIGAME_CHANNEL_ID',
];
const OPTIONAL_ENV = [
  'ADMIN_DASHBOARD_ENABLED', 'ADMIN_WRITE_ENABLED', 'OPERATION_BACKUP_AUTO_ENABLED',
  'DM_CHAT_ENABLED', 'AI_ENABLED', 'OPS_REMINDER_ENABLED', 'WEEKLY_OPS_REPORT_ENABLED',
  'MISSION_SUBMISSION_CHANNEL_ID', 'SAFETY_ALERT_CHANNEL_ID', 'ADMIN_DASHBOARD_URL',
];

function isSet(env, name) {
  return typeof env[name] === 'string' && env[name].trim().length > 0;
}

function isEnabled(env, name) {
  return String(env[name] || '').trim().toLowerCase() === 'true';
}

function envState(env, names) {
  return names.map((name) => ({ name, configured: isSet(env, name) }));
}

function addDependency(blockers, env, feature, alternatives) {
  if (alternatives.some((name) => isSet(env, name))) return;
  blockers.push({
    code: `${feature}_DEPENDENCY_MISSING`,
    message: `${feature} 활성화에 필요한 환경변수가 설정되지 않았습니다.`,
    envNames: alternatives,
  });
}

function featureState(env, name, flag, dependencies = []) {
  return {
    name,
    enabled: isEnabled(env, flag),
    flag,
    dependencies: envState(env, dependencies),
  };
}

function sanitizePreflightIssue(issue) {
  if (/같은 파일/.test(issue)) return '서로 다른 운영 데이터 종류가 같은 파일을 사용합니다.';
  if (/쓰기\/rename/.test(issue)) return '운영 데이터 디렉터리 쓰기/rename 점검에 실패했습니다.';
  if (/JSON parse/.test(issue)) return '운영 데이터 JSON 파싱에 실패했습니다.';
  if (/isExample=true/.test(issue)) return '운영 데이터에 isExample=true 표시가 있습니다.';
  if (/example-like/.test(issue)) return '운영 데이터에 example 유사 레코드가 의심됩니다.';
  return '운영 데이터 preflight 점검에 실패했습니다.';
}

function runPrelaunchReadiness(options = {}) {
  const env = options.env || process.env;
  const blockers = [];
  const warnings = [];
  const ready = [];

  for (const item of envState(env, REQUIRED_ENV)) {
    if (item.configured) ready.push({ code: 'REQUIRED_ENV_READY', envName: item.name });
    else blockers.push({ code: 'REQUIRED_ENV_MISSING', message: '필수 환경변수가 설정되지 않았습니다.', envNames: [item.name] });
  }
  for (const item of envState(env, RECOMMENDED_ENV)) {
    if (item.configured) ready.push({ code: 'RECOMMENDED_ENV_READY', envName: item.name });
    else warnings.push({ code: 'RECOMMENDED_ENV_MISSING', message: '권장 환경변수가 설정되지 않았습니다.', envNames: [item.name] });
  }

  const features = [
    featureState(env, '관리자 콘솔', 'ADMIN_DASHBOARD_ENABLED', ['ADMIN_DASHBOARD_PASSWORD']),
    featureState(env, '관리자 콘솔 쓰기', 'ADMIN_WRITE_ENABLED', ['ADMIN_DASHBOARD_PASSWORD', 'ADMIN_WRITE_TOKEN']),
    featureState(env, '운영 자동 백업', 'OPERATION_BACKUP_AUTO_ENABLED', ['OPERATION_BACKUP_CHANNEL_ID', 'LOG_CHANNEL_ID']),
    featureState(env, 'DM 대화', 'DM_CHAT_ENABLED', ['DM_CHAT_LOG_CHANNEL_ID', 'LOG_CHANNEL_ID']),
    featureState(env, 'DM AI 대화', 'AI_ENABLED', ['AI_PROVIDER', 'AI_MODEL', 'OPENAI_API_KEY', 'GEMINI_API_KEY']),
    featureState(env, '운영 리마인더', 'OPS_REMINDER_ENABLED', ['OPS_REMINDER_CHANNEL_ID', 'ADMIN_CONSOLE_LOG_CHANNEL_ID', 'LOG_CHANNEL_ID']),
    featureState(env, '주간 운영 리포트', 'WEEKLY_OPS_REPORT_ENABLED', ['WEEKLY_OPS_REPORT_CHANNEL_ID', 'OPS_REMINDER_CHANNEL_ID', 'ADMIN_CONSOLE_LOG_CHANNEL_ID', 'LOG_CHANNEL_ID']),
  ];

  for (const feature of features.filter((item) => item.enabled)) {
    if (feature.name === '관리자 콘솔') addDependency(blockers, env, 'ADMIN_DASHBOARD', ['ADMIN_DASHBOARD_PASSWORD']);
    if (feature.name === '관리자 콘솔 쓰기') {
      addDependency(blockers, env, 'ADMIN_WRITE_PASSWORD', ['ADMIN_DASHBOARD_PASSWORD']);
      addDependency(blockers, env, 'ADMIN_WRITE_TOKEN', ['ADMIN_WRITE_TOKEN']);
    }
    if (feature.name === '운영 자동 백업') addDependency(blockers, env, 'OPERATION_BACKUP', ['OPERATION_BACKUP_CHANNEL_ID', 'LOG_CHANNEL_ID']);
    if (feature.name === 'DM 대화') addDependency(blockers, env, 'DM_CHAT_LOG', ['DM_CHAT_LOG_CHANNEL_ID', 'LOG_CHANNEL_ID']);
    if (feature.name === 'DM AI 대화') {
      addDependency(blockers, env, 'AI_PROVIDER', ['AI_PROVIDER']);
      addDependency(blockers, env, 'AI_MODEL', ['AI_MODEL']);
      const provider = String(env.AI_PROVIDER || '').trim().toLowerCase();
      if (provider === 'openai') addDependency(blockers, env, 'AI_KEY', ['OPENAI_API_KEY']);
      else if (provider === 'gemini') addDependency(blockers, env, 'AI_KEY', ['GEMINI_API_KEY']);
      else if (provider) blockers.push({ code: 'AI_PROVIDER_INVALID', message: '지원하지 않는 AI_PROVIDER입니다.', envNames: ['AI_PROVIDER'] });
    }
    if (feature.name === '운영 리마인더') addDependency(blockers, env, 'OPS_REMINDER', ['OPS_REMINDER_CHANNEL_ID', 'ADMIN_CONSOLE_LOG_CHANNEL_ID', 'LOG_CHANNEL_ID']);
    if (feature.name === '주간 운영 리포트') addDependency(blockers, env, 'WEEKLY_OPS_REPORT', ['WEEKLY_OPS_REPORT_CHANNEL_ID', 'OPS_REMINDER_CHANNEL_ID', 'ADMIN_CONSOLE_LOG_CHANNEL_ID', 'LOG_CHANNEL_ID']);
  }

  if (!isEnabled(env, 'PRODUCTION_DATA_STRICT')) {
    blockers.push({ code: 'PRODUCTION_DATA_STRICT_REQUIRED', message: '운영 시작 전 PRODUCTION_DATA_STRICT=true 설정이 필요합니다.', envNames: ['PRODUCTION_DATA_STRICT'] });
  }

  const resolvedPaths = options.paths || getOperationDataPaths(env);
  const safePaths = {};
  const seenPaths = new Map();
  const missingDirectories = new Set();
  for (const [key, filePath] of Object.entries(resolvedPaths)) {
    const resolved = path.resolve(filePath);
    if (seenPaths.has(resolved)) {
      blockers.push({ code: 'OPERATION_DATA_PREFLIGHT_FAILED', message: '서로 다른 운영 데이터 종류가 같은 파일을 사용합니다.', envNames: [] });
      continue;
    }
    seenPaths.set(resolved, key);
    if (!fs.existsSync(path.dirname(filePath))) {
      missingDirectories.add(path.dirname(filePath));
      continue;
    }
    safePaths[key] = filePath;
  }
  if (missingDirectories.size > 0) {
    blockers.push({ code: 'OPERATION_DATA_DIRECTORY_MISSING', message: '운영 데이터 디렉터리가 존재하지 않습니다.', envNames: ['OPERATION_DATA_DIR'] });
  }
  const preflight = runOperationDataPreflight({
    env,
    paths: safePaths,
    strict: true,
  });
  for (const issue of preflight.issues) {
    blockers.push({ code: 'OPERATION_DATA_PREFLIGHT_FAILED', message: sanitizePreflightIssue(issue), envNames: [] });
  }
  if (preflight.ok && missingDirectories.size === 0 && isSet(env, 'OPERATION_DATA_DIR')) {
    ready.push({ code: 'OPERATION_DATA_PREFLIGHT_READY' });
  }

  const manualActions = [
    'Railway 서비스가 단일 replica이고 Volume이 운영 데이터 경로에 연결됐는지 확인하세요.',
    'Discord 운영 채널별 봇의 채널 보기·메시지 보내기 권한을 확인하세요.',
    '대상 서버에 최신 Slash Command가 등록됐는지 확인하세요.',
    '관리자 콘솔을 데스크톱과 375×812 모바일 화면에서 확인하세요.',
    '실제 참여자 계정으로 DM·미션·교환·리포트 흐름을 리허설하세요.',
  ];

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    ready,
    manualActions,
    features,
    environment: {
      required: envState(env, REQUIRED_ENV),
      recommended: envState(env, RECOMMENDED_ENV),
      optional: envState(env, OPTIONAL_ENV),
    },
  };
}

function formatPrelaunchReadiness(result) {
  const lines = [
    '리디파인 운영 전 통합 점검',
    `결과: ${result.ok ? '자동 점검 통과' : '차단 항목 확인 필요'}`,
    `차단 ${result.blockers.length} · 경고 ${result.warnings.length} · 준비 ${result.ready.length}`,
    '',
    '[차단 항목]',
    ...(result.blockers.length ? result.blockers : [{ message: '없음', envNames: [] }]).map((item) => `- ${item.message}${item.envNames.length ? ` (${item.envNames.join(', ')})` : ''}`),
    '',
    '[경고]',
    ...(result.warnings.length ? result.warnings : [{ message: '없음', envNames: [] }]).map((item) => `- ${item.message}${item.envNames.length ? ` (${item.envNames.join(', ')})` : ''}`),
    '',
    '[환경변수 설정 여부]',
    ...result.environment.required.map((item) => `- 필수 ${item.name}: ${item.configured ? '설정됨' : '미설정'}`),
    ...result.environment.recommended.map((item) => `- 권장 ${item.name}: ${item.configured ? '설정됨' : '미설정'}`),
    ...result.environment.optional.map((item) => `- 선택 ${item.name}: ${item.configured ? '설정됨' : '미설정'}`),
    '',
    '[기능 상태]',
    ...result.features.map((item) => `- ${item.name}: ${item.enabled ? '활성' : '비활성'} (${item.flag})`),
    '',
    '[수동 확인]',
    ...result.manualActions.map((item) => `- ${item}`),
  ];
  return lines.join('\n');
}

module.exports = {
  OPTIONAL_ENV,
  RECOMMENDED_ENV,
  REQUIRED_ENV,
  formatPrelaunchReadiness,
  runPrelaunchReadiness,
};
