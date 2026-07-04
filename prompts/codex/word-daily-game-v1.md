# Codex 작업 지시서

## 작업 이름

신규 웹게임 5호 `오늘의 간식 단어` v1 (한글 데일리 단어 맞추기 — 랭킹 없는 참여형)

## 목표

`public/word/`에 다섯 번째 웹게임을 완성 상태로 구현한다. 하루 1단어·자모 6칸·6회 시도, **서버 채점**(정답 비노출), **랭킹·점수·응원이 전혀 없는 첫 게임**(참여 인원과 성공자의 시도 횟수 분포만 노출). 세부 스펙은 **`docs/word-daily-web-game-plan.md`가 기준 문서**다 — 이 지시서보다 상세하므로 반드시 먼저 정독한다. 충돌 시 계획서를 따르고 보고서에 충돌 지점을 남긴다.

## 선행 조건 (작업 전 확인)

1. 비동기 소셜 v1(PR #62)이 `main`에 머지되어 있어야 한다: `src/webgameApi.js`에 `handleDaily`·`getDayKey`가 존재하는지 확인. 없으면 **작업을 시작하지 말고 중단 사유를 보고**한다.
2. `main`에서 새 브랜치 `feat/word-daily-game-v1`을 만든다.

## 참고 문서

- docs/word-daily-web-game-plan.md (기준 문서 — 1절 규칙, 2절 정답 보안, 3절 API, 4절 클라이언트, 6절 테스트)
- docs/webgame-async-social-plan.md (dayKey·자정 유예·daily 인프라의 원 설계)
- docs/webgame-mobile-first-plan.md (모바일 스펙 — 신규 게임은 **처음부터** 이 기준 적용: viewport-fit·100dvh·safe-area·theme-color·touch-action·44px 타겟·무음)
- docs/webgame-design-guide.md (스토리북 v3 톤 — gk 컴포넌트·잉크 프레임 재사용)
- AGENTS.md, src/AGENTS.md, data/AGENTS.md, scripts/AGENTS.md

## 현재 전제

- `GET /game/api/daily`는 현재 `rankable` 게임(match3/deck)만 허용하고 idle을 400으로 거절한다. 이번 작업에서 게임 정의에 **`dailyCapable` 플래그를 도입**해 "daily 지원"과 "랭킹 대상"을 분리한다(match3/deck: 둘 다 true, idle: 둘 다 false, word: dailyCapable true·rankable false). 기존 게임의 응답·거절 동작은 바이트 단위로 불변이어야 한다.
- 점수 저장소(`webgameRepository`)·자정 유예·연결(GameLink)은 그대로 재사용한다. word의 결과 기록은 기존 `POST /score` 경로에 word 전용 분기(시드 대신 dayKey 직접 판정)로 얹는다 — 계획서 3절 표.
- adminServer의 정적 라우팅은 기존 3종 패턴(`/game/<id>/` 트레일링 슬래시)을 따른다.

## 중요 구현 원칙

1. **정답 비노출이 보안 요구사항이다.** 정답 단어·정답 인덱스·salt를 어떤 API 응답, 클라이언트 코드, 콘솔 로그에도 넣지 않는다. 채점은 `POST /game/api/word/guess`가 유일한 경로. API 테스트에 "응답 전체에 정답 문자열 부재" 검증을 반드시 포함한다.
2. **랭킹 없음의 일관성.** `/게임랭킹` choices에 word를 추가하지 않는다(`deploy-commands.js` 무수정 — **이번 작업은 deploy 불필요**). 랭킹·응원·점수 UI를 만들지 않는다. 실패 인원은 어떤 화면·응답에도 노출하지 않는다(분포는 성공자만).
3. **기존 게임 무접촉.** `public/{match3,idle,deck,dungeonworld-survivors}/` 수정 금지. 기존 테스트 전부(웹게임 4본 + 로직 3본) **무수정 통과**가 하위 호환의 증거다.
4. `logic.js`(자모 분해·피드백 계산)는 순수 함수로 작성해 Node에서 직접 로드 가능해야 한다(브라우저 전역 의존 금지 — 기존 board.js 패턴). 중복 자모 규칙(정답에 1개뿐인 자모가 추측에 2개면 하나만 표시)은 계획서 6절의 워들 표준을 따른다.
5. 단어 풀 큐레이션 기준: 2글자 한글 명사, 간식·부엌·일상 소재, **비속어·차별어·질병/죽음 등 상처 줄 수 있는 단어 배제**. 정답 풀 300 + 유효 사전 1,500(정답 풀 포함, 중복 없음). 전체 목록을 커밋하고 보고서에 무작위 표본 30개를 첨부한다(톤 검수용).
6. 서버 채점의 하루 1회 기록·IP 빈도 제한(분당 30회)·dayKey 오늘/어제 유예는 계획서 3절 그대로. 미연결 사용자도 채점 API를 쓸 수 있다(토큰 불필요) — 단 결과 기록(분포 반영)은 연결된 사용자만.
7. 참여자 카피는 차분한 존댓말, 실패 화면은 "오늘은 여기까지예요. 내일 새 단어로 만나요" 톤. 정답 공개 UI를 만들지 않는다. 신규 카피 전체 목록을 보고서에 첨부한다.
8. CommonJS·정적 파일·신규 npm 의존성 금지·외부 요청 금지·무음/무진동. `pointsRepository.js` 무접촉.
9. **git push, PR 생성, `npm run deploy`, `.env` 수정 금지.** 로컬 커밋까지만 (`.env.example`은 수정 대상).

## 수정 가능 파일

- public/word/{index.html, styles.css, logic.js, game.js} (신규)
- src/webgameApi.js (dailyCapable 플래그·word daily 응답·guess 핸들러·score word 분기)
- src/webgameRepository.js (word 결과 기록·분포 집계 함수 — 필요한 경우만)
- src/adminServer.js (정적 라우팅·`/game/api/word/guess` 라우팅 추가만)
- data/word-pool.json (신규), scripts/validate-data.js (스키마 추가)
- scripts/test-word-logic.js, scripts/test-word-api.js (신규), scripts/check-release.js (등록만)
- .env.example (`WEBGAME_WORD_SALT`)
- docs/webgame-rankings-ops.md ("랭킹 없는 게임" 절), docs/railway-env-guide.md, docs/word-daily-web-game-plan.md (완료 표기), docs/README.md (색인 1줄)

위 목록 밖 파일 수정이 필요하면 사유를 보고서에 요약한다.

## 작업 순서 (계획서 7절 커밋 6개)

1. `data/word-pool.json`(풀 300+사전 1,500) + validate-data 스키마(2글자·한글·풀⊂사전·중복 없음)
2. 서버 — `dailyCapable` 도입(기존 동작 불변), word 정답 선택(sha256(salt+dayKey) % pool 길이, salt는 `WEBGAME_WORD_SALT` env → 미설정 시 social 저장소 cheerSalt 재사용), `GET /daily?gameId=word` 응답(dayKey·participants·distribution·myResult — 시드·정답 없음), `POST /game/api/word/guess`(사전 검증·6칸 피드백·유예·IP 제한), `POST /score`의 word 분기(dayKey 직접 판정·사용자당 하루 1건)
3. `logic.js` + `scripts/test-word-logic.js` (자모 분해: 종성 없음·복모음, 피드백: 자리/존재/없음·중복 자모 규칙, 이모지 그리드 생성)
4. 클라이언트 UI — 6×6 그리드·자모 키보드(두벌식·44px)·진행 상태 localStorage 이어보기·성공/실패 화면·분포 막대·결과 복사 버튼(정답 미포함)·연결 섹션. 모바일 하드닝 스펙 처음부터 적용
5. `scripts/test-word-api.js` (정답 결정성·채점 왕복·**응답에 정답 부재**·중복 기록 1건·분포 집계·빈도 제한·기존 게임 daily 불변) + check-release 등록
6. 문서 — rankings-ops "랭킹 없는 게임" 절·env 가이드·docs/README 색인·계획서 완료 표기

## 검증 (필수)

```bash
npm run check:release                    # 전체 게이트 (신규 2본 포함)
node scripts/test-word-logic.js          # 단독 성공 한 줄
node scripts/test-word-api.js
node scripts/test-webgame-link-flow.js   # 무수정 통과 (하위 호환 증명)
node scripts/test-webgame-api.js
node scripts/test-webgame-social-flow.js
node scripts/test-webgame-social-api.js
node scripts/test-match3-logic.js        # 무수정 통과 (기존 게임 무접촉 증명)
node scripts/test-idle-logic.js
node scripts/test-deck-logic.js
```

브라우저 확인은 **반드시 adminServer 경유**(임시 정적 서버 금지), 모바일 뷰포트 375×812 기본:

```bash
ADMIN_DASHBOARD_ENABLED=true ADMIN_DASHBOARD_PASSWORD=x node -e "require('./src/adminServer').startAdminServer({ port: 3300 })"
```

- 성공 경로 풀 플레이(연결 상태) → 분포에 반영, 실패 경로(6회 소진) → 실패 카피·정답 미공개
- 새로고침 이어보기, 결과 복사 버튼 출력물 확인(이모지 그리드 + dayKey, 정답 없음)
- 미연결(시크릿): 전 기능 플레이 가능, 분포에 미반영 확인
- DevTools Network에서 모든 응답 본문에 정답 문자열이 없는지 확인
- 기존 게임 3종 회귀 없음(각 1회 로드·daily 화면), 콘솔 에러 0, 첫 화면 전송량 ≤ 400KB 실측

## 보고 형식

1. 커밋 해시 6개와 각 내용
2. `check:release` 결과, 기존 테스트 7본 무수정 통과 여부
3. 단어 풀 통계(풀/사전 개수)와 무작위 표본 30개 (톤 검수용)
4. 신규 참여자 카피 전체 목록
5. 첫 화면 전송량 실측 (400KB 대비)
6. 계획서 대비 다르게 구현했거나 해석이 필요했던 지점
7. 수정 가능 파일 목록 밖을 건드렸다면 그 사유
