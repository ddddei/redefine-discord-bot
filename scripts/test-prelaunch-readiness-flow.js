const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { main } = require('./check-prelaunch');
const { formatPrelaunchReadiness, runPrelaunchReadiness } = require('../src/prelaunchReadiness');

function captureMain(args, options) {
  let output = '';
  const exitCode = main(args, {
    ...options,
    stdout: { write(value) { output += value; } },
  });
  return { exitCode, output };
}

function checksum(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prelaunch-readiness-'));
try {
  const dataPath = path.join(tempDir, 'points.local.json');
  fs.writeFileSync(dataPath, JSON.stringify({ isExample: false, users: [], pointTransactions: [] }));
  const before = { checksum: checksum(dataPath), mtimeMs: fs.statSync(dataPath).mtimeMs };
  const secrets = {
    token: 'super-secret-discord-token',
    password: 'super-secret-admin-password',
    channel: '123456789012345678',
    url: 'https://private.example.test/admin',
    path: dataPath,
  };
  const env = {
    DISCORD_TOKEN: secrets.token,
    CLIENT_ID: 'client-secret-value',
    GUILD_ID: 'guild-secret-value',
    LOG_CHANNEL_ID: secrets.channel,
    ACTIVITY_REVIEW_CHANNEL_ID: '223456789012345678',
    POINT_REDEEM_CHANNEL_ID: '323456789012345678',
    TODAY_MISSION_CHANNEL_ID: '423456789012345678',
    MINIGAME_CHANNEL_ID: '523456789012345678',
    ADMIN_DASHBOARD_ENABLED: 'true',
    ADMIN_DASHBOARD_PASSWORD: secrets.password,
    ADMIN_DASHBOARD_URL: secrets.url,
    OPERATION_DATA_DIR: tempDir,
    PRODUCTION_DATA_STRICT: 'true',
  };
  const paths = { points: dataPath };
  const ready = runPrelaunchReadiness({ env, paths });
  assert.strictEqual(ready.ok, true);
  assert.strictEqual(ready.blockers.length, 0);
  assert.ok(ready.ready.some((item) => item.code === 'OPERATION_DATA_PREFLIGHT_READY'));

  const text = formatPrelaunchReadiness(ready);
  const json = JSON.stringify(ready);
  for (const secret of Object.values(secrets)) {
    assert.strictEqual(text.includes(secret), false);
    assert.strictEqual(json.includes(secret), false);
  }
  assert.strictEqual(Object.hasOwn(ready, 'paths'), false);
  assert.deepStrictEqual({ checksum: checksum(dataPath), mtimeMs: fs.statSync(dataPath).mtimeMs }, before);
  assert.strictEqual(fs.readdirSync(tempDir).some((name) => name.includes('.operation-data-probe-')), false);

  const missing = runPrelaunchReadiness({ env: {}, paths });
  assert.strictEqual(missing.ok, false);
  assert.strictEqual(missing.blockers.filter((item) => item.code === 'REQUIRED_ENV_MISSING').length, 4);
  assert.ok(missing.warnings.some((item) => item.code === 'RECOMMENDED_ENV_MISSING'));
  assert.strictEqual(missing.ready.some((item) => item.code === 'OPERATION_DATA_PREFLIGHT_READY'), false);

  const conflicted = runPrelaunchReadiness({
    env: {
      DISCORD_TOKEN: 'set', CLIENT_ID: 'set', GUILD_ID: 'set', OPERATION_DATA_DIR: tempDir, PRODUCTION_DATA_STRICT: 'true',
      ADMIN_WRITE_ENABLED: 'true', OPS_REMINDER_ENABLED: 'true', WEEKLY_OPS_REPORT_ENABLED: 'true',
    },
    paths,
  });
  assert.ok(conflicted.blockers.some((item) => item.code === 'ADMIN_WRITE_TOKEN_DEPENDENCY_MISSING'));
  assert.ok(conflicted.blockers.some((item) => item.code === 'OPS_REMINDER_DEPENDENCY_MISSING'));
  assert.ok(conflicted.blockers.some((item) => item.code === 'WEEKLY_OPS_REPORT_DEPENDENCY_MISSING'));

  const geminiReady = runPrelaunchReadiness({
    env: { ...env, AI_ENABLED: 'true', AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-test', GEMINI_API_KEY: 'gemini-secret' },
    paths,
  });
  assert.strictEqual(geminiReady.blockers.some((item) => item.code === 'AI_KEY_DEPENDENCY_MISSING'), false);
  assert.strictEqual(JSON.stringify(geminiReady).includes('gemini-secret'), false);

  const badPath = path.join(tempDir, 'bad.json');
  fs.writeFileSync(badPath, '{not-json');
  const badOptions = { env, paths: { points: badPath } };
  assert.strictEqual(captureMain([], badOptions).exitCode, 0);
  assert.strictEqual(captureMain(['--strict'], badOptions).exitCode, 1);
  const jsonResult = captureMain(['--json', '--strict'], badOptions);
  assert.strictEqual(jsonResult.exitCode, 1);
  const parsed = JSON.parse(jsonResult.output);
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.blockers.some((item) => item.code === 'OPERATION_DATA_PREFLIGHT_FAILED'));
  assert.strictEqual(jsonResult.output.includes(badPath), false);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

console.log('prelaunch readiness flow test passed');
