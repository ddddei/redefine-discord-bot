# 운영 점검 자동화 패키지 테스트 가이드

## 목적

이 문서는 FAQ, 지식창고, 공지 템플릿, 채널 안내 데이터가 로컬에서 정상인지 확인하고, 실제 질문이 FAQ / Knowledge / Fallback 중 어디로 매칭되는지 점검하기 위한 운영 절차를 정리합니다.

## Interaction handler 구조 변경

interaction handler 구조를 변경할 때는 공개 façade와 독립 router 계약을 먼저 확인합니다.

```bash
node scripts/test-interaction-router.js
node scripts/test-participant-interaction-ui.js
node scripts/test-operator-interaction-ui.js
node scripts/test-activity-participant-handlers.js
node scripts/test-activity-operator-handlers.js
node scripts/test-mission-shop-hub-handlers.js
node scripts/test-operator-hub-handlers.js
node scripts/test-participant-handlers.js
node scripts/test-webgame-operator-handlers.js
node scripts/test-handler-module-structure.js
node --check src/handlers.js
node --check src/interactionRouter.js
```

`src/handlers.js`는 런타임 공개 진입점, `src/interactionRouter.js`는 repository를 모르는 분기 factory,
`src/interactionContext.js`는 공통 권한·표시명 helper입니다. 기존 flow 테스트는 계속
`require('../src/handlers')`를 사용해 공개 호환성을 검증합니다. repository 비의존 참여자 UI는
`src/participantInteractionUi.js`, 운영자 UI/payload는 `src/operatorInteractionUi.js`에 있습니다.
repository 접근과 interaction 응답을 함께 수행하는 도메인 handler는 현재 `src/handlerRuntime.js`에
남아 있으며 후속 factory 분할 대상입니다. 참여자 포인트·상점·체크인·미션·교환·인증 흐름은
`src/activityParticipantHandlers.js`의 주입형 factory로 분리되어 실제 repository 없이도 계약을
검증할 수 있습니다. 포인트 조정·교환 검토·인증 검토·포인트 로그 운영 흐름은
`src/activityOperatorHandlers.js`의 주입형 factory에 있으며, 상태 변경과 운영자 정보 전달을
별도 계약 테스트로 확인합니다. 미션·상점 운영 허브와 오늘의 미션 공지 흐름은
`src/missionShopHubHandlers.js` factory에 있으며, 가짜 repository로 미션·템플릿·추천·상점 조회
주입 계약을 검증합니다. 운영 현황·환경 점검·DM 안전 큐·내보내기는
`src/operatorHubHandlers.js` factory에 있고, 공통 채널 조회는 `src/interactionEnvironment.js`에 있습니다.
잔여 참여자 안내·질문·리디·웹게임 연결/랭킹은 `src/participantHandlers.js`, 웹게임 주간 지급은
`src/webgameOperatorHandlers.js`에 있으며 지급 테스트는 실행 시점별 repository 생성을 확인합니다.
`src/missionShopHubUi.js`는 repository 비의존 UI·token·modal builder이고,
`src/interactionResponse.js`는 공통 ephemeral 후속 응답 leaf helper입니다. 구조 계약 테스트는 모듈 크기,
repository 직접 생성 금지, domain 순환 require 부재, Slash Command 정의 파일 불변을 함께 확인합니다.

## 데이터 검증

데이터 파일 구조와 JSON 문법을 확인합니다.

```bash
npm run validate:data
```

정상이라면 `data/faq.json`, `data/knowledge.json`, `data/notices.json`, `data/channels.json`, `data/test-questions.json`이 정상이라고 출력됩니다. 실패하면 메시지에 표시된 파일과 항목을 수정한 뒤 다시 실행합니다.

## 질문 매칭 점검

운영 점검용 질문이 FAQ, Knowledge, Fallback 중 어디에 매칭되는지 확인합니다.

```bash
npm run test:questions
```

카테고리별 결과와 마지막 요약을 보고, Fallback 질문 목록을 FAQ 또는 지식창고 보강 후보로 사용합니다.
`data/knowledge.json`을 보강한 뒤에도 같은 명령어로 새 질문이 Knowledge에 자연스럽게 매칭되는지 확인합니다.
프로그램 구조, 경험트랙, Lab, 안전 안내처럼 배경 설명이 필요한 질문은 FAQ보다 Knowledge로 잡히는 것이 더 적절할 수 있습니다.

## FAQ 또는 Knowledge 수정 후 확인 순서

1. `data/faq.json` 또는 `data/knowledge.json`을 수정합니다.
2. `npm run validate:data`로 JSON 문법과 필수 필드를 확인합니다.
3. `npm run test:questions`로 질문 매칭 결과를 확인합니다.
4. 필요한 경우 디스코드에서 `/질문 내용:테스트 질문`을 실행해 최종 응답을 확인합니다.

## Fallback 질문이 많을 때

Fallback이 많으면 운영자가 실제로 받을 가능성이 높은 질문부터 골라 보강합니다. 짧고 반복되는 질문은 `data/faq.json`에 추가하고, 프로그램 설명처럼 넓은 배경 안내가 필요한 질문은 `data/knowledge.json`에 추가합니다.
테스트 질문 중 Fallback이 많이 나오면 `keywords`만 늘릴지, FAQ 또는 Knowledge 항목을 새로 추가할지 먼저 구분해 주세요.

## 엉뚱한 FAQ로 매칭될 때

의도와 다른 FAQ로 연결되면 해당 FAQ의 `keywords`가 너무 넓은지 확인합니다. 여러 주제에 걸쳐 쓰이는 단어는 줄이고, 사용자가 실제로 입력할 만한 구체적인 표현을 추가합니다. FAQ가 우선 매칭되므로, 지식창고로 보내고 싶은 질문이 FAQ에 잡히면 FAQ keywords를 먼저 조정합니다.
Knowledge로 매칭되어야 하는 질문이 FAQ로 엉뚱하게 잡히면, 해당 FAQ의 넓은 `keywords`를 줄이거나 더 구체적인 표현으로 바꾼 뒤 다시 `npm run test:questions`를 실행합니다.

## 디스코드 최종 확인 명령어

데이터 수정 후 로컬 점검이 끝나면 디스코드에서 아래 명령어를 직접 확인합니다.

- `/안내`
- `/질문 내용:처음 왔는데 뭐부터 해요?`
- `/질문 내용:TRPG는 뭐 하는 거예요?`
- `/질문 내용:완전히 관련 없는 테스트 질문입니다`
- `/리디 도움`
- `/리디 일정`
- `/리디 규칙`
- `/리디 문의`
- `/공지 종류:봇사용안내`
- `/채널안내`

## 브라우저 던전월드 미니게임 확인

`검은 종 생존전`은 Discord 버튼형 게임이 아니라 `public/dungeonworld-survivors/` 정적 웹게임입니다. 포인트 지급, Discord 계정 연동, 운영 데이터 저장이 없으므로 기존 미니게임 보상 상한과 중복 지급 정책을 건드리지 않습니다.

```bash
node scripts/test-dungeonworld-survivors-static.js
python3 -m http.server 4173 --directory public
```

브라우저에서 `http://127.0.0.1:4173/dungeonworld-survivors/`를 열고 여섯 플레이북 선택, 시작, 이동, 직업별 자동 공격, 경험치 획득, 레벨업 업그레이드 선택, 일시정지/재개를 확인합니다. 웨이브 안내가 단계별로 바뀌고, 웨이브 전환 시 2d6 판정 결과와 긴장 수치가 갱신되는지, 적 종류별 이동 차이와 보스 등장/처치 승리 조건이 보이는지도 확인합니다. 375px, 768px, 1280px 폭에서 한글 줄바꿈과 캐릭터 시트 패널이 깨지지 않아야 합니다. 화면에 포인트 지급이나 Discord 계정 연결 안내가 나오면 안 됩니다.

## Railway 배포 전후 확인 루틴

배포 전에는 `node --check src/index.js`, `node --check src/deploy-commands.js`, `npm run validate:data`, `npm run test:questions`, `npm run check:local-data`, `npm run check:release`를 실행합니다. 운영 데이터 안전화 회귀는 `node scripts/test-production-data-safety.js`로 빈 환경·부분 파일·경로 우선순위·strict 차단을 확인합니다. 배포 후에는 Railway에서 봇 상태가 Online인지 확인하고, 디스코드에서 `/안내`, `/질문`, `/채널안내`, `/공지` 응답을 확인합니다.

## Slash Command 등록

`npm run deploy`는 Slash Command 구조를 변경했을 때만 필요합니다. FAQ, 지식창고, 공지 템플릿, 채널 안내 데이터만 수정했다면 보통 다시 실행하지 않아도 됩니다.
