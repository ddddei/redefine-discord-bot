# Codex 작업 지시서

## 작업 이름

참여자 조회형 포인트 명령어 v1

## 목표

프로젝트 리디파인 디스코드 봇에 리디파인 포인트 조회형 명령어를 1차로 추가한다.

이번 작업에서 구현할 명령어는 아래 2개다.

- /포인트
- /상점

/포인트는 사용자가 자신의 리디파인 포인트 상태를 확인하는 명령어다.

/상점은 현재 교환 가능한 리워드 또는 청년동 포인트 전환권 목록을 확인하는 명령어다.

이번 v1에서는 조회 기능만 구현한다.

포인트 차감, 교환 신청, 운영자 승인, 지급 완료, 환불, 미션 인증, 체크인 기능은 구현하지 않는다.

## 참고 문서와 파일

작업 전 아래 파일을 먼저 확인한다.

- docs/journey-point-system-plan.md
- docs/point-data-structure-plan.md
- src/pointsStore.js
- scripts/test-points-store.js
- data/points.example.json
- data/shop-items.example.json
- docs/README.md

## 중요 주의사항

- /교환 명령어는 구현하지 않는다.
- /포인트관리 명령어는 구현하지 않는다.
- /교환관리 명령어는 구현하지 않는다.
- /포인트로그 명령어는 구현하지 않는다.
- /체크인, /미션, /인증 명령어는 구현하지 않는다.
- 포인트 차감, 지급, 환불, 교환 신청 생성은 구현하지 않는다.
- 실제 운영 데이터 파일은 생성하지 않는다.
- data/points.json 같은 운영 데이터 파일은 만들지 않는다.
- 현재는 example JSON 기반의 조회형 v1로 구현한다.
- 실제 참여자 데이터, 실제 Discord 사용자 ID, 실제 채널 ID, 실제 운영자 이름은 작성하지 않는다.
- .env, .env.example은 수정하지 않는다.
- package.json, package-lock.json은 수정하지 않는다.
- 실제 Discord 역할, 채널, 권한 설정은 변경하지 않는다.
- Railway, GitHub 설정은 변경하지 않는다.
- npm run deploy는 실행하지 않는다.
- git commit, git push는 하지 않는다.
- 포인트를 현금성 보상처럼 표현하지 않는다.
- 청년동 포인트 전환권은 청년동 내부 사용처에 한정된 운영진 처리 흐름으로 안내한다.
- 참여 압박, 순위 비교, 경쟁을 유도하는 문구는 쓰지 않는다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

- src/deploy-commands.js
- src/handlers.js
- src/embeds.js
- src/pointsStore.js
- scripts/check-release.js
- docs/point-data-structure-plan.md
- docs/operation-guide.md
- prompts/codex/point-read-commands-v1.md

이미 prompts/codex/point-read-commands-v1.md가 존재한다면 현재 작업 지시서 파일은 수정하지 않아도 된다.

## 작업 1. Slash Command 추가

src/deploy-commands.js에 아래 명령어를 추가한다.

### /포인트

설명 예시:

내 리디파인 포인트를 확인합니다.

옵션:

- 없음

### /상점

설명 예시:

교환 가능한 리워드를 확인합니다.

옵션:

- 없음

주의:

- 기존 /안내, /채널안내, /질문, /리디, /공지 명령어는 유지한다.
- 기존 명령어의 이름, 설명, 옵션을 임의로 변경하지 않는다.
- 새 명령어 추가 외에 Slash Command 구조를 크게 바꾸지 않는다.
- 작업 완료 후 Codex가 npm run deploy를 실행하지 않는다.

## 작업 2. 포인트 조회 데이터 로딩 방식

이번 v1에서는 실제 운영 데이터 파일을 만들지 않는다.

조회 기준은 아래 example JSON을 사용한다.

- data/points.example.json
- data/shop-items.example.json

단, 사용자에게 보여주는 문구에는 이 기능이 아직 운영 전 v1이며 실제 운영 데이터 저장 방식은 확정 전이라는 점을 과하지 않게 안내한다.

권장 방식:

- /포인트는 data/points.example.json을 읽되, 실제 Discord 사용자 ID가 example에 없으면 “아직 기록된 리디파인 포인트가 없어요” 또는 0P 안내를 표시한다.
- /상점은 data/shop-items.example.json의 active 항목을 보여준다.
- /상점 응답에는 “실제 항목과 비용은 운영진 확정 후 달라질 수 있어요”라는 안내를 포함한다.

주의:

- 실제 참여자 운영 데이터 파일을 자동 생성하지 않는다.
- 사용자의 실제 Discord ID를 example 파일에 저장하지 않는다.
- 조회 중 파일을 찾지 못하거나 파싱에 실패하면 사용자에게 운영진 확인 안내를 보여주고, 봇이 중단되지 않게 처리한다.

## 작업 3. /포인트 처리 구현

src/handlers.js에 /포인트 처리 함수를 추가한다.

요구사항:

- interaction.user.id를 기준으로 포인트 조회를 시도한다.
- data/points.example.json에는 실제 Discord 사용자 ID가 없을 수 있으므로, 사용자를 찾지 못하면 0P 또는 기록 없음 안내를 한다.
- 본인 포인트만 보여준다.
- 다른 참여자 포인트나 순위를 보여주지 않는다.
- 응답은 가능하면 ephemeral로 한다.
- 포인트를 경쟁이나 순위처럼 표현하지 않는다.
- 리디파인 포인트는 참여를 돕는 선택형 요소라고 안내한다.
- 운영 데이터 저장 방식은 아직 확정 전이라는 점을 너무 길지 않게 안내한다.

응답 예시 방향:

- 제목: 내 리디파인 포인트
- 현재 보유 리디파인 포인트: 0P 또는 조회된 포인트
- 최근 거래가 있으면 최근 거래 3개 정도 표시
- 기록이 없으면 “아직 기록된 리디파인 포인트가 없어요.”
- “리디파인 포인트는 참여를 돕는 선택형 요소이며, 비교나 경쟁을 위한 점수가 아니에요.” 문구 포함

기술 요구사항:

- src/pointsStore.js의 loadJsonFile, getUser, getUserPoints, listPointTransactions, validateUserBalance 등을 재사용한다.
- 파일 로드 오류가 사용자 응답 실패로 이어지지 않게 try/catch 처리한다.
- 오류 시 console.error로 요약 로그만 남긴다.
- 사용자에게는 “포인트 정보를 불러오지 못했어요. 운영진에게 알려주세요.” 정도로 안내한다.

## 작업 4. /상점 처리 구현

src/handlers.js에 /상점 처리 함수를 추가한다.

요구사항:

- data/shop-items.example.json을 읽는다.
- src/pointsStore.js의 listActiveShopItems를 재사용한다.
- status가 active인 항목만 보여준다.
- hidden, paused, soldOut 항목은 보여주지 않는다.
- 항목명, 설명, 필요 리디파인 포인트, 재고 또는 월 한도 정보를 간단히 표시한다.
- 응답은 가능하면 ephemeral로 한다.
- 실제 교환 신청은 아직 구현하지 않았다고 안내한다.
- 실제 리워드 항목, 비용, 재고, 월 한도는 운영진 확정 후 달라질 수 있다고 안내한다.
- 청년동 포인트 전환권은 청년동 내부 사용처에 한정된 운영진 처리 항목이라고 안내한다.

응답 예시 방향:

- 제목: 리디파인 포인트 상점
- 설명: 현재 확인 가능한 교환 항목입니다.
- 각 항목 field:
  - 이름
  - 필요 포인트
  - 설명
  - 재고 또는 월 한도
- 하단 안내:
  - /교환 기능은 아직 준비 중입니다.
  - 실제 신청 전 운영진 공지를 기준으로 확인해 주세요.

기술 요구사항:

- shop item이 없으면 “현재 표시할 수 있는 상점 항목이 없어요.”라고 안내한다.
- 파일 로드 오류가 사용자 응답 실패로 이어지지 않게 try/catch 처리한다.
- 오류 시 console.error로 요약 로그만 남긴다.

## 작업 5. Embed 또는 helper 정리

기존 src/embeds.js의 createGuideEmbed를 재사용해도 된다.

필요하다면 아래 helper를 src/embeds.js에 추가할 수 있다.

- createPointBalanceEmbed
- createShopEmbed

단, 과도하게 구조를 바꾸지 않는다.

기존 embed 색상, footer 스타일과 맞춘다.

Discord Embed 제한을 고려해 상점 항목이 많을 경우 일부만 표시하거나 설명을 짧게 자른다.

## 작업 6. 핸들러 라우팅 반영

현재 명령어 라우팅 구조를 확인하고, /포인트와 /상점이 정상 처리되도록 연결한다.

요구사항:

- 기존 /안내, /채널안내, /질문, /리디, /공지 동작은 변경하지 않는다.
- /질문 민감 표현 감지 흐름은 변경하지 않는다.
- 역할 기반 /안내, /채널안내 흐름은 변경하지 않는다.
- 신규 명령어는 별도 함수로 분리한다.
- 알 수 없는 명령어 처리 방식이 있다면 기존 구조를 유지한다.

## 작업 7. pointsStore 보강 여부 확인

src/pointsStore.js에 필요한 함수가 이미 있으면 수정하지 않아도 된다.

필요한 경우에만 아래 정도를 소폭 보강한다.

- 최근 거래를 최신순으로 가져오기 위한 listPointTransactions 옵션 확인
- shop item 표시용 필드 접근이 안전한지 확인
- 오류 메시지가 너무 모호하지 않은지 확인

단, 포인트 차감, 저장, 실제 운영 파일 생성 로직은 추가하지 않는다.

## 작업 8. check-release 반영

scripts/check-release.js가 아래 파일을 문법 검사하거나 테스트하는지 확인한다.

- src/pointsStore.js
- scripts/test-points-store.js

이번 작업에서 src/handlers.js 또는 src/embeds.js가 수정되므로 기존 check-release 흐름에서 문법 검사가 되는지도 확인한다.

필요하다면 check-release에 새로 추가된 파일 또는 스크립트 확인을 최소 범위로 보강한다.

## 작업 9. 문서 보강

docs/point-data-structure-plan.md에 “조회형 포인트 명령어 v1 구현 메모”를 짧게 추가한다.

포함 내용:

- 이번 v1에서는 /포인트와 /상점만 구현한다.
- 실제 포인트 차감, 교환 신청, 운영자 처리는 구현하지 않는다.
- /포인트는 본인 포인트 조회만 지원한다.
- /상점은 active 항목 조회만 지원한다.
- 현재는 example JSON 기반 조회이며 실제 운영 저장 방식은 후속 확정이 필요하다.
- 신규 Slash Command가 추가되므로 확인 후 npm run deploy가 필요하다.

docs/operation-guide.md에도 필요한 경우 한 줄 정도만 보강한다.

포함 내용:

- /포인트와 /상점은 조회형 기능이며, 실제 교환 신청은 아직 별도 구현 전이라는 점

## 검증

작업 완료 후 아래 명령어를 실행한다.

- node scripts/test-points-store.js
- npm run validate:data
- npm run test:questions
- npm run check:release

주의:

- npm run deploy는 실행하지 않는다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

- 변경된 파일 목록
- 추가된 Slash Command
- /포인트 동작 요약
- /상점 동작 요약
- 실제 포인트 차감이나 교환 신청은 구현하지 않았다는 점
- 실제 운영 데이터 파일은 만들지 않았다는 점
- src/deploy-commands.js 수정 여부
- npm run deploy는 실행하지 않았다는 점
- node scripts/test-points-store.js 결과
- npm run validate:data 결과
- npm run test:questions 결과
- npm run check:release 결과
- 작업 후 사용자가 직접 npm run deploy를 실행해야 한다는 점