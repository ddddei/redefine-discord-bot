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
