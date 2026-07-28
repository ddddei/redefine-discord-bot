const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createWelcomeOnboardingConfig,
  handleGuildMemberAdd,
  isReminderDue,
  readWelcomeState,
  runWelcomeReminderTick,
} = require('../src/welcomeOnboarding');

const JOINED_AT = '2026-07-27T02:00:00.000Z';
const KST_NOON = new Date('2026-07-28T03:00:00.000Z');

function createStore(initialState = { version: 1, members: {} }) {
  return {
    state: structuredClone(initialState),
    saveCount: 0,
    load() {
      return structuredClone(this.state);
    },
    save(state) {
      this.state = structuredClone(state);
      this.saveCount += 1;
    },
  };
}

function createMember(options = {}) {
  const sent = [];
  const fallbackSent = [];
  const roleNames = options.roleNames || [];
  const member = {
    id: options.id || 'user-1',
    joinedAt: new Date(options.joinedAt || JOINED_AT),
    roles: {
      cache: new Map(roleNames.map((name, index) => [String(index), { name }])),
    },
    user: {
      bot: options.bot === true,
      async send(payload) {
        if (options.dmError) throw options.dmError;
        sent.push(payload);
      },
    },
    guild: {
      channels: {
        cache: {
          get(channelId) {
            if (channelId !== 'fallback-channel') return null;
            return {
              async send(payload) {
                fallbackSent.push(payload);
              },
            };
          },
        },
      },
    },
  };
  return { member, sent, fallbackSent };
}

function createEnabledConfig(overrides = {}) {
  return {
    ...createWelcomeOnboardingConfig({
      WELCOME_ONBOARDING_ENABLED: 'true',
      GUILD_ID: 'guild-1',
      WELCOME_CONSENT_CHANNEL_ID: 'consent-channel',
      WELCOME_NAMETAG_CHANNEL_ID: 'nametag-channel',
      WELCOME_FALLBACK_CHANNEL_ID: 'fallback-channel',
      WELCOME_REMINDER_HOURS: '24',
      WELCOME_REMINDER_QUIET: '22-9',
      PARTICIPANT_GUIDE_URL: 'https://example.com/guide',
    }),
    ...overrides,
  };
}

async function main() {
  // 1. S1: Given the default-off gate, When a member joins, Then nothing is sent or stored.
  const disabledStore = createStore();
  const disabledMember = createMember();
  await handleGuildMemberAdd(disabledMember.member, {
    config: createWelcomeOnboardingConfig({}),
    store: disabledStore,
    log() {},
  });
  assert.strictEqual(disabledMember.sent.length, 0);
  assert.deepStrictEqual(disabledStore.state.members, {});
  assert.strictEqual(createWelcomeOnboardingConfig({ WELCOME_REMINDER_HOURS: '' }).reminderHours, 24);

  // 2. S2: Given an enabled config, When a member joins, Then the welcome links and sent state are stored.
  const welcomeStore = createStore();
  const welcomeMember = createMember();
  await handleGuildMemberAdd(welcomeMember.member, {
    config: createEnabledConfig(),
    store: welcomeStore,
    log() {},
  });
  assert.strictEqual(welcomeMember.sent.length, 1);
  const welcomeButtons = welcomeMember.sent[0].components[0].toJSON().components;
  assert.ok(welcomeButtons.some((button) => button.url.includes('/guild-1/consent-channel')));
  assert.ok(welcomeButtons.some((button) => button.url === 'https://example.com/guide'));
  assert.strictEqual(welcomeStore.state.members['user-1'].welcomeDmStatus, 'sent');

  // 3. Given a bot account, When it joins, Then it is ignored.
  const botStore = createStore();
  const botMember = createMember({ bot: true });
  await handleGuildMemberAdd(botMember.member, {
    config: createEnabledConfig(),
    store: botStore,
    log() {},
  });
  assert.strictEqual(botMember.sent.length, 0);
  assert.deepStrictEqual(botStore.state.members, {});

  // 4. S3: Given blocked DMs, When a member joins, Then a mention-free fallback and failed state are recorded.
  const blockedError = new Error('Cannot send messages to this user');
  blockedError.code = 50007;
  const fallbackStore = createStore();
  const fallbackMember = createMember({ dmError: blockedError });
  await handleGuildMemberAdd(fallbackMember.member, {
    config: createEnabledConfig(),
    store: fallbackStore,
    log() {},
  });
  assert.strictEqual(fallbackMember.fallbackSent.length, 1);
  assert.ok(!fallbackMember.fallbackSent[0].content.includes('<@'));
  assert.strictEqual(fallbackStore.state.members['user-1'].welcomeDmStatus, 'failed');
  assert.ok(fallbackStore.state.members['user-1'].fallbackPostedAt);

  // 5. S4: Given a member due at noon KST, When two ticks run, Then one reminder is sent and recorded.
  const dueMember = createMember();
  const reminderStore = createStore({
    version: 1,
    members: {
      'user-1': { joinedAt: JOINED_AT, welcomeDmStatus: 'sent' },
    },
  });
  const reminderClient = {
    guilds: {
      cache: {
        get: () => ({
          members: { fetch: async () => dueMember.member },
        }),
      },
    },
  };
  assert.strictEqual(isReminderDue(reminderStore.state.members['user-1'], dueMember.member, createEnabledConfig(), KST_NOON), true);
  await runWelcomeReminderTick(reminderClient, {
    config: createEnabledConfig(),
    store: reminderStore,
    now: KST_NOON,
    log() {},
  });
  await runWelcomeReminderTick(reminderClient, {
    config: createEnabledConfig(),
    store: reminderStore,
    now: KST_NOON,
    log() {},
  });
  assert.strictEqual(dueMember.sent.length, 1);
  assert.ok(reminderStore.state.members['user-1'].reminderSentAt);

  // 6. S5: Given a due member, When KST is quiet or reaches 09:00, Then only 09:00 is due.
  const dueRecord = { joinedAt: '2026-07-27T00:00:00.000Z', welcomeDmStatus: 'sent' };
  assert.strictEqual(isReminderDue(dueRecord, dueMember.member, createEnabledConfig(), new Date('2026-07-28T14:00:00Z')), false);
  assert.strictEqual(isReminderDue(dueRecord, dueMember.member, createEnabledConfig(), new Date('2026-07-27T23:00:00Z')), false);
  assert.strictEqual(isReminderDue(dueRecord, dueMember.member, createEnabledConfig(), new Date('2026-07-28T00:00:00Z')), true);

  // 7. Given a consent role, When due is checked, Then the member is excluded.
  const consentedMember = createMember({ roleNames: ['참여자'] });
  assert.strictEqual(isReminderDue(dueRecord, consentedMember.member, createEnabledConfig(), KST_NOON), false);

  // 8. Given reminders are disabled, When due is checked, Then it is always false.
  assert.strictEqual(isReminderDue(dueRecord, dueMember.member, createEnabledConfig({ reminderHours: 0 }), KST_NOON), false);

  // 9. Given corrupt state JSON, When state is read, Then a clean version 1 state is returned.
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'welcome-onboarding-'));
  const corruptPath = path.join(tempDirectory, 'state.json');
  fs.writeFileSync(corruptPath, '{broken', 'utf8');
  assert.deepStrictEqual(readWelcomeState({ WELCOME_ONBOARDING_STATE_PATH: corruptPath }), {
    version: 1,
    members: {},
  });

  console.log('환영 자동화 흐름 테스트 통과');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
