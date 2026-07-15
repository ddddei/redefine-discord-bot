# Railway 환경변수 가이드

Railway에 리디파인 Discord 봇을 배포할 때 필요한 Variables, Public Domain, 관리자 대시보드 확인 순서를 정리한 문서입니다. 실제 토큰, 채널 ID, API Key, 관리자 비밀번호는 이 문서에 적지 않습니다.

## 1. 문서 목적

이 문서는 운영자가 Railway에서 봇 실행 환경과 읽기 전용 관리자 웹 대시보드를 설정할 때 확인할 기준입니다.

## 2. Railway Variables 설정 위치

```txt
Railway 프로젝트 -> 서비스 선택 -> Variables
```

변수를 추가하거나 수정한 뒤에는 서비스가 재배포되어야 새 값이 적용됩니다.

저녁 설정 작업 전후에는 저장소 루트에서 아래 진단을 실행합니다.

```bash
npm run check:prelaunch
npm run check:prelaunch -- --strict
```

첫 명령은 누락이 있어도 전체 보고서를 보여주며 정상 종료합니다. 설정을 마친 뒤 두 번째 strict 명령이 통과하는지 확인합니다. JSON 결과가 필요하면 `node scripts/check-prelaunch.js --json`을 사용합니다. 결과에는 환경변수 이름과 설정 여부만 나오며 실제 토큰, 비밀번호, 채널 ID, URL, 전체 데이터 경로는 출력되지 않습니다. 이 진단은 Discord/Railway API를 호출하지 않으므로 채널 권한, replica 수, Volume 연결, Slash Command 등록, 모바일·실계정 동작은 아래 QA 체크리스트에서 직접 확인해야 합니다.

## 3. 필수 환경변수

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
LOG_CHANNEL_ID=
OPERATION_BACKUP_REMINDER_ENABLED=false
OPERATION_BACKUP_REMINDER_TIME_KST=20:50
OPERATION_DATA_DIR=
PRODUCTION_DATA_STRICT=true
```

`DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`는 실제 운영 Discord 앱과 서버 기준으로 입력합니다. `LOG_CHANNEL_ID`는 기본 운영 로그와 fallback 알림을 받을 운영진 전용 채널로 설정합니다. `OPERATION_BACKUP_REMINDER_ENABLED=true`로 켜면 `OPERATION_BACKUP_REMINDER_TIME_KST` 시각에 `/운영내보내기` 확인 알림만 전송하며, 백업 파일은 자동 생성하지 않습니다.

운영 지연 요약은 `OPS_REMINDER_ENABLED=true`일 때만 작동합니다. `OPS_REMINDER_CHANNEL_ID`는 운영진 전용 채널 ID로 설정하고, `OPS_REMINDER_SLOTS=10:00`처럼 KST 슬롯을 최대 4개 지정합니다. 로컬 JSON 예약 이력을 사용하므로 Railway replica는 하나만 운영해야 합니다. `ADMIN_DASHBOARD_URL`은 `https://` 주소일 때만 메시지에 포함됩니다.

`OPERATION_DATA_DIR`에는 Railway 서비스에 연결한 영속 Volume의 mount 경로를 입력합니다. 개별 `POINTS_DATA_PATH` 같은 변수가 있으면 해당 파일만 개별 변수가 우선합니다. Volume 연결과 mount 경로를 확인한 뒤 `PRODUCTION_DATA_STRICT=true`로 재배포하면 Discord 로그인과 관리자 서버 시작 전에 쓰기·rename, JSON 파싱, example 혼입, 경로 중복을 검사합니다. 실제 mount 경로는 문서나 캡처에 남기지 않습니다.

재배포 전후에는 `node scripts/check-local-operation-data.js` 결과와 핵심 파일의 건수를 비교합니다. 새 Volume에서는 빈 상점으로 시작하고 첫 지급 후에도 example ID가 없어야 합니다.

## 4. 관리자 대시보드 환경변수

관리자 대시보드는 기본 비활성화입니다. 실제 운영에서 사용할 때만 아래 값을 Railway Variables에 설정합니다.

```env
ADMIN_DASHBOARD_ENABLED=true
ADMIN_DASHBOARD_PASSWORD=
ADMIN_DASHBOARD_TITLE=리디파인 운영 대시보드
```

`ADMIN_DASHBOARD_PASSWORD`에는 실제 관리자 비밀번호를 넣습니다. 코드, 문서, `.env.example`에는 실제 값을 남기지 않습니다.

## 4. DM 대화 연습 MVP

DM 대화 연습은 기본 비활성화입니다. 운영에서 켜려면 Railway Variables에 아래 값을 추가합니다.

```env
DM_CHAT_ENABLED=true
AI_ENABLED=true
AI_PROVIDER=openai
AI_MODEL=
OPENAI_API_KEY=
DM_CHAT_LOG_CHANNEL_ID=
DM_CHAT_HISTORY_LIMIT=8
DM_CHAT_DAILY_LIMIT=30
SAFETY_ALERT_THROTTLE_MINUTES=10
DM_CHAT_MEMBER_ONLY=true
DM_CHAT_BURST_LIMIT_PER_MINUTE=5
DM_CHAT_RETENTION_DAYS=90
DM_CHAT_CLEANUP_AUTO_ENABLED=false
DM_CHAT_CLEANUP_WEEKDAY=sunday
DM_CHAT_CLEANUP_TIME_KST=04:00
DM_SAFETY_REVIEWS_PATH=
DM_CHAT_CLEANUP_STATE_PATH=
```

`AI_MODEL`에는 운영자가 OpenAI Platform에서 사용할 모델명을 넣습니다. `OPENAI_API_KEY`와 실제 채널 ID는 Railway Variables 또는 로컬 `.env`에만 저장하고 문서, 코드, 캡처에 남기지 않습니다.

DM 대화는 첫 사용 시 기록/운영진 열람 안내를 자동 전송합니다. 모든 사용자 메시지와 봇 응답은 `DM_CHAT_LOG_PATH` 또는 기본 `data/dm-chat-logs.local.json`에 저장되고, `DM_CHAT_LOG_CHANNEL_ID`가 있으면 운영진 로그 채널에도 전송됩니다. `/admin`은 같은 로그에서 최근 DM 메시지를 읽기 전용으로 보여주며, 사용자 ID, 안전 감지 여부, 개수 필터를 지원합니다. 자해, 폭력, 괴롭힘, 긴급 위험 등 민감 표현은 `SAFETY_ALERT_CHANNEL_ID`가 있으면 해당 채널로, 없으면 `DM_CHAT_LOG_CHANNEL_ID` 또는 `LOG_CHANNEL_ID`로 알립니다. `SAFETY_ALERT_THROTTLE_MINUTES`는 같은 사용자 반복 안전 감지의 안전 알림 채널 전송만 묶는 시간이며 기본값은 10분입니다. 로그 저장, DM 로그 채널 전송, 참여자 안내는 스로틀하지 않습니다. 기존처럼 모든 안전 알림을 받으려면 `0`으로 설정합니다. `DM_CHAT_DAILY_LIMIT`는 KST 당일 사용자별 `role=user` 메시지 수 기준 상한이며, 미설정 또는 숫자가 아닌 값은 30으로 처리합니다. `0`으로 설정하면 일일 제한을 해제합니다. 상한 초과 시 AI를 호출하지 않고 "오늘은 연습을 충분히 했어요. 내일 다시 이어서 연습해요. 급한 일이나 어려운 일이 있다면 운영진에게 문의해 주세요."를 저장/전송합니다. 참여자가 DM에 정확히 `새로 시작`을 보내면 로그는 삭제하지 않고 이후 AI history 기준점만 초기화합니다.

`DM_CHAT_MEMBER_ONLY`(기본 `true`)는 `GUILD_ID`가 설정된 서버의 멤버만 DM 대화를 사용하도록 제한합니다. `GUILD_ID`가 없으면 이 값과 무관하게 제한이 적용되지 않습니다. 비멤버에게는 "이 DM 연습은 리디파인 참여자에게 열려 있어요."를 1회만 보내고 이후 침묵하며, AI 호출·안전 감지·기록을 하지 않습니다. 멤버 확인 API 오류는 허용 쪽으로 폴백하고 콘솔 경고를 남기므로 기존 사용자가 실수로 차단되지 않습니다. `false`로 설정하면 멤버 확인 자체를 끕니다.

`DM_CHAT_BURST_LIMIT_PER_MINUTE`(기본 `5`)는 롤링 60초 동안 사용자별 `role=user` 메시지 수 상한입니다. 초과 시 메시지는 그대로 저장·로그 전송되지만 AI는 호출하지 않고 "조금 천천히 이야기해요. 잠시 후 다시 보내 주세요."를 1분에 1회만 보냅니다. 민감 감지는 이 제한과 무관하게 항상 수행됩니다. `0`으로 설정하면 해제됩니다.

`DM_CHAT_RETENTION_DAYS`(기본 `90`, `0`이면 무기한)는 `scripts/cleanup-dm-chat-logs.js`가 사용하는 로그 보존 기간입니다. 안전 감지 레코드는 이 값과 무관하게 180일 상수를 적용합니다. 첫 안내문에는 이 값을 반영한 보존 기간과 AI 대화·역할 한계가 포함되며, 이전 안내만 받은 사용자는 최신 안내를 1회 다시 받습니다. 정리 절차는 `docs/dm-chat-operation-guide.md`를 참고합니다.

`DM_CHAT_CLEANUP_AUTO_ENABLED=true`이면 봇 단일 인스턴스가 KST 기준 지정 요일·시각에 주간 정리를 시도합니다. 기본은 `false`입니다. 잘못된 요일·시각은 `sunday`, `04:00`으로 돌아가며 경고를 남깁니다. 50% 초과 삭제, JSON 파싱 실패, 백업 사본 생성 실패, 보존 0일이면 자동 적용하지 않습니다. 큐와 정리 상태 경로는 개별 변수가 있으면 `OPERATION_DATA_DIR`보다 우선하므로 Volume 내부인지 확인합니다.

## 5. 채널/로그 환경변수

권장 변수:

```env
TODAY_MISSION_CHANNEL_ID=
DAILY_MISSION_REWARD_POINTS=20
DAILY_MISSION_ANNOUNCEMENT_ENABLED=false
DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID=
DAILY_MISSION_ANNOUNCEMENT_HOUR=9
TODAY_MISSION_AUTO_PUBLISH_ENABLED=false
TODAY_MISSION_AUTO_PUBLISH_HOUR=9
MISSION_SUBMISSION_CHANNEL_ID=
MINIGAME_CHANNEL_ID=
ACTIVITY_REVIEW_CHANNEL_ID=
POINT_REDEEM_CHANNEL_ID=
MISSION_REACTION_REWARD_POINTS=20
MISSION_APPROVE_EMOJI=✅
MISSION_REJECT_EMOJI=❌
SAFETY_ALERT_CHANNEL_ID=
```

`TODAY_MISSION_CHANNEL_ID`는 참여자가 글이나 첨부파일을 올리면 오늘의 미션 인증 후보로 자동 접수되는 채널입니다. 접수 알림은 `ACTIVITY_REVIEW_CHANNEL_ID`로 전송되고, 같은 사용자에게 같은 날짜의 오늘의 미션 포인트는 1회만 지급됩니다. `DAILY_MISSION_REWARD_POINTS`는 오늘의 미션 승인 시 기본 지급 포인트이며 비어 있거나 잘못된 값이면 20P를 사용합니다.

`DAILY_MISSION_ANNOUNCEMENT_ENABLED`가 `true`일 때만 오늘의 미션 자동 안내가 동작합니다. `DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID`가 있으면 해당 채널에 안내를 보내고, 비어 있으면 `TODAY_MISSION_CHANNEL_ID`에 보냅니다. `DAILY_MISSION_ANNOUNCEMENT_HOUR`는 Asia/Seoul 기준 발송 시각이며 비어 있거나 잘못된 값이면 9시를 사용합니다. 봇 안내 메시지가 삭제되면 Discord 자동 관리 설정에서 봇 메시지 예외 처리 또는 안내 채널 분리가 필요합니다. 이 안내는 고정 문구이며 실제 active 미션 제목/설명/포인트를 담지 않습니다.

`TODAY_MISSION_AUTO_PUBLISH_ENABLED`가 `true`이면 매일 `TODAY_MISSION_AUTO_PUBLISH_HOUR`(Asia/Seoul 기준, 비어 있거나 잘못된 값이면 9시)에 그날 active 상태인 미션을 `TODAY_MISSION_CHANNEL_ID`에 자동으로 게시합니다. 미션 관리 허브의 `오늘의 미션 게시` 버튼과 같은 게시 기록(`reserveTodayMissionNoticePublication`)을 공유하므로 운영자가 먼저 수동으로 게시했거나 자동 게시가 먼저 실행됐어도 같은 날짜에 중복 게시되지 않습니다. active 미션이 없으면 아무것도 보내지 않고 조용히 건너뜁니다. 기본값은 `false`이므로 켜기 전까지는 동작이 바뀌지 않습니다.

오늘의 미션 채널에서는 원본 사진에 `MISSION_APPROVE_EMOJI`, `MISSION_REJECT_EMOJI`를 눌러도 반응 승인 기능이 동작하지 않습니다. 오늘의 미션은 `ACTIVITY_REVIEW_CHANNEL_ID`에 올라오는 검토 카드 버튼으로만 승인/반려합니다.

`MINIGAME_CHANNEL_ID`는 미니게임 버튼을 실행할 수 있는 전용 채널입니다. 설정되어 있으면 미니게임은 해당 채널에서만 처리되고, 다른 채널에서는 private/ephemeral 안내로 지정 채널 이용을 안내합니다. 비워 두면 기존처럼 채널 제한 없이 동작하지만, 실제 운영에서는 `#포인트로게임하기`처럼 운영진이 정한 전용 채널 ID를 설정하는 것을 권장합니다. 실제 채널 ID는 Railway Variables 또는 로컬 `.env`에만 저장하고 문서나 코드에 남기지 않습니다.

웹게임 바로가기 링크 버튼은 아래 변수로 켭니다.

```env
WEBGAME_PUBLIC_BASE_URL=
```

Railway Public Domain의 `https://` 주소를 넣으면 미니게임 허브와 미니게임 채널 안내에 매치3/덱/간식 공방/오늘의 단어/생존전 링크 버튼이 표시됩니다. 비워두거나 `https://` 주소가 아니면 버튼이 표시되지 않으며, 이는 잘못된 링크가 참여자에게 노출되지 않게 하려는 동작입니다.

웹게임 공동 목표는 기본값으로도 동작합니다. 첫 주 운영 후 목표량을 조정하려면 아래 변수를 Railway Variables에 추가하고 재배포합니다.

```env
WEBGAME_COMMUNAL_GOAL=4000000000
WEBGAME_WORD_SALT=
```

비워두면 코드 기본값 `4000000000`을 사용합니다. 이 값은 간식 공방 키우기 주간 공동 목표 생산량이며, 매치3/덱 랭킹이나 포인트 자동 지급에는 영향을 주지 않습니다.

`WEBGAME_WORD_SALT`는 `오늘의 간식 단어`의 날짜별 정답 배정에 쓰는 비밀 salt입니다. 운영 환경에서는 임의의 긴 문자열을 Railway Variables에만 저장하는 것을 권장합니다. 비워두면 서버가 커밋되지 않는 `data/webgame-social.local.json`의 `cheerSalt`를 재사용하므로 기능은 동작하지만, 운영 환경별로 명시 값을 두면 백업/이전 시 정답 배정이 더 예측 가능하게 유지됩니다.

간식 공방 키우기 운영 이벤트 주간(생산 배수)은 아래 변수로 켭니다(docs/idle-improvement-plan.md 1.2절).

```env
WEBGAME_IDLE_EVENT_MULTIPLIER=2
WEBGAME_IDLE_EVENT_LABEL=이벤트 주간
```

`WEBGAME_IDLE_EVENT_MULTIPLIER`는 `1.5` / `2` / `3`만 유효한 값으로 인정합니다. 그 외 값(빈 값 포함)은 무효로 취급되어 `/game/api/goal` 응답의 `event` 필드가 `null`이 되고 게임은 평소처럼 1배로 동작합니다. `WEBGAME_IDLE_EVENT_LABEL`은 게임 화면에 노출할 안내 문구이며 비워두면 "이벤트 주간"을 사용합니다.

운영 권장 빈도는 월 1회 이하입니다. 공동 목표가 예상보다 빨리 채워지는 것은 배수를 켰을 때의 의도된 결과이며(달성률 조절 수단), 목표량(`WEBGAME_COMMUNAL_GOAL`)과 함께 조율해서 사용하세요. 방치형(idle)은 랭킹이 없는 장르라 배수로 인한 제출값 상승 자체는 무해하지만, 이상치 플래그(3배 휴리스틱)와 겹칠 수 있으므로 이벤트 주간에는 idle 참여 기록의 flagged 여부를 공동 목표 집계에서 그대로 신뢰하기보다 배수 주간임을 감안해 판단하는 것을 권장합니다(코드 변경 없는 운영 판단 영역).

서버 리플레이 검증(v2, [replay-verification-plan.md](replay-verification-plan.md))의 strict 전환 스위치입니다.

```env
WEBGAME_REPLAY_STRICT=
```

기본(비워두거나 `true`가 아닌 값)은 꺼져 있습니다. 매치3/덱 점수 제출이 재현 검증과 불일치(mismatch)해도 기록·대시보드 표시만 되고 랭킹에는 그대로 유지됩니다(클라이언트 버그로 인한 오탐이 참여자를 억울하게 차단하지 않도록 하는 배려 원칙). `true`로 설정하면 mismatch 기록이 즉시 `flagged: true`로 전환되어 랭킹에서 제외됩니다. 전환 기준은 [webgame-rankings-ops.md](webgame-rankings-ops.md)의 운영 결정 칸을 참고하세요.

운영 환경 점검 기준:

| 환경변수 | 기준 | 용도 |
| --- | --- | --- |
| `LOG_CHANNEL_ID` | 권장 | 기본 운영 로그와 fallback 알림 |
| `OPERATION_BACKUP_REMINDER_ENABLED` | 선택 | 운영 종료 전 `/운영내보내기` 확인 리마인더 |
| `OPERATION_BACKUP_REMINDER_TIME_KST` | 선택 | 백업 리마인더 전송 시각, 기본 `20:50` |
| `POINT_REDEEM_CHANNEL_ID` | 권장 | 교환 신청 및 처리 알림 |
| `ACTIVITY_REVIEW_CHANNEL_ID` | 권장 | 미션 인증 검토 카드와 승인/반려 흐름 |
| `TODAY_MISSION_CHANNEL_ID` | 권장 | 오늘의 미션/인증 업로드 채널 |
| `MINIGAME_CHANNEL_ID` | 권장 | 미니게임 전용 채널 제한 |
| `MISSION_SUBMISSION_CHANNEL_ID` | 선택 | 별도 인증 채널을 운영할 때 |
| `DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID` | 선택 | 별도 안내 채널을 운영할 때 |
| `SAFETY_ALERT_CHANNEL_ID` | 선택 | 민감 질문 알림을 기본 로그와 분리할 때 |
| `SAFETY_ALERT_THROTTLE_MINUTES` | 선택 | 같은 사용자 반복 DM 안전 알림 채널 전송 묶음 간격, 기본 10분, `0`이면 해제 |

`/운영현황`의 `환경 설정 점검`에서는 각 채널 환경변수의 설정 여부, 채널 ID, Discord 채널 조회 여부, 봇 접근 권한, 메시지 전송 권한을 확인합니다. 선택 항목이 미설정인 것은 오류가 아니라 현재 운영 방식 안내입니다.

## 5-1. 운영 보조 local JSON 경로

```env
OPERATOR_SUPPORT_DATA_PATH=
```

비워두면 `data/operator-support.local.json`을 사용합니다. 이 파일에는 `/안내`, `/포인트`, `/미션`, `/상점` 첫 사용 여부, 미션 인증 채널 1회 안내 기록, FAQ 후보 질문 묶음이 저장됩니다. 실제 운영 데이터이므로 `data/*.local.json`과 같이 커밋하지 않습니다.

## 6. Google Sheets 보조 로그 환경변수

Google Sheets append-only 운영 로그는 기본 비활성화입니다. Apps Script Web App을 준비한 운영 환경에서만 아래 값을 Railway Variables에 설정합니다.

```env
GOOGLE_SHEETS_LOGGING_ENABLED=false
GOOGLE_SHEETS_WEB_APP_URL=
GOOGLE_SHEETS_WEB_APP_SECRET=
```

`GOOGLE_SHEETS_LOGGING_ENABLED`가 `true`이고 Web App URL과 secret이 모두 있을 때만 포인트 거래와 미션 제출 접수 로그 append를 시도합니다. 실패해도 Discord의 기존 포인트 지급, 인증 접수, 승인/반려 흐름은 계속 진행됩니다. 실제 Web App URL과 secret은 문서, 코드, `.env.example`에 남기지 않습니다.

`/운영현황`의 `환경 설정 점검`에서는 `GOOGLE_SHEETS_LOGGING_ENABLED`가 `true`인지와 `GOOGLE_SHEETS_WEB_APP_URL`이 설정됐는지만 보여줍니다. 실제 Web App URL 전체값, secret, token은 표시하지 않습니다.

알림 채널 권장 구조:

```txt
LOG_CHANNEL_ID
- 기본 운영 로그
- fallback 로그
- 답변 실패 질문

ACTIVITY_REVIEW_CHANNEL_ID
- 미션 인증 검토
- 반응 승인/반려 처리 로그

POINT_REDEEM_CHANNEL_ID
- 교환 신청 알림
- 포인트 교환 처리 알림
```

채널 ID 가져오는 방법:

```txt
Discord 설정 -> 고급 -> 개발자 모드 ON
채널 우클릭 -> 채널 ID 복사
```

## 7. Public Domain 생성 방법

```txt
Railway 프로젝트 -> 서비스 선택 -> Settings -> Networking -> Public Networking -> Generate Domain
```

생성 후 관리자 대시보드는 아래 주소로 접속합니다.

```txt
https://생성된-Railway-도메인/admin
```

## 8. Redeploy 방법

Variables를 바꾼 뒤 Railway가 자동 재배포하지 않으면 서비스 화면에서 수동 Redeploy를 실행합니다. Slash Command 구조를 바꾸지 않은 환경변수 수정만으로는 `npm run deploy`를 실행하지 않습니다.

## 9. 확인 순서

1. Railway Variables에 필수 변수를 입력합니다.
2. 로그 채널, 인증 검토 채널, 교환 알림 채널 권한을 확인합니다.
3. `ADMIN_DASHBOARD_ENABLED=true`와 `ADMIN_DASHBOARD_PASSWORD`를 설정합니다.
4. Public Domain을 생성합니다.
5. `https://생성된-Railway-도메인/admin`에 접속합니다.
6. Basic Auth 비밀번호로 로그인합니다.
7. 대시보드 상단에 `읽기 전용 · local-json · example 데이터 제외` 안내가 보이는지 확인합니다.
8. 교환 대기, 인증 대기, 포인트 로그가 실제 운영 데이터 기준으로 표시되는지 확인합니다.

## 10. 문제 해결

- `/admin`이 열리지 않으면 `ADMIN_DASHBOARD_ENABLED=true`와 `ADMIN_DASHBOARD_PASSWORD` 설정 여부를 확인합니다.
- 401이 나오면 Basic Auth 비밀번호를 다시 확인합니다.
- Public Domain 접속이 안 되면 Railway Networking에서 도메인이 생성되어 있는지 확인합니다.
- 알림이 오지 않으면 봇이 채널을 볼 수 있고 메시지를 보낼 수 있는지 확인합니다.
- example 데이터가 대시보드에 보이면 `/api/admin/summary`의 `exampleRecordsExcluded` 값과 `data/*.local.json`에 남은 테스트 데이터를 확인합니다.
- `/admin`의 DM 대화 로그가 비어 있으면 `DM_CHAT_ENABLED=true`, `DM_CHAT_LOG_PATH`, 봇 DM 수신 권한, 실제 참여자 DM 발생 여부, 사용자 ID/안전 감지 필터 상태를 확인합니다.
- `/운영현황 종류:DM대화` 선택지가 보이지 않으면 대상 Discord 환경에서 `npm run deploy`를 실행했는지 확인합니다.
