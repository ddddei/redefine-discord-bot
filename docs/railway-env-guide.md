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
```

`DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`는 실제 운영 Discord 앱과 서버 기준으로 입력합니다. `LOG_CHANNEL_ID`는 기본 운영 로그와 fallback 알림을 받을 운영진 전용 채널로 설정합니다.

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
MISSION_SUBMISSION_CHANNEL_ID=
ACTIVITY_REVIEW_CHANNEL_ID=
POINT_REDEEM_CHANNEL_ID=
MISSION_REACTION_REWARD_POINTS=20
MISSION_APPROVE_EMOJI=✅
MISSION_REJECT_EMOJI=❌
```

`TODAY_MISSION_CHANNEL_ID`는 참여자가 글이나 첨부파일을 올리면 오늘의 미션 인증 후보로 자동 접수되는 채널입니다. 접수 알림은 `ACTIVITY_REVIEW_CHANNEL_ID`로 전송되고, 같은 사용자에게 같은 날짜의 오늘의 미션 포인트는 1회만 지급됩니다. `DAILY_MISSION_REWARD_POINTS`는 오늘의 미션 승인 시 기본 지급 포인트이며 비어 있거나 잘못된 값이면 20P를 사용합니다.

`DAILY_MISSION_ANNOUNCEMENT_ENABLED`가 `true`일 때만 오늘의 미션 자동 안내가 동작합니다. `DAILY_MISSION_ANNOUNCEMENT_CHANNEL_ID`가 있으면 해당 채널에 안내를 보내고, 비어 있으면 `TODAY_MISSION_CHANNEL_ID`에 보냅니다. `DAILY_MISSION_ANNOUNCEMENT_HOUR`는 Asia/Seoul 기준 발송 시각이며 비어 있거나 잘못된 값이면 9시를 사용합니다. 봇 안내 메시지가 삭제되면 MEE6에서 봇 메시지 예외 처리 또는 안내 채널 분리 필요.

오늘의 미션 채널에서는 원본 사진에 `MISSION_APPROVE_EMOJI`, `MISSION_REJECT_EMOJI`를 눌러도 반응 승인 기능이 동작하지 않습니다. 오늘의 미션은 `ACTIVITY_REVIEW_CHANNEL_ID`에 올라오는 검토 카드 버튼으로만 승인/반려합니다.

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

## 6. Public Domain 생성 방법

```txt
Railway 프로젝트 -> 서비스 선택 -> Settings -> Networking -> Public Networking -> Generate Domain
```

생성 후 관리자 대시보드는 아래 주소로 접속합니다.

```txt
https://생성된-Railway-도메인/admin
```

## 7. Redeploy 방법

Variables를 바꾼 뒤 Railway가 자동 재배포하지 않으면 서비스 화면에서 수동 Redeploy를 실행합니다. Slash Command 구조를 바꾸지 않은 환경변수 수정만으로는 `npm run deploy`를 실행하지 않습니다.

## 8. 확인 순서

1. Railway Variables에 필수 변수를 입력합니다.
2. 로그 채널, 인증 검토 채널, 교환 알림 채널 권한을 확인합니다.
3. `ADMIN_DASHBOARD_ENABLED=true`와 `ADMIN_DASHBOARD_PASSWORD`를 설정합니다.
4. Public Domain을 생성합니다.
5. `https://생성된-Railway-도메인/admin`에 접속합니다.
6. Basic Auth 비밀번호로 로그인합니다.
7. 대시보드 상단에 `읽기 전용 · local-json · example 데이터 제외` 안내가 보이는지 확인합니다.
8. 교환 대기, 인증 대기, 포인트 로그가 실제 운영 데이터 기준으로 표시되는지 확인합니다.

## 9. 문제 해결

- `/admin`이 열리지 않으면 `ADMIN_DASHBOARD_ENABLED=true`와 `ADMIN_DASHBOARD_PASSWORD` 설정 여부를 확인합니다.
- 401이 나오면 Basic Auth 비밀번호를 다시 확인합니다.
- Public Domain 접속이 안 되면 Railway Networking에서 도메인이 생성되어 있는지 확인합니다.
- 알림이 오지 않으면 봇이 채널을 볼 수 있고 메시지를 보낼 수 있는지 확인합니다.
- example 데이터가 대시보드에 보이면 `/api/admin/summary`의 `exampleRecordsExcluded` 값과 `data/*.local.json`에 남은 테스트 데이터를 확인합니다.
