# 던전월드 브라우저 미니게임: 검은 종 생존전

`검은 종 생존전`은 기존 `/던전월드` 텍스트 미니게임의 세계관을 바탕으로 만든 브라우저용 2D 실시간 액션 프로토타입입니다. Discord 버튼형 게임이 아니라 `public/dungeonworld-survivors/` 아래의 정적 HTML/CSS/JS 파일로 동작합니다.

## 운영 원칙

- Discord 계정 연동이 없습니다.
- 포인트 지급, 포인트 차감, 베팅, 랭킹 저장이 없습니다.
- 기존 버튼형 미니게임의 하루 보상 상한과 중복 지급 정책은 변경하지 않습니다.
- `.env` 수정이나 `npm run deploy`가 필요하지 않습니다.
- 결과는 브라우저 화면 안에서만 끝납니다. 운영 데이터 JSON에도 저장하지 않습니다.

## 플레이 내용

- 플레이어는 방향키 또는 WASD로 이동합니다.
- 공격은 가장 가까운 적에게 자동으로 발동합니다.
- 적 웨이브가 시간이 지날수록 빨라지고 강해집니다.
- 경험치 보석을 모으면 레벨업하며 업그레이드 3개 중 하나를 고릅니다.
- 4분을 버티면 성공, 체력이 0이 되면 실패입니다.

## 던전월드 반영 요소

기존 `/던전월드` 1~9회차의 장소와 NPC를 짧은 액션 구조로 압축했습니다.

| 웹게임 요소 | 원본 콘텐츠 연결 |
| --- | --- |
| 마른 참나무 여관, 검은 종 | 1회차 `변방 여관의 검은 종` |
| 고블린 정찰병, 픽의 지름길 | 2회차 `뿌리 아래 고블린 길` |
| 물그릇 슬라임, 미믹, 정지 문양 | 3회차 `무너진 신전의 잠긴 물그릇` |
| 바루크의 창선, 빈 갑옷 | 4회차와 7회차의 문지기/성문 장면 |
| 라메의 잎 표식, 그림자 늑대 | 6회차 `기억의 숲과 되감긴 길` |
| 검은 종 파수꾼 | 9회차 `검은탑의 마지막 문` |

## 로컬 실행

파일만 열어도 동작하지만, 브라우저 QA는 로컬 정적 서버로 확인하는 것을 권장합니다.

```bash
python3 -m http.server 4173 --directory public
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:4173/dungeonworld-survivors/
```

봇 프로세스의 HTTP 서버가 켜져 있는 환경에서는 `/game/dungeonworld-survivors` 경로로도 정적 파일을 서빙할 수 있습니다. 이 경로는 대시보드 API와 달리 Basic Auth를 요구하지 않습니다.

## QA 체크리스트

- `node scripts/test-dungeonworld-survivors-static.js`가 통과하는지 확인합니다.
- `node --check public/dungeonworld-survivors/content.js`
- `node --check public/dungeonworld-survivors/systems.js`
- `node --check public/dungeonworld-survivors/renderer.js`
- `node --check public/dungeonworld-survivors/game.js`
- 로컬 브라우저에서 시작 버튼을 누르면 캔버스가 움직이고 적이 생성되는지 확인합니다.
- 방향키/WASD 이동, 자동 공격, 경험치 획득, 레벨업 업그레이드 선택이 동작하는지 확인합니다.
- 일시정지와 재개가 동작하는지 확인합니다.
- 375px, 768px, 1280px 폭에서 캔버스와 사이드 패널이 겹치지 않는지 확인합니다.
- 화면 어디에도 포인트 지급, Discord 계정 연결, 보상 수령 안내가 없는지 확인합니다.

## 배포 메모

정적 파일과 문서만 바뀐 경우에는 Slash Command 구조가 바뀌지 않았으므로 `npm run deploy`를 실행하지 않습니다. 운영자가 실제 참여자에게 공개 URL을 안내하려면 먼저 Railway/정적 호스팅 경로에서 `public/dungeonworld-survivors/`가 접근 가능한지 확인해 주세요.
