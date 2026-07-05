const fs = require('fs');
const path = require('path');
const { saveJsonFileAtomic } = require('../src/jsonStorage');
const { DEFAULT_DM_CHAT_LOG_PATH } = require('../src/dmChatRepository');

const DEFAULT_RETENTION_DAYS = 90;
const SAFETY_RECORD_RETENTION_DAYS = 180;

function parseArgs(argv) {
  const args = {
    apply: false,
    user: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--apply') {
      args.apply = true;
    } else if (token === '--user') {
      args.user = argv[index + 1] || null;
      index += 1;
    } else if (token.startsWith('--user=')) {
      args.user = token.slice('--user='.length);
    }
  }

  return args;
}

function getRetentionDays() {
  const parsed = Number.parseInt(process.env.DM_CHAT_RETENTION_DAYS || `${DEFAULT_RETENTION_DAYS}`, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return DEFAULT_RETENTION_DAYS;
  }

  return parsed;
}

function getLogPath() {
  return process.env.DM_CHAT_LOG_PATH || DEFAULT_DM_CHAT_LOG_PATH;
}

function loadRawData(logPath) {
  if (!fs.existsSync(logPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(logPath, 'utf8'));
}

function isSafetyRecord(message) {
  return Boolean(message && message.safetyDetection);
}

function getMessageAgeDays(message, now) {
  const messageTime = new Date(message && message.createdAt).getTime();

  if (Number.isNaN(messageTime)) {
    return 0;
  }

  return (now - messageTime) / (24 * 60 * 60 * 1000);
}

function isMessageExpired(message, now, retentionDays) {
  const ageDays = getMessageAgeDays(message, now);
  const limitDays = isSafetyRecord(message) ? SAFETY_RECORD_RETENTION_DAYS : retentionDays;

  if (limitDays === 0) {
    // retentionDays=0 은 무기한 보관. 단, 안전 레코드는 항상 180일 상수를 적용한다.
    if (!isSafetyRecord(message)) {
      return false;
    }
    return ageDays > SAFETY_RECORD_RETENTION_DAYS;
  }

  return ageDays > limitDays;
}

function createBackupCopy(logPath, data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = path.basename(logPath, path.extname(logPath));
  const backupPath = path.join(
    path.dirname(logPath),
    `${baseName}.backup-${timestamp}.json`
  );

  saveJsonFileAtomic(backupPath, data);
  return backupPath;
}

function runRetentionCleanup(data, { now, retentionDays }) {
  const expired = [];
  const kept = [];

  for (const message of data.messages) {
    if (isMessageExpired(message, now, retentionDays)) {
      expired.push(message);
    } else {
      kept.push(message);
    }
  }

  return {
    nextData: {
      ...data,
      messages: kept,
      // notices/historyResets는 재고지 방지·초기화 기준점 보존을 위해 항상 유지한다.
    },
    removedCount: expired.length,
    remainingCount: kept.length,
  };
}

function runUserDeletion(data, userId) {
  const beforeMessages = data.messages.length;
  const beforeNotices = data.notices.length;
  const beforeResets = data.historyResets.length;
  const beforeScenarios = Array.isArray(data.activeScenarios) ? data.activeScenarios.length : 0;

  const nextData = {
    ...data,
    messages: data.messages.filter((message) => message.userId !== userId),
    notices: data.notices.filter((notice) => notice.userId !== userId),
    historyResets: data.historyResets.filter((reset) => reset.userId !== userId),
    activeScenarios: (data.activeScenarios || []).filter((scenario) => scenario.userId !== userId),
  };

  return {
    nextData,
    removed: {
      messages: beforeMessages - nextData.messages.length,
      notices: beforeNotices - nextData.notices.length,
      historyResets: beforeResets - nextData.historyResets.length,
      activeScenarios: beforeScenarios - nextData.activeScenarios.length,
    },
  };
}

function printSummaryHeader({ logPath, apply, now, retentionDays, targetUser }) {
  console.log('DM 대화 로그 정리 스크립트');
  console.log(`- 로그 파일: ${logPath}`);
  console.log(`- 모드: ${apply ? '적용(--apply)' : 'dry-run (미리보기, 아무것도 바꾸지 않음)'}`);
  console.log(`- 기준 시각: ${now.toISOString()}`);

  if (targetUser) {
    console.log(`- 대상: 사용자 ${targetUser} 전체 삭제`);
  } else {
    console.log(`- 보존 기준: user/assistant 일반 레코드 ${retentionDays === 0 ? '무기한' : `${retentionDays}일`}, 안전 감지 레코드 ${SAFETY_RECORD_RETENTION_DAYS}일`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const logPath = getLogPath();
  const now = new Date();
  const retentionDays = getRetentionDays();

  printSummaryHeader({ logPath, apply: args.apply, now, retentionDays, targetUser: args.user });

  const data = loadRawData(logPath);

  if (!data) {
    console.log('- 로그 파일이 존재하지 않습니다. 정리할 대상이 없습니다.');
    return;
  }

  if (args.user) {
    const { nextData, removed } = runUserDeletion(data, args.user);

    console.log(`- 제거 대상: 메시지 ${removed.messages}건, notices ${removed.notices}건, historyResets ${removed.historyResets}건, activeScenarios ${removed.activeScenarios}건`);

    if (!args.apply) {
      console.log('- dry-run이므로 실제로 지우지 않았습니다. 적용하려면 --apply를 추가하세요.');
      return;
    }

    const backupPath = createBackupCopy(logPath, data);
    console.log(`- 정리 전 백업 사본 생성: ${backupPath}`);
    saveJsonFileAtomic(logPath, nextData);
    console.log('- 사용자 데이터 삭제를 완료했습니다.');
    console.log('- 참고: 위에서 만든 백업 사본에는 과거 데이터가 남아 있어 완전 삭제는 아닙니다.');
    return;
  }

  const { nextData, removedCount, remainingCount } = runRetentionCleanup(data, { now, retentionDays });

  console.log(`- 제거 대상: ${removedCount}건 (남는 메시지: ${remainingCount}건)`);

  if (!args.apply) {
    console.log('- dry-run이므로 실제로 지우지 않았습니다. 적용하려면 --apply를 추가하세요.');
    return;
  }

  if (removedCount === 0) {
    console.log('- 제거 대상이 없어 백업/저장을 생략합니다.');
    return;
  }

  const backupPath = createBackupCopy(logPath, data);
  console.log(`- 정리 전 백업 사본 생성: ${backupPath}`);
  saveJsonFileAtomic(logPath, nextData);
  console.log('- 보존 기간 경과 메시지 정리를 완료했습니다.');
}

if (require.main === module) {
  main();
}

module.exports = {
  SAFETY_RECORD_RETENTION_DAYS,
  isMessageExpired,
  runRetentionCleanup,
  runUserDeletion,
};
