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
