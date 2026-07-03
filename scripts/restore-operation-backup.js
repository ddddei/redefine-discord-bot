// 운영 자동 백업 스냅샷을 data/*.local.json으로 복원하는 스크립트입니다.
// 사용법: node scripts/restore-operation-backup.js <snapshot.json> [--apply] [--force] [--data-dir <dir>]
// 기본은 dry-run이며 파일을 변경하지 않습니다. 봇을 정지한 상태에서 실행하세요.
const fs = require('fs');
const path = require('path');
const { getDefaultSnapshotPaths } = require('../src/operationBackup');
const { saveJsonFileAtomic } = require('../src/jsonStorage');

const LOCAL_FILENAMES = {
  points: 'points.local.json',
  shopItems: 'shop-items.local.json',
  redemptions: 'redemptions.local.json',
  missions: 'missions.local.json',
  missionTemplates: 'mission-templates.local.json',
  submissions: 'submissions.local.json',
  reactionApprovals: 'reaction-approvals.local.json',
  operatorSupport: 'operator-support.local.json',
  dmChatLogs: 'dm-chat-logs.local.json',
  dungeonworldLogs: 'dungeonworld-logs.local.json',
  dungeonworldConfig: 'dungeonworld-config.local.json',
  dailyMissionAnnouncements: 'daily-mission-announcements.local.json',
};

function parseArgs(argv) {
  const args = {
    snapshotPath: null,
    apply: false,
    force: false,
    dataDir: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--apply') {
      args.apply = true;
    } else if (value === '--force') {
      args.force = true;
    } else if (value === '--data-dir') {
      args.dataDir = argv[index + 1] || null;
      index += 1;
    } else if (!args.snapshotPath) {
      args.snapshotPath = value;
    }
  }

  return args;
}

function resolveTargetPaths(dataDir) {
  if (!dataDir) {
    return getDefaultSnapshotPaths();
  }

  const targetPaths = {};
  for (const [key, filename] of Object.entries(LOCAL_FILENAMES)) {
    targetPaths[key] = path.join(dataDir, filename);
  }
  return targetPaths;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.snapshotPath) {
    console.error('사용법: node scripts/restore-operation-backup.js <snapshot.json> [--apply] [--force] [--data-dir <dir>]');
    process.exit(1);
  }

  if (!fs.existsSync(args.snapshotPath)) {
    console.error(`스냅샷 파일을 찾을 수 없습니다: ${args.snapshotPath}`);
    process.exit(1);
  }

  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(args.snapshotPath, 'utf8'));
  } catch (error) {
    console.error(`스냅샷 파일을 읽지 못했습니다: ${error.message}`);
    process.exit(1);
  }

  if (!snapshot || typeof snapshot.files !== 'object' || snapshot.files === null) {
    console.error('스냅샷 형식이 올바르지 않습니다: files 항목이 없습니다.');
    process.exit(1);
  }

  const targetPaths = resolveTargetPaths(args.dataDir);
  const mode = args.apply ? '복원 실행' : 'dry-run (파일 변경 없음)';
  console.log(`운영 백업 복원 시작: ${args.snapshotPath}`);
  console.log(`- 생성 시각: ${snapshot.generatedAt || '알 수 없음'} / 트리거: ${snapshot.trigger || '알 수 없음'}`);
  console.log(`- 모드: ${mode}`);
  console.log('- 주의: 봇이 실행 중이면 복원 직후 봇 저장이 파일을 덮어쓸 수 있습니다. 봇을 정지한 상태에서 실행하세요.');
  console.log('');

  let restoredCount = 0;
  let skippedExistingCount = 0;

  for (const [key, filePath] of Object.entries(targetPaths)) {
    const data = snapshot.files[key];

    if (data === null || data === undefined) {
      console.log(`[건너뜀] ${key}: 스냅샷에 데이터 없음 (null)`);
      continue;
    }

    const exists = fs.existsSync(filePath);

    if (!args.apply) {
      console.log(`[dry-run] ${key}: ${exists ? '기존 파일 덮어쓰기 (--apply --force 필요)' : '새로 생성 (--apply 필요)'} → ${filePath}`);
      continue;
    }

    if (exists && !args.force) {
      console.log(`[보류] ${key}: 기존 파일이 있어 덮어쓰지 않았습니다. 덮어쓰려면 --force를 추가하세요 → ${filePath}`);
      skippedExistingCount += 1;
      continue;
    }

    saveJsonFileAtomic(filePath, data);
    console.log(`[복원] ${key} → ${filePath}`);
    restoredCount += 1;
  }

  console.log('');
  if (!args.apply) {
    console.log('dry-run이 완료되었습니다. 실제 복원은 --apply(기존 파일 덮어쓰기는 --apply --force)를 추가해 실행하세요.');
  } else {
    console.log(`운영 백업 복원이 완료되었습니다: 복원 ${restoredCount}건, 보류 ${skippedExistingCount}건`);
  }
}

main();
