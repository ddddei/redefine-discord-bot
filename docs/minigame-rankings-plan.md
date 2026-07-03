# 미니게임 주간/누적 랭킹 계획

이 문서는 미니게임 개선 3순위 "주간/누적 랭킹"의 구현 계획입니다. **이 문서만 보고 다른 컨텍스트 없이 구현을 시작할 수 있도록** 수정 위치, 함수 시그니처, 테스트 갱신 지점까지 명시합니다. 구현 전 [AGENTS.md](../AGENTS.md), [src/AGENTS.md](../src/AGENTS.md), [scripts/AGENTS.md](../scripts/AGENTS.md)의 컨벤션을 따릅니다.

## 1. 배경과 목표

- 현재 랭킹은 `🏆 오늘의 랭킹` 버튼 하나로 오늘 하루 기준 상위 5명만 보여줍니다(`pointsRepository.listTodayMinigameRanking`). 자정이 지나면 리셋되어 꾸준한 참여가 화면에 남지 않습니다.
- 목표: **같은 버튼 하나에서 오늘 / 최근 7일 / 누적 세 구간의 상위 기록을 함께 보여줘** 재방문 동기를 만듭니다. "비교·평가가 아닌 재미용 기록" 톤은 유지합니다.

## 2. 방식 결정 (대안 비교)

| 방식 | 판단 |
|---|---|
| **기존 랭킹 버튼 화면을 3구간으로 확장 (채택)** | 버튼 customId(`participant_minigame_today_ranking`) 불변 → 허브 화면·채널 게이트·버튼 배치 무변경. 라벨만 `🏆 랭킹`으로 변경 |
| 주간/누적 버튼 별도 추가 | 허브 버튼이 11→13개로 늘어 행 배치·테스트·문서 churn이 큼. 화면 한 장에 다 들어가는 정보량이라 불필요 |
| 슬래시 명령 추가 | `deploy-commands.js` 변경 → `npm run deploy` 필요. 버튼 컴포넌트만으로 충분하므로 기각 |

**이번 작업은 슬래시 명령 스키마를 건드리지 않으므로 `npm run deploy`가 필요 없습니다.**

## 3. 설계

### 3-1. 집계 규칙 (세 구간 공통)

- 대상: `relatedType === 'minigameReward'` 포인트 거래, example 유사 데이터 제외(`getOperationalRecords` 경유 — 기존 `listMinigameRewardTransactions`와 동일 소스).
- 날짜 귀속: `relatedId`(`YYYY-MM-DD:gameId`)의 날짜를 우선 사용, 형식이 안 맞으면 `createdAt`의 KST 날짜로 폴백 — **`src/minigameReport.js`의 `getTransactionPlayDate`와 동일 규칙**. 중복 구현하지 말고 이 헬퍼를 `pointsRepository.js`로 옮겨 `getMinigamePlayDate(transaction)`로 export하고, `minigameReport.js`는 자기 로컬 구현을 지우고 그것을 import하도록 리팩터링합니다(레이어 방향: minigameReport → pointsRepository는 기존에도 사용 중이라 순환 없음).
- 구간: 오늘(KST 1일), 최근 7일(오늘 포함 KST 7개 날짜 — `minigameReport.js`와 동일 정의), 누적(전체).
- 엔트리: `{ userId, displayName, earnedPoints, playCount }`. `earnedPoints`는 양수 금액 합계, `playCount`는 확정 결과 수, `displayName`은 `pointsData.users`에서 조회(없으면 userId).
- **`earnedPoints`가 0인 사용자는 랭킹에 표시하지 않습니다** (현 오늘 랭킹의 기대 동작 — `scripts/test-minigame-hub-flow.js:621`이 0P 사용자 미표시를 단언).
- 정렬: `earnedPoints` 내림차순 → `playCount` 내림차순 → `displayName` `localeCompare(..., 'ko')` — 기존 `listTodayMinigameRanking`과 동일.
- 각 구간 상위 5명.

### 3-2. 화면

버튼 라벨: `🏆 오늘의 랭킹` → `🏆 랭킹`. embed 제목: `🏆 미니게임 랭킹`.

```
오늘 (2026-07-03)
1. 이름 - 40P (4회)
...
최근 7일
1. 이름 - 180P (21회)
...
누적
1. 이름 - 690P (88회)
...
```

- 동점자는 같은 순위로 표시 — 기존 `createTodayMinigameRankingPayload`의 `displayRank` 로직을 헬퍼로 추출해 세 구간에 재사용.
- 구간별 데이터가 없으면 해당 구간에 `아직 기록이 없어요.` 한 줄.
- 세 구간 모두 비어 있으면 기존 빈 화면처럼 안내만 표시(문구는 `아직 미니게임 랭킹 데이터가 없어요.`로 갱신).
- 톤 문구 유지: "비교나 평가보다 가볍게 보는 재미용 기록", "하루 미니게임은 최대 4회, 보상 합계는 최대 40P", "포인트 베팅이나 차감은 없어요." 누적 구간 아래에는 `누적은 순위 경쟁이 아니라 꾸준한 참여 기록에 가까워요.` 한 줄 추가.
- 응답은 기존과 동일하게 ephemeral, 채널 게이트(`MINIGAME_CHANNEL_ID`)도 기존 분기 그대로.

## 4. 수정 대상 파일

| 파일 | 변경 내용 |
|---|---|
| `src/pointsRepository.js` | ① `getMinigamePlayDate(transaction)` 헬퍼 신설(모듈 레벨) + `module.exports`에 추가 ② `listMinigameRankings({ now = new Date(), limit = 5 })` 신설 — `{ today, recent7Days, total }` 반환(각각 3-1 규칙의 배열), `createPointsRepository` 반환 객체에 등록 ③ 기존 `listTodayMinigameRanking`은 시그니처·동작 유지(정렬 로직을 내부 공용 헬퍼로 추출해 공유하는 것은 허용) |
| `src/minigameReport.js` | 로컬 `getTransactionPlayDate` 제거, `pointsRepository`의 `getMinigamePlayDate` import로 대체. 다른 동작 변화 없음(기존 `scripts/test-minigame-report.js`가 회귀 가드) |
| `src/minigamePayloads.js` | `createMinigameRankingPayload(rankings)` 신설(3-2 레이아웃, 순위 표시 헬퍼 추출). 기존 `createTodayMinigameRankingPayload`는 새 함수로 대체하고 삭제(사용처는 minigameInteractions뿐 — 삭제 전 grep으로 확인) |
| `src/minigameInteractions.js` | `participant_minigame_today_ranking` 분기에서 `pointsRepository.listMinigameRankings()` 호출 + 새 payload 사용 (customId는 변경하지 않음) |
| `src/minigameRows.js` | 버튼 라벨 `🏆 오늘의 랭킹` → `🏆 랭킹` (customId·스타일 불변) |
| `scripts/test-minigame-rankings.js` **(신규)** | 모듈 스모크 테스트 (아래 6절) |
| `scripts/test-minigame-hub-flow.js` | 랭킹 단언 갱신 (아래 6절 회귀 항목) |
| `scripts/check-release.js` | `scripts/test-minigame-rankings.js` 문법 검사 + 스모크 실행 등록 (기존 minigame 항목들 옆에) |
| `docs/minigame-hub-guide.md` | 3절 9항·4절 버튼 목록·7절 랭킹 기준·9절 QA 항목의 `오늘의 랭킹` 문구를 새 버튼/3구간 기준으로 갱신 |

**건드리지 않는 것**: `deploy-commands.js`(→ `npm run deploy` 불필요), 포인트 지급·캡·중복 차단 로직, `listTodayMinigameRanking`의 외부 동작, `/운영현황 종류:미니게임` 리포트 출력, 버튼 customId 체계.

## 5. 동작 규칙

- 랭킹은 읽기 전용 — 어떤 경로로도 상태를 변경하지 않습니다.
- 호출 시점 즉석 집계(캐시·상태 파일·env 없음). MVP 규모에서 전체 거래 스캔 비용은 무시 가능.
- 세 구간의 날짜 정의(KST, 최근 7일=오늘 포함 7개 날짜)는 `/운영현황 종류:미니게임` 리포트와 정확히 일치해야 합니다 — 운영자가 두 화면을 대조할 수 있습니다.
- 표시 인원은 구간당 최대 5명, `earnedPoints` 0은 미표시. 개인 식별은 기존 오늘 랭킹과 동일한 수준(표시 이름만).

## 6. 테스트 방법

`scripts/test-minigame-rankings.js` (신규, `assert` + 임시 경로 `createPointsRepository(paths)` — `scripts/test-minigame-report.js`의 픽스처 패턴 참고, 마지막에 성공 1줄 출력):

1. 여러 사용자·여러 날짜(오늘/7일 창 안/창 밖) 픽스처로 `listMinigameRankings`의 세 구간 값이 정확한지 — 특히 7일 창 밖 거래가 `recent7Days`에는 없고 `total`에는 있는지
2. 정렬: 포인트 동점 시 playCount, 그다음 이름(ko) 순인지
3. `earnedPoints` 0인 사용자가 세 구간 모두에서 제외되는지
4. example 유사 데이터(`userId: 'example_user'` 등)와 `relatedType !== 'minigameReward'` 거래가 집계에서 제외되는지
5. `displayName` 폴백: users에 없는 userId는 userId로 표시되는지
6. `getMinigamePlayDate`: relatedId 날짜 우선 / 형식 불일치 시 createdAt KST 폴백 (KST 경계 케이스 1개 포함)
7. `createMinigameRankingPayload`: 세 구간 제목·동점 순위 표시·빈 구간 문구·톤 문구 포함, description 4096자 미만, `ephemeral: true`

회귀 갱신 — `scripts/test-minigame-hub-flow.js`:

- `:248` `아직 오늘의 랭킹 데이터가 없어요` → 새 빈 화면 문구로 갱신
- `:614` embed 제목 `🏆 오늘의 미니게임 랭킹` → `🏆 미니게임 랭킹`
- `:617` `상위 5명` 단언 → 새 레이아웃에 맞는 단언(오늘 구간에 기존 사용자·포인트가 그대로 나오는지 유지: `:618~619`의 `상한 사용자 - 40P (4회)` 형식은 유지되도록 새 payload의 라인 형식을 기존과 동일하게 유지)
- `:621` 0P 사용자 미표시 단언은 그대로 유지

회귀: `scripts/test-minigame-report.js`(리팩터된 `getMinigamePlayDate` 경유 동작 불변 확인), `npm run check:release` 전체 통과.

수동 검증(선택): 테스트 서버 미니게임 채널에서 `🏆 랭킹` 버튼 1회 — 세 구간 표시와 ephemeral 여부 확인.

## 7. 롤백 방법

- 단일 브랜치/PR(`feat/minigame-rankings`) → `git revert` 한 번으로 복구.
- 데이터 구조·저장 포맷·env·슬래시 명령 변경이 없으므로 롤백 시 데이터 조치·`npm run deploy` 모두 불필요.

## 8. 주의사항

- **톤 유지가 이 작업의 품질 기준입니다**: 누적 랭킹은 경쟁 지표로 읽히기 쉬우므로 3-2의 완충 문구를 반드시 포함하고, "1등", "우승" 같은 평가성 어휘를 쓰지 않습니다. Korean copy는 기존 문서·화면과 같은 차분하고 직접적인 톤.
- 하루 40P 캡 때문에 누적 랭킹은 사실상 "꾸준함" 지표입니다 — 문구도 그 프레임으로 작성합니다.
- `createTodayMinigameRankingPayload` 삭제 전 `grep -rn createTodayMinigameRankingPayload src/ scripts/`로 사용처가 minigameInteractions(및 자체 export)뿐인지 확인합니다.
- 커밋은 CommonJS·2-스페이스·세미콜론·작은따옴표 컨벤션을 따르고, 이 계획서(`docs/minigame-rankings-plan.md`)도 브랜치에 함께 커밋합니다.
