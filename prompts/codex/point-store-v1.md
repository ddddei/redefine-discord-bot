# Codex 작업 지시서

## 작업 이름

포인트 저장/조회 유틸 모듈 v1

## 목표

프로젝트 리디파인 디스코드 봇의 리디파인 포인트 시스템 구현을 준비하기 위해 내부 데이터 처리 유틸 모듈을 작성한다.

이번 작업에서는 Slash Command를 추가하지 않는다.

이번 작업에서는 `/포인트`, `/상점`, `/교환`, `/포인트관리`, `/교환관리`, `/포인트로그` 명령어를 구현하지 않는다.

이번 작업의 목적은 이후 명령어 구현에서 재사용할 수 있는 포인트 데이터 읽기, 조회, 검증, 거래 생성, 교환 상태 처리의 기초 함수를 준비하는 것이다.

## 참고 문서

작업 전 아래 문서를 먼저 확인한다.

- docs/journey-point-system-plan.md
- docs/point-data-structure-plan.md
- data/points.example.json
- data/shop-items.example.json
- data/redemptions.example.json
- data/missions.example.json
- data/submissions.example.json

## 중요 주의사항

- src/deploy-commands.js는 수정하지 않는다.
- Slash Command 구조는 변경하지 않는다.
- package.json, package-lock.json은 수정하지 않는다.
- .env, .env.example은 수정하지 않는다.
- 실제 Discord 역할, 채널, 권한 설정은 변경하지 않는다.
- Railway, GitHub 설정은 변경하지 않는다.
- npm run deploy는 실행하지 않는다.
- git commit, git push는 하지 않는다.
- 실제 참여자 데이터 파일을 만들지 않는다.
- data/points.json 같은 운영 데이터 파일은 생성하지 않는다.
- 실제 Discord 사용자 ID, 실제 채널 ID, 실제 운영자 이름은 작성하지 않는다.
- 포인트를 현금성 보상처럼 표현하지 않는다.
- 청년동 포인트 전환은 청년동 내부 사용처에 한정된 운영진 처리 흐름으로 유지한다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

- src/pointsStore.js
- scripts/test-points-store.js
- scripts/check-release.js
- docs/point-data-structure-plan.md
- prompts/codex/point-store-v1.md

이미 prompts/codex/point-store-v1.md가 존재한다면 현재 작업 지시서 파일은 수정하지 않아도 된다.

## 작업 1. src/pointsStore.js 생성

src/pointsStore.js 파일을 새로 만든다.

프로젝트의 기존 코드 스타일을 확인한 뒤 CommonJS 또는 ESM 중 현재 프로젝트 방식에 맞춰 작성한다.

역할:

- 리디파인 포인트 시스템의 데이터 읽기와 계산을 담당한다.
- example JSON 또는 후속 운영 데이터 구조를 기준으로 동작할 수 있도록 순수 함수 중심으로 작성한다.
- 실제 Discord 명령어와 직접 연결하지 않는다.

## 작업 2. 필수 함수 구현

아래 함수를 export한다.

### loadJsonFile(filePath)

역할:

- JSON 파일을 읽고 파싱한다.
- 파일이 없거나 JSON 파싱에 실패하면 명확한 Error를 던진다.
- 실제 운영 파일을 자동 생성하지 않는다.

### saveJsonFile(filePath, data)

역할:

- 데이터를 보기 좋은 JSON 형식으로 저장한다.
- 디렉터리가 없으면 필요한 경우 생성할 수 있다.
- 단, 이번 작업에서 실제 운영 데이터 파일을 만들지는 않는다.
- 테스트 스크립트에서는 임시 디렉터리만 사용한다.

### getUser(pointsData, userId)

역할:

- pointsData.users에서 userId가 일치하는 사용자를 찾는다.
- 없으면 null을 반환한다.

### getUserPoints(pointsData, userId)

역할:

- 해당 사용자의 현재 totalPoints를 반환한다.
- 사용자가 없으면 0을 반환한다.

### listPointTransactions(pointsData, userId, options)

역할:

- 특정 사용자의 pointTransactions를 반환한다.
- userId가 없으면 전체 거래를 반환할 수 있다.
- options.type이 있으면 거래 유형으로 필터링한다.
- 최신순 정렬 옵션을 지원한다.

### calculateUserBalance(pointsData, userId)

역할:

- pointTransactions.amount 합계를 기준으로 사용자 잔액을 계산한다.
- users.totalPoints와 비교할 수 있게 계산값을 반환한다.

### validateUserBalance(pointsData, userId)

역할:

- users.totalPoints와 calculateUserBalance 결과가 일치하는지 확인한다.
- 결과 객체를 반환한다.

예시 반환 형태:

{
  ok: true,
  userId: "user_example_001",
  storedBalance: 50,
  calculatedBalance: 50,
  difference: 0
}

### listActiveShopItems(shopItemsData)

역할:

- shopItems 중 status가 active인 항목만 반환한다.
- hidden, paused, soldOut은 제외한다.

### getShopItem(shopItemsData, itemId)

역할:

- shopItems에서 itemId가 일치하는 항목을 찾는다.
- 없으면 null을 반환한다.

### canRedeem(pointsData, shopItemsData, userId, itemId)

역할:

- 사용자가 특정 상점 항목을 교환 신청할 수 있는지 검증한다.
- 사용자 존재 여부
- 항목 존재 여부
- 항목 active 여부
- 잔액 충분 여부
- stock이 0 이하인지 여부를 확인한다.
- 결과 객체를 반환한다.

예시 반환 형태:

{
  ok: true,
  userId: "user_example_001",
  itemId: "shop_youth_point_100",
  cost: 100,
  currentPoints: 150,
  reason: null
}

실패 시:

{
  ok: false,
  reason: "INSUFFICIENT_POINTS"
}

추천 reason 후보:

- USER_NOT_FOUND
- ITEM_NOT_FOUND
- ITEM_NOT_ACTIVE
- SOLD_OUT
- INSUFFICIENT_POINTS

### createPointTransaction(input)

역할:

- pointTransactions에 추가할 거래 객체를 생성한다.
- 실제 저장은 하지 않고 객체만 반환한다.
- id는 입력으로 받거나, 없으면 예측 가능한 prefix와 timestamp 기반으로 생성한다.
- amount는 숫자여야 한다.
- type은 허용된 값만 받는다.
- reason은 빈 문자열이면 안 된다.

허용 type:

- earn
- spend
- adjust
- redeem
- refund
- cancel

필수 입력:

- userId
- type
- amount
- reason
- balanceAfter
- relatedType
- relatedId
- createdBy

### createRedemption(input)

역할:

- redemptions에 추가할 교환 신청 객체를 생성한다.
- 실제 저장은 하지 않고 객체만 반환한다.
- status 기본값은 pending이다.
- requestedAt을 포함한다.
- transactionId를 연결할 수 있게 한다.

필수 입력:

- userId
- itemId
- cost
- transactionId

선택 입력:

- id
- requestedAt
- note

### completeRedemption(redemption, reviewer)

역할:

- pending 상태의 redemption을 completed 상태로 변경한 새 객체를 반환한다.
- 원본 객체를 직접 mutate하지 않는다.
- completedAt, reviewedBy를 기록한다.
- 이미 completed, cancelled, refunded 상태면 Error를 던진다.

### cancelRedemption(redemption, reviewer, note)

역할:

- pending 상태의 redemption을 cancelled 상태로 변경한 새 객체를 반환한다.
- 원본 객체를 직접 mutate하지 않는다.
- cancelledAt, reviewedBy, note를 기록한다.
- 이미 completed, cancelled, refunded 상태면 Error를 던진다.

### refundRedemption(redemption, refundTransactionId)

역할:

- cancelled 상태의 redemption을 refunded 상태로 변경한 새 객체를 반환한다.
- refundTransactionId와 refundedAt을 기록한다.
- cancelled 상태가 아니면 Error를 던진다.

## 작업 3. 방어 로직

아래 방어 로직을 포함한다.

- userId가 비어 있으면 Error
- itemId가 비어 있으면 Error
- amount가 숫자가 아니면 Error
- 차감 거래인데 amount가 양수이면 Error
- 지급 거래인데 amount가 음수이면 Error
- reason이 비어 있으면 Error
- status 전환 순서가 잘못되면 Error
- 함수는 가능한 한 원본 데이터를 직접 변경하지 않는다.

차감성 type:

- spend
- redeem

지급성 type:

- earn
- refund

양수/음수 둘 다 가능한 type:

- adjust
- cancel

## 작업 4. scripts/test-points-store.js 생성

scripts/test-points-store.js 파일을 새로 만든다.

역할:

- src/pointsStore.js의 주요 함수가 example JSON 기준으로 동작하는지 확인한다.
- 외부 테스트 프레임워크는 추가하지 않는다.
- Node 기본 assert만 사용한다.
- 실제 운영 데이터 파일은 생성하지 않는다.
- 필요한 경우 os.tmpdir() 아래 임시 디렉터리에서 saveJsonFile 테스트를 수행한다.

테스트할 항목:

- example JSON 로드
- getUser
- getUserPoints
- calculateUserBalance
- validateUserBalance
- listActiveShopItems
- getShopItem
- canRedeem 성공 케이스
- canRedeem 실패 케이스
- createPointTransaction
- createRedemption
- completeRedemption
- cancelRedemption
- refundRedemption
- 원본 객체 mutate 여부 간단 확인

테스트 성공 시 아래와 비슷한 문구를 출력한다.

pointsStore smoke test passed

## 작업 5. scripts/check-release.js 수정

scripts/check-release.js에 아래 파일 문법 검사를 추가한다.

- src/pointsStore.js
- scripts/test-points-store.js

기존 check:release 흐름은 유지한다.

가능하다면 check-release에서 scripts/test-points-store.js도 실행하도록 추가한다.

단, 기존 check-release 구조가 문법 검사만 담당하는 구조라면 무리해서 실행하지 말고 문법 검사만 추가한다.

## 작업 6. docs/point-data-structure-plan.md 보강

docs/point-data-structure-plan.md에 “pointsStore v1 구현 메모” 섹션을 짧게 추가한다.

포함 내용:

- 이번 v1은 Slash Command 구현이 아니라 내부 데이터 유틸 모듈이다.
- 실제 운영 데이터 파일을 생성하지 않는다.
- example JSON을 기준으로 smoke test를 수행한다.
- 운영 데이터 저장 방식은 아직 확정하지 않았다.
- 실제 참여자 운영 전에는 PostgreSQL 또는 Google Sheets 등 영속 저장소를 다시 검토해야 한다.
- users.totalPoints와 pointTransactions 합계의 정합성을 검증하는 함수가 필요하다.

## 검증

작업 완료 후 아래 명령어를 실행한다.

- node scripts/test-points-store.js
- npm run validate:data
- npm run test:questions
- npm run check:release

## 완료 후 요약

완료 후 아래 내용을 요약한다.

- 변경된 파일 목록
- 새로 생성한 src/pointsStore.js
- 새로 생성한 scripts/test-points-store.js
- export한 함수 목록
- 운영 데이터 파일은 만들지 않았다는 점
- Slash Command는 추가하지 않았다는 점
- src/deploy-commands.js는 수정하지 않았다는 점
- node scripts/test-points-store.js 결과
- npm run validate:data 결과
- npm run test:questions 결과
- npm run check:release 결과
- npm run deploy는 실행하지 않았다는 점