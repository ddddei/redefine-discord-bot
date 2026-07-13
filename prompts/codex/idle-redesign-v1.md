# 지시서: 방치형 리디자인 v1 — "살아있는 작업대"

## 1. 배경과 전제

- 대상: `public/idle/` (간식 공방 키우기 — 방치형 웹게임, CommonJS·무의존성·정적 파일, 모바일 퍼스트 375px).
- 승인된 계획서: `docs/idle-redesign-plan.md` — **이 지시서와 계획서가 다르면 지시서를 따르고 보고에 기록**하라.
- 이미 되어 있는 것(이 브랜치): 무대 장면 원화(`sceneAsset`, 이모지 폴백), 황금 간식·깃발 원화, 시설 구매 시 장면 소품(SVG) 추가.
- 이 작업: **표시·입력 배선 전용** 4건 — (A) 장면 = 탭 타겟, (B) 승급 진행바 상시 노출, (C) 생산 티커, (D) 레이아웃 재배치.
- 이 작업이 아닌 것: `engine.js` 수정, 밸런스·시설·무대 추가, 저장 스키마 변경, 신규 래스터 에셋, 사운드.

## 2. 작업 전 필독 파일 (읽지 않고 쓰지 마라)

- `public/idle/index.html` — `#tab-workshop`(무대 장면 `#stage-scene`, `#make-snack-button`, `#popup-layer`, 승급 카드, 하단 퀘스트 바, 탭 바)
- `public/idle/game.js` — `makeSnackButton` 클릭 핸들러(간식 생산 경로), `renderScene`/`renderSceneArt`, `renderHeader`, 승급 관련 렌더(`next-stage-label`·`stage-upgrade-cost` 갱신 지점), `popupLayerEl` 티커 사용법, 파견(`deliveryActive*`) 상태 접근법
- `public/idle/engine.js` — **읽기만.** `getClickAmount`, `getProductionPerSecond`, `findStage`, `formatNumber` 시그니처 확인용
- `public/idle/content.js` — `STAGES[].upgradeCost`(다음 무대 비용), `BUILDINGS`(소품 SVG 경로는 game.js `BUILDING_ASSET`)
- `public/idle/styles.css` — `.stage-scene`, `.scene-props`, `.make-snack-button`, `.stage-upgrade-card`, 기존 keyframes
- `docs/webgame-design-guide.md` 4절(모션 원칙)·6절(스토리북 프레임 토큰)

## 3. 산출물

### A. 장면 = 탭 타겟 (`index.html` + `game.js` + `styles.css`)

1. `#stage-scene` 전체를 탭 가능하게 — 장면 위에 투명 오버레이 `<button id="scene-tap-button" aria-label="간식 만들기">`(absolute inset 0)를 추가하고, 클릭 시 **기존 `makeSnackButton` 클릭 핸들러와 동일한 함수 경로**를 태운다 (핸들러 본문을 공용 함수로 추출해 두 버튼이 공유; 생산 수치·저장 경로가 두 갈래가 되면 안 된다).
2. 탭 지점 피드백: 클릭 좌표(event.clientX/Y)를 장면 기준 좌표로 바꿔 그 위치에서 `+N` 숫자와 작은 간식 아이콘(현재 무대의 첫 해금 시설 SVG 재사용)이 400ms 떠오르며 사라지는 파티클을 생성. 파티클 DOM은 동시 10개 상한, 종료 시 remove. 기존 `popup-layer` 티커 방식을 참고하되 장면 안에 별도 레이어(`#scene-tap-layer`)를 둬라.
3. 캐릭터 반응: 기존 `#make-snack-button`은 장면 아래 **얇은 보조 버튼**으로 축소(제빵사 초상 이미지는 유지하되 작게 — 버튼 높이 목표 56~64px). 장면 탭 시 이 버튼의 초상에 scale 0.96 → 1 반응(120ms, retrigger 패턴).
4. 첫 진입 안내: 장면 하단에 옅은 안내 문구 1줄("공방을 톡톡 두드려 보세요") — localStorage 부가 키 없이, 세션 최초 렌더에만 표시하고 첫 장면 탭 때 사라지게(단순 JS 플래그). 카피 톤은 차분·직접적으로.

### B. 승급 진행바 (`index.html` + `game.js` + `styles.css`)

1. 무대 장면 바로 아래(승급 카드 안 상단)에 진행바: `현재 간식 보유량 / 다음 무대 upgradeCost` 비율(0~100% 클램프). `Engine.formatNumber` 축약 표기로 "1.2만 / 5만" 텍스트 병기.
2. 100% 도달(승급 가능) 시 바에 `ready` 클래스 — 채움색을 `--accent-rose`에서 더 밝은 강조로, 승급 버튼과 시각적으로 연결.
3. 최종 무대(6, 다음 무대 없음)에서는 진행바 대신 기존 환생 안내 문구 유지(진행바 숨김).
4. 갱신 주기: 기존 렌더 루프(간식 수 갱신 지점)와 같은 곳에서 style.width만 갱신 — 매 프레임 DOM 재생성 금지.

### C. 생산 티커 (`game.js` + `styles.css`)

1. `Engine.getProductionPerSecond(state, ...) > 0`일 때만: 2~4초 랜덤 간격(`Math.random` 허용 — idle은 시드 무관 장르, 계획서 명시)으로 장면 안 랜덤 x 위치에서 작은 간식 SVG(보유 중인 시설 중 랜덤 1종의 `BUILDING_ASSET`)가 아래→위로 떠오르며 사라지는 티커 1개 생성(600ms).
2. 동시 존재 티커 ≤ 2 (초과 시 이번 틱 생략). `document.hidden`이면 타이머를 멈추고 visibilitychange에서 재개. `prefers-reduced-motion: reduce`면 티커 자체 미생성(matchMedia로 판정).
3. 파견 진행 중 표시: `state.delivery`(활성 파견) 존재 시 장면 좌하단 구석에 작은 칩(기존 종이 칩 스타일) — "배달 중 · 남은 시간" 텍스트. 남은 시간 갱신은 기존 파견 카운트다운 갱신 지점에 편승(신규 타이머 금지).

### D. 레이아웃 재배치 (`index.html` + `styles.css`)

1. 공방 탭 첫 화면(375×812)에서 스크롤 없이 다음이 모두 보이게: 헤더 / 무대 장면(탭 타겟, 높이 확대 — 원화가 주인공) / 승급 진행바+승급 버튼(한 카드로 통합) / 보조 만들기 버튼(얇게) / 하단 퀘스트 바 / 탭 바.
2. 기존 큰 로즈색 `make-snack-button` 카드(현재 화면의 1/4)를 축소하면서 확보되는 공간을 장면에 배분. 장면 `min-height`를 늘리되(target 240px±) 원화 `max-height`도 함께 조정.
3. 다른 탭(시설/배달/기록)의 마크업·스타일은 건드리지 않는다.

## 4. 금지 사항

- `public/idle/engine.js` 수정 금지 (한 줄도). `content.js`도 이번 작업에선 수정 금지.
- 생산·클릭 수치 계산을 새로 만들지 마라 — 반드시 기존 엔진 함수·기존 핸들러 경로 재사용.
- 저장 스키마·localStorage 키 추가 금지.
- git 커밋·스테이징·브랜치 변경 금지. 새 의존성·새 래스터 파일 금지. 하위 에이전트 재위임 금지.
- `transform`·`opacity` 이외 속성 애니메이션 금지. 상시 무한 루프 애니메이션 추가 금지(티커는 간격 생성-소멸).
- 압박·조급함 유발 연출(점멸 카운트다운 등) 금지 — 참여자 배려 원칙.

## 5. 완료 기준 (스스로 검증하고 결과를 보고에 포함)

1. `node --check public/idle/game.js` 통과.
2. `git diff --stat -- public/idle/engine.js public/idle/content.js` 출력 0줄.
3. `grep -c "scene-tap\|upgrade-progress\|ticker" public/idle/game.js` ≥ 3, `grep -c "prefers-reduced-motion\|visibilitychange\|document.hidden" public/idle/game.js public/idle/styles.css` 합계 ≥ 2.
4. `npm run check:release` 전체 통과 (워크트리 루트에서).
5. 브라우저 확인이 가능하면(정적 서버 임시 사용 가능, 종료 필수): 장면 탭 → 간식 수 증가 + 파티클, 기존 버튼 탭 → 동일 증가폭, 진행바 % 표시. 불가능하면 그 사실을 보고에 명시.
6. **보고에 포함할 것**: 변경 파일 목록, 위 1~5 실행 결과 원문, 계획서와 달리 판단한 지점, 보류 항목, `git status --short` 출력.
