require('dotenv').config();

const { REST, Routes } = require('discord.js');
const { ONBOARDING_ROLE_TYPES } = require('../src/onboardingRoles');
const {
  createWelcomeDmPayload,
  createWelcomeOnboardingConfig,
  getWelcomeOnboardingStore,
} = require('../src/welcomeOnboarding');

const EXECUTION_CONFIRMATION = 'WELCOME_BACKFILL_2026_07_28';
// 운영진 계정은 발송 대상에서 제외합니다 (send-track-lab-dm.js와 동일 목록).
const EXCLUDED_USERNAMES = new Set([
  'kueol_70854',
  'hwang_stoneiron',
  'gmyouthzone',
  'bead_1',
  'hanpilgu.',
]);
const BACKFILL_MESSAGE = `🌱 리디파인에 함께해 주셔서 고마워요.

혹시 아직 첫 단계가 낯설다면, 아래 버튼을 순서대로 눌러 보세요.
① 참여동의 확인 → ② 이름표 고르기 → ③ 참여자 가이드

이미 하셨다면 이 메시지는 편하게 넘기셔도 됩니다.
채팅창에 /안내 를 입력하면 언제든 시작 메뉴를 볼 수 있어요.`;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchGuildMembers(rest, guildId) {
  return rest.get(Routes.guildMembers(guildId), {
    query: new URLSearchParams({ limit: '1000' }),
  });
}

async function fetchOnboardingRoleIds(rest, guildId) {
  const roles = await rest.get(Routes.guildRoles(guildId));
  const targetNames = new Set(ONBOARDING_ROLE_TYPES.keys());
  return new Set(roles.filter((role) => targetNames.has(role.name)).map((role) => role.id));
}

function selectBackfillTargets(members, onboardingRoleIds, { excludedUsernames = EXCLUDED_USERNAMES } = {}) {
  return members
    .filter(({ roles, user }) => {
      if (!user || user.bot) return false;
      if (excludedUsernames.has(user.username)) return false;
      return !(roles || []).some((roleId) => onboardingRoleIds.has(roleId));
    })
    .map(({ nick, user }) => ({
      id: user.id,
      username: user.username,
      displayName: nick || user.global_name || user.username,
    }))
    .sort((left, right) => left.username.localeCompare(right.username));
}

async function sendBackfillMessages(rest, targets, { content, components, delayMs = 1250, onProgress = () => {} }) {
  const result = { sent: [], failed: [] };

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    try {
      const channel = await rest.post(Routes.userChannels(), {
        body: { recipient_id: target.id },
      });
      await rest.post(Routes.channelMessages(channel.id), {
        body: {
          content,
          components,
          allowed_mentions: { parse: [] },
        },
      });
      result.sent.push(target);
      onProgress({ status: 'sent', target, index, total: targets.length });
    } catch (error) {
      const failed = { ...target, error: error instanceof Error ? error.message : String(error) };
      result.failed.push(failed);
      onProgress({ status: 'failed', target: failed, index, total: targets.length });
    }
    if (delayMs > 0 && index < targets.length - 1) {
      await wait(delayMs);
    }
  }

  return result;
}

function recordBackfillResult(store, result, now = new Date()) {
  const state = store.load();
  const sentAt = now.toISOString();
  for (const target of result.sent) {
    // 백필 DM 자체가 안내 1회이므로 reminderSentAt을 채워 리마인드 중복 발송을 막습니다.
    state.members[target.id] = {
      ...(state.members[target.id] || {}),
      joinedAt: state.members[target.id] && state.members[target.id].joinedAt ? state.members[target.id].joinedAt : sentAt,
      welcomeDmStatus: 'sent',
      reminderSentAt: sentAt,
    };
  }
  store.save(state);
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const config = createWelcomeOnboardingConfig();

  if (!token || !config.guildId) {
    throw new Error('DISCORD_TOKEN과 GUILD_ID 환경 변수가 필요합니다.');
  }
  if (!config.consentChannelId) {
    throw new Error('WELCOME_CONSENT_CHANNEL_ID 환경 변수가 필요합니다 (버튼 링크 구성).');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const [members, onboardingRoleIds] = await Promise.all([
    fetchGuildMembers(rest, config.guildId),
    fetchOnboardingRoleIds(rest, config.guildId),
  ]);
  const targets = selectBackfillTargets(members, onboardingRoleIds);

  console.log(`서버 인원 ${members.length}명 중 온보딩 역할 매칭 ${onboardingRoleIds.size}종 기준, 발송 대상 ${targets.length}명`);
  console.log(targets.map(({ username, displayName }) => `${username} (${displayName})`).join('\n'));

  if (!process.argv.includes('--execute')) {
    console.log('\nDry run입니다. 메시지는 발송되지 않았습니다.');
    return;
  }

  if (process.env.WELCOME_BACKFILL_CONFIRM !== EXECUTION_CONFIRMATION) {
    throw new Error(`실제 발송에는 WELCOME_BACKFILL_CONFIRM=${EXECUTION_CONFIRMATION} 설정이 필요합니다.`);
  }

  const expectedCount = Number.parseInt(process.env.WELCOME_BACKFILL_EXPECTED_COUNT || '', 10);
  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    throw new Error('실제 발송에는 드라이런으로 확인한 WELCOME_BACKFILL_EXPECTED_COUNT 설정이 필요합니다.');
  }
  if (targets.length !== expectedCount) {
    throw new Error(`안전을 위해 발송을 중단했습니다. 예상 ${expectedCount}명, 실제 ${targets.length}명입니다.`);
  }

  const components = createWelcomeDmPayload(config).components.map((row) => row.toJSON());
  const result = await sendBackfillMessages(rest, targets, {
    content: BACKFILL_MESSAGE,
    components,
    onProgress: ({ status, target, index, total }) => {
      console.log(`[${index + 1}/${total}] ${status}: ${target.username}`);
    },
  });

  recordBackfillResult(getWelcomeOnboardingStore(), result);

  console.log(`\n발송 성공 ${result.sent.length}명, 실패 ${result.failed.length}명`);
  if (result.failed.length > 0) {
    for (const target of result.failed) {
      console.error(`실패: ${target.username} (${target.error})`);
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

module.exports = {
  fetchGuildMembers,
  fetchOnboardingRoleIds,
  recordBackfillResult,
  selectBackfillTargets,
  sendBackfillMessages,
};
