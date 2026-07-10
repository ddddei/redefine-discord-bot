const { spawnSync } = require('child_process');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const checks = [
  {
    label: 'src/index.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/index.js'],
  },
  {
    label: 'src/ai.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/ai.js'],
  },
  {
    label: 'src/safety.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/safety.js'],
  },
  {
    label: 'src/dmChat.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/dmChat.js'],
  },
  {
    label: 'src/dmChatRepository.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/dmChatRepository.js'],
  },
  {
    label: 'src/dmChatLogging.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/dmChatLogging.js'],
  },
  {
    label: 'src/dmChatScenarios.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/dmChatScenarios.js'],
  },
  {
    label: 'scripts/cleanup-dm-chat-logs.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/cleanup-dm-chat-logs.js'],
  },
  {
    label: 'scripts/test-dm-chat-retention.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dm-chat-retention.js'],
  },
  {
    label: 'src/onboardingRoles.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/onboardingRoles.js'],
  },
  {
    label: 'src/deploy-commands.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/deploy-commands.js'],
  },
  {
    label: 'src/handlers.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/handlers.js'],
  },
  {
    label: 'src/embeds.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/embeds.js'],
  },
  {
    label: 'src/components.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/components.js'],
  },
  {
    label: 'src/jsonStorage.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/jsonStorage.js'],
  },
  {
    label: 'src/pointsStore.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/pointsStore.js'],
  },
  {
    label: 'src/pointsRepository.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/pointsRepository.js'],
  },
  {
    label: 'src/minigameData.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/minigameData.js'],
  },
  {
    label: 'src/minigameResults.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/minigameResults.js'],
  },
  {
    label: 'src/minigameRows.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/minigameRows.js'],
  },
  {
    label: 'src/minigamePayloads.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/minigamePayloads.js'],
  },
  {
    label: 'src/minigames.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/minigames.js'],
  },
  {
    label: 'src/minigameInteractions.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/minigameInteractions.js'],
  },
  {
    label: 'src/googleSheetsLogger.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/googleSheetsLogger.js'],
  },
  {
    label: 'src/reactionApproval.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/reactionApproval.js'],
  },
  {
    label: 'src/dailyMissionAnnouncement.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/dailyMissionAnnouncement.js'],
  },
  {
    label: 'src/todayMission.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/todayMission.js'],
  },
  {
    label: 'src/adminAuth.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/adminAuth.js'],
  },
  {
    label: 'src/adminApi.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/adminApi.js'],
  },
  {
    label: 'src/adminServer.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/adminServer.js'],
  },
  {
    label: 'src/webgameRepository.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/webgameRepository.js'],
  },
  {
    label: 'src/webgameApi.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/webgameApi.js'],
  },
  {
    label: 'src/webgameReplay.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/webgameReplay.js'],
  },
  {
    label: 'src/webgameLink.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/webgameLink.js'],
  },
  {
    label: 'public/admin/admin.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/admin/admin.js'],
  },
  {
    label: 'public/dungeonworld-survivors/content.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/dungeonworld-survivors/content.js'],
  },
  {
    label: 'public/dungeonworld-survivors/systems.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/dungeonworld-survivors/systems.js'],
  },
  {
    label: 'public/dungeonworld-survivors/renderer.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/dungeonworld-survivors/renderer.js'],
  },
  {
    label: 'public/dungeonworld-survivors/game.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/dungeonworld-survivors/game.js'],
  },
  {
    label: 'public/match3/board.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/match3/board.js'],
  },
  {
    label: 'public/match3/scoring.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/match3/scoring.js'],
  },
  {
    label: 'public/match3/game.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/match3/game.js'],
  },
  {
    label: 'public/idle/content.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/idle/content.js'],
  },
  {
    label: 'public/idle/engine.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/idle/engine.js'],
  },
  {
    label: 'public/idle/game.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/idle/game.js'],
  },
  {
    label: 'public/deck/content.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/deck/content.js'],
  },
  {
    label: 'public/deck/engine.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/deck/engine.js'],
  },
  {
    label: 'public/deck/game.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/deck/game.js'],
  },
  {
    label: 'public/word/logic.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/word/logic.js'],
  },
  {
    label: 'public/word/game.js 문법 검사',
    command: 'node',
    args: ['--check', 'public/word/game.js'],
  },
  {
    label: 'src/exportUtils.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/exportUtils.js'],
  },
  {
    label: 'src/dungeonworld.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/dungeonworld.js'],
  },
  {
    label: 'src/operationBackup.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/operationBackup.js'],
  },
  {
    label: 'scripts/restore-operation-backup.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/restore-operation-backup.js'],
  },
  {
    label: 'scripts/test-operation-backup-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-operation-backup-flow.js'],
  },
  {
    label: 'scripts/test-dungeonworld-sessions.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dungeonworld-sessions.js'],
  },
  {
    label: 'scripts/test-json-storage.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-json-storage.js'],
  },
  {
    label: 'scripts/test-points-store.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-points-store.js'],
  },
  {
    label: 'scripts/test-points-repository.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-points-repository.js'],
  },
  {
    label: 'scripts/test-google-sheets-logger.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-google-sheets-logger.js'],
  },
  {
    label: 'scripts/test-point-activity-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-point-activity-flow.js'],
  },
  {
    label: 'scripts/test-admin-management-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-admin-management-flow.js'],
  },
  {
    label: 'scripts/test-admin-mission-hub-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-admin-mission-hub-flow.js'],
  },
  {
    label: 'scripts/test-admin-shop-hub-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-admin-shop-hub-flow.js'],
  },
  {
    label: 'scripts/test-operation-export-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-operation-export-flow.js'],
  },
  {
    label: 'scripts/check-local-operation-data.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/check-local-operation-data.js'],
  },
  {
    label: 'scripts/test-local-operation-data-check.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-local-operation-data-check.js'],
  },
  {
    label: 'scripts/test-production-data-safety.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-production-data-safety.js'],
  },
  {
    label: 'scripts/test-slash-command-docs-consistency.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-slash-command-docs-consistency.js'],
  },
  {
    label: 'scripts/test-participant-ux-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-participant-ux-flow.js'],
  },
  {
    label: 'scripts/test-onboarding-role-personalization-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-onboarding-role-personalization-flow.js'],
  },
  {
    label: 'scripts/test-safety-detection.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-safety-detection.js'],
  },
  {
    label: 'scripts/test-minigame-hub-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-minigame-hub-flow.js'],
  },
  {
    label: 'scripts/test-minigame-results.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-minigame-results.js'],
  },
  {
    label: 'src/minigameReport.js 문법 검사',
    command: 'node',
    args: ['--check', 'src/minigameReport.js'],
  },
  {
    label: 'scripts/test-minigame-report.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-minigame-report.js'],
  },
  {
    label: 'scripts/test-reaction-approval-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-reaction-approval-flow.js'],
  },
  {
    label: 'scripts/test-daily-mission-announcement-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-daily-mission-announcement-flow.js'],
  },
  {
    label: 'scripts/test-today-mission-auto-publish-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-today-mission-auto-publish-flow.js'],
  },
  {
    label: 'scripts/test-submission-review-buttons-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-submission-review-buttons-flow.js'],
  },
  {
    label: 'scripts/test-operator-hub-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-operator-hub-flow.js'],
  },
  {
    label: 'scripts/test-admin-dashboard-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-admin-dashboard-flow.js'],
  },
  {
    label: 'scripts/test-dungeonworld-session-02.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dungeonworld-session-02.js'],
  },
  {
    label: 'scripts/test-dungeonworld-session-03.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dungeonworld-session-03.js'],
  },
  {
    label: 'scripts/test-dungeonworld-session-04.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dungeonworld-session-04.js'],
  },
  {
    label: 'scripts/test-dungeonworld-session-05.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dungeonworld-session-05.js'],
  },
  {
    label: 'scripts/test-dungeonworld-session-06.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dungeonworld-session-06.js'],
  },
  {
    label: 'scripts/test-dungeonworld-session-07.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dungeonworld-session-07.js'],
  },
  {
    label: 'scripts/test-dungeonworld-session-08.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dungeonworld-session-08.js'],
  },
  {
    label: 'scripts/test-dungeonworld-session-09.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-dungeonworld-session-09.js'],
  },
  {
    label: 'scripts/test-mobile-hardening-static.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-mobile-hardening-static.js'],
  },
  {
    label: 'scripts/test-webgame-social-flow.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-webgame-social-flow.js'],
  },
  {
    label: 'scripts/test-webgame-social-api.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-webgame-social-api.js'],
  },
  {
    label: 'scripts/test-webgame-replay.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-webgame-replay.js'],
  },
  {
    label: 'scripts/test-word-logic.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-word-logic.js'],
  },
  {
    label: 'scripts/test-word-api.js 문법 검사',
    command: 'node',
    args: ['--check', 'scripts/test-word-api.js'],
  },
  {
    label: 'jsonStorage smoke test',
    command: 'node',
    args: ['scripts/test-json-storage.js'],
  },
  {
    label: 'pointsStore smoke test',
    command: 'node',
    args: ['scripts/test-points-store.js'],
  },
  {
    label: 'pointsRepository smoke test',
    command: 'node',
    args: ['scripts/test-points-repository.js'],
  },
  {
    label: 'googleSheetsLogger smoke test',
    command: 'node',
    args: ['scripts/test-google-sheets-logger.js'],
  },
  {
    label: 'point activity flow smoke test',
    command: 'node',
    args: ['scripts/test-point-activity-flow.js'],
  },
  {
    label: 'admin management flow smoke test',
    command: 'node',
    args: ['scripts/test-admin-management-flow.js'],
  },
  {
    label: 'admin mission hub flow smoke test',
    command: 'node',
    args: ['scripts/test-admin-mission-hub-flow.js'],
  },
  {
    label: 'admin shop hub flow smoke test',
    command: 'node',
    args: ['scripts/test-admin-shop-hub-flow.js'],
  },
  {
    label: 'operation export flow smoke test',
    command: 'node',
    args: ['scripts/test-operation-export-flow.js'],
  },
  {
    label: 'operation backup flow smoke test',
    command: 'node',
    args: ['scripts/test-operation-backup-flow.js'],
  },
  {
    label: 'local operation data integrity check',
    command: 'node',
    args: ['scripts/check-local-operation-data.js'],
  },
  {
    label: 'local operation data checker smoke test',
    command: 'node',
    args: ['scripts/test-local-operation-data-check.js'],
  },
  {
    label: 'production data safety smoke test',
    command: 'node',
    args: ['scripts/test-production-data-safety.js'],
  },
  {
    label: 'slash command docs consistency test',
    command: 'node',
    args: ['scripts/test-slash-command-docs-consistency.js'],
  },
  {
    label: 'participant UX flow smoke test',
    command: 'node',
    args: ['scripts/test-participant-ux-flow.js'],
  },
  {
    label: 'onboarding role personalization flow smoke test',
    command: 'node',
    args: ['scripts/test-onboarding-role-personalization-flow.js'],
  },
  {
    label: 'safety detection smoke test',
    command: 'node',
    args: ['scripts/test-safety-detection.js'],
  },
  {
    label: 'minigame hub flow smoke test',
    command: 'node',
    args: ['scripts/test-minigame-hub-flow.js'],
  },
  {
    label: 'minigame results smoke test',
    command: 'node',
    args: ['scripts/test-minigame-results.js'],
  },
  {
    label: 'minigame report smoke test',
    command: 'node',
    args: ['scripts/test-minigame-report.js'],
  },
  {
    label: 'reaction approval flow smoke test',
    command: 'node',
    args: ['scripts/test-reaction-approval-flow.js'],
  },
  {
    label: 'daily mission announcement flow smoke test',
    command: 'node',
    args: ['scripts/test-daily-mission-announcement-flow.js'],
  },
  {
    label: 'today mission auto publish flow smoke test',
    command: 'node',
    args: ['scripts/test-today-mission-auto-publish-flow.js'],
  },
  {
    label: 'submission review buttons flow smoke test',
    command: 'node',
    args: ['scripts/test-submission-review-buttons-flow.js'],
  },
  {
    label: 'operator hub flow smoke test',
    command: 'node',
    args: ['scripts/test-operator-hub-flow.js'],
  },
  {
    label: 'dm chat flow smoke test',
    command: 'node',
    args: ['scripts/test-dm-chat-flow.js'],
  },
  {
    label: 'dm chat retention cleanup test',
    command: 'node',
    args: ['scripts/test-dm-chat-retention.js'],
  },
  {
    label: 'admin dashboard flow smoke test',
    command: 'node',
    args: ['scripts/test-admin-dashboard-flow.js'],
  },
  {
    label: 'dungeonworld flow smoke test',
    command: 'node',
    args: ['scripts/test-dungeonworld-flow.js'],
  },
  {
    label: 'dungeonworld survivors static smoke test',
    command: 'node',
    args: ['scripts/test-dungeonworld-survivors-static.js'],
  },
  {
    label: 'shared game ui static smoke test',
    command: 'node',
    args: ['scripts/test-shared-ui-static.js'],
  },
  {
    label: 'mobile hardening static smoke test',
    command: 'node',
    args: ['scripts/test-mobile-hardening-static.js'],
  },
  {
    label: 'match3 logic smoke test',
    command: 'node',
    args: ['scripts/test-match3-logic.js'],
  },
  {
    label: 'match3 static smoke test',
    command: 'node',
    args: ['scripts/test-match3-static.js'],
  },
  {
    label: 'idle logic smoke test',
    command: 'node',
    args: ['scripts/test-idle-logic.js'],
  },
  {
    label: 'idle static smoke test',
    command: 'node',
    args: ['scripts/test-idle-static.js'],
  },
  {
    label: 'deck logic smoke test',
    command: 'node',
    args: ['scripts/test-deck-logic.js'],
  },
  {
    label: 'word logic smoke test',
    command: 'node',
    args: ['scripts/test-word-logic.js'],
  },
  {
    label: 'word api smoke test',
    command: 'node',
    args: ['scripts/test-word-api.js'],
  },
  {
    label: 'deck static smoke test',
    command: 'node',
    args: ['scripts/test-deck-static.js'],
  },
  {
    label: 'design assets static smoke test',
    command: 'node',
    args: ['scripts/test-design-assets-static.js'],
  },
  {
    label: 'webgame link flow smoke test',
    command: 'node',
    args: ['scripts/test-webgame-link-flow.js'],
  },
  {
    label: 'webgame api smoke test',
    command: 'node',
    args: ['scripts/test-webgame-api.js'],
  },
  {
    label: 'webgame async social repository flow smoke test',
    command: 'node',
    args: ['scripts/test-webgame-social-flow.js'],
  },
  {
    label: 'webgame async social api smoke test',
    command: 'node',
    args: ['scripts/test-webgame-social-api.js'],
  },
  {
    label: 'webgame replay verification smoke test',
    command: 'node',
    args: ['scripts/test-webgame-replay.js'],
  },
  {
    label: 'dungeonworld session 02 content test',
    command: 'node',
    args: ['scripts/test-dungeonworld-session-02.js'],
  },
  {
    label: 'dungeonworld session 03 content test',
    command: 'node',
    args: ['scripts/test-dungeonworld-session-03.js'],
  },
  {
    label: 'dungeonworld session 04 content test',
    command: 'node',
    args: ['scripts/test-dungeonworld-session-04.js'],
  },
  {
    label: 'dungeonworld session 05 content test',
    command: 'node',
    args: ['scripts/test-dungeonworld-session-05.js'],
  },
  {
    label: 'dungeonworld session 06 content test',
    command: 'node',
    args: ['scripts/test-dungeonworld-session-06.js'],
  },
  {
    label: 'dungeonworld session 07 content test',
    command: 'node',
    args: ['scripts/test-dungeonworld-session-07.js'],
  },
  {
    label: 'dungeonworld session 08 content test',
    command: 'node',
    args: ['scripts/test-dungeonworld-session-08.js'],
  },
  {
    label: 'dungeonworld session 09 content test',
    command: 'node',
    args: ['scripts/test-dungeonworld-session-09.js'],
  },
  {
    label: 'dungeonworld sessions smoke test',
    command: 'node',
    args: ['scripts/test-dungeonworld-sessions.js'],
  },
  {
    label: '데이터 구조 검사',
    command: npmCommand,
    args: ['run', 'validate:data'],
  },
  {
    label: '질문 매칭 테스트',
    command: npmCommand,
    args: ['run', 'test:questions'],
  },
];

function runCheck(check) {
  console.log('');
  console.log(`릴리즈 점검 시작: ${check.label}`);

  const result = spawnSync(check.command, check.args, {
    env: {
      ...process.env,
      GOOGLE_SHEETS_LOGGING_ENABLED: 'false',
    },
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`릴리즈 점검 실패: ${check.label}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`릴리즈 점검 실패: ${check.label}`);
    process.exit(result.status || 1);
  }
}

for (const check of checks) {
  runCheck(check);
}

console.log('');
console.log('릴리즈 기본 점검이 완료되었습니다.');
