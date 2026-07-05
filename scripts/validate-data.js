const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

const dataFiles = {
  faq: path.join(dataDir, 'faq.json'),
  knowledge: path.join(dataDir, 'knowledge.json'),
  notices: path.join(dataDir, 'notices.json'),
  channels: path.join(dataDir, 'channels.json'),
  testQuestions: path.join(dataDir, 'test-questions.json'),
  wordPool: path.join(dataDir, 'word-pool.json'),
  webgameLinksExample: path.join(dataDir, 'webgame-links.example.json'),
  webgameScoresExample: path.join(dataDir, 'webgame-scores.example.json'),
  webgameSocialExample: path.join(dataDir, 'webgame-social.example.json'),
};

const blockedWordPoolTerms = new Set([
  '자살',
  '자해',
  '죽음',
  '사망',
  '질병',
  '부상',
  '상처',
  '폭력',
  '학대',
  '혐오',
  '차별',
  '욕설',
]);

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

function validateWordList(label, words, expectedCount) {
  const hangulTwoSyllables = /^[가-힣]{2}$/;
  const seen = new Set();

  if (!Array.isArray(words)) {
    fail(`${label}는 배열이어야 합니다.`);
    return null;
  }

  if (words.length !== expectedCount) {
    fail(`${label}는 ${expectedCount}개여야 합니다. 현재 ${words.length}개입니다.`);
  }

  words.forEach((word, index) => {
    if (typeof word !== 'string' || !hangulTwoSyllables.test(word)) {
      fail(`${label} ${index + 1}번째 항목은 두 글자 한글이어야 합니다.`);
    } else if (blockedWordPoolTerms.has(word)) {
      fail(`${label}에는 상처를 줄 수 있는 단어를 넣을 수 없습니다: ${word}`);
    } else if (seen.has(word)) {
      fail(`${label}에 중복 단어가 있습니다: ${word}`);
    } else {
      seen.add(word);
    }
  });

  return seen;
}

function validateWordPool(wordPool) {
  if (!wordPool || typeof wordPool !== 'object' || Array.isArray(wordPool)) {
    fail('data/word-pool.json은 객체여야 합니다.');
    return;
  }

  const answers = validateWordList('data/word-pool.json answers', wordPool.answers, 300);
  const validGuesses = validateWordList('data/word-pool.json validGuesses', wordPool.validGuesses, 1500);

  if (!answers || !validGuesses) return;

  answers.forEach((answer) => {
    if (!validGuesses.has(answer)) {
      fail(`data/word-pool.json answers가 validGuesses에 포함되지 않았습니다: ${answer}`);
    }
  });
}

function isStringOrNull(value) {
  return value === null || typeof value === 'string';
}

function validateWebgameLinks(linksData) {
  if (!linksData || typeof linksData !== 'object') {
    fail('data/webgame-links.example.json은 객체여야 합니다.');
    return;
  }

  if (!Array.isArray(linksData.links)) {
    fail('data/webgame-links.example.json의 links는 배열이어야 합니다.');
  } else {
    linksData.links.forEach((link, index) => {
      const label = `data/webgame-links.example.json links ${index + 1}번째 항목`;
      if (!isNonEmptyString(link.discordId)) fail(`${label}의 discordId는 문자열이어야 합니다.`);
      if (!isNonEmptyString(link.displayName)) fail(`${label}의 displayName은 문자열이어야 합니다.`);
      if (!isNonEmptyString(link.playerToken)) fail(`${label}의 playerToken은 문자열이어야 합니다.`);
      if (!isNonEmptyString(link.linkedAt)) fail(`${label}의 linkedAt은 문자열이어야 합니다.`);
    });
  }

  if (!Array.isArray(linksData.pendingCodes)) {
    fail('data/webgame-links.example.json의 pendingCodes는 배열이어야 합니다.');
  } else {
    linksData.pendingCodes.forEach((entry, index) => {
      const label = `data/webgame-links.example.json pendingCodes ${index + 1}번째 항목`;
      if (!isNonEmptyString(entry.code)) fail(`${label}의 code는 문자열이어야 합니다.`);
      if (!isNonEmptyString(entry.discordId)) fail(`${label}의 discordId는 문자열이어야 합니다.`);
      if (!isNonEmptyString(entry.displayName)) fail(`${label}의 displayName은 문자열이어야 합니다.`);
      if (!isNonEmptyString(entry.expiresAt)) fail(`${label}의 expiresAt은 문자열이어야 합니다.`);
    });
  }
}

function validateWebgameScores(scoresData) {
  if (!scoresData || typeof scoresData !== 'object') {
    fail('data/webgame-scores.example.json은 객체여야 합니다.');
    return;
  }

  if (!Array.isArray(scoresData.scores)) {
    fail('data/webgame-scores.example.json의 scores는 배열이어야 합니다.');
    return;
  }

  scoresData.scores.forEach((score, index) => {
    const label = `data/webgame-scores.example.json scores ${index + 1}번째 항목`;
    if (!isNonEmptyString(score.discordId)) fail(`${label}의 discordId는 문자열이어야 합니다.`);
    if (!isNonEmptyString(score.gameId)) fail(`${label}의 gameId는 문자열이어야 합니다.`);
    if (typeof score.score !== 'number') fail(`${label}의 score는 숫자여야 합니다.`);
    if (!isStringOrNull(score.seed)) fail(`${label}의 seed는 문자열 또는 null이어야 합니다.`);
    if (!isNonEmptyString(score.submittedAt)) fail(`${label}의 submittedAt은 문자열이어야 합니다.`);
    if (!isNonEmptyString(score.weekKey)) fail(`${label}의 weekKey는 문자열이어야 합니다.`);
    if (typeof score.flagged !== 'boolean') fail(`${label}의 flagged는 불리언이어야 합니다.`);
    if (score.mode !== undefined && !['free', 'daily'].includes(score.mode)) {
      fail(`${label}의 mode는 free 또는 daily여야 합니다.`);
    }
    if (score.dayKey !== undefined && !isStringOrNull(score.dayKey)) {
      fail(`${label}의 dayKey는 문자열 또는 null이어야 합니다.`);
    }
  });
}

function validateWebgameSocial(socialData) {
  if (!socialData || typeof socialData !== 'object') {
    fail('data/webgame-social.example.json은 객체여야 합니다.');
    return;
  }

  if (!isNonEmptyString(socialData.cheerSalt)) {
    fail('data/webgame-social.example.json의 cheerSalt는 문자열이어야 합니다.');
  }

  if (!Array.isArray(socialData.cheers)) {
    fail('data/webgame-social.example.json의 cheers는 배열이어야 합니다.');
    return;
  }

  socialData.cheers.forEach((cheer, index) => {
    const label = `data/webgame-social.example.json cheers ${index + 1}번째 항목`;
    if (!isNonEmptyString(cheer.fromDiscordId)) fail(`${label}의 fromDiscordId는 문자열이어야 합니다.`);
    if (!isNonEmptyString(cheer.targetDiscordId)) fail(`${label}의 targetDiscordId는 문자열이어야 합니다.`);
    if (!isNonEmptyString(cheer.gameId)) fail(`${label}의 gameId는 문자열이어야 합니다.`);
    if (!isNonEmptyString(cheer.periodKey)) fail(`${label}의 periodKey는 문자열이어야 합니다.`);
    if (!isNonEmptyString(cheer.createdAt)) fail(`${label}의 createdAt은 문자열이어야 합니다.`);
  });
}

function main() {
  const faq = readJson('data/faq.json', dataFiles.faq);
  const knowledge = readJson('data/knowledge.json', dataFiles.knowledge);
  const notices = readJson('data/notices.json', dataFiles.notices);
  const channels = readJson('data/channels.json', dataFiles.channels);
  const testQuestions = readJson('data/test-questions.json', dataFiles.testQuestions);
  const wordPool = readJson('data/word-pool.json', dataFiles.wordPool);
  const webgameLinksExample = readJson('data/webgame-links.example.json', dataFiles.webgameLinksExample);
  const webgameScoresExample = readJson('data/webgame-scores.example.json', dataFiles.webgameScoresExample);
  const webgameSocialExample = readJson('data/webgame-social.example.json', dataFiles.webgameSocialExample);

  if (faq) validateFaq(faq);
  if (knowledge) validateKnowledge(knowledge);
  if (notices) validateNotices(notices);
  if (channels) validateChannels(channels);
  if (testQuestions) validateTestQuestions(testQuestions);
  if (wordPool) validateWordPool(wordPool);
  if (webgameLinksExample) validateWebgameLinks(webgameLinksExample);
  if (webgameScoresExample) validateWebgameScores(webgameScoresExample);
  if (webgameSocialExample) validateWebgameSocial(webgameSocialExample);

  if (process.exitCode) {
    process.exit(1);
  }

  console.log('data/faq.json 정상');
  console.log('data/knowledge.json 정상');
  console.log('data/notices.json 정상');
  console.log('data/channels.json 정상');
  console.log('data/test-questions.json 정상');
  console.log('data/word-pool.json 정상');
  console.log('data/webgame-links.example.json 정상');
  console.log('data/webgame-scores.example.json 정상');
  console.log('data/webgame-social.example.json 정상');
  console.log('데이터 검증이 완료되었습니다.');
}

main();
