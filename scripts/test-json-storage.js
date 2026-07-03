const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { saveJsonFileAtomic } = require('../src/jsonStorage');

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-storage-test-'));

try {
  // 1. 기존 saveJsonFile 출력과 바이트 단위로 동일한 포맷을 유지해야 합니다.
  const sample = { users: [{ userId: 'u1', totalPoints: 10 }], isExample: false };
  const samplePath = path.join(workDir, 'sample.json');
  saveJsonFileAtomic(samplePath, sample);
  assert.strictEqual(
    fs.readFileSync(samplePath, 'utf8'),
    `${JSON.stringify(sample, null, 2)}\n`,
    '저장 포맷은 JSON.stringify(data, null, 2) + 개행이어야 합니다.'
  );

  // 2. 저장 성공 후 임시 파일이 남지 않아야 합니다.
  assert.strictEqual(fs.existsSync(`${samplePath}.tmp`), false, '.tmp 파일이 남아 있으면 안 됩니다.');

  // 3. 중첩 디렉터리를 자동으로 생성해야 합니다.
  const nestedPath = path.join(workDir, 'nested', 'deep', 'state.json');
  saveJsonFileAtomic(nestedPath, { ok: true });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(nestedPath, 'utf8')), { ok: true });

  // 4. 기존 파일을 새 내용으로 교체해야 합니다.
  saveJsonFileAtomic(samplePath, { replaced: true });
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(samplePath, 'utf8')), { replaced: true });

  // 5. 저장 실패 시 기존과 동일한 형식의 에러를 던져야 합니다.
  const blockedParent = path.join(workDir, 'blocked');
  fs.writeFileSync(blockedParent, 'not a directory');
  const blockedPath = path.join(blockedParent, 'state.json');
  assert.throws(
    () => saveJsonFileAtomic(blockedPath, { ok: false }),
    (error) => error.message.startsWith(`Failed to save JSON file "${blockedPath}":`),
    '저장 실패 에러 메시지 형식이 유지되어야 합니다.'
  );

  // 6. pointsStore.saveJsonFile은 원자 저장 유틸에 위임된 뒤에도 같은 결과를 내야 합니다.
  const { saveJsonFile, loadJsonFile } = require('../src/pointsStore');
  const storePath = path.join(workDir, 'store.json');
  saveJsonFile(storePath, sample);
  assert.strictEqual(fs.readFileSync(storePath, 'utf8'), `${JSON.stringify(sample, null, 2)}\n`);
  assert.deepStrictEqual(loadJsonFile(storePath), sample);
  assert.strictEqual(fs.existsSync(`${storePath}.tmp`), false);
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}

console.log('jsonStorage 원자 저장 스모크 테스트를 통과했습니다.');
