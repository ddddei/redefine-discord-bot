# Codex 작업 지시서

## 작업 이름

디스코드 봇 운영 관리 기능 완성 MVP v1

## 목표

프로젝트 리디파인 디스코드 봇의 리디파인 포인트 시스템을 디스코드 안에서 최대한 끊김 없이 운영할 수 있도록 운영자 관리 기능을 보강한다.

현재 구현된 기능은 다음과 같다.

* /포인트
* /상점
* /교환
* /포인트관리
* /교환관리
* /포인트로그
* /체크인
* /미션
* /인증
* /인증관리

이번 작업에서는 페이지, Google Sheets, PostgreSQL 연동 없이 디스코드 봇 내부 운영 기능을 먼저 완성한다.

이번 작업에서 추가할 기능은 아래와 같다.

* /운영현황
* /미션관리
* /상점관리
* 운영자용 pending 목록 확인
* 상점 항목 추가/수정/상태 변경
* 미션 추가/수정/상태 변경
* 운영자 명령어 안내 문서 보강
* 관련 smoke test 추가

이번 작업에서는 웹 대시보드, Google Sheets 연동, PostgreSQL 연동, MEE6 연동은 구현하지 않는다.

## 현재 전제

현재 프로젝트에는 아래 파일과 구조가 있다.

* src/pointsStore.js
* src/pointsRepository.js
* src/handlers.js
* src/embeds.js
* src/logging.js
* scripts/test-points-store.js
* scripts/test-points-repository.js
* scripts/test-point-activity-flow.js
* data/points.example.json
* data/shop-items.example.json
* data/redemptions.example.json
* data/missions.example.json
* data/submissions.example.json
* docs/journey-point-system-plan.md
* docs/point-data-structure-plan.md
* docs/operation-guide.md

현재 local JSON repository 구조를 유지한다.

실제 운영 데이터 파일은 data/*.local.json 형태이며 커밋하지 않는다.

## 중요 운영 정책

### 참여자 기능 유지

아래 명령어의 기존 동작을 깨지 않는다.

* /포인트
* /상점
* /교환
* /체크인
* /미션
* /인증

/포인트, /상점, /교환, /체크인, /미션, /인증 응답은 가능하면 계속 ephemeral로 유지한다.

### 운영자 기능 유지

아래 명령어의 기존 동작을 깨지 않는다.

* /포인트관리
* /교환관리
* /포인트로그
* /인증관리

운영자 명령어는 ManageMessages 또는 Administrator 권한이 있는 사용자만 실행 가능하게 유지한다.

### 이번 작업의 핵심

운영자가 JSON 파일을 직접 열지 않고도 디스코드 안에서 다음을 할 수 있게 한다.

* 현재 처리해야 할 pending 교환 신청 확인
* 현재 처리해야 할 pending 인증 제출 확인
* 현재 active 미션 확인
* 미션 추가
* 미션 활성화/일시중지/종료
* 상점 항목 추가
* 상점 항목 활성화/일시중지/품절/숨김
* 최근 운영 현황 요약 확인

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
* 웹 대시보드는 구현하지 않는다.
* MEE6 연동은 구현하지 않는다.
* Slash Command가 추가되므로 작업 완료 후 사용자가 직접 npm run deploy를 실행해야 한다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

* src/deploy-commands.js
* src/handlers.js
* src/embeds.js
* src/pointsRepository.js
* src/pointsStore.js
* scripts/test-admin-management-flow.js
* scripts/test-point-activity-flow.js
* scripts/test-points-repository.js
* scripts/check-release.js
* docs/journey-point-system-plan.md
* docs/point-data-structure-plan.md
* docs/operation-guide.md
* .env.example
* prompts/codex/bot-admin-management-mvp-v1.md

.env.example은 실제 값 없이 placeholder만 추가할 수 있다.

## 작업 1. Slash Command 추가

src/deploy-commands.js에 아래 운영자 명령어를 추가한다.

### /운영현황

설명 예시:

운영자가 포인트, 교환, 인증 현황을 요약 확인합니다.

옵션:

* 종류: string, optional

  * choices:

    * 요약
    * 교환대기
    * 인증대기
    * 미션
    * 상점
* 개수: integer, optional

  * 기본값 10
  * 최소 1
  * 최대 20

권한:

* 운영자 전용
* ManageMessages 권한 적용
* 응답은 ephemeral 권장

### /미션관리

설명 예시:

운영자가 미션을 추가하거나 상태를 변경합니다.

옵션:

* 작업: string, required

  * choices:

    * 목록
    * 추가
    * 수정
    * 활성화
    * 일시중지
    * 종료
* 미션id: string, optional
* 제목: string, optional
* 설명: string, optional
* 포인트: integer, optional
* 인증필요: boolean, optional
* 날짜: string, optional

  * YYYY-MM-DD 형식 권장
* 메모: string, optional

권한:

* 운영자 전용
* ManageMessages 권한 적용
* 응답은 ephemeral 권장

동작 기준:

* 목록: 전체 또는 최근 미션 목록 표시
* 추가: 제목, 설명, 포인트를 바탕으로 새 미션 생성
* 수정: 기존 미션의 제목, 설명, 포인트, 인증필요, 날짜, 메모를 수정
* 활성화: status를 active로 변경
* 일시중지: status를 paused로 변경
* 종료: status를 closed로 변경

### /상점관리

설명 예시:

운영자가 상점 항목을 추가하거나 상태를 변경합니다.

옵션:

* 작업: string, required

  * choices:

    * 목록
    * 추가
    * 수정
    * 활성화
    * 일시중지
    * 품절
    * 숨김
* 항목id: string, optional
* 이름: string, optional
* 설명: string, optional
* 비용: integer, optional
* 재고: integer, optional
* 월한도: integer, optional
* 유형: string, optional

  * choices:

    * 청년동포인트
    * 리워드
    * 굿즈
    * 이벤트
* 메모: string, optional

권한:

* 운영자 전용
* ManageMessages 권한 적용
* 응답은 ephemeral 권장

동작 기준:

* 목록: 현재 상점 항목 목록 표시
* 추가: 이름, 설명, 비용, 유형을 바탕으로 새 상점 항목 생성
* 수정: 기존 항목의 이름, 설명, 비용, 재고, 월한도, 메모를 수정
* 활성화: status를 active로 변경
* 일시중지: status를 paused로 변경
* 품절: status를 soldOut로 변경
* 숨김: status를 hidden으로 변경

## 작업 2. Repository 보강

src/pointsRepository.js를 보강한다.

추가 또는 보강할 함수 후보:

### 운영 현황

* getOperationSummary()
* listPendingRedemptions(limit)
* listPendingSubmissions(limit)
* listActiveMissions(limit)
* listShopItemsForAdmin(limit)
* listTodayCheckins()
* listRecentActivityLogs(limit)

운영현황 요약에 포함할 수 있는 내용:

* pending 교환 신청 수
* pending 인증 제출 수
* active 미션 수
* active 상점 항목 수
* 오늘 체크인 수
* 최근 포인트 거래 수
* 최근 교환 신청 수

### 미션 관리

* createMission(input)
* updateMission(missionId, updates)
* setMissionStatus(missionId, status)
* listMissionsForAdmin(options)
* findMission(missionId)

mission status 후보:

* draft
* active
* paused
* closed
* archived

주의:

* status 값은 기존 문서와 충돌하지 않게 한다.
* active 미션만 /미션에 노출되도록 기존 흐름을 유지한다.
* mission id는 입력값이 없으면 mission_타임스탬프 또는 예측 가능한 prefix로 생성한다.
* rewardPoints는 0보다 큰 정수여야 한다.
* 미션 추가 시 제목과 설명이 비어 있으면 Error를 던지거나 사용자에게 안내한다.

### 상점 관리

* createShopItem(input)
* updateShopItem(itemId, updates)
* setShopItemStatus(itemId, status)
* listShopItemsForAdmin(options)
* findShopItem(itemId)

shop item status 후보:

* active
* paused
* soldOut
* hidden

shop item type 후보:

* youthCenterPoint
* reward
* goods
* event

주의:

* active 항목만 /상점에 노출되도록 기존 흐름을 유지한다.
* item id는 입력값이 없으면 item_타임스탬프 또는 예측 가능한 prefix로 생성한다.
* cost는 0보다 큰 정수여야 한다.
* 청년동 포인트 전환권은 youthCenterPoint type으로 관리한다.
* 구독권, 굿즈, 특별 리워드는 stock 또는 monthlyLimit 설정이 가능해야 한다.

## 작업 3. /운영현황 구현

src/handlers.js에 /운영현황 처리 함수를 추가한다.

운영자 전용이다.

종류 옵션에 따라 다르게 보여준다.

### 종류: 요약 또는 미입력

다음 내용을 요약한다.

* 대기 중인 교환 신청 수
* 대기 중인 인증 제출 수
* 활성 미션 수
* 활성 상점 항목 수
* 오늘 체크인 수
* 최근 포인트 로그 요약
* 운영자가 다음에 확인할 명령어 안내

응답 예시 방향:

제목: 운영 현황 요약

내용:

* 교환 대기: 0건
* 인증 대기: 0건
* 활성 미션: 0개
* 활성 상점 항목: 0개
* 오늘 체크인: 0건

하단 안내:

* 교환 대기는 /운영현황 종류:교환대기
* 인증 대기는 /운영현황 종류:인증대기
* 미션 관리는 /미션관리
* 상점 관리는 /상점관리

### 종류: 교환대기

pending redemptions 목록을 보여준다.

포함:

* 신청 ID
* 사용자 표시명 또는 userId 최소 표시
* 항목 ID
* 비용
* 신청 시간
* 처리 안내

### 종류: 인증대기

pending submissions 목록을 보여준다.

포함:

* 제출 ID
* 사용자 표시명 또는 userId 최소 표시
* 미션 ID
* 제출 내용 요약
* 제출 시간
* 처리 안내

### 종류: 미션

미션 목록을 보여준다.

포함:

* 미션 ID
* 제목
* status
* rewardPoints
* activeDate

### 종류: 상점

상점 항목 목록을 보여준다.

포함:

* 항목 ID
* 이름
* status
* cost
* stock
* type

주의:

* 응답은 ephemeral로 한다.
* 너무 긴 목록은 개수 옵션에 따라 자른다.
* 개인정보를 과도하게 표시하지 않는다.
* ID는 운영자가 복사해서 사용할 수 있게 명확하게 보여준다.

## 작업 4. /미션관리 구현

src/handlers.js에 /미션관리 처리 함수를 추가한다.

운영자 전용이다.

### 목록

* 최근 또는 전체 미션 목록을 보여준다.
* status, rewardPoints, activeDate를 함께 표시한다.
* active 미션은 참여자 /미션에 노출된다는 안내를 포함한다.

### 추가

필수에 가까운 옵션:

* 제목
* 설명
* 포인트

인증필요 옵션이 없으면 true를 기본값으로 둔다.

날짜 옵션이 없으면 오늘 한국 날짜 또는 null을 사용할 수 있다.

추가 후:

* 생성된 미션 ID
* 제목
* 지급 포인트
* 상태
* 활성화 방법 안내

초기 status는 draft 또는 active 중 하나를 선택한다.

추천:

* 운영 실수 방지를 위해 기본 status는 draft로 둔다.
* 운영자가 /미션관리 작업:활성화 미션id:... 로 활성화하게 한다.

### 수정

* 미션id가 필요하다.
* 입력된 필드만 수정한다.
* 없는 미션이면 안내한다.

### 활성화

* 미션 status를 active로 변경한다.

### 일시중지

* 미션 status를 paused로 변경한다.

### 종료

* 미션 status를 closed로 변경한다.

주의:

* 이미 종료된 미션을 다시 활성화할 수는 있지만 운영진이 확인하도록 안내한다.
* rewardPoints는 음수 또는 0이면 허용하지 않는다.
* 응답은 ephemeral로 한다.

## 작업 5. /상점관리 구현

src/handlers.js에 /상점관리 처리 함수를 추가한다.

운영자 전용이다.

### 목록

* 현재 상점 항목 목록을 보여준다.
* status, cost, stock, type을 함께 표시한다.
* active 항목은 참여자 /상점에 노출된다는 안내를 포함한다.

### 추가

필수에 가까운 옵션:

* 이름
* 설명
* 비용
* 유형

유형 매핑:

* 청년동포인트 -> youthCenterPoint
* 리워드 -> reward
* 굿즈 -> goods
* 이벤트 -> event

재고가 입력되지 않으면 null 또는 운영진 확인으로 처리한다.

월한도가 입력되지 않으면 null 또는 운영진 확인으로 처리한다.

초기 status는 draft가 없으므로 paused 또는 active 중 하나를 선택한다.

추천:

* 운영 실수 방지를 위해 기본 status는 paused로 둔다.
* 운영자가 /상점관리 작업:활성화 항목id:... 로 활성화하게 한다.

### 수정

* 항목id가 필요하다.
* 입력된 필드만 수정한다.
* 없는 항목이면 안내한다.

### 활성화

* status를 active로 변경한다.

### 일시중지

* status를 paused로 변경한다.

### 품절

* status를 soldOut로 변경한다.

### 숨김

* status를 hidden으로 변경한다.

주의:

* cost는 음수 또는 0이면 허용하지 않는다.
* stock은 음수이면 허용하지 않는다.
* 청년동 포인트 전환권은 현금성 보상처럼 보이지 않게 안내한다.
* 응답은 ephemeral로 한다.

## 작업 6. Embed 보강

필요하다면 src/embeds.js에 아래 helper를 추가한다.

* createOperationSummaryEmbed
* createPendingRedemptionsEmbed
* createPendingSubmissionsEmbed
* createAdminMissionListEmbed
* createAdminShopListEmbed
* createMissionAdminResultEmbed
* createShopAdminResultEmbed

기존 embed 톤과 색상을 유지한다.

Embed 제한을 고려한다.

* title 256자
* description 4096자
* field value 1024자
* fields 25개 제한

목록은 길 경우 일부만 표시한다.

## 작업 7. 테스트 스크립트 추가

scripts/test-admin-management-flow.js 파일을 새로 만든다.

역할:

* 임시 디렉터리에서 운영자 관리 기능 repository 흐름을 테스트한다.
* 실제 data/*.local.json은 만들지 않는다.
* os.tmpdir() 아래 테스트용 파일만 사용한다.
* Node 기본 assert만 사용한다.
* 외부 테스트 라이브러리는 추가하지 않는다.

테스트 항목:

* 운영 현황 요약 생성
* 미션 추가
* 미션 수정
* 미션 활성화
* 미션 일시중지
* 미션 종료
* active 미션 목록 반영
* 상점 항목 추가
* 상점 항목 수정
* 상점 항목 활성화
* 상점 항목 일시중지
* 상점 항목 품절
* 상점 항목 숨김
* active 상점 목록 반영
* pending 교환 목록 조회
* pending 인증 목록 조회

성공 시 출력:

admin management flow smoke test passed

## 작업 8. check-release 반영

scripts/check-release.js에 아래 파일 문법 검사 또는 smoke test를 반영한다.

* scripts/test-admin-management-flow.js

가능하다면 check-release에서 아래 테스트도 실행하도록 한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* node scripts/test-admin-management-flow.js

기존 validate:data, test:questions 흐름은 유지한다.

## 작업 9. 문서 보강

아래 문서를 필요한 만큼 보강한다.

### docs/journey-point-system-plan.md

보강 내용:

* 디스코드 봇 내부에서 운영자 관리 기능을 우선 완성한다는 방향
* /운영현황으로 pending 교환/인증 및 전체 현황 확인 가능
* /미션관리로 미션 추가, 수정, 활성화, 일시중지, 종료 가능
* /상점관리로 상점 항목 추가, 수정, 활성화, 일시중지, 품절, 숨김 가능
* 페이지나 Google Sheets 연동은 후속 단계

### docs/point-data-structure-plan.md

보강 내용:

* mission status 관리
* shopItem status 관리
* 운영자 관리 명령어가 local JSON repository를 수정한다는 점
* local JSON은 MVP용이며 장기 운영 저장소가 아님
* 실제 운영 전 Google Sheets 또는 PostgreSQL 검토 필요

### docs/operation-guide.md

보강 내용:

* 운영자는 /운영현황으로 대기 건을 먼저 확인
* 미션 생성 후 활성화해야 참여자 /미션에 노출
* 상점 항목 생성 후 활성화해야 참여자 /상점에 노출
* 품절 또는 숨김 상태 항목은 참여자에게 노출되지 않음
* 대기 중인 교환은 /교환관리로 처리
* 대기 중인 인증은 /인증관리로 처리
* 운영 중에는 ID를 복사해 처리하므로 ID 관리에 유의

## 작업 10. .env.example 보강

.env.example은 필요한 경우에만 보강한다.

이번 작업에서 새 환경변수가 꼭 필요하지 않다면 수정하지 않아도 된다.

주의:

* 실제 값은 절대 넣지 않는다.
* .env 파일은 수정하지 않는다.

## 검증

작업 완료 후 아래 명령어를 실행한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* node scripts/test-admin-management-flow.js
* npm run validate:data
* npm run test:questions
* npm run check:release

주의:

* npm run deploy는 실행하지 않는다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

* 변경된 파일 목록
* 추가된 Slash Command 목록
* /운영현황 동작 요약
* /미션관리 동작 요약
* /상점관리 동작 요약
* pending 교환/인증 확인 방식
* 미션 생성 후 활성화 구조
* 상점 항목 생성 후 활성화 구조
* 운영자 권한 검사 방식
* 실제 Google Sheets나 PostgreSQL 연동은 하지 않았다는 점
* 웹 대시보드는 만들지 않았다는 점
* data/*.local.json은 커밋하지 않는다는 점
* node scripts/test-points-store.js 결과
* node scripts/test-points-repository.js 결과
* node scripts/test-point-activity-flow.js 결과
* node scripts/test-admin-management-flow.js 결과
* npm run validate:data 결과
* npm run test:questions 결과
* npm run check:release 결과
* npm run deploy는 실행하지 않았다는 점
* 작업 후 사용자가 직접 npm run deploy를 실행해야 한다는 점
