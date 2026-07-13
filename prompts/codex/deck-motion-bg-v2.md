# 지시서: 덱 고도화 v2 — 전투 모션 팩 + 전투 무대 원화 배경

## 1. 배경과 전제

- 대상: `public/deck/` (간식 수호대 — 슬레이 더 스파이어류 웹게임, CommonJS·무의존성·정적 파일).
- 이미 되어 있는 것(고도화 v1, 이 브랜치의 최근 커밋 5개): 전투 무대 대치 구도(`.battle-stage`에 플레이어 좌하 `#player-side` · 적 우상 `.enemy-side`), 양측 체력바, 의도 아이콘(`deck-intent-*.svg` 5종), 손패 부채꼴, 맵 경로, 데스크톱(≥900px) 가로 무대.
- 이 작업: **표시·연출 전용** 2건 — (A) 전투 모션 팩, (B) 전투 무대에 기존 원화 배경 적용.
- 이 작업이 아닌 것: 게임 로직·카드 효과·저장 스키마·리플레이 로그 변경, 신규 래스터 에셋, 맵(run) 화면 배경, 사운드.

## 2. 작업 전 필독 파일 (읽지 않고 쓰지 마라)

- `public/deck/index.html` — `#screen-combat`의 `.battle-stage` 구조 (player-side / enemy-side / enemy-art-window)
- `public/deck/game.js` — `handleCardTap`(카드 사용 지점), `endTurnButton` 리스너(적 공격 지점), `showDamagePopup`·`shakeEnemy`·`retriggerAnimation`(기존 연출 헬퍼), `INTENT_ASSET`
- `public/deck/styles.css` — `.battle-stage`·`.enemy-art-window`·기존 keyframes, 파일 말미 `@media (min-width: 900px)` 블록
- `docs/webgame-design-guide.md` 4절(모션 원칙: 피드백 300ms 이하, transform/opacity만, 비블로킹, reduced-motion 존중)

## 3. 산출물

### A. 전투 모션 팩 (`public/deck/game.js` + `public/deck/styles.css`)

모두 기존 헬퍼 `retriggerAnimation(el, className)` 패턴(클래스 재부여로 애니메이션 재시작)을 따른다.

1. **공격 런지**: `handleCardTap`에서 카드 사용 성공(`result.success`) 시, 사용한 카드의 효과에 `damage`가 있으면(`Engine.findCard(cardId).effect.damage !== undefined`) `#player-side`에 `player-lunge` 클래스를 재부여. keyframes: 적 방향(우상)으로 `translate(22px, -10px)`까지 갔다가 복귀, 250ms ease. 900px 이상에서는 적이 오른쪽 옆이므로 `translate(30px, 0)` 변형을 미디어 쿼리로 덮어쓴다.
2. **히트 플래시**: 같은 조건(hits 존재, 기존 `shakeEnemy()` 호출 지점)에서 `.enemy-art-window`에 `hit-flash` 재부여. `.enemy-art-window::after`(inset 0, 흰색, opacity 0, pointer-events none)를 만들고 `hit-flash` 시 opacity 0 → 0.55 → 0 애니메이션 200ms. 기존 shake와 병행.
3. **방패 팝**: 카드 효과에 `block`이 있으면 플레이어 쪽에 방패 연출 — `../shared/assets/deck-intent-block.svg`를 src로 하는 `<img>` 복제본을 `#player-side` 중앙 위에 절대 배치로 생성, scale 0.5→1.15→1 + opacity 팝 350ms 후 DOM에서 제거(setTimeout). 입력을 막지 않는다(복제본 원칙 — `animateCardPlay`의 clone 방식 참고).
4. **적 공격 모션**: `endTurnButton` 리스너에서 `Engine.endTurn` 호출 전 의도를 읽어(`Engine.getEnemyIntent(state)`) type이 `attack`이면 `.enemy-side`에 `enemy-lunge` 재부여 — 플레이어 방향(좌하) `translate(-20px, 10px)` 복귀 250ms. 900px 이상은 `translate(-30px, 0)`. 기존 플레이어 피격 팝·shake는 유지.
5. **reduced-motion**: 신규 keyframes 4종 전부 `@media (prefers-reduced-motion: reduce)`에서 `animation: none`으로 끈다(기존 파일의 해당 블록이 있으면 거기에 추가, 없으면 styles.css 말미에 블록 신설).

### B. 전투 무대 원화 배경 (`public/deck/styles.css`)

1. `.battle-stage`의 배경을 크림 단색에서 **기존 원화 재사용**으로 교체:
   `background: linear-gradient(rgba(58, 42, 28, 0.38), rgba(58, 42, 28, 0.52)), url('../shared/art/bg-deck.webp') center / cover no-repeat;`
   (bg-deck.webp는 이미 body::before가 로드하므로 전송량 증가 없음.)
2. 어두운 배경 위 가독성: `.battle-stage` 안의 텍스트 요소들(`.enemy-name`, `.enemy-stat-row`, `.player-stat-row`, 상태 배지 행)이 어두운 배경에 묻히지 않게, **밝은 종이 칩 처리**를 한다 — 각 텍스트 묶음에 `background: rgba(247, 240, 225, 0.88); border-radius: 8px; padding: 2px 8px;` 부여(새 공통 클래스 `.stage-chip`을 만들어 index.html의 해당 요소에 클래스 추가 방식 권장). 의도 배지(`.enemy-intent`)는 이미 종이 칩이므로 그대로.
3. 체력바 트랙 배경도 어두운 배경에서 보이도록 `background: rgba(247, 240, 225, 0.75)`로 조정.
4. 판단 기준: 결과 화면에서 원화(촛불 공방)가 뚜렷이 보이면서 모든 수치·이름이 즉독 가능해야 한다. 대비가 애매하면 그라디언트를 더 어둡게 하지 말고 칩 불투명도를 올려라.

## 4. 금지 사항

- `public/deck/engine.js`, `public/deck/content.js` 수정 금지 (한 줄도).
- `state`·리플레이 로그(`pushAction`)·저장 관련 코드 경로 변경 금지 — 연출은 전부 렌더/이벤트 핸들러 안에서만.
- git 커밋·스테이징·브랜치 변경 금지. 새 의존성·새 래스터 파일 금지.
- 기존 연출(카드 날아감, 피해 팝, shake, 딜-인) 제거·약화 금지 — 위에 얹기만.
- `transform`·`opacity` 이외 속성 애니메이션 금지 (filter 포함 금지 — 히트 플래시는 흰색 오버레이 opacity로).
- **하위 에이전트 재위임 금지.** 지시서 범위 밖 리팩터링 금지.

## 5. 완료 기준 (스스로 검증하고 결과를 보고에 포함)

1. `node --check public/deck/game.js` 통과.
2. `git diff --stat -- public/deck/engine.js public/deck/content.js` 출력 0줄.
3. `grep -c "player-lunge\|enemy-lunge\|hit-flash" public/deck/game.js` ≥ 3, `grep -c "prefers-reduced-motion" public/deck/styles.css` ≥ 1.
4. `node scripts/test-webgame-replay.js` 통과 (워크트리 루트에서).
5. `npm run check:release` 전체 통과.
6. **보고에 포함할 것**: 변경 파일 목록, 위 1~5 실행 결과 원문, 판단이 필요했던 지점과 선택(예: 칩 불투명도 값), 보류 항목, `git status --short` 출력.
