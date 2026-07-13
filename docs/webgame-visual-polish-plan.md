# 웹게임 비주얼 폴리시 v1 계획서 — 매치3 타일 판별성 · 덱 카드 아이콘/라벨 · idle 무대 소품 원화

작성: 2026-07-13. 상태: **승인 대기**.

## 0. 배경 / 문제

2026-07-13 모바일 뷰포트(375px) 실화면 점검에서 확인된 세 가지 문제를 묶어서 해소한다.
셋 다 **표시 전용** 변경으로, 게임 로직·저장 스키마·리플레이 재현 의미에는 손대지 않는다.

| # | 게임 | 문제 | 성격 |
| --- | --- | --- | --- |
| 1 | 매치3 | v3 정물 원화가 전부 어두운 갈색 톤 + `object-fit: cover`로 칸을 꽉 채워, 종류 구분을 맡기로 한 배경 틴트(`public/match3/styles.css` 229~251행)가 얇은 저채도 링으로만 보임. 딸기/오렌지/쿠키/파이가 즉시 구분되지 않아 **게임성 자체를 해침** | 판별성 (최우선) |
| 2 | idle | 무대 장면이 이모지 텍스트(`sceneEmoji: '🧺🍓'`, `public/idle/content.js` 22행) — 초상 원화·배경 원화와 톤 낙차가 가장 큼. 황금 간식 버튼(`✨🍩`)·공동 목표 깃발(`🎉`)도 이모지(`public/idle/index.html` 40·52행) | 톤 완성도 |
| 3 | 덱 | 카드 타입 아이콘 `deck-icon-defense.svg`가 한색 파랑(`#5b8dff`)이라 회화 톤과 충돌. 카드 하단 분류 표기가 영문(`ATTACK`/`DEFENSE`/`SKILL`, `public/deck/game.js` getCardTypeLabel) — 한국어 UI에서 유일한 영문 노출 | 톤 완성도 |

착수 게이트: 없음 (운영 개시 전 폴리시 작업, 데이터 조건 불필요).
단, **PR-B는 원화 8종 생성(사용자, ChatGPT)** 이 선행 조건이다 — 프롬프트 명세는 `docs/webgame-art-prompts.md` 6.2절에 이미 완성돼 있다.

## 1. 전체 구조

```
PR-A (즉시 착수 가능 — 코드만)
  매치3: styles.css 틴트/링 강화 (+ 아트 밝기 보정)
  덱:    deck-icon-*.svg 3종 난색 리터치, 라벨 한글화(game.js)
  가이드: webgame-design-guide.md 6.4절 분류 표기 규정 개정

PR-B (선행: 원화 8종 도착·검수)
  idle:  무대 원화 idle-stage-1~6 + 황금 간식 + 깃발 통합
         content.js 표시용 sceneAsset 필드, game.js 렌더 교체(이모지 폴백 유지)
```

- 저장 스키마 변경: **없음** (localStorage 형식 불변).
- 환경변수: **없음** (신규/변경 0건).
- `src/deploy-commands.js` 변경: **없음 → 머지 후 `npm run deploy` 불필요.**
- 서버 코드 변경: **없음** (adminServer의 `.webp`/`.svg` MIME은 기존 지원 확인됨).
- 로직 파일(`match3/board.js`·`scoring.js`, `idle/engine.js`, `deck/engine.js`·`content.js` 효과 정의) **무수정** — 리플레이 로그 버전 상향 불필요(재현 의미 불변).

## 2. 접근 방식

- 기존 구조 재사용: v2 SVG 에셋 체계(`public/shared/assets/`), v3 원화 체계(`public/shared/art/` + SOURCES.md), 표시용 필드 허용 선례(v2: deck content.js `asset` 필드) 를 그대로 따른다.
- 표시 전용 원칙: 모든 변경은 CSS·SVG·표시 매핑·정적 에셋에 한정. 판정 로직이 필요한 곳(덱 카드 타입)은 기존 `getCardTypeAsset` 판정 기준을 공유하고 새 판정을 만들지 않는다.
- 단계별 독립 PR: PR-A와 PR-B는 서로 의존하지 않고 각각 단일 revert로 복구 가능.
- 저사양 배려(`docs/webgame-mobile-first-plan.md`): 신규 애니메이션 0건, 정적 filter 1건(매치3 아트 밝기 보정)만 추가하고 저사양 렌더 비용을 QA에서 확인. 첫 화면 전송량 예산 게임당 ≤ 400KB 유지.
- 문서 동시 갱신: 분류 표기 영문 규정(가이드 6.4절)을 바꾸므로 가이드 문서를 같은 PR에서 개정.

## 3. 단계별 계획

### PR-A 1단계 — 매치3 타일 판별성 (`feat/webgame-visual-polish` 브랜치)

수정 파일: `public/match3/styles.css` (단일 파일).

1. **판별 링 강화**: `.tile-asset`에 내부 여백을 둬(크기 `calc(100% - 8px)` 수준) 종류별 배경 틴트가 최소 4px 링으로 보이게 한다.
2. **틴트 재설계**: `.tile-strawberry` 등 6종 배경을 저채도 세피아 파스텔에서 **서로 hue가 뚜렷이 다른 중채도 톤**으로 교체 (예: 딸기=로즈 레드 계열, 오렌지=주황, 사탕=핑크, 쿠키=갈색, 컵케이크=노랑, 젤리=보라 — 정확한 값은 구현에서 잉크 보더와 대비 확인하며 확정). v3 가이드의 "고채도 파스텔 폐기" 조항과 상충하므로 가이드 6.6절(게임별 적용 노트)에 "판별 기능이 걸린 타일 틴트는 예외" 단서를 추가한다.
3. **아트 밝기 보정**: `.tile-asset`에 정적 `filter: brightness(…) saturate(…)` 1건(값은 QA에서 확정, 1.1 내외)을 걸어 원화 본색 차이(딸기 빨강 vs 오렌지 주황)가 살아나게 한다. 저사양 렌더 비용은 QA 항목(S7)으로 검증하고, 문제 시 이 항목만 제거해도 1·2번으로 판별성이 확보되게 설계한다.
4. 특수 타일 오버레이(`.tile-special-*`)·선택/드래그 연출과의 시각 간섭을 확인한다 (링 강화로 selected 인셋 섀도가 가려지지 않는지).

### PR-A 2단계 — 덱 카드 아이콘·라벨

수정 파일: `public/shared/assets/deck-icon-attack.svg`, `deck-icon-defense.svg`, `deck-icon-skill.svg`, `public/deck/game.js`(getCardTypeLabel 반환값만), `docs/webgame-design-guide.md`(6.4절).

1. **아이콘 리터치**: 3종 SVG의 채움색을 한색(파랑 `#5b8dff`/`#cddcff` 등)에서 가이드 서브 팔레트의 난색 계열로 교체. 외곽선 `#4a3524` 두께 3 등 라인 캐릭터 규칙은 유지 — 형태 변경 없이 색만 바꾼다.
2. **라벨 한글화**: `getCardTypeLabel` 반환값을 `ATTACK`/`DEFENSE`/`SKILL` → `공격`/`방어`/`스킬`로 교체. 판정 기준(effect.damage/block 유무)은 불변.
3. **가이드 개정**: 6.4절 "하단에 소문자 분류 표기(예: `ATTACK`)" 문구를 한글 표기 규정으로 개정 (영문 표기는 폐기 사유 명시).
4. idle 시설 목록 등에서 같은 SVG를 재사용하는 화면(`public/idle/game.js` BUILDING_ASSET은 매치3 타일 SVG만 사용 — 덱 아이콘 미사용 확인됨)이 없는지 최종 grep으로 재확인 후, 덱 화면에서만 색 변화가 나타남을 QA.

### PR-B — idle 무대 소품 원화 통합 (선행: 원화 8종)

원화 생성(사용자): `docs/webgame-art-prompts.md` 6.2절 프롬프트 8종(idle-stage-1~6, idle-golden-snack, idle-goal-flag)을 ChatGPT로 생성. **투명 배경 png** → webp 변환(알파 유지)·150KB/장 이하는 통합 단계에서 처리. Fable이 마스터 스타일 일치·투명 배경 여부를 검수하고, 불합격분은 재생성 요청.

수정 파일: `public/shared/art/`(webp 8종 + SOURCES.md), `public/idle/content.js`(무대 6종에 표시용 `sceneAsset` 필드 추가), `public/idle/game.js`(무대 장면·황금 간식·깃발 렌더), `public/idle/index.html`(scene-flag·golden-snack-button 내용), `public/idle/styles.css`(크기·배치).

1. `content.js` 무대 정의에 `sceneAsset: '../shared/art/idle-stage-N.webp'` 필드 추가 — **표시 전용 필드이며 engine.js는 읽지 않는다** (v2 선례와 동일 조건: 로직 테스트 무수정 통과).
2. `game.js` 무대 렌더(241행 부근)에서 `sceneAsset`이 있으면 `<img>`(lazy·async)로, 없으면 기존 `sceneEmoji` 텍스트로 폴백 — 원화 로드 실패(onerror) 시에도 이모지 폴백.
3. 황금 간식 버튼·공동 목표 깃발을 원화 `<img>`로 교체 (버튼 접근성 라벨은 텍스트로 유지).
4. `SOURCES.md`에 8종 생성 출처·라이선스 기록. 총 아트 예산(현재 732KB, 상한 5MB) 내 확인.
5. 전송량: 무대 원화는 현재 무대 1장만 로드되는 구조로 구현 (승급 시 다음 무대 이미지를 그때 로드). 첫 화면 실측 ≤ 400KB 보고.

### 배포 시점

로직 무변경(리플레이 재현 의미 불변)이므로 **KST 자정 배포 규칙 비적용** — 아무 때나 머지·배포 가능. 다만 브라우저 캐시로 신구 CSS가 섞여 보일 수 있는 것은 새로고침으로 해소되는 수준.

## 4. 성공 기준

- **S1 (매치3 판별성)**: adminServer(`/game/match3/`) 모바일 뷰포트에서 보드 스크린샷을 찍었을 때, 6종 타일의 링 색이 서로 다른 hue임을 devtools 계산값으로 확인하고, 링 두께가 4px 이상임을 확인. 최종 판정은 사용자 육안 승인(변경 전/후 스크린샷 비교 제출).
- **S2 (매치3 회귀)**: 특수 타일 오버레이·선택(selected)·드래그·클리어 연출이 링 강화 후에도 시각적으로 식별됨을 수동 확인. `board.js`/`scoring.js` git diff 0건.
- **S3 (덱 라벨)**: 전투 화면 카드 하단에 영문 분류 표기가 0건이고 `공격`/`방어`/`스킬`이 표시됨을 수동 확인. `engine.js`/`content.js` git diff 0건.
- **S4 (덱 아이콘)**: 3종 SVG에 한색 계열(`#5b8dff` 등) 채움색이 남아 있지 않음을 파일 grep으로 확인.
- **S5 (idle 원화)**: localStorage 조작으로 무대 1~6을 순회하며 각 무대 원화가 표시됨을 수동 확인. `sceneAsset`을 임시 제거한 무대에서 이모지 폴백이 동작함을 확인.
- **S6 (idle 로직 불변)**: `engine.js` git diff 0건, `scripts/test-idle*.js` 포함 `npm run check:release` 전체 통과.
- **S7 (성능·전송량)**: 매치3 밝기 보정 filter 적용 후 저사양 시뮬(devtools CPU 4x)에서 스와이프 연출 끊김이 없음을 수동 확인. idle 첫 화면 전송량 실측 ≤ 400KB 보고.
- **S8 (리플레이 안전망)**: `node scripts/test-webgame-replay.js` 통과 (로직 무변경 확인용 게이트).

## 5. 제약 조건

- CommonJS·무의존성, 프론트 빌드 없음 (정적 파일 직접 서빙) — 기존과 동일.
- 로직 파일 무수정: `public/match3/board.js`·`scoring.js`, `public/idle/engine.js`, `public/deck/engine.js`. 위반 시 리뷰에서 원복.
- `pointsRepository.js`·서버 코드·admin 콘솔 비접촉 (이번 범위에 서버 변경 없음).
- 래스터는 `public/shared/art/`(webp, 150KB/장·총 5MB), 벡터는 `public/shared/assets/` — v3에서 개정된 에셋 정책 준수, SOURCES.md 기록 의무.
- CLAUDE.md 금기 위반: **없음** (별도 승인 절 불필요).

## 6. 위험 / 롤백

| 위험 | 대응 |
| --- | --- |
| 틴트 중채도 전환이 v3 세피아 톤을 깨뜨려 보임 | 링은 원화 바깥 여백에만 보이므로 영향 국소적. 사용자 전/후 스크린샷 승인(S1)을 머지 게이트로 |
| 매치3 filter가 저사양에서 프레임 저하 | S7에서 CPU 4x 확인, 문제 시 filter 항목만 제거(판별성은 링/틴트로 확보되는 설계) |
| 원화 8종 중 투명 배경 실패(명세상 실패율 최고 묶음) | 검수에서 불합격분 재생성 요청, PR-B는 8종 전부 합격 전 착수하지 않음 |
| idle 원화 로드 실패로 무대가 빈 화면 | onerror 이모지 폴백(S5로 검증) |
| 신구 클라 혼재 | 로직 무변경이라 리플레이 판정 영향 0 — 시각 차이만 존재 |

롤백: 두 PR 모두 표시 전용 단일 커밋 묶음 → **PR 단위 revert 한 번**으로 완전 복구. env 게이트 불필요.

## 7. 커밋 / PR 구성

- **PR-A** `feat/webgame-visual-polish`: ① 매치3 styles.css ② 덱 SVG 3종+라벨 ③ 가이드 6.4/6.6 개정 — 커밋 3개.
- **PR-B** `feat/idle-stage-art`: ① 원화 8종+SOURCES.md ② content.js/game.js/index.html/styles.css 통합 ③ 문서(전송량 실측표) — 커밋 3개.
- 두 PR 모두 본문에 검증 절(성공 기준 대비 결과) 포함. `npm run deploy` 불필요.

## 8. 범위 제외 (재론 방지)

- 매치3 헤더~보드 사이 여백 재배치 (점검 항목 4) — 레이아웃 개편은 판별성과 독립, 별도 건.
- 덱 맵 화면 밀도 개선 (점검 항목 5) — 노드 연출 추가는 저사양 예산 검토가 따로 필요.
- 단어 게임 액센트 통일 (점검 항목 6) — 소형이지만 이번 묶음의 "톤 낙차" 주제와 별개.
- 덱 카드 아트 13종 원화 (`webgame-art-prompts.md` 6.1절) — 별도 원화 배치, 이번엔 아이콘 색만.
- 색약 대응 모양 뱃지 (타일에 형태 기호 추가) — 판별성 후속 후보로 기록만.
- adminServer gzip (매치3 전송량 401.6KB 초과 백로그) — 서버 변경이라 이번 표시 전용 원칙과 상충.
