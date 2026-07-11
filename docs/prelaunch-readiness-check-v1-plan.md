# 운영 전 통합 점검 자동화 v1 계획서

**상태: 코드·자동 검증 완료, 실환경 QA 대기 (2026-07-11)**

## 목적

Railway·Discord 실환경 QA 전에 환경변수, 기능별 의존성, 운영 데이터 경로, 수동 확인 항목을 한 명령으로 정리해 저녁 설정 작업의 누락과 반복 확인을 줄인다.

## 범위

- `npm run check:prelaunch` 읽기 전용 진단 명령
- 필수·권장·선택 환경변수의 설정 여부만 점검
- 기능 flag가 켜졌을 때 필요한 채널·토큰·URL 의존성 검사
- `runOperationDataPreflight`를 재사용한 Volume 경로 쓰기/rename·JSON·example·경로 중복 검사
- 관리자 콘솔, 백업, DM, Phase 3 리마인더, 주간 리포트의 활성화 상태 요약
- Discord 권한, Slash Command 등록, 모바일·실계정 리허설처럼 로컬에서 확인할 수 없는 항목을 수동 작업 목록으로 출력
- `--json` 기계 판독 결과와 `--strict`일 때 blocker 기반 비정상 종료
- 릴리스 게이트에는 고정 테스트 환경의 진단기 테스트만 포함하고 실제 운영 env 상태는 포함하지 않음

## 보안·비변경 계약

- 토큰, secret, 비밀번호, 채널/사용자 ID, URL 전체값, 데이터 디렉터리 전체 경로를 출력하지 않는다.
- 환경변수나 파일 내용을 생성·수정·삭제하지 않는다. preflight의 임시 쓰기/rename probe는 기존 구현대로 즉시 제거한다.
- Discord API·Railway API·외부 네트워크를 호출하지 않는다.
- 기본 실행은 blocker가 있어도 보고서를 보여주고 exit 0, CI나 배포 전 강제 점검은 `--strict`에서만 exit 1을 사용한다.

## 완료 기준

고정 fixture에서 blocker/warning/manual 분류와 민감값 비노출, 파일 checksum·mtime 불변, JSON 출력, strict exit 정책을 자동 검증하고 운영 문서에 저녁 실행 순서를 기록한다.

## 구현 결과

- `npm run check:prelaunch`는 차단·경고·기능 상태·수동 확인 목록을 출력하며 기본 실행은 차단 항목이 있어도 exit 0이다.
- `npm run check:prelaunch -- --json`은 동일 결과를 JSON으로 출력한다. npm 자체 실행 배너 없이 순수 JSON만 필요한 자동화에서는 `node scripts/check-prelaunch.js --json`을 사용한다.
- `npm run check:prelaunch -- --strict`는 차단 항목이 있을 때 exit 1을 반환한다.
- 토큰·비밀번호·채널 ID·URL·전체 데이터 경로와 운영 파일 내용은 결과에 포함하지 않는다.
- Discord 권한, Railway replica·Volume 연결, Slash Command, 모바일·실계정 흐름은 자동 통과로 표시하지 않고 수동 확인 목록으로 유지한다.
