# Railway 환경변수 가이드

Railway에 리디파인 Discord 봇을 배포할 때 필요한 Variables, Public Domain, 관리자 대시보드 확인 순서를 정리한 문서입니다. 실제 토큰, 채널 ID, API Key, 관리자 비밀번호는 이 문서에 적지 않습니다.

## 1. 문서 목적

이 문서는 운영자가 Railway에서 봇 실행 환경과 읽기 전용 관리자 웹 대시보드를 설정할 때 확인할 기준입니다.

## 2. Railway Variables 설정 위치

```txt
Railway 프로젝트 -> 서비스 선택 -> Variables
```

변수를 추가하거나 수정한 뒤에는 서비스가 재배포되어야 새 값이 적용됩니다.

## 3. 필수 환경변수

```env
DISCORD_TOKEN=
CLIENT_ID=
GUILD_ID=
LOG_CHANNEL_ID=
OPERATION_BACKUP_REMINDER_ENABLED=false
OPERATION_BACKUP_REMINDER_TIME_KST=20:50
```

`DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`는 실제 운영 Discord 앱과 서버 기준으로 입력합니다. `LOG_CHANNEL_ID`는 기본 운영 로그와 fallback 알림을 받을 운영진 전용 채널로 설정합니다. `OPERATION_BACKUP_REMINDER_ENABLED=true`로 켜면 `OPERATION_BACKUP_REMINDER_TIME_KST` 시각에 `/운영내보내기` 확인 알림만 전송하며, 백업 파일은 자동 생성하지 않습니다.

## 4. 관리자 대시보드 환경변수

관리자 대시보드는 기본 비활성화입니다. 실제 운영에서 사용할 때만 아래 값을 Railway Variables에 설정합니다.

```env
ADMIN_DASHBOARD_ENABLED=true
ADMIN_DASHBOARD_PASSWORD=
ADMIN_DASHBOARD_TITLE=리디파인 운영 대시보드
```

`ADMIN_DASHBOARD_PASSWORD`에는 실제 관리자 비밀번호를 넣습니다. 코드, 문서, `.env.example`에는 실제 값을 남기지 않습니다.

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

`DAILY_MISSION_ANNOUNCEMENT_ENABLED`가 `true`일 때만 오늘의 미션 자동 안내가 동작합니다. `DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID`가 있으면 해당 채널에 안내를 보내고, 비어 있으면 `TODAY_MISSION_CHANNEL_ID`에 보냅니다. `DAILY_MISSION_ANNOUNCEMENT_HOUR`는 Asia/Seoul 기준 발송 시각이며 비어 있거나 잘못된 값이면 9시를 사용합니다. 봇 안내 메시지가 삭제되면 MEE6에서 봇 메시지 예외 처리 또는 안내 채널 분리 필요. 이 안내는 고정 문구이며 실제 active 미션 제목/설명/포인트를 담지 않습니다.

`TODAY_MISSION_AUTO_PUBLISH_ENABLED`가 `true`이면 매일 `TODAY_MISSION_AUTO_PUBLISH_HOUR`(Asia/Seoul 기준, 비어 있거나 잘못된 값이면 9시)에 그날 active 상태인 미션을 `TODAY_MISSION_CHANNEL_ID`에 자동으로 게시합니다. 미션 관리 허브의 `오늘의 미션 게시` 버튼과 같은 게시 기록(`reserveTodayMissionNoticePublication`)을 공유하므로 운영자가 먼저 수동으로 게시했거나 자동 게시가 먼저 실행됐어도 같은 날짜에 중복 게시되지 않습니다. active 미션이 없으면 아무것도 보내지 않고 조용히 건너뜁니다. 기본값은 `false`이므로 켜기 전까지는 동작이 바뀌지 않습니다.

오늘의 미션 채널에서는 원본 사진에 `MISSION_APPROVE_EMOJI`, `MISSION_REJECT_EMOJI`를 눌러도 반응 승인 기능이 동작하지 않습니다. 오늘의 미션은 `ACTIVITY_REVIEW_CHANNEL_ID`에 올라오는 검토 카드 버튼으로만 승인/반려합니다.

`MINIGAME_CHANNEL_ID`는 미니게임 버튼을 실행할 수 있는 전용 채널입니다. 설정되어 있으면 미니게임은 해당 채널에서만 처리되고, 다른 채널에서는 private/ephemeral 안내로 지정 채널 이용을 안내합니다. 비워 두면 기존처럼 채널 제한 없이 동작하지만, 실제 운영에서는 `#포인트로게임하기`처럼 운영진이 정한 전용 채널 ID를 설정하는 것을 권장합니다. 실제 채널 ID는 Railway Variables 또는 로컬 `.env`에만 저장하고 문서나 코드에 남기지 않습니다.

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
