const fs = require('fs');
const path = require('path');

const testQuestionsPath = path.join(__dirname, '..', 'data', 'test-questions.json');

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadMatchers() {
  const originalLog = console.log;

  try {
    console.log = () => {};
    return require(path.join(__dirname, '..', 'src', 'index.js'));
  } finally {
    console.log = originalLog;
  }
}

function printCategoryHeader(category) {
  console.log('');
  console.log(`## ${category}`);
}

function printSummary(summary, fallbackQuestions) {
  console.log('');
  console.log('## 요약');
  console.log(`전체 질문 수: ${summary.total}`);
  console.log(`FAQ 매칭 수: ${summary.faq}`);
  console.log(`Knowledge 매칭 수: ${summary.knowledge}`);
  console.log(`Fallback 수: ${summary.fallback}`);

  console.log('');
  console.log('## Fallback 질문 목록');

  if (fallbackQuestions.length === 0) {
    console.log('Fallback으로 분류된 질문이 없습니다.');
    return;
  }

  for (const question of fallbackQuestions) {
    console.log(`- ${question}`);
  }
}

function main() {
  const groups = readJsonFile(testQuestionsPath);
  const { findFaqAnswer, findKnowledgeAnswer } = loadMatchers();
  const summary = {
    total: 0,
    faq: 0,
    knowledge: 0,
    fallback: 0,
  };
  const fallbackQuestions = [];

  console.log('운영 점검 질문 매칭 결과');

  for (const group of groups) {
    printCategoryHeader(group.category);

    for (const question of group.questions) {
      summary.total += 1;

      const faqMatch = findFaqAnswer(question);

      if (faqMatch) {
        summary.faq += 1;
        console.log(`[FAQ] ${question} → ${faqMatch.question}`);
        continue;
      }

      const knowledgeMatch = findKnowledgeAnswer(question);

      if (knowledgeMatch) {
        summary.knowledge += 1;
        console.log(`[Knowledge] ${question} → ${knowledgeMatch.title}`);
        continue;
      }

      summary.fallback += 1;
      fallbackQuestions.push(question);
      console.log(`[Fallback] ${question}`);
    }
  }

  printSummary(summary, fallbackQuestions);
}

main();
