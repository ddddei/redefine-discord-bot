const fs = require('fs');
const path = require('path');

function saveJsonFileAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp`;

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      fs.rmSync(tmpPath, { force: true });
    } catch (cleanupError) {
      // 임시 파일 정리 실패는 원본 저장 실패보다 중요하지 않으므로 무시합니다.
    }
    throw new Error(`Failed to save JSON file "${filePath}": ${error.message}`);
  }
}

module.exports = {
  saveJsonFileAtomic,
};
