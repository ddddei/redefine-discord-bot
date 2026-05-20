const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

const dataFiles = {
  faq: path.join(dataDir, 'faq.json'),
  knowledge: path.join(dataDir, 'knowledge.json'),
  notices: path.join(dataDir, 'notices.json'),
  channels: path.join(dataDir, 'channels.json'),
  testQuestions: path.join(dataDir, 'test-questions.json'),
};

function fail(message) {
  console.error(`검증 실패: ${message}`);
  process.exitCode = 1;
}

function readJson(label, filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} 파싱 실패 - ${error.message}`);
    return null;
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateFaq(faq) {
  if (!Array.isArray(faq)) {
    fail('data/faq.json은 배열이어야 합니다.');
    return;
  }

  faq.forEach((item, index) => {
    if (!isStringArray(item.keywords)) {
      fail(`data/faq.json ${index + 1}번째 항목의 keywords는 문자열 배열이어야 합니다.`);
    }

    if (!isNonEmptyString(item.question)) {
      fail(`data/faq.json ${index + 1}번째 항목의 question은 문자열이어야 합니다.`);
    }

    if (!isNonEmptyString(item.answer)) {
      fail(`data/faq.json ${index + 1}번째 항목의 answer는 문자열이어야 합니다.`);
    }
  });
}

function validateKnowledge(knowledge) {
  const ids = new Set();

  if (!Array.isArray(knowledge)) {
    fail('data/knowledge.json은 배열이어야 합니다.');
    return;
  }

  knowledge.forEach((item, index) => {
    const label = `data/knowledge.json ${index + 1}번째 항목`;

    if (!isNonEmptyString(item.id)) {
      fail(`${label}의 id는 문자열이어야 합니다.`);
    } else if (ids.has(item.id)) {
      fail(`data/knowledge.json의 id가 중복되었습니다: ${item.id}`);
    } else {
      ids.add(item.id);
    }

    if (!isNonEmptyString(item.title)) {
      fail(`${label}의 title은 문자열이어야 합니다.`);
    }

    if (!isStringArray(item.keywords)) {
      fail(`${label}의 keywords는 문자열 배열이어야 합니다.`);
    }

    if (!isNonEmptyString(item.summary)) {
      fail(`${label}의 summary는 문자열이어야 합니다.`);
    }

    if (!isNonEmptyString(item.content)) {
      fail(`${label}의 content는 문자열이어야 합니다.`);
    }
  });
}

function validateNotices(notices) {
  if (!notices || typeof notices !== 'object' || Array.isArray(notices)) {
    fail('data/notices.json은 객체여야 합니다.');
  }
}

function validateChannels(channels) {
  if (!channels || typeof channels !== 'object' || !Array.isArray(channels.categories)) {
    fail('data/channels.json은 categories 배열을 가진 객체여야 합니다.');
  }
}

function validateTestQuestions(testQuestions) {
  if (!Array.isArray(testQuestions)) {
    fail('data/test-questions.json은 배열이어야 합니다.');
    return;
  }

  testQuestions.forEach((item, index) => {
    if (!isNonEmptyString(item.category)) {
      fail(`data/test-questions.json ${index + 1}번째 항목의 category는 문자열이어야 합니다.`);
    }

    if (!isStringArray(item.questions)) {
      fail(`data/test-questions.json ${index + 1}번째 항목의 questions는 문자열 배열이어야 합니다.`);
    }
  });
}

function main() {
  const faq = readJson('data/faq.json', dataFiles.faq);
  const knowledge = readJson('data/knowledge.json', dataFiles.knowledge);
  const notices = readJson('data/notices.json', dataFiles.notices);
  const channels = readJson('data/channels.json', dataFiles.channels);
  const testQuestions = readJson('data/test-questions.json', dataFiles.testQuestions);

  if (faq) validateFaq(faq);
  if (knowledge) validateKnowledge(knowledge);
  if (notices) validateNotices(notices);
  if (channels) validateChannels(channels);
  if (testQuestions) validateTestQuestions(testQuestions);

  if (process.exitCode) {
    process.exit(1);
  }

  console.log('data/faq.json 정상');
  console.log('data/knowledge.json 정상');
  console.log('data/notices.json 정상');
  console.log('data/channels.json 정상');
  console.log('data/test-questions.json 정상');
  console.log('데이터 검증이 완료되었습니다.');
}

main();
