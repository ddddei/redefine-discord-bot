# 운영 전 전체 QA 감사 리포트

작성일: 2026-06-27 KST

## 요약 verdict: 조건부 가능

참여자 온보딩, 포인트, 상점/교환, 미션/인증, 반응 승인, 운영자 허브, 운영 내보내기, 관리자 대시보드의 로컬 smoke test는 모두 통과했습니다. 데이터 검증과 질문 매칭 테스트도 통과했습니다.

다만 `npm run check:release`가 `scripts/test-minigame-hub-flow.js`에서 실패했습니다. 실패 지점은 미니게임 가위바위보 테스트의 날짜 의존 assertion이며, 이번 QA 범위의 핵심 운영 흐름은 개별 smoke test에서 통과했습니다. 그래도 운영 릴리즈 체크리스트 기준으로는 release gate가 녹색이 아니므로, 운영 시작 전에는 이 release gate 실패를 해결하거나 운영진이 위험을 명시적으로 승인해야 합니다.

실제 Discord 서버, Railway, Slash Command 등록, 채널 권한, DM 수신, `/admin` 실서비스 접속은 로컬에서 완전히 검증할 수 없어 수동 확인 필요 항목으로 분리했습니다.

## 실행한 명령어와 결과

| 명령어 | 결과 | 메모 |
| --- | --- | --- |
| `git status --short` | 통과 | 출력 없음. 시작 시점 작업트리 변경 없음. |
| `node scripts/test-points-store.js` | 통과 | `pointsStore smoke test passed` |
| `node scripts/test-points-repository.js` | 통과 | `pointsRepository smoke test passed` |
| `node scripts/test-point-activity-flow.js` | 통과 | `point activity flow smoke test passed` |
| `node scripts/test-admin-management-flow.js` | 통과 | `admin management flow smoke test passed` |
| `node scripts/test-admin-mission-hub-flow.js` | 통과 | 잘못된 날짜, 포인트, 상태값 검증 실패 로그 후 정상 통과 |
| `node scripts/test-admin-shop-hub-flow.js` | 통과 | 잘못된 상점 유형 검증 실패 로그 후 정상 통과 |
| `node scripts/test-operation-export-flow.js` | 통과 | `operation export flow smoke test passed` |
| `node scripts/test-participant-ux-flow.js` | 통과 | 알림 채널 미설정 skip 로그 후 정상 통과 |
| `node scripts/test-reaction-approval-flow.js` | 통과 | 로그 채널 미설정, DM blocked 시나리오 로그 후 정상 통과 |
| `node scripts/test-submission-review-buttons-flow.js` | 통과 | 검토 채널 테스트 로그 전송 시나리오 포함 |
| `node scripts/test-operator-hub-flow.js` | 통과 | `operator hub flow smoke test passed` |
| `node scripts/test-admin-dashboard-flow.js` | 통과 | 인증, example 제외, 빈 상태, read-only 요약 검증 |
| `npm run validate:data` | 통과 | FAQ, knowledge, notices, channels, test questions 정상 |
| `npm run test:questions` | 통과 | 전체 153개, FAQ 136개, Knowledge 7개, Fallback 10개 |
| `npm run check:release` | 실패 | `test-minigame-hub-flow`의 deterministic RPS draw assertion 실패 |
| `node scripts/test-minigame-hub-flow.js` | 실패 | release gate 실패 단독 재현 |

## 자동 테스트로 확인된 항목

### 참여자 온보딩

- `/안내` 참여자 허브, 선택 메뉴, 시작 가이드, 오늘 할 일, 포인트/상점/미션/문의 안내 흐름이 `test-participant-ux-flow`에서 검증되었습니다.
- `/채널안내`, `/질문`, `/리디` 계열의 데이터와 질문 매칭 기반은 `validate:data`, `test:questions`, participant UX smoke test로 확인했습니다.
- 처음 참여자 안내 문서 `docs/first-time-participant-guide.md`는 운영 문서 기준과 일치하며 실제 채널 ID를 포함하지 않습니다.

### 포인트 흐름

- `/포인트`, `/체크인`, 포인트 적립/차감, 잔액과 로그 정합성, 중복 체크인 방지는 `test-points-store`, `test-points-repository`, `test-point-activity-flow`, `test-participant-ux-flow`에서 확인되었습니다.

### 상점/교환 흐름

- `/상점`, `/교환`, 선택 메뉴 기반 신청, `/교환 항목:S001` 호환, 신청 확인/취소 2단계 흐름은 `test-participant-ux-flow`에서 통과했습니다.
- 포인트 부족, 기록 없음, 품절/비활성 안내와 운영자 알림 skip/fallback 경로도 smoke test 로그와 assertion으로 확인되었습니다.
- `/상점관리` 허브의 잘못된 유형 입력 검증과 정상 흐름은 `test-admin-shop-hub-flow`에서 확인되었습니다.

### 미션/인증 흐름

- `/미션`, `/인증`, 선택 메뉴와 모달 인증, `/인증 미션:M001 내용:...` 직접 입력, 첨부파일 인증, 중복 제출과 비활성 미션 안내는 `test-participant-ux-flow`와 `test-submission-review-buttons-flow`에서 확인되었습니다.
- 운영자 검토 알림은 채널 설정이 있을 때 전송되는 경로와 미설정 시 skip되는 경로가 모두 확인되었습니다.
- `/미션관리` 허브의 잘못된 날짜, 포인트, 상태값 입력 검증과 정상 흐름은 `test-admin-mission-hub-flow`에서 확인되었습니다.

### 미션 인증 채널 반응 승인

- ✅ 승인, ❌ 반려, 중복 지급 방지, 운영자 권한 검증, DM 실패 시에도 기록과 포인트 처리가 유지되는 경로가 `test-reaction-approval-flow`에서 통과했습니다.
- 공개 답글 설정은 로컬 mock 기반으로 확인되었고, 실제 채널에서 공개 답글이 남는지 여부는 수동 확인이 필요합니다.

### 운영자 흐름

- `/운영현황`, `/포인트관리`, `/포인트로그`, `/교환관리`, `/인증관리`, `/미션관리`, `/상점관리`, `/운영내보내기`의 주요 처리 흐름은 `test-admin-management-flow`, `test-operator-hub-flow`, `test-admin-mission-hub-flow`, `test-admin-shop-hub-flow`, `test-operation-export-flow`, `test-submission-review-buttons-flow`에서 확인되었습니다.

### 관리자 대시보드

- `/admin` read-only 대시보드, Basic Auth, 잘못된 비밀번호 401, 올바른 비밀번호 200, 빈 상태, example/demo/sample 성격 레코드 제외는 `test-admin-dashboard-flow`에서 확인되었습니다.
- 테스트는 `user_example`, `rd_example`, `submission_example`, `tx_example`, 2030년 샘플 날짜가 운영 데이터처럼 집계되지 않는지 검증합니다.

### 데이터/릴리즈 점검

- `npm run validate:data`와 `npm run test:questions`는 통과했습니다.
- `npm run check:release`는 실패했습니다. 실패 원인은 아래 이슈 목록의 Blocker 항목에 정리했습니다.

## 수동 Discord 서버에서 확인해야 하는 항목

- 실제 운영 서버에서 Slash Command가 최신 등록 상태인지 확인합니다. 이 QA에서는 `npm run deploy`를 실행하지 않았습니다.
- 테스트 참여자 계정으로 `/안내 -> /미션 -> /체크인 -> 인증 업로드 -> /포인트 -> /상점 -> /교환`을 실제 Discord UI에서 1회 이상 완료합니다.
- 운영자 계정으로 `✅ 반응 승인 -> /포인트로그 -> /운영현황 -> /admin -> /교환관리 -> /운영내보내기`를 실제 서버에서 1회 이상 완료합니다.
- 일반 참여자가 운영자 전용 명령어와 채널을 볼 수 없는지 확인합니다.
- `LOG_CHANNEL_ID`, `POINT_REDEEM_CHANNEL_ID`, `ACTIVITY_REVIEW_CHANNEL_ID`, `MISSION_SUBMISSION_CHANNEL_ID`, `TODAY_MISSION_CHANNEL_ID`의 실제 채널 권한을 확인합니다.
- `REACTION_APPROVAL_PUBLIC_REPLY=false`일 때 인증 채널 공개 답글이 남지 않는지 확인합니다.
- `REACTION_APPROVAL_DM_USER=true`일 때 DM 수신 가능 사용자에게 DM이 도착하는지, DM 차단 사용자도 포인트와 기록이 유지되는지 확인합니다.
- Railway `/admin` URL에서 Basic Auth가 동작하고, `/api/admin/*`도 보호되는지 확인합니다.
- 운영용 active 미션과 active 상점 항목이 실제로 1개 이상 보이는지 확인합니다.
- `/운영내보내기` 결과 파일에 개인정보, 사용자 ID, 인증 내용, 운영 메모가 포함될 수 있음을 운영진 보관 기준에 따라 확인합니다.

## 발견한 이슈 목록

### Blocker: `npm run check:release` 실패

- 영향: 운영 릴리즈 체크리스트의 필수 release gate가 실패합니다. 핵심 QA 범위의 개별 smoke test는 통과했지만, 운영 전 최종 점검 기준으로는 녹색 빌드 상태가 아닙니다.
- 재현 방법:
  1. `npm run check:release`를 실행합니다.
  2. `minigame hub flow smoke test` 단계에서 `expected at least one deterministic RPS draw choice` assertion이 실패합니다.
  3. `node scripts/test-minigame-hub-flow.js` 단독 실행으로도 같은 실패가 재현됩니다.
- 원인: `scripts/test-minigame-hub-flow.js`가 현재 KST 날짜와 고정 사용자 `rps_draw_user` 기준으로 가위바위보 선택지 3개 중 최소 1개는 무승부가 나온다고 가정합니다. 2026-06-27 KST에는 세 선택 모두 무승부가 아니어서 실패합니다.
- 권장 조치: 테스트가 날짜에 의존하지 않도록 고정 날짜를 주입하거나, 무승부가 보장되는 fixture 사용자/날짜를 사용하도록 수정합니다. 운영 코드 수정이 필요할 수 있으므로 이 QA에서는 변경하지 않았습니다.

### Low: 질문 매칭 Fallback 10개 존재

- 영향: `test:questions`는 통과했지만 일부 질문은 의도적으로 Fallback에 남습니다. 운영 정책 미확정 질문이나 무관한 질문은 Fallback이 맞지만, 실제 운영 중 반복되면 운영자 로그 확인 부담이 생길 수 있습니다.
- 재현 방법: `npm run test:questions` 실행 후 Fallback 질문 목록을 확인합니다.
- 권장 조치: 교통비, 식사, 노트북, 늦은 합류처럼 운영 정책이 정해지면 FAQ가 아니라 운영진 확인 안내 또는 확정 답변으로 분류할지 별도 결정합니다. 정책 미확정 상태에서는 현재처럼 운영자 확인으로 남기는 것이 안전합니다.

## 운영 전 체크리스트

- [ ] `npm run check:release` 실패를 해결하거나, 운영진이 해당 실패의 범위와 위험을 승인했습니다.
- [ ] 실제 Discord 서버에서 참여자 전체 흐름을 테스트 계정으로 완료했습니다.
- [ ] 실제 Discord 서버에서 운영자 전체 흐름을 운영자 계정으로 완료했습니다.
- [ ] 일반 참여자 권한으로 운영자 명령어와 운영자 채널 접근이 차단됨을 확인했습니다.
- [ ] 운영용 active 미션과 active 상점 항목만 노출되는지 확인했습니다.
- [ ] 미션 인증 채널에서 ✅/❌ 반응 승인, 중복 지급 방지, DM 실패 시 기록 유지가 실제로 동작함을 확인했습니다.
- [ ] `/admin`이 운영 URL에서 인증 보호되고 read-only로만 보이는지 확인했습니다.
- [ ] `/admin`과 `/운영현황`에서 example/demo/sample 레코드가 운영 데이터처럼 보이지 않음을 확인했습니다.
- [ ] `/운영내보내기` 백업 파일 보관 위치와 접근 권한을 정했습니다.
- [ ] 운영 시작 전 테스트 교환, 테스트 인증, 테스트 포인트 로그를 정리할지 결정했습니다.
- [ ] `.env`, 실제 토큰, 실제 채널 ID, `data/*.local.json`이 문서나 커밋 대상에 포함되지 않음을 확인했습니다.

## 수정하지 않고 남긴 이유가 있는 항목

- `scripts/test-minigame-hub-flow.js`의 날짜 의존 실패는 release gate를 막는 이슈지만, 사용자가 코드 수정 전 원인과 영향도 정리를 요청했습니다. 따라서 이 리포트에서는 원인과 권장 조치만 남기고 수정하지 않았습니다.
- 실제 Discord 서버, Railway Variables, 실제 `/admin` URL, 실제 채널 권한은 로컬 smoke test로 검증할 수 없습니다. 토큰과 실제 ID를 출력하지 않는 조건도 있어 수동 확인 항목으로 분리했습니다.
- `npm run test:questions`의 Fallback 질문 중 운영 정책 미확정 항목은 프로젝트 규칙상 단정 답변으로 하드코딩하지 않는 것이 안전하므로 수정하지 않았습니다.

## 다음 작업 추천 순서

1. `test-minigame-hub-flow`의 날짜 의존 assertion을 수정해 `npm run check:release`가 항상 통과하도록 만듭니다.
2. 수정 후 `npm run check:release`를 다시 실행합니다.
3. 실제 Discord 테스트 서버에서 참여자 리허설 흐름을 완료합니다.
4. 실제 Discord 테스트 서버에서 운영자 리허설 흐름과 반응 승인 흐름을 완료합니다.
5. Railway `/admin`과 `/api/admin/*` 인증 보호, read-only 상태, example 제외를 실제 URL에서 확인합니다.
6. 운영용 active 미션/상점 상태와 테스트 데이터 정리 여부를 확정합니다.
7. 운영 시작 직전 `/운영내보내기 종류:전체 형식:JSON`으로 백업을 남깁니다.
