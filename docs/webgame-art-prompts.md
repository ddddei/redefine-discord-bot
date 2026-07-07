# 웹게임 v3 원화 생성 프롬프트 명세

디자인 v3([webgame-design-v3-plan.md](webgame-design-v3-plan.md)) 래스터 아트 트랙의 생성 명세입니다. 이미지 생성은 운영자가 외부 도구(미드저니 등)에서 수행하고, 결과물을 `public/shared/art/`에 넣으면 Claude가 게임 통합·QA를 진행합니다.

## 1. 공통 규칙

- **출력 규격**: 정사각 1:1, 최소 1024px. **투명 배경 불필요** — 모든 아트는 카드 아트 창/타일/배경 프레임 안에 통째로 들어가므로, 그림 자체에 낡은 종이·어두운 배경이 포함되는 편이 오히려 좋습니다.
- **이미지 안에 글자·워터마크·테두리 장식이 생기지 않게** 하세요 (프레임은 게임 쪽 SVG/CSS가 담당).
- **일관성이 최대 과제입니다**: ① 아래 마스터 스타일 문단을 모든 프롬프트에 동일하게 붙이고 ② 첫 배치(적 9종)에서 톤이 가장 잘 나온 1장을 스타일 레퍼런스(미드저니 `--sref`)로 삼아 나머지 전부에 적용하세요. ③ 배치 간 도구/모델 버전을 바꾸지 마세요.
- 대상이 고립·은둔 청년 포함 커뮤니티임을 감안해 **공포·혐오 연출은 금지** — "낡고 진지한 동화책"까지, "호러"는 아님.
- 완료 후 `public/shared/art/SOURCES.md`에 도구·플랜·생성일을 한 줄씩 기록해 주세요 (라이선스 근거).

## 2. 마스터 스타일 (모든 프롬프트 앞에 붙이기)

```
aged storybook oil painting illustration, muted sepia and warm earth tones,
painterly brushwork, antique parchment atmosphere, vintage fairytale book plate,
soft candlelight and deep shadows, weathered and worn, subtle craquelure,
classic card game art, no text, no border, centered composition
```

## 3. 에셋 목록과 개별 프롬프트

### 3.1 덱 적 9종 (첫 배치 — 이걸로 톤 확정)

파일명: `deck-enemy-{이름}.webp`

| 파일 | 개별 프롬프트 (마스터 뒤에 이어 붙이기) |
| --- | --- |
| `crumb-ant` | a large old ant carrying a cookie crumb on its back, insect anatomy, slightly mischievous, kitchen floor at night |
| `sugar-scent-moth` | a dusty moth with sugar-powder wings drawn to candlelight, delicate wing patterns |
| `greedy-pigeon` | a plump greedy pigeon clutching a stolen pastry, ruffled feathers, defiant look |
| `sugar-slime` | a translucent amber sugar-syrup slime creature, viscous drips, faint inner glow |
| `kitchen-mouse` | a cunning kitchen mouse with crumbs in its whiskers, standing upright, tail curled |
| `mold-fairy` | a melancholic small fairy with mushroom cap hat and moth-eaten wings, spores drifting |
| `caramel-golem` | a hulking golem made of hardened caramel and toffee blocks, cracked glossy surface, imposing |
| `whipped-harpy` | a harpy with whipped-cream plumage, sharp talons, swirling cream crest, haughty |
| `great-glutton-dragon` | a great dragon hoarding a mountain of sweets and pastries, heavy belly, smoke from nostrils, boss presence |

### 3.2 매치3 타일 6종 (회화 정물)

파일명: `match3-tile-{이름}.webp` — 보태니컬/정물화 느낌, 과일·간식 단일 오브젝트 클로즈업.

| 파일 | 개별 프롬프트 |
| --- | --- |
| `strawberry` | a single ripe strawberry with leaf, botanical still life close-up |
| `orange` | a single orange with one leaf, botanical still life close-up |
| `candy` | a single wrapped hard candy with twisted wrapper ends, still life close-up |
| `cookie` | a single chocolate chip cookie, rustic still life close-up |
| `cupcake` | a single cupcake with cream swirl and a cherry, still life close-up |
| `jelly` | a cluster of dark grapes / grape jelly, botanical still life close-up |

### 3.3 공용 캐릭터 1종

파일명: `shared-char-baker.webp`

```
portrait of a young apprentice baker with a white chef hat and flour-dusted apron,
gentle determined expression, warm kitchen light, half-length portrait
```

### 3.4 배경 3종 (래스터 전환으로 가능해진 것)

파일명: `bg-{게임}.webp` — 가로 사용을 감안해 이것만 16:9 권장.

| 파일 | 개별 프롬프트 |
| --- | --- |
| `bg-deck` | interior of an old bakery workshop at night, long wooden table, candlelight, shelves of jars and tools, empty center stage for a card battle |
| `bg-idle` | a cozy old bakery storefront interior, warm oven glow, wooden counters, shelves of bread and sweets |
| `bg-match3` | a rustic wooden table top seen from above, scattered flour, warm light from a side window |

## 4. 납품·검수

1. 생성물을 위 파일명으로 `public/shared/art/`에 넣고 (1024px webp, 파일당 ≤150KB — 변환은 Claude가 대신 처리 가능하니 png로 줘도 됨) Claude에게 알려 주세요.
2. Claude 검수 기준: 톤 일관성(세피아·웜톤), 글자/테두리 혼입 없음, 주제 중앙 배치, 공포 연출 없음, 용량.
3. 검수 통과 후 통합(카드 아트 창·타일·배경 적용 + 스토리북 프레임 v3) 진행. 톤이 어긋난 개별 컷은 재생성 요청 목록으로 돌려드립니다.

## 5. 권장 진행 순서

1. **적 9종 먼저 생성** → 가장 좋은 1장을 `--sref` 기준으로 확정 (이 단계에서 Claude에게 보여주면 톤 피드백 가능)
2. 기준 확정 후 타일 6종 + 캐릭터 1종
3. 배경 3종 (톤이 이미 잡힌 뒤라 실패율 낮음)

---

## 6. 2차 배치 — 고도화 v1 원화 게이트 3건 (2026-07-07)

고도화 4종(PR #68~71)에서 "원화 도착 게이트"로 남긴 세 묶음입니다. 1차 배치와 같은 워크플로: 운영자가 외부 도구로 생성 → 지정 경로에 넣고 알려주면 Claude가 변환(webp/축소)·검수·통합·QA를 진행합니다. **6.1~6.2는 1절 공통 규칙과 2절 마스터 스타일을 그대로 적용**하고, 6.3(생존전)만 별도 스타일(다크 판타지 도트)입니다.

### 6.1 덱 신규 카드 13종 (12 + 저주 카드)

파일명: `deck-card-{id}.webp` → `public/shared/art/`. 카드 아트 창은 정사각 — 단일 오브젝트/소품 클로즈업, 적 원화보다 정물에 가깝게. 마스터 스타일(2절) 앞에 붙이고 아래를 이어 붙이세요.

| 파일 | 카드 | 개별 프롬프트 |
| --- | --- | --- |
| `deck-card-croissant-double-tap` | 크루아상 연타 | two crescent croissants crossed like striking batons, motion streaks of flour, dynamic diagonal composition |
| `deck-card-macaron-twin-window` | 마카롱 이중창 | a pair of identical pink macarons side by side, mirrored like twin windows, crumbs scattering |
| `deck-card-choux-rampart` | 슈크림 방벽 | a wall built of stacked cream puffs, sturdy rampart silhouette, cream oozing between layers |
| `deck-card-tiramisu-stockpile` | 티라미수 비축 | layered tiramisu slices stacked in a wooden pantry crate, dusted with cocoa, abundance |
| `deck-card-caramel-coagulate` | 캐러멜 응고 | molten caramel hardening mid-drip into amber crystal strands, viscous and heavy |
| `deck-card-mint-blizzard` | 박하 눈보라 | a swirl of frosted mint leaves and ice-sugar shards in a cold spiral wind |
| `deck-card-butter-grease` | 버터 기름칠 | a golden butter pat melting on an old iron pan, glistening slick sheen, single spark of energy |
| `deck-card-pretzel-knot` | 프레첼 매듭 | a single dark glazed pretzel tied like a strong rope knot, salt crystals, sturdy feel |
| `deck-card-jam-bomb` | 잼 폭탄 | a round jar of dark berry jam with a burning candle wick on top, about to burst, dripping red jam |
| `deck-card-cinnamon-awakening` | 시나몬 각성 | cinnamon sticks arranged like rising rays around a glowing ember core, awakening warmth |
| `deck-card-donut-cycle` | 도넛 순환 | ring donuts orbiting in a circular cycle like a wheel, one returning from shadow into light |
| `deck-card-honey-glaze` | 꿀 코팅 | golden honey pouring over a shield-shaped biscuit, protective glossy coat, slow thick drip |
| `deck-card-soggy-bread` | 눅눅한 빵 (저주) | a sad damp slice of bread, drooping and waterlogged on a cracked plate, melancholic but not gross |

- 기존 카드 18종의 일러스트는 **v4 후보 유지**(이번 게이트 아님) — 신규 13종이 잉크 문양 폴백을 먼저 벗습니다.

### 6.2 방치형 무대 소품 8종 (⚠️ 투명 배경 예외)

파일명: → `public/shared/art/`. **이 묶음만 1절의 "투명 배경 불필요" 예외** — 무대 배경(`bg-idle`) 위에 얹히는 오브젝트라 **투명 배경 png**로 생성하세요(프롬프트 끝에 `isolated on transparent background, soft contact shadow only` 유지). 톤은 마스터 스타일 유지.

| 파일 | 대체 대상 | 개별 프롬프트 |
| --- | --- | --- |
| `idle-stage-1` | 무대1 길거리 좌판 (🧺🍓) | a small street stall basket with fresh strawberries and a folded cloth, humble beginnings |
| `idle-stage-2` | 무대2 포장마차 (🛒⛺) | a little wooden food cart with a canvas awning, hanging lantern, hand-painted sign board without letters |
| `idle-stage-3` | 무대3 동네 가게 (🏪🍬) | a cozy corner-shop facade piece with a candy jar display window, warm interior glow |
| `idle-stage-4` | 무대4 간식 공방 (🏭🍪) | a bakery workshop scene piece with a brick oven, cooling racks of cookies, tools on hooks |
| `idle-stage-5` | 무대5 간식 공장 (🏗️🚚) | a whimsical small snack factory with a delivery cart being loaded with pastry crates, gentle chimney smoke |
| `idle-stage-6` | 무대6 간식 왕국 (🏰🚩) | a fairytale castle made of cake layers and cookie battlements, banner poles without text, grand but warm |
| `idle-golden-snack` | 황금 간식 버튼 (✨🍩) | a single radiant golden donut with a soft halo of sparkles, precious relic feel |
| `idle-goal-flag` | 공동 목표 달성 깃발 (🎉) | a small celebratory pennant flag on a wooden pole with ribbon streamers, festive but calm, no letters |

### 6.3 생존전 클래스 스프라이트 6종 (별도 스타일 — 다크 판타지 도트)

파일명: `{fighter,cleric,thief,druid,wizard,ranger}.png` → `public/dungeonworld-survivors/assets/classes/`. 스토리북 톤이 아니라 **생존전의 다크 판타지 톤**입니다 ([survivors-class-sprites-v1.md](../prompts/codex/survivors-class-sprites-v1.md) 규격: 최종 64×64 투명 png, 몸체 약 48px, 그림자 없음 — 고해상 생성물은 Claude가 nearest-neighbor 축소 처리).

**6.3 전용 마스터 스타일** (모든 프롬프트 앞에):

```
16-bit dark fantasy pixel art character sprite, single full-body figure facing slightly right,
muted desaturated palette with one accent color, grim medieval tone, gothic storybook mood,
crisp pixel clusters, plain solid background for easy removal, no shadow under feet,
no text, centered, full body visible
```

| 파일 | 직업 | 개별 프롬프트 (액센트 컬러 포함) |
| --- | --- | --- |
| `fighter` | 전사 | an armored fighter with a worn iron sword and round shield, heavy stance, accent color dull crimson |
| `cleric` | 사제 | a hooded cleric holding a small sun-shaped censer, calm posture, accent color pale gold |
| `thief` | 도적 | a nimble thief in a dark cloak with twin daggers, crouched ready stance, accent color deep violet |
| `druid` | 드루이드 | a druid with gnarled root staff and leaf-trimmed robe, grounded stance, accent color moss green |
| `wizard` | 마법사 | a wizard with a tattered star-flecked robe and orb-tipped staff, accent color arcane blue |
| `ranger` | 레인저 | a ranger with a longbow and feathered hood, alert side stance, accent color hunter amber |

- 6종은 **한 세션에서 연속 생성**해 실루엣 스케일·팔레트를 통일하세요 (첫 장을 기준 삼아 나머지에 참조 적용).
- 배경은 투명이 이상적이지만, 단색 배경으로 생성해도 Claude가 제거 처리합니다.

### 6.4 납품·검수 (2차 배치)

1. 6.1·6.2는 `public/shared/art/`, 6.3은 `public/dungeonworld-survivors/assets/classes/`. png로 줘도 됩니다(변환·축소·용량은 Claude 처리).
2. 검수 기준은 4절과 동일 + 6.2는 투명 배경 여부, 6.3은 실루엣 가독성(64px 축소 후 직업 구분 가능한지 — 축소 시안을 먼저 1종 확인 권장).
3. 완료 후 `SOURCES.md`에 배치 단위로 기록.
4. 권장 순서: **6.3 1종(fighter)으로 축소 가독성 먼저 확인** → 6.3 나머지 → 6.1(카드 13) → 6.2(소품 8 — 투명 배경이라 실패율이 가장 높아 마지막).
