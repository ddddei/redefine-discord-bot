# 미니게임 참여 리포트 계획

이 문서는 미니게임 개선 2순위이자 운영 안정성 로드맵 "참여 리포트"의 첫 조각인 **미니게임 참여 리포트**의 구현 계획입니다. 새 세션에서 이 문서만 보고 작업을 시작할 수 있도록 배경과 결정 사항을 함께 정리합니다.

## 1. 배경과 목표

- 미니게임 참여 데이터는 이미 두 곳에 쌓이고 있습니다: 버튼형 허브 9종은 포인트 거래(`relatedType: 'minigameReward'`, `relatedId: 'YYYY-MM-DD:gameId'`), 던전월드는 `data/dungeonworld-logs.local.json`.
- 그러나 운영자가 "어떤 게임이 실제로 플레이되는지, 참여가 늘고 있는지"를 보려면 `/운영내보내기`로 파일을 받아 직접 집계해야 합니다.
- 목표: **`/운영현황 종류:미니게임` 한 번으로 게임별·기간별 참여 요약을 읽기 전용 ephemeral로 확인**하게 하여, 콘텐츠 확장/정리 판단(예: 던전월드 후속 회차 착수 여부)을 데이터로 내릴 수 있게 합니다.

## 2. 방식 결정 (대안 비교)

| 방식 | 판단 |
|---|---|
| **`/운영현황` 종류 choice 추가 (채택)** | 운영자가 이미 쓰는 명령어의 기존 패턴(종류별 embed 분기) 그대로. 신규 명령어·화면·권한 없음 |
| 관리자 웹 대시보드에 추가 | `adminApi.js`+프런트까지 범위가 커짐. Discord 안에서 즉시 보는 요구에는 과함. 대시보드 반영은 후속 검토 |
| `/운영내보내기`에 종류 추가 | 파일 백업용 표면이라 "빠른 확인" 목적과 안 맞음. CSV 원본은 이미 포인트/던전월드 내보내기로 가능 |

**중요**: 이번 작업은 지금까지의 미니게임/백업 PR과 달리 `deploy-commands.js`의 choice가 늘어나므로 **머지 후 `npm run deploy` 실행이 필요**합니다.

## 3. 리포트 설계

집계 기간은 옵션 없이 세 창을 고정으로 함께 보여줍니다: **오늘(KST) / 최근 7일 / 누적**.

```
🎮 미니게임 참여 리포트 (2026-07-03 기준)

전체 (버튼형 허브)
- 오늘: 확정 결과 N건 / 참여자 N명 / 지급 NP
- 최근 7일: 확정 결과 N건 / 참여자 N명 / 지급 NP
- 누적: 확정 결과 N건 / 참여자 N명 / 지급 NP

최근 7일 일별 참여          ← 날짜별 "N건/N명" 7줄
게임별 (누적 기준, 플레이 수 내림차순)
- 🗺️ 세 칸 탐험: N건 / N명 / 0P 비율 n% / 지급 NP   ← 9종 각 1줄

던전월드 (솔로 어드벤처, 포인트 없음)
- 누적 플레이 N건 / 참여자 N명
- 회차별 진행: 1회차 N · 2회차 N · ...              ← 후속 회차 판단 근거
```

- 집계에는 사용자 ID·표시 이름을 **노출하지 않습니다**(합계·인원수만). 랭킹과 달리 개인 식별 없는 순수 운영 지표.
- `isExample` 데이터는 기존 원칙대로 집계에서 제외(`filterOperationalRecords` 경유 데이터 사용).
- 0P 비율은 "참여했지만 보상 없음" 비율로, 게임 난이도/재미 점검 지표.
- 게임 제목은 `MINIGAMES` 맵에서 조회, 없으면(과거 gameId) gameId 그대로 표기.
- embed description은 4096자 한도 안에 들어오는 고정 구조(전체 3줄 + 일별 7줄 + 게임 9줄 + 던전월드 ~11줄)이며, 방어적으로 `truncateEmbedValue` 계열 가드를 둡니다.

## 4. 수정 대상 파일

| 파일 | 변경 내용 |
|---|---|
| `src/minigameReport.js` **(신규)** | ① `buildMinigameReport({ pointsRepository, dungeonworldRepository, now })` — 허브 거래 집계(오늘/7일/누적, 게임별) + `buildDungeonworldAnalytics` 재사용(총 플레이·고유 참여자·회차별 진행). 순수 데이터 객체 반환 ② `createMinigameReportEmbed(report)` — `embeds.js`의 `createGuideEmbed`로 embed 생성. 로직을 handlers.js 밖에 둬서 단독 테스트 가능하게 |
| `src/pointsRepository.js` | 읽기 전용 `listMinigameRewardTransactions()` 추가 — `relatedType === 'minigameReward'` 거래만 반환, 운영 레코드 필터(`getOperationalRecords`) 적용. 저장 로직 변경 없음 |
| `src/handlers.js` | `handleOperationStatusCommand`에 `type === 'minigames'` 분기 1개 추가(기존 종류 분기 패턴 그대로, 리포트 생성은 `minigameReport.js` 호출) |
| `src/deploy-commands.js` | `운영현황` 종류 choices에 `{ name: '미니게임', value: 'minigames' }` 추가 → **`npm run deploy` 필요** |
| `docs/operator-command-guide.md` | `운영현황` 종류 목록에 `미니게임` 추가 — `test-slash-command-docs-consistency.js`가 choice와 문서 일치를 강제하므로 필수 |
| `docs/minigame-hub-guide.md` | 운영 섹션에 리포트 확인 방법 2~3줄 추가 |
| `scripts/test-minigame-report.js` **(신규)** | 스모크 테스트 (아래 6절) |
| `scripts/check-release.js` | 신규 모듈/테스트 문법 검사 + 스모크 실행 등록 |

**건드리지 않는 것**: 포인트 지급·캡·중복 차단 로직(리포트는 읽기만), 미니게임 판정(`minigameResults.js`), 관리자 웹 대시보드, 던전월드 저장 구조, `/운영내보내기`(기존 CSV/JSON 경로는 원본 확인용으로 그대로 공존).

## 5. 동작 규칙

- 운영자 권한(`isOperator`) + ephemeral 응답 — `/운영현황`의 기존 규칙 그대로.
- 리포트는 호출 시점에 즉석 집계(캐시·상태 파일 없음). 현재 데이터 규모(단일 서버 MVP)에서 전체 스캔 비용은 무시 가능.
- 데이터가 전혀 없으면 "아직 미니게임 참여 기록이 없어요" 안내(빈 배열에서도 embed가 깨지지 않게).
- 집계 실패는 기존 `/운영현황` 패턴대로 catch 후 안내 메시지 — 다른 종류 조회에 영향 없음.
- 날짜 경계는 기존 `getKoreanDateString`(KST) 기준. "최근 7일"은 오늘 포함 7개 날짜.

## 6. 테스트 방법

`scripts/test-minigame-report.js` (임시 데이터 경로 + `createPointsRepository(paths)`, 기존 모듈 테스트 패턴):

1. 픽스처 거래(여러 사용자·여러 날짜·0P 포함·minigame 아닌 거래 섞음)로 오늘/최근 7일/누적 집계 값이 정확한지
2. `relatedType !== 'minigameReward'` 거래와 example 데이터가 집계에서 제외되는지
3. 게임별 집계: 플레이 수 내림차순 정렬, 0P 비율 계산, 알 수 없는 gameId의 제목 폴백
4. KST 날짜 경계: UTC 자정 전후 거래가 올바른 KST 날짜 창에 들어가는지
5. 던전월드 섹션: 임시 로그 저장소로 총 플레이·회차별 진행 수 연동 확인
6. 빈 데이터에서 안내 문구 embed가 생성되는지 + description 길이가 4096자 미만인지
7. `/운영현황 종류:미니게임` 분기: 기존 flow 테스트 방식(fake interaction)으로 embed 응답·ephemeral 확인 — `test-minigame-report.js`에 포함하거나 `test-operator-hub-flow.js` 패턴 참고

회귀: `test-slash-command-docs-consistency.js`(문서에 choice 추가 안 하면 실패), `npm run check:release` 전체 통과.

수동 검증(선택): 테스트 서버에서 `/운영현황 종류:미니게임` 1회 실행, 실제 거래 수와 표시 값 대조.

## 7. 롤백 방법

- 단일 브랜치/PR(`feat/minigame-report`) → `git revert` 한 번으로 복구. 단, **revert 후에도 `npm run deploy`를 다시 실행**해야 Discord 쪽 choice가 제거됩니다(그 전까지는 choice가 남아 있지만, 선택해도 summary로 폴백해 무해).
- 읽기 전용 기능이라 데이터 조치 불필요. 상태 파일·env 없음.

## 8. 주의사항

- 리포트는 **읽기만** 수행 — 어떤 경로로도 포인트/로그 상태를 변경하지 않습니다.
- 개인 식별 정보(사용자 ID, 표시 이름)를 리포트에 넣지 않습니다. 개인별 확인은 기존 `/포인트로그`, 원본 확인은 `/운영내보내기`로 안내.
- 랭킹과 마찬가지로 "평가가 아닌 운영 참고" 톤 유지 — 참여율이 낮은 게임을 벌점처럼 표기하지 않습니다.
- 던전월드 리포트 수치는 후속 회차/클래스 작업(미니게임 트랙 4번) 착수 판단의 근거로 사용됩니다.
