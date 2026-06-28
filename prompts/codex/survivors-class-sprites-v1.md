# 던전월드 생존전 직업 스프라이트 v1

## 목표

`public/dungeonworld-survivors/` 브라우저 게임의 플레이어 캐릭터를 직업별 64x64 투명 PNG 스프라이트로 렌더링한다. 스프라이트가 없거나 로드에 실패하면 기존 절차형 플레이어 렌더를 그대로 사용한다.

## 에셋

- 최종 경로: `public/dungeonworld-survivors/assets/classes/`
- 최종 파일: `ranger.png`, `wizard.png`, `druid.png`, `thief.png`, `cleric.png`, `fighter.png`
- 각 파일은 64x64 투명 배경 PNG다.
- 캐릭터 중심은 캔버스 중앙에 맞춘다.
- 실제 몸체 크기는 약 48px 기준으로 맞춘다.
- 그림자 타원은 이미지 안에 넣지 않는다.
- 리사이즈는 nearest-neighbor 방식으로 처리한다.
- 직업 식별 소품은 가능한 보존한다.

## 연동 규칙

- `renderer.js` 또는 초기화 지점에 직업 스프라이트 로더/캐시를 둔다.
- 경로는 `assets/classes/<class>.png`를 사용한다.
- 직업 식별은 `player.playbook` 또는 `player.classId`가 있으면 우선 사용한다.
- 현재 런타임의 `player.playbookId`도 같은 직업 ID로 취급한다.
- 없으면 `player.crest`를 아래처럼 매핑한다.

| crest | class |
| --- | --- |
| `shield` | `fighter` |
| `halo` | `cleric` |
| `blade` | `thief` |
| `root` | `druid` |
| `rune` | `wizard` |
| `hawk` | `ranger` |

## 렌더링 규칙

- 이미지 로드는 게임 시작 시 한 번만 수행한다.
- `drawPlayerAnchor`는 유지한다.
- 스프라이트가 있으면 절차형 몸체와 crest 렌더 대신 `drawImage`를 우선 사용한다.
- 스프라이트 중심은 `player.x`, `player.y`에 정렬한다.
- `imageSmoothingEnabled = false`를 적용한다.
- `drawImage` 좌표와 크기는 정수 픽셀에 스냅한다.
- `player.facing`으로 스프라이트 자체를 회전하지 않는다.
- 필요하면 기존 방향 표시 notch는 유지한다.
- `drawPlayerAuras`, 위치 원, 그림자, 무적 보호막, HUD 색 가독성 요소는 유지한다.

## 검증

아래 명령을 실행한다.

```bash
node --check public/dungeonworld-survivors/content.js
node --check public/dungeonworld-survivors/systems.js
node --check public/dungeonworld-survivors/renderer.js
node --check public/dungeonworld-survivors/game.js
node scripts/test-dungeonworld-survivors-static.js
```
