# Codex 작업 지시서

## 작업 이름

참여자 UX 구조 개선 v1

## 목표

프로젝트 리디파인 디스코드 봇의 참여자 사용 흐름을 더 쉽게 만든다.

현재 봇 기능은 작동하지만, 참여자가 미션 ID나 상점 항목 ID를 직접 확인하고 복사해 `/인증`, `/교환`에 입력해야 해서 사용 흐름이 복잡하다.

이번 작업에서는 참여자가 명령어와 ID를 외우지 않아도 디스코드 안에서 자연스럽게 다음 행동으로 이어질 수 있도록 UX를 개선한다.

핵심 목표:

* `/상점`에서 항목을 보고 바로 교환 신청으로 이어질 수 있게 한다.
* `/미션`에서 미션을 보고 바로 인증 제출로 이어질 수 있게 한다.
* 긴 내부 ID 대신 짧고 이해하기 쉬운 표시 코드를 도입한다.
* 참여자용 문구를 더 부드럽고 덜 개발자스럽게 다듬는다.
* 기존 `/교환`, `/인증` 명령어는 유지하되, 버튼/선택 메뉴/모달 기반 흐름을 추가한다.
* 운영자 기능은 이번 작업에서 크게 변경하지 않는다.

이번 작업에서는 웹 관리자 페이지, Google Sheets 연동, PostgreSQL 연동, MEE6 연동은 구현하지 않는다.

## 현재 전제

현재 구현된 참여자 명령어:

* /안내
* /채널안내
* /질문
* /리디
* /포인트
* /상점
* /교환
* /체크인
* /미션
* /인증

현재 구현된 운영자 명령어:

* /공지
* /포인트관리
* /교환관리
* /포인트로그
* /인증관리
* /운영현황
* /미션관리
* /상점관리
* /운영내보내기

현재 데이터 저장 구조:

* src/pointsRepository.js
* src/pointsStore.js
* data/*.example.json
* data/*.local.json

data/*.local.json은 커밋하지 않는다.

## 중요 UX 원칙

### 참여자는 ID를 몰라도 되어야 한다

현재 내부 ID 예시:

* mission_1779947375009_vjcds3
* item_youth_point_100_example
* rd_1779947292182_bsngc0

이런 ID는 참여자에게 어렵게 느껴진다.

이번 작업에서는 참여자 화면에 아래처럼 짧은 표시 코드를 보여준다.

* M001 · 오늘의 짧은 회고
* M002 · 프로그램 참여 인증
* S001 · 청년동 포인트 전환권 100P
* S002 · 프로그램 굿즈

내부 데이터 저장에는 기존 id를 유지해도 된다.

단, 화면 표시와 선택 메뉴에는 짧은 code를 우선 사용한다.

### 참여자에게 주로 안내할 명령어는 적어야 한다

참여자에게 적극 안내할 명령어는 아래 정도로 줄이는 방향을 유지한다.

* /안내
* /포인트
* /상점
* /미션
* /체크인

/교환과 /인증은 직접 입력도 가능하지만, 기본 흐름은 /상점과 /미션에서 버튼 또는 선택 메뉴로 이어지게 한다.

### 응답 공개 범위

참여자 명령어는 기존처럼 가능한 한 ephemeral로 유지한다.

* /포인트: ephemeral
* /상점: ephemeral
* /교환: ephemeral
* /체크인: ephemeral
* /미션: ephemeral
* /인증: ephemeral

### 문구 톤

참여자를 압박하거나 경쟁시키는 문구를 피한다.

피해야 할 표현:

* 반드시 참여해야 합니다.
* 미션을 완료해야 합니다.
* 점수를 획득하세요.
* 순위가 올라갑니다.
* 실패했습니다.

권장 표현:

* 원할 때 가볍게 참여해 주세요.
* 가능한 범위에서 남겨주시면 돼요.
* 리디파인 포인트는 비교나 경쟁을 위한 점수가 아니에요.
* 신청 전 항목을 한 번 더 확인해 주세요.
* 운영진이 순차적으로 확인할게요.

## 중요 주의사항

* .env 파일은 수정하지 않는다.
* 실제 토큰, API Key, 실제 채널 ID, 실제 참여자 개인정보는 작성하지 않는다.
* package.json, package-lock.json은 수정하지 않는다.
* Railway, GitHub 설정은 변경하지 않는다.
* npm run deploy는 실행하지 않는다.
* git commit, git push는 하지 않는다.
* data/*.local.json은 커밋하지 않는다.
* Google Sheets 연동은 구현하지 않는다.
* PostgreSQL 연동은 구현하지 않는다.
* 웹 관리자 페이지는 구현하지 않는다.
* Slash Command를 새로 추가하지 않는다면 npm run deploy가 필요 없도록 한다.
* 기존 Slash Command 이름은 변경하지 않는다.
* 기존 명령어 동작을 깨지 않는다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

* src/handlers.js
* src/embeds.js
* src/pointsRepository.js
* src/pointsStore.js
* src/components.js
* scripts/test-participant-ux-flow.js
* scripts/test-points-store.js
* scripts/test-points-repository.js
* scripts/test-point-activity-flow.js
* scripts/test-admin-management-flow.js
* scripts/test-operation-export-flow.js
* scripts/check-release.js
* docs/participant-command-guide.md
* docs/operation-guide.md
* docs/prelaunch-qa-checklist.md
* docs/journey-point-system-plan.md
* docs/point-data-structure-plan.md
* README.md
* prompts/codex/participant-ux-flow-v1.md

src/components.js가 없다면 새로 만들어도 된다.

단, 구조가 과도하게 복잡해지지 않도록 한다.

## 작업 1. 표시 코드 helper 추가

상점 항목과 미션을 화면에 표시할 때 짧은 표시 코드를 생성한다.

예시:

* shop item: S001, S002, S003
* mission: M001, M002, M003

기준:

* 목록 표시 순서 기준으로 생성해도 된다.
* 기존 데이터에 code 필드가 있으면 우선 사용한다.
* code 필드가 없으면 runtime에서 목록 순서 기준으로 표시 코드를 생성한다.
* 내부 id는 그대로 유지한다.
* 선택 메뉴 value에는 내부 id를 넣어도 된다.
* 사용자에게는 code와 name/title을 함께 보여준다.

함수 후보:

* getDisplayCode(prefix, index)
* mapShopItemsWithDisplayCodes(items)
* mapMissionsWithDisplayCodes(missions)
* findItemByDisplayCodeOrId(items, input)
* findMissionByDisplayCodeOrId(missions, input)

기존 `/교환 항목:...`과 `/인증 미션id:...`도 표시 코드 입력을 허용할 수 있으면 좋다.

예:

* /교환 항목:S001
* /인증 미션id:M001 내용:...

주의:

* 기존 내부 ID 입력도 계속 허용한다.
* 표시 코드는 사용자 편의용이다.
* 저장 데이터의 id를 강제로 변경하지 않는다.

## 작업 2. /상점 UX 개선

현재 /상점은 active 항목을 보여준다.

이번 작업에서는 /상점 응답에 선택 메뉴 또는 버튼을 추가한다.

권장 방식:

* 상점 항목이 1개 이상이면 StringSelectMenu를 표시한다.
* 선택 메뉴 placeholder: 교환할 항목을 선택해 주세요
* 각 option label: S001 · 청년동 포인트 전환권 100P
* option description: 필요 100P · 청년동 내부 사용처
* option value: 실제 item.id

선택 후 흐름:

1. 참여자가 /상점 실행
2. active 상점 항목 확인
3. 선택 메뉴에서 항목 선택
4. 봇이 교환 신청 전 확인 화면을 ephemeral로 표시
5. 확인 버튼을 누르면 교환 신청 처리
6. 취소 버튼을 누르면 신청하지 않고 종료

교환 신청 전 확인 화면 포함 내용:

* 선택한 항목명
* 필요 포인트
* 현재 보유 포인트
* 신청 후 예상 잔액
* 단순 변심 취소/환불은 원칙적으로 어렵다는 안내
* 청년동 포인트 전환권은 운영진이 별도 지급 처리한다는 안내

버튼:

* 교환 신청하기
* 취소하기

주의:

* 선택만 했다고 바로 차감하지 않는다.
* 반드시 확인 버튼을 눌렀을 때만 차감한다.
* 기존 `/교환` 명령어는 그대로 유지한다.
* `/교환` 명령어에서도 가능하면 S001 같은 표시 코드를 허용한다.
* 포인트 부족이면 확인 버튼 전 또는 확인 시점에 친절하게 안내한다.
* 응답은 ephemeral 유지.

## 작업 3. /미션 UX 개선

현재 /미션은 active 미션 목록을 보여준다.

이번 작업에서는 /미션 응답에 선택 메뉴 또는 버튼을 추가한다.

권장 방식:

* active 미션이 1개 이상이면 StringSelectMenu를 표시한다.
* 선택 메뉴 placeholder: 인증할 미션을 선택해 주세요
* 각 option label: M001 · 오늘의 짧은 회고
* option description: 30P · 인증 필요
* option value: 실제 mission.id

선택 후 흐름:

1. 참여자가 /미션 실행
2. active 미션 목록 확인
3. 선택 메뉴에서 미션 선택
4. 봇이 인증 내용 입력 Modal을 띄운다.
5. 참여자가 내용을 입력한다.
6. 기존 인증 제출 로직과 동일하게 pending submission을 생성한다.
7. 운영자 채널에 인증 검토 요청을 보낸다.
8. 참여자에게 제출 접수 안내를 ephemeral로 보여준다.

모달 구성:

* title: 미션 인증하기
* input label: 인증 내용
* placeholder: 오늘 남기고 싶은 내용을 편하게 적어주세요.
* required: true
* style: Paragraph

주의:

* 모달 제출 시 기존 /인증과 같은 중복 제출 방지 로직을 사용한다.
* /인증 명령어도 그대로 유지한다.
* /인증 미션id:M001 형태도 가능하면 지원한다.
* 인증 제출 즉시 포인트 지급하지 않는다.
* 운영자 승인 후 포인트 지급 구조를 유지한다.
* 미션은 강제 과제가 아니라 선택형 활동이라고 안내한다.

## 작업 4. interaction handler 확장

src/handlers.js 또는 현재 interaction 라우팅 구조에 맞춰 아래 interaction을 처리한다.

필요한 customId 예시:

* shop_select
* shop_redeem_confirm
* shop_redeem_cancel
* mission_select
* mission_submit_modal

customId에는 필요한 경우 itemId 또는 missionId를 안전하게 포함한다.

주의:

* Discord customId 길이 제한을 고려한다.
* 민감한 정보나 긴 JSON을 customId에 넣지 않는다.
* 필요한 경우 prefix와 id만 넣는다.
* interaction.isStringSelectMenu()
* interaction.isButton()
* interaction.isModalSubmit()
  처리를 현재 구조에 맞게 추가한다.
* 기존 slash command 처리 흐름을 깨지 않는다.

## 작업 5. /교환 문구 보강

/교환 명령어는 유지하되 문구를 부드럽게 바꾼다.

변경 방향:

* “항목을 찾을 수 없습니다”보다 “해당 항목을 찾지 못했어요. /상점에서 항목을 다시 확인해 주세요.”
* “포인트 부족”보다 “현재 보유 포인트가 조금 부족해요.”
* “신청 완료”보다 “교환 신청이 접수됐어요. 운영진이 순차적으로 확인할게요.”

신청 전 주의 안내:

* 교환 신청이 완료되면 리디파인 포인트가 차감됩니다.
* 단순 변심에 따른 취소나 환불은 원칙적으로 어렵습니다.
* 신청 전 항목과 필요 포인트를 한 번 더 확인해 주세요.
* 중복 신청, 시스템 오류 등은 운영진이 확인할 수 있습니다.

## 작업 6. /인증 문구 보강

/인증 명령어는 유지하되 문구를 부드럽게 바꾼다.

변경 방향:

* “미션을 찾을 수 없습니다”보다 “해당 미션을 찾지 못했어요. /미션에서 현재 참여 가능한 미션을 확인해 주세요.”
* “이미 제출됨”보다 “이 미션은 이미 제출한 기록이 있어요. 운영진 확인을 기다려 주세요.”
* “제출 완료”보다 “인증 제출이 접수됐어요. 운영진 확인 후 포인트가 지급돼요.”

안내 문구:

* 인증 내용에는 개인정보를 자세히 적지 않아도 돼요.
* 가능한 범위에서 편하게 남겨주세요.
* 미션은 선택형 활동이에요.

## 작업 7. /안내 또는 /리디 도움 보강

참여자가 처음 봇을 사용할 때 너무 많은 명령어를 보지 않도록 안내를 줄인다.

참여자에게 우선 안내할 핵심 명령어:

* /안내
* /포인트
* /상점
* /미션
* /체크인

/교환과 /인증은 /상점, /미션 안에서 이어질 수 있다고 설명한다.

예시 문구:

처음에는 아래 명령어만 기억해도 충분해요.

* /포인트: 내 리디파인 포인트 확인
* /상점: 교환 가능한 항목 확인
* /미션: 참여 가능한 미션 확인
* /체크인: 오늘의 가벼운 체크인

상점과 미션에서는 선택 버튼을 따라가면 교환 신청이나 인증 제출까지 이어질 수 있어요.

## 작업 8. 문서 보강

아래 문서를 보강한다.

### docs/participant-command-guide.md

보강 내용:

* 참여자가 ID를 외우지 않아도 /상점과 /미션에서 선택할 수 있다는 점
* /상점 선택 메뉴 사용법
* 교환 신청 전 확인 버튼
* /미션 선택 메뉴 사용법
* 인증 모달 사용법
* /교환과 /인증은 직접 입력도 가능하지만 기본은 선택형 흐름이라는 점
* 미션 ID 대신 M001 같은 표시 코드가 보인다는 점

### docs/prelaunch-qa-checklist.md

보강 내용:

* /상점 선택 메뉴 테스트
* 교환 확인 버튼 테스트
* 교환 취소 버튼 테스트
* /미션 선택 메뉴 테스트
* 인증 모달 제출 테스트
* /교환 항목:S001 입력 테스트
* /인증 미션id:M001 입력 테스트
* 기존 내부 ID 입력이 계속 동작하는지 테스트

### docs/operation-guide.md

보강 내용:

* 참여자는 가능한 한 /상점, /미션에서 선택형 흐름을 사용하도록 안내
* 운영자는 미션/상점 제목을 짧고 명확하게 작성해야 함
* 미션/상점 이름이 선택 메뉴에 들어가므로 너무 길지 않게 작성
* 표시 코드는 사용자 편의를 위한 것이며 내부 ID와 다를 수 있음

### README.md

보강 내용:

* /상점과 /미션이 선택형 UX를 제공한다는 점
* 참여자가 ID를 직접 복사하지 않아도 되는 방향으로 개선되었다는 점
* /교환과 /인증은 직접 입력도 가능하다는 점

## 작업 9. 테스트 스크립트 추가

scripts/test-participant-ux-flow.js 파일을 새로 만든다.

역할:

* 표시 코드 생성과 매핑 로직을 테스트한다.
* 표시 코드로 상점 항목을 찾을 수 있는지 테스트한다.
* 표시 코드로 미션을 찾을 수 있는지 테스트한다.
* 내부 ID 입력도 계속 동작하는지 테스트한다.
* 선택형 UX helper가 데이터가 비어 있어도 안전하게 동작하는지 테스트한다.

테스트 항목:

* shop item display code 생성
* mission display code 생성
* S001로 item 찾기
* item.id로 item 찾기
* M001로 mission 찾기
* mission.id로 mission 찾기
* 비어 있는 목록 처리
* 긴 이름 truncation 처리
* customId 생성 또는 파싱 helper가 있다면 안전성 확인

성공 시 출력:

participant UX flow smoke test passed

## 작업 10. check-release 반영

scripts/check-release.js에 아래 파일 문법 검사 또는 smoke test를 반영한다.

* scripts/test-participant-ux-flow.js

가능하다면 check-release에서 아래 테스트도 실행하도록 한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* node scripts/test-admin-management-flow.js
* node scripts/test-operation-export-flow.js
* node scripts/test-participant-ux-flow.js

기존 validate:data, test:questions 흐름은 유지한다.

## 검증

작업 완료 후 아래 명령어를 실행한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* node scripts/test-admin-management-flow.js
* node scripts/test-operation-export-flow.js
* node scripts/test-participant-ux-flow.js
* npm run validate:data
* npm run test:questions
* npm run check:release

주의:

* npm run deploy는 실행하지 않는다.
* 이번 작업에서 Slash Command를 새로 추가하지 않는다면 deploy는 필요 없다.
* 다만 Discord component customId 처리 코드가 추가되므로 Railway 재배포 반영은 필요할 수 있다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

* 변경된 파일 목록
* /상점 UX 개선 요약
* /미션 UX 개선 요약
* 선택 메뉴/버튼/모달 추가 여부
* 표시 코드 도입 방식
* /교환 항목:S001 지원 여부
* /인증 미션id:M001 지원 여부
* 참여자 문구 개선 내용
* 기존 내부 ID 입력이 유지되는지 여부
* 새 Slash Command는 추가하지 않았다는 점
* npm run deploy는 실행하지 않았다는 점
* node scripts/test-points-store.js 결과
* node scripts/test-points-repository.js 결과
* node scripts/test-point-activity-flow.js 결과
* node scripts/test-admin-management-flow.js 결과
* node scripts/test-operation-export-flow.js 결과
* node scripts/test-participant-ux-flow.js 결과
* npm run validate:data 결과
* npm run test:questions 결과
* npm run check:release 결과
