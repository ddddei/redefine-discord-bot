require('dotenv').config();

const { REST, Routes } = require('discord.js');

const EXPECTED_TARGET_COUNT = 35;
const EXECUTION_CONFIRMATION = 'TRACK_LAB_2026_07_28';
const EXCLUDED_USERNAMES = new Set([
  'kueol_70854',
  'hwang_stoneiron',
  'gmyouthzone',
  'bead_1',
  'hanpilgu.',
]);
const ALREADY_SENT_USERNAMES = new Set([
  'songsuhun7757',
  'dec31th',
  'webdiingeol',
  'sohyun1805_55990',
]);
const TRACK_LAB_MESSAGE = `안녕하세요! 리디파인 트랙·랩 선택 안내드려요 :)

이번에는 무용극, TRPG, 글쓰기, 밴드 중 1·2순위를 선택해주시면 돼요. 각 활동 소개와 일정은 아래 가이드에서 편하게 확인해 주세요.

📖 트랙·랩 가이드
https://redefine-track-lab-guide-2026.yyz8784c9p.chatgpt.site

✍️ 선택 폼
https://gmyouthzone.typeform.com/to/ZFh5apYf

⏰ 마감: 7월 31일(금) 오후 3시

선택했다고 바로 참여가 확정되는 것은 아니고, 작성해주신 내용은 평가 목적이 아니라 활동을 잘 연결하기 위한 참고로만 확인할게요. 궁금하거나 어려운 점이 있으면 한필구에게 편하게 DM 주세요!`;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchGuildMembers(rest, guildId) {
  return rest.get(Routes.guildMembers(guildId), {
    query: new URLSearchParams({ limit: '1000' }),
  });
}

function selectBulkDmTargets(
  members,
  {
    excludedUsernames = EXCLUDED_USERNAMES,
    alreadySentUsernames = ALREADY_SENT_USERNAMES,
  } = {}
) {
  return members
    .filter(({ user }) => {
      if (!user || user.bot) return false;
      if (excludedUsernames.has(user.username)) return false;
      return !alreadySentUsernames.has(user.username);
    })
    .map(({ nick, user }) => ({
      id: user.id,
      username: user.username,
      displayName: nick || user.global_name || user.username,
    }))
    .sort((left, right) => left.username.localeCompare(right.username));
}

async function sendBulkDirectMessages(
  rest,
  targets,
  {
    content,
    delayMs = 1250,
    onProgress = () => {},
  }
) {
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
          allowed_mentions: { parse: [] },
        },
      });
      result.sent.push(target);
      onProgress({ status: 'sent', target, index, total: targets.length });
    } catch (error) {
      const failed = {
        ...target,
        error: error instanceof Error ? error.message : String(error),
      };
      result.failed.push(failed);
      onProgress({ status: 'failed', target: failed, index, total: targets.length });
    }

    if (delayMs > 0 && index < targets.length - 1) {
      await wait(delayMs);
    }
  }

  return result;
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const guildId = process.env.GUILD_ID;

  if (!token || !guildId) {
    throw new Error('DISCORD_TOKEN과 GUILD_ID 환경 변수가 필요합니다.');
  }

  const rest = new REST({ version: '10' }).setToken(token);
  const members = await fetchGuildMembers(rest, guildId);
  const targets = selectBulkDmTargets(members);

  console.log(`발송 대상 ${targets.length}명`);
  console.log(targets.map(({ username }) => username).join('\n'));

  if (!process.argv.includes('--execute')) {
    console.log('\nDry run입니다. 메시지는 발송되지 않았습니다.');
    return;
  }

  if (process.env.BULK_DM_CONFIRM !== EXECUTION_CONFIRMATION) {
    throw new Error(
      `실제 발송에는 BULK_DM_CONFIRM=${EXECUTION_CONFIRMATION} 설정이 필요합니다.`
    );
  }

  if (targets.length !== EXPECTED_TARGET_COUNT) {
    throw new Error(
      `안전을 위해 발송을 중단했습니다. 예상 ${EXPECTED_TARGET_COUNT}명, 실제 ${targets.length}명입니다.`
    );
  }

  const result = await sendBulkDirectMessages(rest, targets, {
    content: TRACK_LAB_MESSAGE,
    onProgress: ({ status, target, index, total }) => {
      console.log(`[${index + 1}/${total}] ${status}: ${target.username}`);
    },
  });

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
  selectBulkDmTargets,
  sendBulkDirectMessages,
};
