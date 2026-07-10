const fs = require('fs');
const path = require('path');

function saveJsonFileAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

function saveJsonFilesGroup(entries, options = {}) {
  const operationId = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const prepared = entries.map(({ filePath, data }) => ({
    filePath,
    data,
    tmpPath: `${filePath}.tmp-${operationId}`,
    rollbackPath: `${filePath}.rollback-${operationId}`,
    existed: fs.existsSync(filePath),
    committed: false,
  }));
  const fsApi = options.fs || fs;
  let restoreOk = true;

  try {
    for (const item of prepared) {
      fsApi.mkdirSync(path.dirname(item.filePath), { recursive: true });
      fsApi.writeFileSync(item.tmpPath, `${JSON.stringify(item.data, null, 2)}\n`, 'utf8');
      if (item.existed) fsApi.copyFileSync(item.filePath, item.rollbackPath);
    }
    for (const item of prepared) {
      fsApi.renameSync(item.tmpPath, item.filePath);
      item.committed = true;
    }
  } catch (error) {
    for (const item of prepared.slice().reverse()) {
      if (!item.committed) continue;
      try {
        if (item.existed && fsApi.existsSync(item.rollbackPath)) {
          fsApi.renameSync(item.rollbackPath, item.filePath);
        } else if (!item.existed) {
          fsApi.rmSync(item.filePath, { force: true });
        }
      } catch (restoreError) {
        restoreOk = false;
      }
    }
    throw new Error(`Failed to save JSON file group: ${error.message} (rollback ${restoreOk ? 'succeeded' : 'failed'})`);
  } finally {
    for (const item of prepared) {
      try { fsApi.rmSync(item.tmpPath, { force: true }); } catch (error) { /* best effort */ }
      try { fsApi.rmSync(item.rollbackPath, { force: true }); } catch (error) { /* best effort */ }
    }
  }
}

module.exports = {
  saveJsonFileAtomic,
  saveJsonFilesGroup,
};
