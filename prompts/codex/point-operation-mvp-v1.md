# Codex 작업 지시서

## 작업 이름

포인트 교환 운영 MVP v1

## 목표

프로젝트 리디파인 디스코드 봇의 리디파인 포인트 시스템을 실제 운영 흐름에 가깝게 확장한다.

이번 작업에서는 기존 조회형 명령어인 `/포인트`, `/상점`을 유지하면서, 포인트 교환과 운영자 관리에 필요한 MVP 기능을 구현한다.

이번 작업에서 추가하거나 보강할 기능은 아래와 같다.

* 운영 데이터 저장소 repository v1
* `/교환`
* `/포인트관리`
* `/교환관리`
* `/포인트로그`
* 교환 신청 시 운영자 채널 알림
* 교환 정책 문서 보강
* 기존 `/포인트`, `/상점`의 본인만 보기 유지

이번 작업에서는 `/체크인`, `/미션`, `/인증`, Google Sheets 연동, PostgreSQL 연동, 웹 대시보드는 구현하지 않는다.

## 현재 전제

현재 프로젝트에는 아래 기능이 이미 있다.

* `/안내`
* `/채널안내`
* `/질문`
* `/공지`
* `/리디`
* `/포인트`
* `/상점`
* `src/pointsStore.js`
* `scripts/test-points-store.js`
* `data/points.example.json`
* `data/shop-items.example.json`
* `data/redemptions.example.json`
* `docs/journey-point-system-plan.md`
* `docs/point-data-structure-plan.md`

기존 `/포인트`와 `/상점`은 현재 example JSON 기반 조회형 v1이다.

이번 작업에서는 실제 운영 데이터 저장소를 준비하되, 장기 운영 저장소가 아직 확정되지 않았다는 점을 문서에 남긴다.

## 중요 운영 정책

아래 정책을 코드와 문서에 반영한다.

### `/포인트`

* 본인만 볼 수 있게 유지한다.
* 개인 포인트와 최근 기록은 공개하지 않는다.
* 응답은 ephemeral 유지.

### `/상점`

* 본인이 직접 `/상점` 명령어를 입력해 확인하는 방식으로 유지한다.
* 공개 채널에 상점 목록이 계속 노출되지 않도록 ephemeral 유지.
* 상점 항목은 active 항목만 보여준다.

### 청년동 포인트 전환권

* 청년동 포인트 전환권은 기본적으로 상시 교환 가능한 항목으로 본다.
* 별도 재고 제한이 없을 수 있다.
* 다만 운영 상황, 예산, 시스템 오류, 지급 상황에 따라 일시 제한될 수 있다는 안내는 남긴다.
* 청년동 포인트는 청년동 내부 사용처에 한정된다.
* 예시 사용처는 벤딩머신, 프린트 카드 충전 등이다.
* 현금 환급, 외부 재화 교환, 타인 양도처럼 보이지 않게 안내한다.

### 수량 제한 리워드

* 밀리의 서재 구독권, 왓챠 구독권, 굿즈, 특별 리워드 등은 추후 수량 제한이 있을 수 있다.
* 따라서 shopItems의 stock, monthlyLimit 구조는 유지한다.
* stock이 null이거나 정의되지 않은 경우에는 “운영진 확인” 또는 “별도 제한 없음”에 가깝게 표현할 수 있다.
* stock이 0이면 soldOut 또는 교환 불가로 처리한다.

### 취소와 환불 정책

* 참여자 단순 변심에 따른 취소/환불은 원칙적으로 받지 않는다.
* 참여자용 취소 명령어는 만들지 않는다.
* 신청 전 주의를 요한다는 안내를 `/교환` 응답에 포함한다.
* 다만 시스템 오류, 중복 신청, 운영진 사유, 지급 불가 상황은 운영자가 정정할 수 있어야 한다.
* 따라서 내부적으로는 cancelled, refunded 상태와 refund transaction 구조를 유지한다.
* `/교환관리`에서 운영자만 완료 또는 취소/환불 처리할 수 있게 한다.

권장 안내 문구:

교환 신청이 완료되면 리디파인 포인트가 차감되며, 운영진이 청년동 포인트 또는 리워드 지급을 순차적으로 처리합니다. 단순 변심에 따른 취소나 환불은 원칙적으로 어렵습니다. 신청 전 항목과 필요 포인트를 다시 확인해 주세요. 다만 중복 신청, 시스템 오류, 운영진 확인이 필요한 상황은 운영진이 별도로 확인할 수 있습니다.

## 중요 주의사항

* `/체크인`은 구현하지 않는다.
* `/미션`은 구현하지 않는다.
* `/인증`은 구현하지 않는다.
* Google Sheets 연동은 구현하지 않는다.
* PostgreSQL 연동은 구현하지 않는다.
* 웹 대시보드는 구현하지 않는다.
* MEE6 연동은 구현하지 않는다.
* 실제 청년동 포인트 지급 사이트와 연동하지 않는다.
* 실제 포인트 지급은 운영자가 청년동 포인트 사이트에서 별도로 처리한다.
* 토큰, API Key, 실제 채널 ID, 실제 참여자 개인정보는 작성하지 않는다.
* .env 파일은 수정하지 않는다.
* package.json, package-lock.json은 수정하지 않는다.
* Railway, GitHub 설정은 변경하지 않는다.
* npm run deploy는 실행하지 않는다.
* git commit, git push는 하지 않는다.
* Slash Command 추가가 있으므로 작업 완료 후 사용자가 직접 npm run deploy를 실행해야 한다.
* 실제 운영 데이터 파일은 커밋하지 않는다.
* 운영 데이터 파일은 .gitignore로 보호한다.
* JSON 기반 저장은 MVP용이며, Railway 장기 운영에는 한계가 있음을 문서에 남긴다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

* src/deploy-commands.js
* src/handlers.js
* src/embeds.js
* src/pointsStore.js
* src/pointsRepository.js
* src/logging.js
* scripts/test-points-store.js
* scripts/test-points-repository.js
* scripts/check-release.js
* docs/point-data-structure-plan.md
* docs/journey-point-system-plan.md
* docs/operation-guide.md
* .gitignore
* .env.example
* prompts/codex/point-operation-mvp-v1.md

.env.example은 실제 값 없이 변수명과 placeholder만 추가할 수 있다.

## 작업 1. 운영 데이터 저장소 repository v1 추가

src/pointsRepository.js 파일을 새로 만든다.

역할:

* 실제 운영 데이터 읽기/쓰기 흐름을 담당한다.
* pointsStore.js의 순수 함수와 분리한다.
* JSON 파일 기반 MVP repository로 구현한다.
* 나중에 Google Sheets 또는 PostgreSQL로 교체할 수 있도록 함수 단위를 분리한다.

기본 저장 파일 구조:

* data/points.local.json
* data/shop-items.local.json
* data/redemptions.local.json

위 파일은 실제 운영 데이터 파일이므로 커밋하지 않는다.

.gitignore에 아래 패턴을 추가한다.

* data/*.local.json
* data/runtime/
* data/production/

초기화 기준:

* points.local.json이 없으면 data/points.example.json을 기준으로 초기 구조를 만들 수 있다.
* shop-items.local.json이 없으면 data/shop-items.example.json을 기준으로 초기 구조를 만들 수 있다.
* redemptions.local.json이 없으면 data/redemptions.example.json 또는 빈 redemptions 배열을 기준으로 초기 구조를 만들 수 있다.
* 단, 실제 사용자 정보는 example에서 가져오지 않는 방향을 우선 검토한다.
* 운영 데이터 파일 자동 생성 시에도 실제 Discord 사용자 ID를 임의로 저장하지 않는다.

권장 동작:

* getPointsData()
* savePointsData(pointsData)
* getShopItemsData()
* saveShopItemsData(shopItemsData)
* getRedemptionsData()
* saveRedemptionsData(redemptionsData)
* getUserOrCreate(pointsData, discordUser)
* addPointTransaction(pointsData, transaction)
* updateUserBalance(pointsData, userId, nextBalance)
* createRedemptionRequest(pointsData, redemptionsData, shopItemsData, userId, itemId)
* completeRedemptionById(pointsData, redemptionsData, redemptionId, reviewer)
* cancelAndRefundRedemptionById(pointsData, redemptionsData, redemptionId, reviewer, note)
* listRecentPointLogs(pointsData, limit)
* listRecentRedemptions(redemptionsData, limit)
* findRedemption(redemptionsData, redemptionId)

환경변수 후보:

* POINTS_DATA_PATH
* SHOP_ITEMS_DATA_PATH
* REDEMPTIONS_DATA_PATH
* POINT_REDEEM_CHANNEL_ID

환경변수가 없으면 위 local JSON 경로를 기본값으로 사용한다.

주의:

* 실제 운영 장기 저장소로 JSON 파일은 한계가 있다는 주석을 남긴다.
* 파일 저장은 보기 좋은 JSON 형식으로 한다.
* 가능한 한 원본 객체를 직접 변경하지 않는 방향을 유지한다.
* 동시에 여러 명령어가 실행될 때 파일 저장 충돌 가능성이 있음을 문서에 남긴다.

## 작업 2. Slash Command 추가

src/deploy-commands.js에 아래 명령어를 추가한다.

### /교환

설명 예시:

리디파인 포인트로 리워드 교환을 신청합니다.

옵션:

* 항목: string, required

  * /상점에 표시된 신청 코드 또는 항목 ID를 입력한다.

주의:

* autocomplete는 이번 작업에서 구현하지 않아도 된다.
* 동적 choices는 이번 작업에서 구현하지 않아도 된다.
* /상점 응답에 신청 코드가 잘 보이도록 한다.

### /포인트관리

설명 예시:

운영자가 리디파인 포인트를 지급하거나 차감합니다.

옵션:

* 작업: string, required

  * choices: 지급, 차감
* 대상: user, required
* 포인트: integer, required
* 사유: string, required

주의:

* 운영자 전용 명령어다.
* 일반 참여자는 사용할 수 없어야 한다.
* 응답은 ephemeral 권장.

### /교환관리

설명 예시:

운영자가 교환 신청을 완료 또는 정정 처리합니다.

옵션:

* 신청id: string, required
* 처리: string, required

  * choices: 완료, 취소환불
* 메모: string, optional

주의:

* 운영자 전용 명령어다.
* 완료는 운영자가 실제 청년동 포인트 또는 리워드를 지급한 뒤 처리한다.
* 취소환불은 시스템 오류, 중복 신청, 운영진 사유 등 예외 상황에만 사용한다.
* 참여자 단순 변심 처리를 위한 기능이 아니라고 문서에 명시한다.

### /포인트로그

설명 예시:

운영자가 최근 포인트 기록과 교환 신청 내역을 확인합니다.

옵션:

* 종류: string, optional

  * choices: 포인트, 교환, 전체
* 개수: integer, optional

주의:

* 운영자 전용 명령어다.
* 응답은 ephemeral 권장.
* 개인정보를 과도하게 표시하지 않는다.

## 작업 3. 운영자 권한 확인 helper 추가

운영자 명령어에는 권한 확인이 필요하다.

권장 방식:

* Discord ManageMessages 권한이 있으면 운영자로 본다.
* 또는 Administrator 권한이 있으면 운영자로 본다.
* 추후 운영진 역할명 기반 검토 가능성을 주석 또는 문서에 남긴다.

필요한 경우 helper 함수를 만든다.

예시 이름:

* isOperatorInteraction(interaction)
* assertOperator(interaction)
* replyOperatorOnly(interaction)

일반 참여자가 운영자 명령어를 실행하면:

* “운영진 전용 명령어예요.” 정도로 ephemeral 응답한다.
* 에러를 throw해서 봇이 죽지 않게 한다.

## 작업 4. /교환 구현

src/handlers.js에 /교환 처리 함수를 추가한다.

흐름:

1. 사용자가 /교환 항목:신청코드 또는 itemId 입력
2. 봇이 shopItems에서 항목을 찾는다.
3. 항목이 없으면 안내한다.
4. 항목이 active가 아니면 안내한다.
5. stock이 0 이하이면 교환 불가 안내한다.
6. 사용자의 현재 포인트를 확인한다.
7. 포인트가 부족하면 부족 안내를 한다.
8. 포인트가 충분하면 리디파인 포인트를 차감한다.
9. pointTransactions에 redeem 또는 spend 기록을 남긴다.
10. redemptions에 pending 신청을 생성한다.
11. 운영자 채널에 교환 신청 알림을 보낸다.
12. 사용자에게 신청 완료 안내를 ephemeral로 응답한다.

중요:

* /교환은 사용자가 직접 취소할 수 없다고 안내한다.
* 단순 변심 취소/환불은 원칙적으로 어렵다고 안내한다.
* 중복 신청, 시스템 오류, 운영진 확인 필요 상황은 운영진이 확인할 수 있다고 안내한다.
* 청년동 포인트 전환권의 경우 실제 청년동 포인트 지급은 운영자가 별도 사이트에서 처리한다고 안내한다.
* 음수 잔액이 발생하지 않게 한다.
* 같은 요청으로 중복 차감되지 않게 유의한다.
* Discord interaction 3초 제한에 걸리지 않도록 가능한 빠르게 처리한다.

응답 예시 방향:

제목: 교환 신청이 접수됐어요

내용:

* 신청 항목
* 차감된 리디파인 포인트
* 남은 리디파인 포인트
* 신청 ID
* 상태: 지급 대기
* 운영진이 순차적으로 확인합니다.
* 단순 변심에 따른 취소/환불은 원칙적으로 어렵습니다.

## 작업 5. 운영자 채널 알림 구현

교환 신청이 발생하면 운영자 채널에 알림을 보낸다.

채널 ID 기준:

* POINT_REDEEM_CHANNEL_ID가 있으면 우선 사용
* 없으면 LOG_CHANNEL_ID를 fallback으로 사용
* 둘 다 없으면 알림 전송은 생략하고 console.warn을 남긴다.

알림 내용:

* 신청 ID
* 신청자 표시명
* 신청자 userId는 과도하게 길게 노출하지 않거나 필요 최소한으로만 표시
* 항목명
* 필요 포인트
* 상태: pending
* 신청 시간
* 운영자 처리 방법 안내

운영자 처리 안내 예시:

실제 청년동 포인트 또는 리워드 지급 후 `/교환관리 신청id:... 처리:완료`로 완료 처리해 주세요. 시스템 오류나 중복 신청 등 운영진 사유로 지급이 어려운 경우에만 `처리:취소환불`을 사용해 주세요.

버튼은 이번 작업에서 구현하지 않아도 된다.

## 작업 6. /교환관리 구현

src/handlers.js에 /교환관리 처리 함수를 추가한다.

운영자 전용이다.

처리 방식:

### 완료

* 대상 redemption이 pending인지 확인한다.
* 운영자가 실제 청년동 포인트 또는 리워드를 지급한 뒤 사용하는 것으로 안내한다.
* redemption 상태를 completed로 변경한다.
* completedAt, reviewedBy를 기록한다.
* 사용자 포인트는 이미 /교환 시 차감되었으므로 추가 차감하지 않는다.
* 운영자에게 완료 처리 결과를 ephemeral로 보여준다.

### 취소환불

* 대상 redemption이 pending인지 확인한다.
* 시스템 오류, 중복 신청, 운영진 사유 등 예외 상황에만 사용한다.
* redemption을 cancelled 후 refunded 상태로 변경하거나, cancelled와 refunded 로그를 모두 남긴다.
* refund transaction을 생성한다.
* 사용자 포인트를 환불한다.
* 운영자에게 환불 완료 결과를 ephemeral로 보여준다.
* 참여자 단순 변심 처리용이 아니라는 문구를 문서에 남긴다.

주의:

* 이미 completed 상태인 신청은 취소환불하지 않는다.
* 이미 refunded 상태인 신청은 중복 환불하지 않는다.
* 신청 ID가 없으면 안내한다.
* 권한이 없으면 운영진 전용 안내를 한다.

## 작업 7. /포인트관리 구현

src/handlers.js에 /포인트관리 처리 함수를 추가한다.

운영자 전용이다.

옵션:

* 작업: 지급 또는 차감
* 대상: Discord user
* 포인트: 양의 정수
* 사유: 필수 문자열

동작:

* 지급이면 amount는 양수
* 차감이면 amount는 음수
* 차감 시 대상 잔액이 부족하면 차감하지 않고 안내한다.
* 사용자 기록이 없으면 새 사용자 record를 생성한다.
* pointTransactions에 adjust 또는 earn/spend 기록을 남긴다.
* reason은 반드시 저장한다.
* balanceAfter를 저장한다.
* 운영자에게 처리 결과를 ephemeral로 보여준다.

주의:

* 운영자 수동 지급/차감은 반드시 사유가 있어야 한다.
* 참여자에게 자동 DM을 보내는 기능은 이번 작업에서 구현하지 않는다.
* 개인정보를 과도하게 표시하지 않는다.

## 작업 8. /포인트로그 구현

src/handlers.js에 /포인트로그 처리 함수를 추가한다.

운영자 전용이다.

기능:

* 최근 포인트 거래 내역 확인
* 최근 교환 신청 내역 확인
* 종류 옵션이 없으면 전체 또는 요약을 보여준다.
* 개수 옵션이 없으면 10개 정도를 기본값으로 한다.
* 너무 긴 경우 일부만 보여준다.

응답:

* ephemeral 권장
* 신청자 정보는 최소화
* 거래 ID, 유형, 포인트, 사유, 생성일
* 교환 ID, 항목 ID, 상태, 신청일, 처리일

## 작업 9. /포인트와 /상점 보강

기존 /포인트와 /상점은 유지하되, repository v1을 사용하도록 변경한다.

### /포인트

* 본인만 보이게 유지한다.
* 실제 운영 데이터 저장소에서 사용자 포인트를 읽는다.
* 기록이 없으면 0P로 안내한다.
* 기존 “운영 전 조회형 v1”처럼 너무 개발자스러운 문구는 줄인다.
* 권장 문구:

  * 현재 리디파인 포인트는 시범 운영 중이며, 세부 기준은 운영진 안내에 따라 조정될 수 있어요.

### /상점

* 본인만 보이게 유지한다.
* repository에서 active shop items를 읽는다.
* 상점 항목에 신청 코드 또는 itemId를 표시한다.
* /교환에서 해당 코드를 입력하면 된다고 안내한다.
* 실제 항목과 비용은 운영진 안내에 따라 변경될 수 있다고 안내한다.
* 청년동 포인트 전환권과 수량 제한 리워드의 차이를 자연스럽게 안내한다.

## 작업 10. embed 보강

필요하다면 src/embeds.js에 아래 helper를 추가하거나 보강한다.

* createRedemptionSuccessEmbed
* createPointAdminResultEmbed
* createRedemptionAdminResultEmbed
* createPointLogEmbed
* createRedeemRequestLogEmbed

단, 기존 embed 구조를 과도하게 변경하지 않는다.

Embed 제한을 고려한다.

* title 256자
* description 4096자
* field value 1024자
* fields 25개 제한

## 작업 11. 테스트 스크립트 추가

scripts/test-points-repository.js 파일을 새로 만든다.

역할:

* 임시 디렉터리에서 repository 동작을 테스트한다.
* 실제 data/*.local.json은 만들지 않는다.
* os.tmpdir() 아래 테스트용 파일만 사용한다.
* Node 기본 assert만 사용한다.
* 외부 테스트 라이브러리는 추가하지 않는다.

테스트 항목:

* 초기 데이터 로드
* 사용자 생성
* 포인트 지급
* 포인트 차감
* /교환에 해당하는 redemption 생성
* pending redemption 생성 확인
* 완료 처리
* 취소환불 처리
* 중복 환불 방지
* 포인트 로그 조회
* 교환 로그 조회
* stock 0 항목 교환 불가
* 잔액 부족 교환 불가

성공 시 출력:

pointsRepository smoke test passed

## 작업 12. check-release 반영

scripts/check-release.js에 아래 파일 문법 검사 또는 smoke test를 반영한다.

* src/pointsRepository.js
* scripts/test-points-repository.js

가능하다면 check-release에서 아래 테스트도 실행하도록 한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js

기존 validate:data, test:questions 흐름은 유지한다.

## 작업 13. 문서 보강

아래 문서를 필요한 만큼 보강한다.

### docs/journey-point-system-plan.md

보강 내용:

* 청년동 포인트 전환권은 기본적으로 상시 교환 가능하되 운영 상황에 따라 제한될 수 있음
* 구독권, 굿즈, 특별 리워드는 수량 제한 가능
* 참여자 단순 변심 취소/환불은 원칙적으로 어렵고, 운영진 사유나 시스템 오류만 정정 가능
* /교환, /교환관리, /포인트관리, /포인트로그의 MVP 흐름

### docs/point-data-structure-plan.md

보강 내용:

* repository v1 구현 메모
* local JSON 저장소는 MVP용이며 장기 운영 저장소가 아님
* data/*.local.json은 커밋하지 않음
* Railway 재배포/재시작 시 데이터 유지 한계가 있을 수 있음
* 실제 운영 전 Google Sheets 또는 PostgreSQL 검토 필요

### docs/operation-guide.md

보강 내용:

* /포인트는 본인만 확인
* /상점은 본인이 직접 확인
* /교환은 신청 즉시 차감
* 단순 변심 취소/환불은 원칙적으로 어려움
* 실제 청년동 포인트 지급은 운영자가 별도로 처리
* 지급 후 /교환관리로 완료 처리
* 오류나 중복 신청은 운영진이 취소환불 처리 가능

## 작업 14. .env.example 보강

.env.example에 실제 값 없이 placeholder만 추가할 수 있다.

추가 후보:

* POINTS_DATA_PATH=
* SHOP_ITEMS_DATA_PATH=
* REDEMPTIONS_DATA_PATH=
* POINT_REDEEM_CHANNEL_ID=

주의:

* 실제 값은 절대 넣지 않는다.
* .env 파일은 수정하지 않는다.

## 작업 15. 검증

작업 완료 후 아래 명령어를 실행한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* npm run validate:data
* npm run test:questions
* npm run check:release

주의:

* npm run deploy는 실행하지 않는다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

* 변경된 파일 목록
* 추가된 Slash Command 목록
* /교환 동작 요약
* /포인트관리 동작 요약
* /교환관리 동작 요약
* /포인트로그 동작 요약
* /포인트와 /상점이 계속 ephemeral인지 여부
* 운영자 권한 검사 방식
* 운영자 채널 알림 방식
* 실제 청년동 포인트 사이트와 연동하지 않았다는 점
* 참여자 단순 변심 취소/환불 기능은 만들지 않았다는 점
* 시스템 오류/중복 신청 등 운영진 사유에 대한 취소환불은 운영자만 가능하다는 점
* JSON local repository는 MVP용이며 장기 운영 저장소가 아니라는 점
* data/*.local.json은 커밋하지 않는다는 점
* node scripts/test-points-store.js 결과
* node scripts/test-points-repository.js 결과
* npm run validate:data 결과
* npm run test:questions 결과
* npm run check:release 결과
* npm run deploy는 실행하지 않았다는 점
* 작업 후 사용자가 직접 npm run deploy를 실행해야 한다는 점
