const fs = require('fs');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { saveJsonFileAtomic } = require('./jsonStorage');
const { getOnboardingRoleType } = require('./onboardingRoles');
const { getOperationDataPaths } = require('./operationDataPaths');

const WELCOME_CONTENT = `🌱 리디파인에 와 주셔서 고마워요.

처음이라 낯설 수 있는데, 아래 버튼을 순서대로 눌러 보면 금방 익숙해져요.
① 참여동의 확인 → ② 이름표 고르기 → ③ 참여자 가이드

서두르지 않아도 괜찮아요. 읽기만 해도, 이모지 반응만 눌러도 참여예요.
채팅창에 /안내 를 입력하면 언제든 시작 메뉴를 다시 볼 수 있어요.`;
const FALLBACK_CONTENT = `🌱 새로 오신 분들께 — 처음이라면 참여동의 채널의 안내를 먼저 확인해 주세요.
채팅창에 /안내 를 입력하면 시작 메뉴가 열려요. 궁금한 점은 운영진에게 편하게 물어봐 주세요.`;
const REMINDER_CONTENT = `🌱 어제 리디파인에 와 주셨죠. 천천히 하셔도 괜찮아요.

준비가 되면 아래 버튼으로 참여동의 안내만 먼저 확인해 주세요.
확인이 끝나면 다른 채널들이 열려요. 어려운 점이 있으면 운영진에게 편하게 말씀해 주세요.`;
const REMINDER_INTERVAL_MS = 10 * 60 * 1000;

let activeScheduler = null;
let activeStore = null;
let quietWarningIssued = false;
let tickRunning = false;

function createEmptyState() { return { version: 1, members: {} }; }

function parseReminderHours(value) {
  const parsed = Number(String(value === undefined ? '' : value).trim() || 24);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 24;
}

function parseQuietHours(value) {
  const match = String(value || '22-9').match(/^(\d{1,2})-(\d{1,2})$/);
  const start = match ? Number(match[1]) : -1;
  const end = match ? Number(match[2]) : -1;
  if (start >= 0 && start <= 23 && end >= 0 && end <= 23) return { quietStartHour: start, quietEndHour: end };
  if (!quietWarningIssued) {
    console.warn('WELCOME_REMINDER_QUIET 형식이 유효하지 않아 기본값 22-9를 사용합니다.');
    quietWarningIssued = true;
  }
  return { quietStartHour: 22, quietEndHour: 9 };
}

function createWelcomeOnboardingConfig(env = process.env) {
  return {
    enabled: env.WELCOME_ONBOARDING_ENABLED === 'true',
    guildId: String(env.GUILD_ID || '').trim(),
    consentChannelId: String(env.WELCOME_CONSENT_CHANNEL_ID || '').trim(),
    nametagChannelId: String(env.WELCOME_NAMETAG_CHANNEL_ID || '').trim(),
    fallbackChannelId: String(env.WELCOME_FALLBACK_CHANNEL_ID || '').trim(),
    reminderHours: parseReminderHours(env.WELCOME_REMINDER_HOURS),
    ...parseQuietHours(env.WELCOME_REMINDER_QUIET),
    guideUrl: String(env.PARTICIPANT_GUIDE_URL || '').trim(),
  };
}

function createChannelUrl(config, channelId) { return `https://discord.com/channels/${config.guildId}/${channelId}`; }

function createConsentButton(config) {
  return new ButtonBuilder()
    .setLabel('🌱 참여동의 하러 가기')
    .setStyle(ButtonStyle.Link)
    .setURL(createChannelUrl(config, config.consentChannelId));
}

function createWelcomeDmPayload(config) {
  const buttons = [createConsentButton(config)];
  if (config.nametagChannelId) {
    buttons.push(new ButtonBuilder()
      .setLabel('🏷️ 이름표 고르기')
      .setStyle(ButtonStyle.Link)
      .setURL(createChannelUrl(config, config.nametagChannelId)));
  }
  if (config.guideUrl) {
    buttons.push(new ButtonBuilder()
      .setLabel('📖 참여자 가이드 열기')
      .setStyle(ButtonStyle.Link)
      .setURL(config.guideUrl));
  }
  return {
    content: WELCOME_CONTENT,
    components: [new ActionRowBuilder().addComponents(buttons)],
  };
}

function createFallbackMessagePayload() {
  return { content: FALLBACK_CONTENT };
}

function createReminderDmPayload(config) {
  return {
    content: REMINDER_CONTENT,
    components: [new ActionRowBuilder().addComponents(createConsentButton(config))],
  };
}

function readWelcomeState(env = process.env) {
  const statePath = getOperationDataPaths(env).welcomeOnboarding;
  if (!fs.existsSync(statePath)) return createEmptyState();
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    if (!parsed || parsed.version !== 1 || !parsed.members || Array.isArray(parsed.members)) {
      return createEmptyState();
    }
    return parsed;
  } catch (error) {
    return createEmptyState();
  }
}

function saveWelcomeState(state, env = process.env) {
  saveJsonFileAtomic(getOperationDataPaths(env).welcomeOnboarding, state);
}

function createWelcomeOnboardingStore(env = process.env) {
  const store = {
    path: getOperationDataPaths(env).welcomeOnboarding,
    state: readWelcomeState(env),
    load() {
      return store.state;
    },
    save(state) {
      store.state = state;
      saveWelcomeState(store.state, env);
    },
  };
  return store;
}

function getWelcomeOnboardingStore(env = process.env) {
  const statePath = getOperationDataPaths(env).welcomeOnboarding;
  if (!activeStore || activeStore.path !== statePath) {
    activeStore = createWelcomeOnboardingStore(env);
  }
  return activeStore;
}

function writeMemberRecord(store, userId, record) {
  const state = store.load();
  state.members[userId] = record;
  store.save(state);
}

function reportFailure(log, message, error) {
  if (typeof log === 'function') log(message, error);
}

async function fetchFallbackChannel(member, channelId) {
  const cached = member.guild.channels.cache && member.guild.channels.cache.get(channelId);
  return cached || member.guild.channels.fetch(channelId);
}

async function handleGuildMemberAdd(member, { config, store, log }) {
  if (!config.enabled || member.user.bot) return;
  const joinedAt = member.joinedAt instanceof Date ? member.joinedAt.toISOString() : new Date().toISOString();
  try {
    await member.user.send(createWelcomeDmPayload(config));
    writeMemberRecord(store, member.id, { joinedAt, welcomeDmStatus: 'sent' });
    return;
  } catch (error) {
    writeMemberRecord(store, member.id, { joinedAt, welcomeDmStatus: 'failed' });
    reportFailure(log, '신규 입장자 환영 DM 전송 실패', error);
  }
  if (!config.fallbackChannelId) return;
  try {
    const channel = await fetchFallbackChannel(member, config.fallbackChannelId);
    await channel.send(createFallbackMessagePayload(config));
    const state = store.load();
    writeMemberRecord(store, member.id, {
      ...state.members[member.id],
      fallbackPostedAt: new Date().toISOString(),
    });
  } catch (error) {
    reportFailure(log, '신규 입장자 환영 폴백 안내 실패', error);
  }
}

function getKstHour(now) { return new Date(now.getTime() + 9 * 60 * 60 * 1000).getUTCHours(); }

function isQuietHour(hour, start, end) {
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function isReminderDue(record, member, config, now) {
  if (config.reminderHours <= 0 || record.reminderSentAt || getOnboardingRoleType(member) !== 'default') {
    return false;
  }
  const joinedAt = Date.parse(record.joinedAt);
  if (!Number.isFinite(joinedAt) || joinedAt + config.reminderHours * 60 * 60 * 1000 > now.getTime()) {
    return false;
  }
  return !isQuietHour(getKstHour(now), config.quietStartHour, config.quietEndHour);
}

async function getGuild(client, guildId) {
  const cached = client.guilds.cache && client.guilds.cache.get(guildId);
  return cached || client.guilds.fetch(guildId);
}

async function runWelcomeReminderTick(client, { config, store, now = new Date(), log }) {
  if (!config.enabled || config.reminderHours <= 0 || tickRunning) return;
  tickRunning = true;
  try {
    let guild;
    try {
      guild = await getGuild(client, config.guildId);
    } catch (error) {
      reportFailure(log, '환영 리마인드 서버 조회 실패', error);
      return;
    }
    for (const [userId, record] of Object.entries(store.load().members)) {
      if (record.reminderSentAt || record.leftAt) continue;
      let member;
      try {
        member = await guild.members.fetch(userId);
      } catch (error) {
        writeMemberRecord(store, userId, { ...record, leftAt: now.toISOString() });
        continue;
      }
      if (!isReminderDue(record, member, config, now)) continue;
      try {
        await member.user.send(createReminderDmPayload(config));
      } catch (error) {
        reportFailure(log, '참여동의 리마인드 DM 전송 실패', error);
      }
      writeMemberRecord(store, userId, { ...record, reminderSentAt: now.toISOString() });
    }
  } finally {
    tickRunning = false;
  }
}

function startWelcomeOnboardingScheduler(client, env = process.env) {
  const config = createWelcomeOnboardingConfig(env);
  if (!config.enabled || config.reminderHours <= 0) return { started: false, stop() {}, runNow: () => Promise.resolve() };
  if (activeScheduler) return activeScheduler;
  const store = getWelcomeOnboardingStore(env);
  const log = (message, error) => console.warn(`${message}:`, error.message);
  const runNow = () => runWelcomeReminderTick(client, { config, store, now: new Date(), log });
  Promise.resolve(runNow()).catch((error) => console.warn('환영 리마인드 실행 실패:', error.message));
  const timer = setInterval(() => Promise.resolve(runNow())
    .catch((error) => console.warn('환영 리마인드 실행 실패:', error.message)), REMINDER_INTERVAL_MS);
  if (typeof timer.unref === 'function') timer.unref();
  activeScheduler = {
    started: true,
    runNow,
    stop() {
      clearInterval(timer);
      activeScheduler = null;
    },
  };
  return activeScheduler;
}

function resetWelcomeOnboardingForTests() {
  if (activeScheduler) activeScheduler.stop();
  activeStore = null;
  quietWarningIssued = false;
  tickRunning = false;
}

module.exports = {
  createFallbackMessagePayload,
  createReminderDmPayload,
  createWelcomeDmPayload,
  createWelcomeOnboardingConfig,
  getWelcomeOnboardingStore,
  handleGuildMemberAdd,
  isReminderDue,
  readWelcomeState,
  resetWelcomeOnboardingForTests,
  runWelcomeReminderTick,
  saveWelcomeState,
  startWelcomeOnboardingScheduler,
};
