const assert = require('assert');
const { recordBackfillResult, selectBackfillTargets } = require('./send-welcome-backfill');

const ONBOARDING_ROLE_IDS = new Set(['role-consent', 'role-basic']);

function createMember({ id, username, bot = false, roles = [], nick = null, globalName = null }) {
  return { nick, roles, user: { id, username, bot, global_name: globalName } };
}

// 1. 온보딩/참여자 역할이 하나라도 있으면 제외, 없으면 대상.
const targets = selectBackfillTargets([
  createMember({ id: '1', username: 'no-role-user' }),
  createMember({ id: '2', username: 'consented-user', roles: ['role-consent'] }),
  createMember({ id: '3', username: 'other-role-user', roles: ['role-unrelated'] }),
], ONBOARDING_ROLE_IDS);
assert.deepStrictEqual(targets.map((target) => target.username), ['no-role-user', 'other-role-user']);

// 2. 봇 계정과 운영진 제외 목록은 대상에서 빠진다.
const filtered = selectBackfillTargets([
  createMember({ id: '4', username: 'bot-user', bot: true }),
  createMember({ id: '5', username: 'operator-user' }),
  createMember({ id: '6', username: 'participant-user' }),
], ONBOARDING_ROLE_IDS, { excludedUsernames: new Set(['operator-user']) });
assert.deepStrictEqual(filtered.map((target) => target.username), ['participant-user']);

// 3. 표시 이름은 nick > global_name > username 순서.
const [displayTarget] = selectBackfillTargets(
  [createMember({ id: '7', username: 'name-user', nick: '별명', globalName: '글로벌' })],
  ONBOARDING_ROLE_IDS
);
assert.strictEqual(displayTarget.displayName, '별명');

// 4. 발송 성공자는 reminderSentAt이 채워져 리마인드 중복이 차단되고, 기존 joinedAt은 보존된다.
const savedStates = [];
const fakeStore = {
  state: { version: 1, members: { '8': { joinedAt: '2026-07-01T00:00:00.000Z', welcomeDmStatus: 'failed' } } },
  load() { return this.state; },
  save(state) { this.state = state; savedStates.push(state); },
};
const now = new Date('2026-07-29T03:00:00.000Z');
recordBackfillResult(fakeStore, { sent: [{ id: '8' }, { id: '9' }], failed: [] }, now);
assert.strictEqual(savedStates.length, 1);
assert.strictEqual(fakeStore.state.members['8'].joinedAt, '2026-07-01T00:00:00.000Z');
assert.strictEqual(fakeStore.state.members['8'].welcomeDmStatus, 'sent');
assert.strictEqual(fakeStore.state.members['8'].reminderSentAt, now.toISOString());
assert.strictEqual(fakeStore.state.members['9'].joinedAt, now.toISOString());
assert.strictEqual(fakeStore.state.members['9'].reminderSentAt, now.toISOString());

console.log('환영 백필 대상 선정·기록 테스트 통과');
