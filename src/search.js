const { faqList, knowledgeList } = require('./data');

const MIN_FAQ_SCORE = 5;

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(text) {
  return normalizeText(text).replace(/\s/g, '');
}

function getSearchTokens(text) {
  return [...new Set(
    normalizeText(text)
      .split(' ')
      .filter((token) => token.length >= 2)
  )];
}

function getCharacterPairs(text) {
  const compactedText = compactText(text);

  if (compactedText.length < 2) {
    return compactedText ? [compactedText] : [];
  }

  const pairs = [];

  for (let index = 0; index < compactedText.length - 1; index += 1) {
    pairs.push(compactedText.slice(index, index + 2));
  }

  return pairs;
}

function getSimilarityScore(firstText, secondText) {
  const firstPairs = getCharacterPairs(firstText);
  const secondPairs = getCharacterPairs(secondText);

  if (firstPairs.length === 0 || secondPairs.length === 0) {
    return 0;
  }

  const secondPairSet = new Set(secondPairs);
  const commonCount = firstPairs.filter((pair) => secondPairSet.has(pair)).length;

  return commonCount / Math.max(firstPairs.length, secondPairs.length);
}

function scoreFaqItem(item, userQuestion) {
  const questionCompact = compactText(userQuestion);
  const questionTokens = getSearchTokens(userQuestion);
  const faqText = [item.question, ...(Array.isArray(item.keywords) ? item.keywords : [])].join(' ');
  const faqCompact = compactText(faqText);
  const itemQuestionCompact = compactText(item.question);

  let score = 0;

  if (questionCompact.length < 2) {
    return score;
  }

  if (itemQuestionCompact === questionCompact) {
    score += 20;
  }

  if (faqCompact.includes(questionCompact)) {
    score += questionCompact.length >= 4 ? 6 : 3;
  }

  for (const token of questionTokens) {
    if (faqCompact.includes(compactText(token))) {
      score += token.length >= 3 ? 2 : 1;
    }
  }

  for (const keyword of Array.isArray(item.keywords) ? item.keywords : []) {
    const keywordCompact = compactText(keyword);

    if (keywordCompact.length < 2) {
      continue;
    }

    if (questionCompact === keywordCompact) {
      score += 10;
      continue;
    }

    if (questionCompact.includes(keywordCompact)) {
      score += keywordCompact.length >= 3 ? 6 : 3;
      continue;
    }

    if (keywordCompact.includes(questionCompact) && questionCompact.length >= 3) {
      score += 4;
      continue;
    }

    const similarityScore = getSimilarityScore(questionCompact, keywordCompact);

    if (similarityScore >= 0.75) {
      score += 4;
    } else if (similarityScore >= 0.55 && questionCompact.length <= 8) {
      score += 2;
    }
  }

  return score;
}

function findFaqAnswer(userQuestion) {
  const normalizedQuestion = normalizeText(userQuestion);

  if (!normalizedQuestion) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const item of faqList) {
    const score = scoreFaqItem(item, normalizedQuestion);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestScore < MIN_FAQ_SCORE) {
    return null;
  }

  return bestMatch;
}

function scoreKnowledgeItem(item, userQuestion) {
  return scoreFaqItem(
    {
      question: item.title,
      keywords: item.keywords,
    },
    userQuestion
  );
}

function findKnowledgeAnswer(userQuestion) {
  const normalizedQuestion = normalizeText(userQuestion);

  if (!normalizedQuestion) {
    return null;
  }

  let bestMatch = null;
  let bestScore = 0;

  for (const item of knowledgeList) {
    const score = scoreKnowledgeItem(item, normalizedQuestion);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestScore < MIN_FAQ_SCORE) {
    return null;
  }

  return bestMatch;
}

module.exports = {
  compactText,
  findFaqAnswer,
  findKnowledgeAnswer,
  getCharacterPairs,
  getSearchTokens,
  getSimilarityScore,
  normalizeText,
  scoreFaqItem,
  scoreKnowledgeItem,
};
