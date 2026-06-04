function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function isExampleLikeValue(value, key = '') {
  if (value === null || value === undefined) {
    return false;
  }

  const normalizedKey = String(key).toLowerCase();
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.toLowerCase();
  const isIdentifierField = normalizedKey === 'id'
    || normalizedKey.endsWith('id')
    || normalizedKey.includes('userid')
    || normalizedKey.includes('itemid')
    || normalizedKey.includes('missionid')
    || normalizedKey.includes('submissionid')
    || normalizedKey.includes('redemptionid')
    || normalizedKey.includes('transactionid');
  const isTextField = ['title', 'name', 'description', 'reason', 'note', 'content', 'displayname'].some((field) => normalizedKey.includes(field));

  if ((isIdentifierField || isTextField) && (normalized.includes('example') || normalized.includes('sample') || normalized.includes('demo') || value.includes('예시'))) {
    return true;
  }

  return (normalizedKey.endsWith('at') || normalizedKey.includes('date')) && /^20[3-9]\d/.test(value);
}

function isExampleLikeRecord(record) {
  if (!record || typeof record !== 'object') {
    return false;
  }

  return Object.entries(record).some(([key, value]) => isExampleLikeValue(value, key));
}

function filterOperationalRecords(records) {
  const original = toArray(records);
  const data = original.filter((record) => !isExampleLikeRecord(record));

  return {
    data,
    excluded: original.length - data.length,
  };
}

module.exports = {
  filterOperationalRecords,
  isExampleLikeRecord,
  isExampleLikeValue,
};
