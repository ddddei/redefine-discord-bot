const assert = require('assert');
const { detectSensitiveQuestion, getSensitiveQuestionUserMessage } = require('../src/safety');

function main() {
  assert.strictEqual(detectSensitiveQuestion(''), null);
  assert.strictEqual(detectSensitiveQuestion('   '), null);
  assert.strictEqual(detectSensitiveQuestion(null), null);
  assert.strictEqual(detectSensitiveQuestion(undefined), null);

  const positiveCases = [
    ['죽고 싶다는 말을 봤어요', 'selfHarm'],
    ['자해 생각이 들면 어디에 말해야 하나요?', 'selfHarm'],
    ['누가 저를 위협해서 무서워요', 'danger'],
    ['병원에 가야 할지 모르겠어요', 'medicalCounseling'],
    ['상담 받을 수 있는 기관을 알려주세요', 'medicalCounseling'],
    ['정신과 가야 하나요', 'medicalCounseling'],
    ['친구가 같은 서버에 있으면 불편해요', 'unwantedContact'],
    ['DM으로 친해지자고 계속 연락이 와요', 'unwantedContact'],
    ['제 전화번호가 공개됐어요', 'privacyReport'],
    ['캡처해서 신고하고 싶어요', 'privacyReport'],
  ];

  for (const [question, expectedCategory] of positiveCases) {
    const detection = detectSensitiveQuestion(question);
    assert.ok(detection, `"${question}"는 민감 질문으로 감지되어야 합니다.`);
    assert.strictEqual(detection.category, expectedCategory, `"${question}"의 분류가 예상과 다릅니다.`);
    assert.ok(['urgent', 'attention'].includes(detection.severity));
  }

  const negativeCases = [
    '처음 왔는데 뭐부터 해요?',
    '오늘의 미션은 무엇인가요?',
    '포인트는 어떻게 얻나요?',
    '교통비 지원 있나요',
    '식사는 제공되나요',
    '노트북이 꼭 필요한가요',
    '나중에 들어와도 되나요',
  ];

  for (const question of negativeCases) {
    assert.strictEqual(detectSensitiveQuestion(question), null, `"${question}"는 민감 질문으로 감지되면 안 됩니다.`);
  }

  const detection = detectSensitiveQuestion('상담 받을 수 있는 기관을 알려주세요');
  const message = getSensitiveQuestionUserMessage(detection);
  assert.match(message, /운영진 확인이 필요할 수 있어요/);
  assert.match(message, /상담이나 판단을 대신하지 않/);
  assert.doesNotMatch(message, /병원|정신과|상담기관/);

  console.log('safety detection smoke test passed');
}

main();
