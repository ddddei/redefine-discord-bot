const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createWebgameRepository, getIsoWeekKey } = require('../src/webgameRepository');

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webgame-link-flow-'));
  const paths = {
    links: path.join(tempDir, 'webgame-links.local.json'),
    scores: path.join(tempDir, 'webgame-scores.local.json'),
  };
  const repository = createWebgameRepository(paths);
  const now = new Date('2026-07-06T00:00:00Z'); // 월요일

  // 1. 코드 발급 -> 검증 -> 토큰 발급
  const issued = repository.issueLinkCode({ discordId: 'user_1', displayName: '참여자1' }, now);
  assert.match(issued.code, /^\d{6}$/, '코드는 6자리 숫자여야 합니다.');

  const redeemed = repository.redeemLinkCode(issued.code, now);
  assert.strictEqual(redeemed.ok, true);
  assert.ok(redeemed.playerToken, 'playerToken이 발급돼야 합니다.');
  assert.strictEqual(redeemed.displayName, '참여자1');

  // 2. 동일 코드 재사용 불가(일회용, 검증 즉시 폐기)
  const reused = repository.redeemLinkCode(issued.code, now);
  assert.strictEqual(reused.ok, false);
  assert.strictEqual(reused.reason, 'CODE_NOT_FOUND');

  // 3. 코드 만료(10분 경과)
  const issuedForExpiry = repository.issueLinkCode({ discordId: 'user_2', displayName: '참여자2' }, now);
  const elevenMinutesLater = new Date(now.getTime() + 11 * 60 * 1000);
  const expiredResult = repository.redeemLinkCode(issuedForExpiry.code, elevenMinutesLater);
  assert.strictEqual(expiredResult.ok, false);
  assert.strictEqual(expiredResult.reason, 'CODE_EXPIRED');

  // 4. 재실행 시 기존 코드 폐기 후 재발급 (동일 discordId)
  const firstIssue = repository.issueLinkCode({ discordId: 'user_3', displayName: '참여자3' }, now);
  const secondIssue = repository.issueLinkCode({ discordId: 'user_3', displayName: '참여자3' }, now);
  const staleResult = repository.redeemLinkCode(firstIssue.code, now);
  assert.strictEqual(staleResult.ok, false, '재발급 후 이전 코드는 무효화되어야 합니다.');
  const freshResult = repository.redeemLinkCode(secondIssue.code, now);
  assert.strictEqual(freshResult.ok, true);

  // 5. 이미 연결된 사용자의 재연결 -> 토큰 재발급, 이전 토큰 무효화
  const firstToken = redeemed.playerToken;
  const reconnectIssue = repository.issueLinkCode({ discordId: 'user_1', displayName: '참여자1-새기기' }, now);
  const reconnectResult = repository.redeemLinkCode(reconnectIssue.code, now);
  assert.strictEqual(reconnectResult.ok, true);
  assert.notStrictEqual(reconnectResult.playerToken, firstToken, '재연결 시 새 토큰이 발급되어야 합니다.');
  assert.strictEqual(repository.getLinkByToken(firstToken), null, '이전 토큰은 무효화되어야 합니다.');
  assert.ok(repository.getLinkByToken(reconnectResult.playerToken), '새 토큰은 유효해야 합니다.');

  const activeToken = reconnectResult.playerToken;

  // 6. 점수 제출 -> 주간 랭킹 산출
  const weekKey = getIsoWeekKey(now);
  repository.recordScore({ discordId: 'user_1', gameId: 'match3', score: 1000 }, now);
  repository.recordScore({ discordId: 'user_1', gameId: 'match3', score: 1500 }, now);
  repository.recordScore({ discordId: 'user_3', gameId: 'match3', score: 800 }, now);

  const ranking = repository.listWeeklyRanking('match3', weekKey, { limit: 10 });
  assert.strictEqual(ranking.length, 2, '참여자별 최고 점수만 랭킹에 반영되어야 합니다.');
  assert.strictEqual(ranking[0].displayName, '참여자1-새기기');
  assert.strictEqual(ranking[0].score, 1500, '참여자당 최고 점수가 반영되어야 합니다.');
  assert.strictEqual(ranking[1].score, 800);

  const myRank = repository.getMyWeeklyRank('match3', weekKey, 'user_1');
  assert.strictEqual(myRank.rank, 1);
  assert.strictEqual(myRank.score, 1500);

  // 7. 이상치 플래그 휴리스틱: 직전 주 최고의 3배 초과 시 flagged
  const user2Issue = repository.issueLinkCode({ discordId: 'user_2', displayName: '참여자2' }, now);
  repository.redeemLinkCode(user2Issue.code, now);

  const previousWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousWeekKey = getIsoWeekKey(previousWeek);
  repository.recordScore({ discordId: 'user_2', gameId: 'match3', score: 1000, weekKey: previousWeekKey }, previousWeek);
  const previousBest = repository.getPreviousWeekBest('user_2', 'match3', weekKey);
  assert.strictEqual(previousBest.score, 1000);

  const normalRecord = repository.recordScore({ discordId: 'user_2', gameId: 'match3', score: 2500, flagged: false }, now);
  assert.strictEqual(normalRecord.flagged, false, '3배 이하 점수는 플래그되지 않아야 합니다.');

  const outlierRecord = repository.recordScore({ discordId: 'user_2', gameId: 'match3', score: 3500, flagged: true }, now);
  assert.strictEqual(outlierRecord.flagged, true);

  const rankingAfterFlag = repository.listWeeklyRanking('match3', weekKey, { limit: 10 });
  const user2Entry = rankingAfterFlag.find((entry) => entry.displayName === '참여자2');
  assert.ok(user2Entry, '플래그되지 않은 최고 점수(2500)는 랭킹에 남아야 합니다.');
  assert.strictEqual(user2Entry.score, 2500, 'flagged된 3500점은 랭킹 반영에서 제외되어야 합니다.');

  // 8. 토큰으로 연결 확인
  const linkByToken = repository.getLinkByToken(activeToken);
  assert.ok(linkByToken);
  assert.strictEqual(linkByToken.discordId, 'user_1');

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('webgame 연동 흐름 스모크 테스트를 통과했습니다.');
}

main();
