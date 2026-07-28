const assert = require('assert');
const { Routes } = require('discord.js');
const {
  fetchGuildMembers,
  selectBulkDmTargets,
  sendBulkDirectMessages,
} = require('./send-track-lab-dm');

class FakeRest {
  constructor(members, failedUserId = null) {
    this.members = members;
    this.failedUserId = failedUserId;
    this.calls = [];
  }

  async get(route, options) {
    this.calls.push({ method: 'GET', route, options });
    return this.members;
  }

  async post(route, options) {
    this.calls.push({ method: 'POST', route, options });

    if (route === Routes.userChannels()) {
      return { id: `dm-${options.body.recipient_id}` };
    }

    const userId = route.replace('/channels/dm-', '').replace('/messages', '');
    if (userId === this.failedUserId) {
      throw new Error('DM disabled');
    }

    return { id: `message-${userId}` };
  }
}

async function main() {
  const members = [
    { user: { id: '1', username: 'alpha', bot: false } },
    { user: { id: '2', username: 'beta', bot: false } },
    { user: { id: '3', username: 'gamma', bot: false } },
    { user: { id: '4', username: 'excluded', bot: false } },
    { user: { id: '5', username: 'already-sent', bot: false } },
    { user: { id: '6', username: 'helper-bot', bot: true } },
  ];

  // Given: a guild member list with excluded, already-sent, and bot accounts.
  const rest = new FakeRest(members, '2');

  // When: members are fetched and filtered for a bulk DM run.
  const fetched = await fetchGuildMembers(rest, 'guild-test');
  const targets = selectBulkDmTargets(fetched, {
    excludedUsernames: new Set(['excluded']),
    alreadySentUsernames: new Set(['already-sent']),
  });

  // Then: only eligible human accounts remain in deterministic order.
  assert.deepStrictEqual(
    targets.map((target) => target.username),
    ['alpha', 'beta', 'gamma']
  );
  assert.strictEqual(rest.calls[0].route, Routes.guildMembers('guild-test'));
  assert.strictEqual(rest.calls[0].options.query.get('limit'), '1000');

  const progress = [];

  // Given: one eligible account rejects direct messages.
  // When: the bulk sender processes the full target list.
  const result = await sendBulkDirectMessages(rest, targets, {
    content: '안내 메시지',
    delayMs: 0,
    onProgress: (entry) => progress.push(entry),
  });

  // Then: successes and failures are reported without stopping later sends.
  assert.deepStrictEqual(
    result.sent.map((entry) => entry.username),
    ['alpha', 'gamma']
  );
  assert.deepStrictEqual(
    result.failed.map((entry) => entry.username),
    ['beta']
  );
  assert.strictEqual(progress.length, 3);

  const messageCalls = rest.calls.filter((call) => call.route.endsWith('/messages'));
  assert.strictEqual(messageCalls.length, 3);
  assert.deepStrictEqual(messageCalls[0].options.body.allowed_mentions, { parse: [] });

  console.log('track/lab bulk DM flow smoke test passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
