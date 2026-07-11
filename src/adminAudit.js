const fs = require('fs');
const { saveJsonFileAtomic } = require('./jsonStorage');
const { getOperationDataPaths } = require('./operationDataPaths');

const MAX_AUDIT_ENTRIES = 1000;

function readAuditData(filePath) {
  if (!fs.existsSync(filePath)) return { entries: [] };
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
}

function createAdminAudit(options = {}) {
  const filePath = options.filePath || getOperationDataPaths(options.env).adminAudit;
  const now = options.now || (() => new Date());

  function appendAuditEntry(input) {
    const data = readAuditData(filePath);
    const entry = {
      timestamp: now().toISOString(),
      action: String(input.action || ''),
      targetType: String(input.targetType || ''),
      targetId: String(input.targetId || ''),
      reason: input.reason ? String(input.reason).slice(0, 500) : null,
      result: String(input.result || ''),
      actor: input.actor ? String(input.actor).slice(0, 100) : 'admin-console',
      errorCode: input.errorCode ? String(input.errorCode) : null,
    };
    data.entries.push(entry);
    data.entries = data.entries.slice(-MAX_AUDIT_ENTRIES);
    saveJsonFileAtomic(filePath, data);
    return entry;
  }

  return { appendAuditEntry, filePath };
}

module.exports = { MAX_AUDIT_ENTRIES, createAdminAudit, readAuditData };
