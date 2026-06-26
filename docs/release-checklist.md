# 프로젝트 리디파인 디스코드 봇 운영 릴리즈 체크리스트

참여자 입장 전과 운영 시작 직전에 확인해야 할 항목을 정리한 문서입니다.

## 사용 시점

- 참여자 입장 전
- 봇 기능 수정 후 배포 전
- FAQ/지식창고/공지/채널안내 데이터 수정 후
- Railway 재배포 후
- 운영 시작 전 최종 점검 시

## 로컬 기본 확인

- [ ] `git status`로 현재 브랜치와 변경 상태를 확인했습니다.
- [ ] 변경 파일 목록을 확인했습니다.
- [ ] `.env`가 변경 목록에 없는지 확인했습니다.
- [ ] `data/*.local.json`이 변경 목록에 없는지 확인했습니다.
- [ ] `package.json`, `package-lock.json`, `src/deploy-commands.js` 변경 여부를 확인했습니다.
- [ ] `npm run check:release`로 릴리즈 기본 점검을 한 번에 실행했습니다.
- [ ] `src/index.js` 문법 검사를 통과했습니다.
- [ ] `src/deploy-commands.js` 문법 검사를 통과했습니다.
- [ ] 데이터 구조 검사를 통과했습니다.
- [ ] 질문 매칭 테스트를 실행했습니다.

```bash
git status
git diff --stat
npm run check:release
```

`npm run check:release`는 `src/index.js` 문법 검사, `src/deploy-commands.js` 문법 검사, 데이터 구조 검사, 질문 매칭 테스트를 순서대로 실행합니다. 중간에 하나라도 실패하면 즉시 종료됩니다.

## GitHub 확인

- [ ] 커밋 후 push가 완료됐습니다.
- [ ] GitHub 저장소에서 최신 커밋이 반영된 것을 확인했습니다.
- [ ] Actions 탭에서 CI가 초록 체크로 성공한 것을 확인했습니다.
- [ ] CI 실패 시 실패한 단계의 로그를 먼저 확인했습니다.

CI가 실패하면 아래 로그를 우선 확인합니다.

- `npm ci`
- `node --check`
- `npm run validate:data`
- `npm run test:questions`

## Railway 확인

- [ ] Railway 서비스 상태가 Online입니다.
- [ ] Deploy Logs에 봇 준비 메시지가 출력됩니다.
- [ ] Railway Variables에 필요한 환경변수가 등록되어 있습니다.

확인할 환경변수:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`
- `LOG_CHANNEL_ID`

실제 토큰이나 실제 채널 ID는 문서, README, 이슈, 커밋 메시지에 적지 않습니다.

Railway에서 봇이 실행 중일 때 로컬에서도 `npm run start`를 동시에 켜면 Discord interaction 처리 충돌이 날 수 있습니다. 운영 중에는 Railway와 로컬 봇을 동시에 실행하지 않는 것을 기본으로 합니다.

## 디스코드 명령어 최소 테스트

실제 디스코드 서버에서 아래 명령어를 실행합니다.

- [ ] `/안내`
- [ ] `/채널안내`
- [ ] `/던전월드` (선택지 클릭까지 끝까지 진행)
- [ ] `/던전월드기록`
- [ ] `/질문 내용: 처음 왔는데 뭐부터 해요?`
- [ ] `/질문 내용: TRPG는 뭐 하는 거예요?`
- [ ] `/질문 내용: 커뮤니티 규칙은 어디서 봐요?`
- [ ] `/질문 내용: 일부러 답변 실패 테스트 질문입니다`
- [ ] `/리디 도움`
- [ ] `/리디 규칙`
- [ ] `/리디 문의`
- [ ] `/공지 종류:봇사용안내`

각 테스트에서 확인할 기준:

- [ ] 답변이 정상 출력됩니다.
- [ ] 말투가 너무 딱딱하지 않습니다.
- [ ] 질문이 엉뚱한 답변으로 매칭되지 않습니다.
- [ ] 답변 실패 질문이 `#봇-질문로그`에 기록됩니다.
- [ ] 운영진용 응답은 필요한 사람에게만 보입니다.

## 던전월드 미니게임 확인

- [ ] `/던전월드`가 현재 열린 회차의 도입부와 선택지 3개를 private/ephemeral 응답으로 보여줍니다.
- [ ] 선택지 클릭 후 2d6 결과, 등급(10+ / 7~9 / 6-), 결과 텍스트, 다음 회차 안내가 보입니다.
- [ ] 결과 응답에 포인트 지급 안내가 나오지 않습니다.
- [ ] `/던전월드기록`이 본인 기록만 private/ephemeral 응답으로 보여주며, 총 플레이 수, 완료 회차 수, 현재 회차 참여 여부, 회차별 최신 결과를 포함합니다.
- [ ] `DUNGEONWORLD_START_DATE`를 운영 시작일로 설정했다면 시작일 기준 7일마다 다음 회차가 열리는지 확인했습니다.
- [ ] `/던전월드관리`를 운영자 계정으로 실행해 현재 회차, 자동 계산 회차, 수동 오버라이드 상태, 다음 자동 오픈 맥락, 전체 회차 목록, 운영 지표를 확인했습니다.
- [ ] 필요한 경우 `/던전월드관리 회차:<회차ID>`로 테스트 회차를 열고, 확인 후 `/던전월드관리 초기화:true`로 자동 계산으로 되돌렸습니다.
- [ ] `/던전월드관리` 버튼으로 이전 회차, 다음 회차, 오버라이드 해제, 새로고침만 가능한지 확인했습니다.
- [ ] 같은 참여자가 직전 회차를 플레이한 뒤 다음 회차를 열었을 때, 직전 결과 등급에 맞는 인트로 변형이 보이는지 확인했습니다.
- [ ] `/운영내보내기 종류:던전월드 형식:요약`으로 전체 플레이 수, 고유 참여자 수, 회차별 플레이, 결과 등급 분포, 선택 분포, 최신 회차 진행 수가 집계되는지 확인했습니다.
- [ ] `/운영내보내기 종류:던전월드 형식:JSON`에 `data.analytics`가 포함되는지 확인했습니다.
- [ ] `/운영내보내기 종류:던전월드 형식:CSV` 파일은 기존 플레이 로그 행 형태를 유지하는지 확인했습니다.

로컬에서는 아래 스크립트가 던전월드 관련 릴리즈 게이트입니다. `npm run check:release`에도 포함되어 있습니다.

```bash
node scripts/test-dungeonworld-flow.js
node scripts/test-dungeonworld-sessions.js
node scripts/test-dungeonworld-session-02.js
node scripts/test-dungeonworld-session-03.js
node scripts/test-dungeonworld-session-04.js
node scripts/test-dungeonworld-session-05.js
node scripts/test-dungeonworld-session-06.js
node scripts/test-dungeonworld-session-07.js
node scripts/test-dungeonworld-session-08.js
node scripts/test-dungeonworld-session-09.js
```

## `/공지` 권한 확인

- [ ] `/공지` 명령어는 운영자 권한이 있는 계정에서만 보일 수 있음을 확인했습니다.
- [ ] `/공지`가 보이지 않으면 코드나 배포 문제라고 바로 판단하지 않고, 먼저 디스코드 역할/권한을 확인했습니다.
- [ ] 운영자 역할이 있는 계정에서 `/공지 종류:봇사용안내`가 보입니다.
- [ ] 일반 참여자에게 `/공지`가 보이지 않는 것은 정상일 수 있음을 운영진이 알고 있습니다.

## 운영진 전용 채널 확인

확인할 채널:

- `#봇-질문로그`
- `#운영진-문의대응`

체크할 내용:

- [ ] 일반 참여자에게 보이지 않습니다.
- [ ] 운영진에게 보입니다.
- [ ] 봇이 `#봇-질문로그`에 메시지를 보낼 수 있습니다.
- [ ] 테스트 로그 메시지는 운영 시작 전 정리할 수 있습니다.

## 참여자용 공지 확인

- [ ] 봇 사용 안내 공지가 게시되어 있습니다.
- [ ] 공지 메시지가 고정되어 있습니다.
- [ ] `#환영-인사와-규칙` 또는 `#공지_관리자-공지`에 안내가 올라가 있습니다.
- [ ] 처음 온 참여자에게 `/안내`, `/채널안내`, `/질문` 사용법이 보입니다.

## 데이터 수정 후 확인 루틴

- [ ] `data/faq.json` 수정 후 확인했습니다.
- [ ] `data/knowledge.json` 수정 후 확인했습니다.
- [ ] `data/notices.json` 수정 후 확인했습니다.
- [ ] `data/channels.json` 수정 후 확인했습니다.
- [ ] 데이터 수정 후 `npm run validate:data`를 실행했습니다.
- [ ] 데이터 수정 후 `npm run test:questions`를 실행했습니다.
- [ ] 명령어 구조가 바뀌지 않았다면 `npm run deploy`가 필요 없음을 확인했습니다.

```bash
npm run validate:data
npm run test:questions
```

## Slash Command 구조 변경 시 확인

- [ ] `src/deploy-commands.js`를 수정했을 때만 `npm run deploy`가 필요합니다.
- [ ] `/공지` 종류 선택지, `/리디` 하위 명령어, 새 명령어를 추가한 경우 `npm run deploy`가 필요합니다.
- [ ] `/던전월드기록` 같은 새 Slash Command나 `/운영내보내기` 선택지 변경이 있으면 `npm run deploy`가 필요합니다.
- [ ] `data/notices.json`만 수정한 경우에는 보통 `npm run deploy`가 필요하지 않습니다.
- [ ] `data/notices.json`과 함께 `src/deploy-commands.js`의 `/공지` 선택지를 수정한 경우에는 `npm run deploy`가 필요합니다.

문서만 수정한 경우 `npm run deploy`는 실행하지 않습니다. 기능 코드가 재배포되어도 Discord Slash Command 목록은 자동으로 바뀌지 않으므로, 명령어 구조 변경 여부를 별도로 판단합니다.

## 문서와 프롬프트 변경 시 확인

- [ ] README와 docs 링크가 실제 파일명과 맞습니다.
- [ ] 운영 문서에 실제 토큰, 실제 채널 ID, API Key, 참여자 개인정보가 없습니다.
- [ ] `prompts/codex`에는 재사용 가능한 작업 지시서만 남겼습니다.
- [ ] 작업 결과나 운영 기록은 필요한 경우 `docs`에 정리했습니다.
- [ ] 문서만 수정했다면 기능 코드와 Slash Command를 변경하지 않았음을 확인했습니다.

## 포인트 운영 데이터 확인

- [ ] `data/*.local.json`은 운영 데이터 파일이므로 커밋하지 않습니다.
- [ ] local JSON은 MVP용이며 Railway 장기 운영 저장소로 충분한지 별도 확인이 필요합니다.
- [ ] 실제 운영 전 Railway Volume, Google Sheets, PostgreSQL 중 하나를 검토할 필요가 있는지 확인했습니다.
- [ ] `/운영내보내기` 백업 파일은 외부 공유 전 개인정보 포함 여부를 확인합니다.

## 운영 시작 후 매일 또는 회차 전 확인할 것

- [ ] `#봇-질문로그`를 확인합니다.
- [ ] 미응답 질문 중 반복 질문을 FAQ/지식창고 보강 후보로 정리합니다.
- [ ] 공지 채널의 최신 일정을 확인합니다.
- [ ] 문의 채널을 확인합니다.
- [ ] 봇이 온라인인지 확인합니다.
- [ ] 참여자들이 헷갈려하는 채널이 있는지 확인합니다.

## 문제 발생 시 빠른 판단표

| 증상 | 먼저 확인할 것 |
| --- | --- |
| `/공지`가 안 보임 | 운영자 역할/권한 확인 |
| 봇이 답변하지 않음 | Railway Online 상태와 Deploy Logs 확인 |
| 엉뚱한 답변을 함 | `data/faq.json`, `data/knowledge.json`의 keywords 조정 |
| JSON 수정 후 봇이 이상함 | `npm run validate:data` 실행 |
| 디스코드 명령어가 새로 안 보임 | `npm run deploy` 실행 여부 확인 |
| Unknown interaction 오류 | Railway와 로컬 봇이 동시에 켜져 있는지 확인 |

## 최종 완료 기준

- [ ] GitHub Actions CI 성공
- [ ] Railway Online
- [ ] Railway latest deploy success 확인
- [ ] 최소 명령어 테스트 통과
- [ ] `#봇-질문로그` 작동
- [ ] `/공지` 운영자 권한 확인
- [ ] Discord 실제 Slash Command 응답 확인
- [ ] Slash Command 추가/변경 시 `npm run deploy` 실행과 등록 결과 확인
- [ ] 문서만 수정한 경우 `npm run deploy` 미실행
- [ ] 봇 사용 안내 공지 고정
- [ ] 테스트 로그 정리
- [ ] `git status` clean
