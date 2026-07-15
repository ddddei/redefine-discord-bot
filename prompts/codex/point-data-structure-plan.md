# Codex 작업 지시서

## 작업 이름

포인트 시스템 데이터 구조 설계 v1

## 목표

프로젝트 리디파인 디스코드 봇의 리디파인 포인트 시스템 구현을 준비하기 위해 데이터 구조 설계 문서와 예시 JSON 파일을 작성한다.

이전 문서인 docs/journey-point-system-plan.md를 기준으로, 실제 구현 전에 필요한 데이터 모델, 상태값, 트랜잭션 흐름, 저장 방식, 마이그레이션 가능성, 운영 리스크를 더 구체화한다.

이번 작업에서는 실제 Slash Command 기능을 구현하지 않는다.

코드 실행 흐름은 변경하지 않는다.

## 중요 주의사항

- src/*.js 파일은 수정하지 않는다.
- src/deploy-commands.js는 수정하지 않는다.
- package.json, package-lock.json은 수정하지 않는다.
- .env, .env.example은 수정하지 않는다.
- 실제 Discord 역할, 채널, 권한 설정은 변경하지 않는다.
- Railway, GitHub 설정은 변경하지 않는다.
- npm run deploy는 실행하지 않는다.
- git commit, git push는 하지 않는다.
- 실제 참여자 개인정보, 실제 Discord 사용자 ID, 실제 채널 ID는 작성하지 않는다.
- 포인트를 현금성 보상처럼 표현하지 않는다.
- 청년동 포인트 전환은 청년동 내부 사용처에 한정된 운영진 처리 흐름으로 설명한다.
- 이번 작업은 설계와 예시 데이터 작성이 목적이다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

- docs/point-data-structure-plan.md
- docs/README.md
- data/points.example.json
- data/shop-items.example.json
- data/redemptions.example.json
- data/missions.example.json
- data/submissions.example.json
- prompts/codex/point-data-structure-plan.md

이미 prompts/codex/point-data-structure-plan.md가 존재한다면 현재 작업 지시서 파일은 수정하지 않아도 된다.

## 작업 1. 데이터 구조 설계 문서 작성

docs/point-data-structure-plan.md 파일을 새로 작성한다.

문서 제목은 아래와 같이 한다.

# 리디파인 포인트 시스템 데이터 구조 설계 v1

문서에는 아래 내용을 포함한다.

## 1. 문서 목적

- 리디파인 포인트 시스템 구현 전 데이터 구조를 정리하는 문서라고 설명한다.
- docs/journey-point-system-plan.md의 기능개발 방향을 실제 데이터 설계로 구체화한다고 설명한다.
- 이번 문서는 구현 전 기준 문서이며, 실제 명령어 구현은 후속 작업이라고 명시한다.

## 2. 설계 전제

아래 내용을 포함한다.

- MEE6는 포인트, EXP, 레벨업 운영에 사용하지 않는다.
- 리디파인 봇이 자체 리디파인 포인트를 관리한다.
- 리디파인 포인트는 한글 명령어 기반으로 운영한다.
- 청년동 포인트 지급 사이트와 직접 연동하지 않는다.
- /교환 신청 시 리디파인 포인트는 자동 차감된다.
- 운영자가 청년동 포인트 사이트에서 실제 지급한다.
- 운영자가 /교환관리로 지급 완료 또는 취소 처리한다.
- 모든 지급, 차감, 교환, 환불은 로그로 남긴다.
- 실제 운영 전에는 JSON 기반 MVP와 DB 또는 Google Sheets 연동 여부를 다시 결정해야 한다.

## 3. 데이터 모델 전체 구조

다음 데이터 모델을 표로 정리한다.

- users
- pointTransactions
- shopItems
- redemptions
- missions
- submissions

각 모델별로 아래 항목을 설명한다.

- 역할
- 주요 필드
- 참조 관계
- 운영상 주의사항

## 4. users 구조

users는 리디파인 포인트 잔액과 참여자 기본 식별 정보를 관리하는 모델이다.

필드 후보:

- userId
- displayName
- nickname
- totalPoints
- createdAt
- updatedAt
- status
- note

각 필드에 대해 설명한다.

운영 기준:

- 실제 Discord userId는 필요한 경우에만 저장한다.
- 표시 이름은 운영 확인용 최소 정보로만 사용한다.
- 다른 참여자에게 잔액이나 순위를 공개하지 않는다.
- totalPoints는 pointTransactions 합계와 어긋나지 않도록 관리해야 한다.

## 5. pointTransactions 구조

pointTransactions는 모든 포인트 증감 이력을 기록하는 핵심 로그다.

필드 후보:

- id
- userId
- type
- amount
- balanceAfter
- reason
- relatedType
- relatedId
- createdBy
- createdAt
- note

type 후보:

- earn
- spend
- adjust
- redeem
- refund
- cancel

각 type의 의미를 정리한다.

중요 원칙:

- 포인트 기록은 삭제하지 않는다.
- 오류가 있으면 정정 거래를 추가한다.
- 운영자 수동 지급과 차감은 반드시 reason을 남긴다.
- 청년동 포인트 교환 신청과 환불은 redemptions와 relatedId로 연결한다.
- balanceAfter를 저장할지, 계산할지 장단점을 설명한다.

## 6. shopItems 구조

shopItems는 /상점에 표시할 교환 가능 항목을 관리한다.

필드 후보:

- id
- name
- description
- cost
- stock
- monthlyLimit
- status
- type
- createdAt
- updatedAt
- note

type 후보:

- youthCenterPoint
- reward
- goods
- event

status 후보:

- active
- paused
- soldOut
- hidden

운영 기준:

- 청년동 포인트 전환권은 youthCenterPoint type으로 구분한다.
- 실제 리워드 비용과 재고는 운영진이 확정한다.
- 청년동 내부 사용처로 제한된다는 설명을 포함해야 한다.
- 현금 환급 또는 외부 재화 교환처럼 보이지 않게 작성한다.

## 7. redemptions 구조

redemptions는 /교환 신청과 운영자 지급 처리 상태를 관리한다.

필드 후보:

- id
- userId
- itemId
- cost
- status
- requestedAt
- completedAt
- cancelledAt
- refundedAt
- reviewedBy
- transactionId
- refundTransactionId
- note

status 후보:

- pending
- completed
- cancelled
- refunded

상태 의미:

- pending: 신청 완료, 리디파인 포인트 차감 완료, 청년동 포인트 지급 대기
- completed: 운영자가 청년동 포인트 또는 리워드 실제 지급 완료
- cancelled: 지급 불가 또는 오류로 신청 취소
- refunded: 취소 후 차감된 리디파인 포인트 환불 완료

운영 기준:

- MVP에서는 pending, completed, cancelled를 우선 사용한다.
- 환불은 별도 refund transaction으로 남긴다.
- pending 상태가 장기간 방치되지 않도록 운영자 확인 주기가 필요하다.
- completed 처리는 실제 청년동 포인트 지급 후에만 해야 한다.

## 8. missions 구조

missions는 /미션에서 보여줄 활동과 보상 기준을 관리한다.

필드 후보:

- id
- title
- description
- rewardPoints
- activeDate
- startAt
- endAt
- status
- requiresSubmission
- maxPerUser
- note

status 후보:

- draft
- active
- closed
- archived

운영 기준:

- 미션은 참여 강제가 아니라 선택형 활동이어야 한다.
- 지급 기준과 기간을 명확히 공지해야 한다.
- 중복 지급 방지 기준이 필요하다.
- 개인정보가 필요한 인증을 과도하게 요구하지 않는다.

## 9. submissions 구조

submissions는 /인증으로 제출된 미션 수행 내용을 관리한다.

필드 후보:

- id
- missionId
- userId
- content
- status
- reviewedBy
- createdAt
- reviewedAt
- rewardTransactionId
- note

status 후보:

- pending
- approved
- rejected

운영 기준:

- 제출 내용에는 필요한 최소 정보만 받는다.
- 승인 시 pointTransactions에 earn 기록을 남긴다.
- 반려 시 사유를 남기되 참여자를 평가하는 표현은 피한다.
- 같은 미션에 대해 중복 승인되지 않도록 기준이 필요하다.

## 10. 주요 관계 정리

아래 관계를 설명한다.

- users 1명은 여러 pointTransactions를 가질 수 있다.
- users 1명은 여러 redemptions를 가질 수 있다.
- shopItems 1개는 여러 redemptions와 연결될 수 있다.
- redemptions 1개는 spend/redeem transaction과 연결된다.
- redemptions가 취소되면 refund transaction과 연결된다.
- missions 1개는 여러 submissions와 연결될 수 있다.
- submissions가 승인되면 earn transaction과 연결된다.

간단한 관계도를 텍스트로 표현한다.

## 11. 포인트 증감 규칙

아래 규칙을 정리한다.

- 지급은 earn 또는 adjust로 기록한다.
- 교환 신청 시 redeem 또는 spend로 기록한다.
- 취소 후 반환은 refund로 기록한다.
- 운영자 실수 정정은 adjust로 기록한다.
- 음수 잔액이 발생하지 않도록 한다.
- 차감 전 잔액을 반드시 확인한다.
- 동일 신청에 대해 중복 차감되지 않도록 한다.
- 동일 취소에 대해 중복 환불되지 않도록 한다.

## 12. 청년동 포인트 전환 데이터 흐름

아래 흐름을 데이터 관점으로 정리한다.

1. 참여자가 /교환으로 shopItem을 선택한다.
2. 봇이 users.totalPoints 또는 transaction 합산 잔액을 확인한다.
3. 잔액이 충분하면 redemptions pending을 생성한다.
4. pointTransactions에 redeem 또는 spend 기록을 추가한다.
5. users.totalPoints를 차감한다.
6. 운영자 채널에 redemptions id를 포함한 지급 요청 알림을 보낸다.
7. 운영자가 청년동 포인트 사이트에서 실제 지급한다.
8. 운영자가 /교환관리로 completed 처리한다.
9. redemptions.completedAt과 reviewedBy를 기록한다.

취소/환불 데이터 흐름도 작성한다.

## 13. JSON MVP 파일 구조 제안

JSON MVP로 시작할 경우 다음 파일 구조를 제안한다.

- data/points.example.json
- data/shop-items.example.json
- data/redemptions.example.json
- data/missions.example.json
- data/submissions.example.json

주의:

- 이번 작업에서는 실제 운영 파일이 아니라 example 파일만 만든다.
- 실제 운영 데이터 파일은 .gitignore 처리 여부를 후속 검토한다.
- 예시에는 실제 사용자 ID를 넣지 않는다.
- 예시는 구조 이해용 더미 데이터로만 작성한다.

## 14. 저장 방식별 운영 판단

아래 저장 방식을 비교한다.

- JSON 파일 기반
- SQLite
- PostgreSQL
- Google Sheets 연동

각 방식별로 아래 항목을 표로 정리한다.

- 장점
- 단점
- 적합한 단계
- 운영 리스크
- 추천 여부

권장 판단:

- 로컬 설계와 초기 MVP는 JSON example로 시작할 수 있다.
- 실제 참여자 운영 전에는 PostgreSQL 또는 Google Sheets 연동을 검토해야 한다.
- 정산과 이력이 중요하므로 단순 JSON만으로 장기간 운영하는 것은 위험할 수 있다.
- Google Sheets는 운영진 정산 확인에는 편리하지만 권한과 동시성 관리가 필요하다.
- PostgreSQL은 정합성과 확장성에 유리하지만 구현 난이도가 높다.

## 15. 권한과 개인정보 기준

아래 내용을 포함한다.

- 참여자는 본인 포인트만 확인할 수 있어야 한다.
- 운영자는 포인트 지급, 차감, 교환 완료, 로그 조회 권한을 가진다.
- 일반 참여자는 /포인트로그, /포인트관리, /교환관리 사용 불가다.
- 운영자 명령어 응답은 ephemeral 권장이다.
- 운영자 채널 알림은 운영진 전용 채널에서만 보이게 한다.
- 실제 사용자 ID, 닉네임, 인증 내용은 최소한으로 저장한다.
- 로그 내보내기 시 개인정보가 과도하게 포함되지 않도록 주의한다.

## 16. 오류와 복구 시나리오

아래 상황별 대응을 정리한다.

- 교환 신청 후 청년동 포인트 지급을 못 한 경우
- 운영자가 completed를 잘못 누른 경우
- 리디파인 포인트가 중복 차감된 경우
- 리디파인 포인트가 중복 지급된 경우
- shopItem 재고가 부족한 경우
- pending 신청이 장기간 방치된 경우
- 데이터 파일 또는 DB 오류가 발생한 경우

각 상황별로 권장 복구 방식을 작성한다.

## 17. 구현 전 확정해야 할 항목

운영진이 실제 구현 전에 확정해야 할 항목을 체크리스트로 작성한다.

- 리디파인 포인트 명칭 확정
- 청년동 포인트 전환 비율 확정
- 월별 전환 한도 확정
- 1일 또는 1주 적립 상한 확정
- 청년동 포인트 실제 지급 담당자 확정
- 운영자 알림 채널 확정
- 환불 처리 기준 확정
- 상점 항목과 재고 확정
- 저장 방식 확정
- 정산 방식 확정
- 개인정보 보관 범위 확정

## 18. 다음 작업 제안

아래 후속 작업을 제안한다.

1. 포인트 데이터 example JSON 작성 및 검증
2. 포인트 저장/조회 유틸 모듈 구현
3. /포인트, /상점 조회 명령어 구현
4. /교환 신청 및 운영자 알림 구현
5. /포인트관리, /교환관리, /포인트로그 구현
6. /체크인, /미션, /인증 구현
7. CSV 또는 Google Sheets 정산 연동 검토

각 작업마다 아래 항목을 정리한다.

- 목적
- 위험도
- 수정 예상 파일
- npm run deploy 필요 여부

## 작업 2. example JSON 작성

아래 example JSON 파일을 만든다.

### data/points.example.json

포함할 최상위 키:

- users
- pointTransactions

예시 데이터는 더미 값만 사용한다.

예시 사용자 ID는 실제 Discord ID처럼 보이지 않게 한다.

예시:

- user_example_001
- user_example_002

예시 거래에는 earn, redeem, refund, adjust를 포함한다.

### data/shop-items.example.json

포함할 최상위 키:

- shopItems

예시 항목:

- 청년동 포인트 전환권 100P
- 청년동 포인트 전환권 300P
- 프로그램 굿즈
- 프린트 카드 충전 관련 리워드

각 항목에는 id, name, description, cost, stock, monthlyLimit, status, type을 포함한다.

### data/redemptions.example.json

포함할 최상위 키:

- redemptions

예시 상태:

- pending
- completed
- cancelled
- refunded

각 신청에는 id, userId, itemId, cost, status, requestedAt, completedAt, cancelledAt, refundedAt, reviewedBy, transactionId, refundTransactionId, note를 포함한다.

### data/missions.example.json

포함할 최상위 키:

- missions

예시 미션:

- 오늘의 체크인
- 짧은 회고 남기기
- 프로그램 참여 인증

각 미션에는 id, title, description, rewardPoints, activeDate, startAt, endAt, status, requiresSubmission, maxPerUser, note를 포함한다.

### data/submissions.example.json

포함할 최상위 키:

- submissions

예시 상태:

- pending
- approved
- rejected

각 제출에는 id, missionId, userId, content, status, reviewedBy, createdAt, reviewedAt, rewardTransactionId, note를 포함한다.

주의:

- 실제 참여자 정보는 넣지 않는다.
- 실제 청년동 운영자 이름은 넣지 않는다.
- 실제 날짜가 필요한 경우 예시 날짜를 사용한다.
- 예시는 문서용이며 실제 운영 데이터가 아니라고 각 파일 또는 문서에서 알 수 있게 한다.

## 작업 3. docs/README.md 수정

docs/README.md에 point-data-structure-plan.md 링크를 추가한다.

설명은 다음 취지로 작성한다.

- 리디파인 포인트 시스템의 데이터 모델, 상태값, 트랜잭션, 저장 방식, 오류 복구 기준을 정리한 설계 문서

## 작업 4. prompts/README.md 확인

prompts/README.md가 있다면 현재 프롬프트 관리 원칙과 충돌하지 않는지 확인한다.

필요하다면 한 줄 정도만 보강한다.

보강 예시:

- Codex 작업 지시서는 실제 토큰, 채널 ID, 참여자 개인정보를 포함하지 않는다.

## 검증

작업 완료 후 아래 명령어를 실행한다.

- npm run validate:data
- npm run test:questions
- npm run check:release

example JSON 파일이 validate:data 대상에 포함되어 실패한다면, 실패 원인을 요약하고 기존 검증 스크립트의 범위를 임의로 수정하지 않는다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

- 변경된 파일 목록
- 새로 생성한 문서
- 새로 생성한 example JSON 파일
- users, pointTransactions, shopItems, redemptions, missions, submissions 구조 요약
- 저장 방식별 권장 판단
- 구현 전 확정해야 할 항목
- npm run validate:data 결과
- npm run test:questions 결과
- npm run check:release 결과
- 실제 명령어 구현은 하지 않았다는 점
- npm run deploy는 실행하지 않았다는 점
