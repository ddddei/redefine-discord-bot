const { spawnSync } = require('child_process');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const checks = [
  {
    label: 'src/index.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/index.js'],
  },
  {
    label: 'src/ai.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/ai.js'],
  },
  {
    label: 'src/safety.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/safety.js'],
  },
  {
    label: 'src/onboardingRoles.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/onboardingRoles.js'],
  },
  {
    label: 'src/deploy-commands.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/deploy-commands.js'],
  },
  {
    label: 'src/handlers.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/handlers.js'],
  },
  {
    label: 'src/embeds.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/embeds.js'],
  },
  {
    label: 'src/components.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/components.js'],
  },
  {
    label: 'src/pointsStore.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/pointsStore.js'],
  },
  {
    label: 'src/pointsRepository.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/pointsRepository.js'],
  },
  {
    label: 'src/reactionApproval.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/reactionApproval.js'],
  },
  {
    label: 'src/adminAuth.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/adminAuth.js'],
  },
  {
    label: 'src/adminApi.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/adminApi.js'],
  },
  {
    label: 'src/adminServer.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/adminServer.js'],
  },
  {
    label: 'public/admin/admin.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/admin/admin.js'],
  },
  {
    label: 'src/exportUtils.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/exportUtils.js'],
  },
  {
    label: 'scripts/test-points-store.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-points-store.js'],
  },
  {
    label: 'scripts/test-points-repository.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-points-repository.js'],
  },
  {
    label: 'scripts/test-point-activity-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-point-activity-flow.js'],
  },
  {
    label: 'scripts/test-admin-management-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-admin-management-flow.js'],
  },
  {
    label: 'scripts/test-operation-export-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-operation-export-flow.js'],
  },
  {
    label: 'scripts/test-participant-ux-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-participant-ux-flow.js'],
  },
  {
    label: 'scripts/test-reaction-approval-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-reaction-approval-flow.js'],
  },
  {
    label: 'scripts/test-operator-hub-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-operator-hub-flow.js'],
  },
  {
    label: 'scripts/test-admin-dashboard-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-admin-dashboard-flow.js'],
  },
  {
    label: 'pointsStore smoke test',
    command: 'node',
    args: ['scripts/test-points-store.js'],
  },
  {
    label: 'pointsRepository smoke test',
    command: 'node',
    args: ['scripts/test-points-repository.js'],
  },
  {
    label: 'point activity flow smoke test',
    command: 'node',
    args: ['scripts/test-point-activity-flow.js'],
  },
  {
    label: 'admin management flow smoke test',
    command: 'node',
    args: ['scripts/test-admin-management-flow.js'],
  },
  {
    label: 'operation export flow smoke test',
    command: 'node',
    args: ['scripts/test-operation-export-flow.js'],
  },
  {
    label: 'participant UX flow smoke test',
    command: 'node',
    args: ['scripts/test-participant-ux-flow.js'],
  },
  {
    label: 'reaction approval flow smoke test',
    command: 'node',
    args: ['scripts/test-reaction-approval-flow.js'],
  },
  {
    label: 'operator hub flow smoke test',
    command: 'node',
    args: ['scripts/test-operator-hub-flow.js'],
  },
  {
    label: 'admin dashboard flow smoke test',
    command: 'node',
    args: ['scripts/test-admin-dashboard-flow.js'],
  },
  {
    label: '데이터 구조 검사',
    command: npmCommand,
    args: ['run', 'validate:data'],
  },
  {
    label: '질문 매칭 테스트',
    command: npmCommand,
    args: ['run', 'test:questions'],
  },
];

function runCheck(check) {
  console.log('');
  console.log(`릴리즈 점검 시작: ${check.label}`);

  const result = spawnSync(check.command, check.args, {
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`릴리즈 점검 실패: ${check.label}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`릴리즈 점검 실패: ${check.label}`);
    process.exit(result.status || 1);
  }
}

for (const check of checks) {
  runCheck(check);
}

console.log('');
console.log('릴리즈 기본 점검이 완료되었습니다.');
