# Codex 작업 지시서

## 작업 이름

운영자 운영 허브 v1

## 목표

프로젝트 리디파인 디스코드 봇의 운영자용 `/운영현황` 명령어를 운영 허브로 개선한다.

현재 참여자용 `/안내`는 안내 허브로 정리되어 있고, 참여자는 `/안내` 하나에서 주요 사용법을 확인할 수 있다. 반면 운영자는 `/운영현황`, `/교환관리`, `/인증관리`, `/포인트로그`, `/미션관리`, `/상점관리`, `/운영내보내기` 등 여러 명령어를 기억해야 한다.

이번 작업에서는 기존 `/운영현황` 명령어를 운영자용 메인 허브처럼 정리한다.

핵심 목표:

- 운영자는 `/운영현황` 하나로 현재 운영 상태를 빠르게 확인할 수 있다.
- 운영현황 첫 화면에서 핵심 숫자와 다음 확인 항목이 보인다.
- 드롭다운 또는 버튼으로 운영 메뉴를 선택할 수 있다.
- 교환 대기, 인증 대기, 최근 포인트 로그, 미션/상점 상태, 반응 승인 기록, 내보내기 안내를 확인할 수 있다.
- 기존 운영자 명령어는 유지한다.
- 새 Slash Command는 추가하지 않는다.
- Google Sheets 연동, PostgreSQL 연동, 웹 관리자 페이지는 구현하지 않는다.

## 현재 전제

현재 참여자 주요 기능:

- /안내
- /포인트
- /상점
- /교환
- /체크인
- /미션
- /인증
- 미션 인증 채널 반응 승인

현재 운영자 명령어:

- /공지
- /포인트관리
- /교환관리
- /포인트로그
- /인증관리
- /운영현황
- /미션관리
- /상점관리
- /운영내보내기

현재 운영 데이터:

- 사용자별 포인트
- 포인트 거래 로그
- 교환 신청
- 미션 인증 제출
- 미션 목록
- 상점 항목
- 반응 승인 기록
- 운영 내보내기 기능

## 중요 UX 방향

### 운영자 화면은 감성 문구보다 상태와 다음 행동이 중요하다

참여자 화면은 부드럽게 작성하되, 운영자 화면은 짧고 명확하게 작성한다.

운영자 화면 예시:

- 교환 대기: 2건
- 인증 대기: 1건
- 오늘 포인트 거래: 5건
- 활성 미션: 3개
- 활성 상점 항목: 2개
- 반응 승인: 오늘 4건

### /운영현황은 운영자용 허브 역할을 한다

`/운영현황` 실행 시 아래 정보를 우선 보여준다.

- 운영 요약
- 확인 필요 항목
- 최근 로그
- 다음 메뉴 선택 드롭다운

드롭다운 항목 추천:

- 전체 요약
- 교환 대기
- 인증 대기
- 최근 포인트 로그
- 미션/상점 상태
- 반응 승인 기록
- 내보내기 안내
- 운영 체크리스트

### 처리 기능은 기존 명령어를 유지한다

이번 작업에서 모든 처리 버튼까지 완벽하게 구현하려고 하지 않는다.

우선순위:

1. 운영자가 현재 상태를 빠르게 보는 것
2. 어떤 명령어로 처리해야 하는지 알 수 있는 것
3. 기존 처리 명령어와 충돌하지 않는 것

가능하면 일부 항목에 간단한 처리 안내를 붙인다.

예:

- 교환 대기 처리는 `/교환관리`
- 인증 대기 처리는 `/인증관리`
- 포인트 수동 지급은 `/포인트관리`
- 데이터 백업은 `/운영내보내기`

## 중요 주의사항

- 새 Slash Command는 추가하지 않는다.
- 기존 Slash Command 이름은 변경하지 않는다.
- `/운영현황`을 운영자 허브로 개선한다.
- `.env` 파일은 수정하지 않는다.
- 실제 토큰, 실제 채널 ID, 실제 개인정보는 작성하지 않는다.
- `data/*.local.json`은 커밋하지 않는다.
- package.json, package-lock.json은 수정하지 않는다.
- Railway, GitHub 설정은 변경하지 않는다.
- Google Sheets 연동은 구현하지 않는다.
- PostgreSQL 연동은 구현하지 않는다.
- 웹 관리자 페이지는 구현하지 않는다.
- npm run deploy는 실행하지 않는다.
- git commit, git push는 하지 않는다.
- 기존 `/포인트관리`, `/교환관리`, `/인증관리`, `/포인트로그`, `/미션관리`, `/상점관리`, `/운영내보내기` 기능을 깨지 않는다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

- src/handlers.js
- src/embeds.js
- src/components.js
- src/pointsRepository.js
- src/pointsStore.js
- src/logging.js
- scripts/test-admin-management-flow.js
- scripts/test-operation-export-flow.js
- scripts/test-reaction-approval-flow.js
- scripts/check-release.js
- docs/operation-guide.md
- docs/prelaunch-qa-checklist.md
- docs/operator-dashboard-guide.md
- README.md
- prompts/codex/operator-operation-hub-v1.md

새 문서 생성 권장:

- docs/operator-dashboard-guide.md

## 작업 1. /운영현황 첫 화면 개선

`/운영현황` 실행 시 기존 요약을 운영자 허브 형태로 개선한다.

권장 제목:

운영 현황 허브

권장 본문:

현재 운영 상태를 한눈에 확인할 수 있어요.  
아래 요약을 확인한 뒤 필요한 메뉴를 선택해 주세요.

표시할 요약:

- 전체 사용자 수
- 총 포인트 거래 수
- 교환 대기 수
- 인증 대기 수
- 활성 미션 수
- 활성 상점 항목 수
- 오늘 체크인 수
- 오늘 반응 승인 수
- 오늘 포인트 거래 수

구현 가능한 데이터만 표시한다.  
데이터 구조상 어려운 항목은 생략하거나 0으로 안전하게 표시한다.

주의:

- 내부 저장소 오류가 발생해도 명령어가 죽지 않게 한다.
- 값이 없으면 0건 또는 없음으로 표시한다.
- 운영자 화면이므로 ID나 상태값이 어느 정도 보여도 된다.
- 너무 긴 목록은 첫 화면에 모두 넣지 않는다.

## 작업 2. 운영현황 메뉴 드롭다운 추가

`/운영현황` 응답에 운영자용 드롭다운을 추가한다.

customId 후보:

- operator_hub_select

option value 후보:

- overview
- redemptions
- submissions
- points
- missions_shop
- reaction_approvals
- exports
- checklist

드롭다운 label 추천:

- 전체 요약
- 교환 대기
- 인증 대기
- 최근 포인트 로그
- 미션/상점 상태
- 반응 승인 기록
- 내보내기 안내
- 운영 체크리스트

placeholder:

확인할 운영 메뉴를 선택해 주세요

주의:

- 기존 participant guide hub customId와 충돌하지 않는다.
- 기존 shop/mission/redeem/submission customId와 충돌하지 않는다.
- interaction.isStringSelectMenu() 분기에 operator_hub_select 처리를 추가한다.
- 응답은 운영자에게만 보이는 ephemeral을 유지한다.

## 작업 3. 교환 대기 화면

운영자가 드롭다운에서 “교환 대기”를 선택하면 대기 중인 교환 신청 목록을 보여준다.

표시 항목:

- 신청 ID
- 사용자 표시명 또는 사용자 ID
- 항목명
- 필요 포인트
- 신청 시각
- 상태

최대 5~10건만 표시한다.

하단 안내:

처리는 `/교환관리` 명령어에서 진행할 수 있어요.

예시:

대기 중인 교환 신청 2건

1. 청년동 포인트 전환권 100P  
   신청자: user_xxx  
   신청 ID: rd_xxx  
   상태: pending

주의:

- 너무 긴 ID는 줄이거나 코드 블록 형태로 정리한다.
- 개인정보를 과도하게 노출하지 않는다.
- 대기 건이 없으면 “현재 대기 중인 교환 신청은 없어요.”로 표시한다.

## 작업 4. 인증 대기 화면

운영자가 “인증 대기”를 선택하면 대기 중인 미션 인증 제출 목록을 보여준다.

표시 항목:

- 제출 ID
- 사용자 표시명 또는 사용자 ID
- 미션명
- 지급 예정 포인트
- 제출 시각
- 첨부파일 여부
- 상태

하단 안내:

처리는 `/인증관리` 명령어에서 진행할 수 있어요.  
미션 인증 채널 반응 승인으로 처리된 건은 별도 반응 승인 기록에서 확인할 수 있어요.

주의:

- `/인증` 명령어로 제출된 pending 건 중심으로 표시한다.
- 반응 승인으로 이미 지급된 건과 혼동하지 않게 한다.
- pending 건이 없으면 “현재 확인할 인증 제출은 없어요.”로 표시한다.

## 작업 5. 최근 포인트 로그 화면

운영자가 “최근 포인트 로그”를 선택하면 최근 포인트 거래를 보여준다.

표시 항목:

- 날짜
- 사용자
- 타입 earn/spend/refund/manual 등
- 포인트 변화량
- 사유
- 잔액

최대 10건만 표시한다.

하단 안내:

자세한 기록은 `/포인트로그` 또는 `/운영내보내기`로 확인할 수 있어요.

주의:

- 너무 긴 로그는 줄인다.
- 사용자 ID와 사유가 너무 길면 잘라낸다.
- 로그가 없으면 “아직 표시할 포인트 로그가 없어요.”로 표시한다.

## 작업 6. 미션/상점 상태 화면

운영자가 “미션/상점 상태”를 선택하면 현재 활성 미션과 활성 상점 항목을 요약한다.

표시 항목:

미션:

- 활성 미션 수
- draft/paused/active 등 상태별 수
- 최근 등록된 미션 3~5개

상점:

- 활성 상점 항목 수
- 숨김/일시중지/활성 상태별 수
- 최근 등록된 상점 항목 3~5개

하단 안내:

미션은 `/미션관리`, 상점은 `/상점관리`에서 수정할 수 있어요.

주의:

- 운영자 화면이므로 내부 코드나 상태값이 보여도 된다.
- 다만 너무 길게 나열하지 않는다.

## 작업 7. 반응 승인 기록 화면

운영자가 “반응 승인 기록”을 선택하면 미션 인증 채널에서 ✅/❌ 반응으로 처리된 최근 기록을 보여준다.

표시 항목:

- 처리 상태 approved/rejected
- 참여자
- 승인/반려자
- 지급 포인트
- 처리 시각
- 원본 메시지 링크가 있으면 표시

최대 5~10건만 표시한다.

하단 안내:

반응 승인 기록은 미션 인증 채널에서 운영자가 이모지로 확인한 내역이에요.  
전체 백업은 `/운영내보내기`를 활용해 주세요.

주의:

- 데이터 구조상 reaction approvals를 읽을 수 있어야 한다.
- 아직 repository helper가 없다면 가능한 범위에서 추가한다.
- 어렵다면 “반응 승인 기록은 포인트 로그에서 확인할 수 있어요.” 안내로 대체해도 된다.

## 작업 8. 내보내기 안내 화면

운영자가 “내보내기 안내”를 선택하면 운영 데이터 백업 방법을 안내한다.

권장 문구:

운영 데이터는 정기적으로 백업하는 것을 권장합니다.

확인 가능한 데이터:

- 포인트 로그
- 교환 신청
- 인증 제출
- 반응 승인 기록
- 전체 운영 요약

사용 방법:

- `/운영내보내기 종류:포인트 형식:CSV`
- `/운영내보내기 종류:교환 형식:JSON`
- `/운영내보내기 종류:인증 형식:JSON`
- `/운영내보내기 종류:전체 형식:JSON`

주의:

- 실제 명령어 옵션 이름이 다르면 현재 코드 기준으로 정확히 맞춘다.
- 운영자가 바로 복사해 테스트할 수 있게 짧게 정리한다.

## 작업 9. 운영 체크리스트 화면

운영자가 “운영 체크리스트”를 선택하면 운영 전/운영 중 확인할 항목을 보여준다.

권장 내용:

운영 전:

- `/안내`가 정상 작동하는지 확인
- 미션 인증 채널 ID가 설정되어 있는지 확인
- 운영자 역할/권한이 정상인지 확인
- 반응 승인 ✅/❌가 정상 작동하는지 확인

운영 중:

- 교환 대기 건 확인
- 인증 대기 건 확인
- 포인트 로그 확인
- 미션/상점 활성 상태 확인

운영 후:

- `/운영내보내기`로 데이터 백업
- 이상 지급/중복 지급 여부 확인

주의:

- 체크리스트는 너무 길지 않게 한다.
- 자세한 내용은 docs/operator-dashboard-guide.md로 안내한다.

## 작업 10. 운영 허브 helper 분리

가능하면 src/embeds.js 또는 src/components.js에 운영 허브 관련 helper를 분리한다.

추천 helper:

- buildOperatorHubEmbed(summary)
- buildOperatorHubSelectMenu()
- buildOperatorRedemptionsEmbed(data)
- buildOperatorSubmissionsEmbed(data)
- buildOperatorPointLogsEmbed(data)
- buildOperatorMissionsShopEmbed(data)
- buildOperatorReactionApprovalsEmbed(data)
- buildOperatorExportGuideEmbed()
- buildOperatorChecklistEmbed()

주의:

- 기존 handler가 너무 길어지지 않게 한다.
- 하지만 과도한 구조 변경은 피한다.
- 테스트 가능하도록 pure helper를 우선한다.

## 작업 11. 권한 확인 유지

`/운영현황`은 운영자용 명령어다.

기존 운영자 권한 확인 로직이 있으면 유지한다.

주의:

- 일반 참여자가 운영자 허브를 볼 수 있으면 안 된다.
- 권한 실패 문구는 짧고 부드럽게 유지한다.
- 기존 운영자 판별 기준을 바꾸지 않는다.
- OPERATOR_ROLE_ID, Administrator, ManageMessages 기준이 기존에 있으면 그대로 활용한다.

## 작업 12. 문서 생성

새 문서 `docs/operator-dashboard-guide.md`를 생성한다.

구성:

1. 운영자 허브란?
2. `/운영현황`에서 확인할 수 있는 것
3. 교환 대기 확인 방법
4. 인증 대기 확인 방법
5. 포인트 로그 확인 방법
6. 미션/상점 상태 확인 방법
7. 반응 승인 기록 확인 방법
8. 데이터 내보내기 방법
9. 운영 전 체크리스트
10. 운영 중 체크리스트
11. 운영 후 백업 체크리스트

톤:

- 운영자용
- 간결하고 실무적으로
- 복사해서 사용할 수 있는 명령어 예시 포함

주의:

- 실제 채널 ID나 개인정보는 쓰지 않는다.
- 명령어 예시는 현재 코드와 맞춘다.

## 작업 13. 기존 문서 보강

### README.md

보강 내용:

- `/운영현황`이 운영자용 허브 역할을 한다는 점
- 운영자는 `/운영현황`에서 대기 건, 로그, 미션/상점 상태, 내보내기 안내를 확인할 수 있다는 점
- docs/operator-dashboard-guide.md 링크 추가

### docs/operation-guide.md

보강 내용:

- 운영자는 먼저 `/운영현황`으로 상태를 확인한다.
- 교환/인증/포인트/미션/상점 관리는 허브에서 안내되는 명령어로 처리한다.
- 정기 백업은 `/운영내보내기`로 진행한다.

### docs/prelaunch-qa-checklist.md

보강 내용:

- `/운영현황` 첫 화면 확인
- 운영자 드롭다운 확인
- 교환 대기 화면 확인
- 인증 대기 화면 확인
- 최근 포인트 로그 화면 확인
- 미션/상점 상태 화면 확인
- 반응 승인 기록 화면 확인
- 내보내기 안내 확인
- 일반 참여자가 접근할 수 없는지 확인

## 작업 14. 테스트 보강

`scripts/test-admin-management-flow.js` 또는 별도 테스트를 보강한다.

가능하면 `scripts/test-operator-hub-flow.js`를 새로 만들어도 된다.  
새로 만들 경우 check-release에 포함한다.

테스트 항목:

- 운영 허브 embed 생성
- 운영 허브 select menu 생성
- 드롭다운 option label/value 확인
- 교환 대기 embed 생성
- 인증 대기 embed 생성
- 최근 포인트 로그 embed 생성
- 미션/상점 상태 embed 생성
- 반응 승인 기록 embed 생성
- 내보내기 안내 embed 생성
- 운영 체크리스트 embed 생성
- 빈 데이터에서도 오류 없이 embed 생성
- 권한 없는 사용자 안내는 기존 로직 유지

성공 시 출력:

operator hub flow smoke test passed

## 작업 15. check-release 반영

새 테스트 파일을 만들었다면 scripts/check-release.js에 포함한다.

예:

- node scripts/test-operator-hub-flow.js

기존 테스트는 유지한다.

## 검증

작업 완료 후 아래 명령어를 실행한다.

- node scripts/test-points-store.js
- node scripts/test-points-repository.js
- node scripts/test-point-activity-flow.js
- node scripts/test-admin-management-flow.js
- node scripts/test-operation-export-flow.js
- node scripts/test-participant-ux-flow.js
- node scripts/test-reaction-approval-flow.js
- node scripts/test-operator-hub-flow.js
- npm run validate:data
- npm run test:questions
- npm run check:release

주의:

- test-operator-hub-flow.js를 만들지 않았다면 해당 명령은 생략해도 된다.
- npm run deploy는 실행하지 않는다.
- 새 Slash Command를 추가하지 않았으므로 npm run deploy는 필요 없다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

- 변경된 파일 목록
- /운영현황 첫 화면 개선 내용
- 운영자 드롭다운 구성
- 전체 요약 화면 내용
- 교환 대기 화면 내용
- 인증 대기 화면 내용
- 최근 포인트 로그 화면 내용
- 미션/상점 상태 화면 내용
- 반응 승인 기록 화면 내용
- 내보내기 안내 화면 내용
- 운영 체크리스트 화면 내용
- 권한 확인 유지 여부
- docs/operator-dashboard-guide.md 생성 여부
- README 보강 내용
- operation-guide 보강 내용
- prelaunch QA 체크리스트 보강 내용
- 기존 운영자 명령어 유지 여부
- 새 Slash Command는 추가하지 않았다는 점
- npm run deploy는 실행하지 않았다는 점
- node scripts/test-points-store.js 결과
- node scripts/test-points-repository.js 결과
- node scripts/test-point-activity-flow.js 결과
- node scripts/test-admin-management-flow.js 결과
- node scripts/test-operation-export-flow.js 결과
- node scripts/test-participant-ux-flow.js 결과
- node scripts/test-reaction-approval-flow.js 결과
- node scripts/test-operator-hub-flow.js 결과 또는 생략 사유
- npm run validate:data 결과
- npm run test:questions 결과
- npm run check:release 결과