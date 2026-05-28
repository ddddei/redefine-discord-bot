# Codex 작업 지시서

## 작업 이름

운영 안정화 QA 및 README 정리 v1

## 목표

프로젝트 리디파인 디스코드 봇에 지금까지 구현된 기능과 운영 흐름을 README와 문서에 정리한다.

현재 봇에는 참여자 기능, 운영자 기능, 여정 포인트 시스템, 교환, 체크인, 미션, 인증, 운영 현황, 상점/미션 관리, 운영 데이터 내보내기 기능까지 구현되어 있다.

이번 작업에서는 새로운 Slash Command나 기능을 추가하지 않는다.

이번 작업의 핵심은 다음과 같다.

* 루트 README.md 최신화
* docs/README.md 최신화
* 운영자용 명령어 가이드 정리
* 참여자용 명령어 가이드 정리
* 실제 운영 전 QA 체크리스트 작성
* 데이터 저장/백업 주의사항 정리
* 지금까지의 포인트 봇 구현 범위 정리
* 추후 Google Sheets, PostgreSQL, 웹 대시보드 연동 후보 정리

## 현재 구현된 주요 명령어

참여자 또는 일반 안내 명령어:

* /안내
* /채널안내
* /질문
* /리디
* /포인트
* /상점
* /교환
* /체크인
* /미션
* /인증

운영자 명령어:

* /공지
* /포인트관리
* /교환관리
* /포인트로그
* /인증관리
* /운영현황
* /미션관리
* /상점관리
* /운영내보내기

## 중요 주의사항

* 이번 작업에서는 기능을 추가하지 않는다.
* src/*.js 파일은 가능하면 수정하지 않는다.
* src/deploy-commands.js는 수정하지 않는다.
* package.json, package-lock.json은 수정하지 않는다.
* .env 파일은 수정하지 않는다.
* 실제 토큰, API Key, 실제 채널 ID, 실제 참여자 개인정보는 작성하지 않는다.
* data/*.local.json은 커밋하지 않는다.
* Railway, GitHub 설정은 변경하지 않는다.
* npm run deploy는 실행하지 않는다.
* git commit, git push는 하지 않는다.
* 문서에는 실제 운영 전 확인이 필요한 항목을 명확히 남긴다.
* local JSON 저장소는 MVP용이며 장기 운영 저장소가 아니라는 점을 명확히 적는다.
* Google Sheets, PostgreSQL, 웹 대시보드는 후속 검토 대상으로만 정리한다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

* README.md
* docs/README.md
* docs/operation-guide.md
* docs/journey-point-system-plan.md
* docs/point-data-structure-plan.md
* docs/export-and-backup-guide.md
* docs/operator-command-guide.md
* docs/participant-command-guide.md
* docs/prelaunch-qa-checklist.md
* docs/release-checklist.md
* prompts/codex/readme-and-ops-qa-v1.md

이미 존재하는 문서는 중복 생성하지 말고 필요한 만큼 보강한다.

## 작업 1. 루트 README.md 최신화

루트 README.md를 프로젝트 전체 소개 문서로 최신화한다.

README.md에는 아래 내용을 포함한다.

### 1. 프로젝트 소개

* 프로젝트 리디파인 디스코드 봇이라고 설명한다.
* 리디파인 참여자 안내, FAQ, 온보딩, 여정 포인트, 상점, 교환, 체크인, 미션, 인증, 운영자 관리 기능을 제공한다고 설명한다.
* MEE6는 환대와 채팅 EXP/레벨업 보조 용도로만 사용하고, 리디파인 봇은 실제 운영 기능을 담당한다고 정리한다.

### 2. 주요 기능

참여자 기능:

* 처음 안내 확인
* 채널 안내 확인
* FAQ/지식창고 질문
* 여정 포인트 확인
* 상점 확인
* 교환 신청
* 체크인
* 미션 확인
* 미션 인증 제출

운영자 기능:

* 공지 템플릿 확인
* 포인트 지급/차감
* 교환 신청 처리
* 포인트 로그 확인
* 인증 제출 승인/반려
* 운영 현황 확인
* 미션 관리
* 상점 관리
* 운영 데이터 내보내기

### 3. Slash Command 목록

참여자 명령어와 운영자 명령어를 표로 정리한다.

각 명령어마다 아래 항목을 포함한다.

* 명령어
* 대상
* 목적
* 공개 범위 또는 비고

주의:

* /포인트, /상점, /교환, /체크인, /미션, /인증은 본인만 보이는 응답 또는 private 응답 중심이라고 설명한다.
* 운영자 명령어는 ManageMessages 또는 Administrator 권한 기준이라고 설명한다.

### 4. 여정 포인트 운영 흐름

아래 흐름을 정리한다.

* 참여자 체크인
* 미션 확인
* 인증 제출
* 운영자 인증 승인
* 포인트 지급
* 상점 확인
* 교환 신청
* 운영자 실지급
* 교환 완료 처리
* 로그/내보내기

### 5. 데이터 저장 방식

아래 내용을 포함한다.

* 현재 MVP는 local JSON repository 구조를 사용한다.
* data/*.local.json은 운영 데이터 파일이므로 커밋하지 않는다.
* local JSON은 Railway 장기 운영 저장소로는 한계가 있다.
* 실제 운영 전에는 Railway Volume, Google Sheets, PostgreSQL 중 하나를 검토해야 한다.
* /운영내보내기로 데이터를 백업할 수 있다.

### 6. 개발 및 실행 방법

기존 프로젝트 구조에 맞게 아래 명령어를 정리한다.

* npm install
* npm start
* npm run deploy
* npm run validate:data
* npm run test:questions
* npm run check:release

주의:

* npm run deploy는 Slash Command 등록/갱신이 필요할 때만 실행한다고 설명한다.
* 기능 코드를 수정하고 push하면 Railway가 재배포될 수 있지만, Slash Command 목록 변경은 별도 deploy가 필요하다고 설명한다.

### 7. 검증 명령어

현재 사용 중인 검증 명령어를 정리한다.

* node scripts/test-points-store.js
* node scripts/test-points-repository.js
* node scripts/test-point-activity-flow.js
* node scripts/test-admin-management-flow.js
* node scripts/test-operation-export-flow.js
* npm run validate:data
* npm run test:questions
* npm run check:release

### 8. prompts 사용 방식

prompts/codex 폴더 사용 방식을 간단히 설명한다.

* Codex CLI 작업 지시서를 보관하는 폴더
* 재사용 가능한 프롬프트만 보관
* 실제 토큰, 채널 ID, 개인정보는 넣지 않음
* 작업 후 결과 문서는 docs에 정리

### 9. 현재 구현 범위와 후속 과제

현재 구현된 범위:

* 디스코드 내부 운영 MVP
* 여정 포인트
* 교환
* 체크인
* 미션/인증
* 운영자 관리
* 데이터 내보내기

후속 과제:

* 문구/UX 다듬기
* 실제 운영 전 QA
* Google Sheets 연동 검토
* PostgreSQL 또는 Railway Volume 검토
* 운영자 웹 대시보드 검토
* 참여자 안내 문서/공지 템플릿 보강

## 작업 2. docs/README.md 최신화

docs/README.md에 현재 문서 목록을 정리한다.

아래 문서가 있으면 링크와 설명을 정리한다.

* journey-point-system-plan.md
* point-data-structure-plan.md
* operation-guide.md
* export-and-backup-guide.md
* operator-command-guide.md
* participant-command-guide.md
* prelaunch-qa-checklist.md
* release-checklist.md
* 그 외 기존 문서

문서 설명은 짧고 명확하게 작성한다.

## 작업 3. 운영자 명령어 가이드 작성

docs/operator-command-guide.md 파일을 새로 만들거나 기존 문서가 있으면 보강한다.

문서 제목:

# 운영자 명령어 가이드

포함 내용:

* 운영자 명령어 전체 목록
* 각 명령어 목적
* 사용 상황
* 주요 옵션
* 처리 순서
* 주의사항

포함할 명령어:

* /공지
* /포인트관리
* /교환관리
* /포인트로그
* /인증관리
* /운영현황
* /미션관리
* /상점관리
* /운영내보내기

각 명령어별로 아래 구조로 정리한다.

* 언제 사용하나
* 기본 사용 흐름
* 확인해야 할 점
* 실수 방지 포인트

특히 아래 내용을 명확히 쓴다.

* /교환관리 완료는 실제 청년동 포인트 또는 리워드 지급 후 처리한다.
* /교환관리 취소/환불은 단순 변심용이 아니라 시스템 오류, 중복 신청, 운영진 사유 등 예외 상황용이다.
* /인증관리 승인은 포인트 지급과 연결된다.
* /운영내보내기 결과에는 개인정보나 운영 데이터가 포함될 수 있으므로 외부 공유에 주의한다.

## 작업 4. 참여자 명령어 가이드 작성

docs/participant-command-guide.md 파일을 새로 만들거나 기존 문서가 있으면 보강한다.

문서 제목:

# 참여자 명령어 가이드

포함 내용:

* 참여자가 사용할 수 있는 명령어 목록
* 각 명령어 목적
* 사용 상황
* 응답 공개 범위
* 안내 문구 톤

포함할 명령어:

* /안내
* /채널안내
* /질문
* /리디
* /포인트
* /상점
* /교환
* /체크인
* /미션
* /인증

주의:

* 참여자에게 포인트를 경쟁이나 순위처럼 설명하지 않는다.
* /포인트는 본인만 확인할 수 있다고 설명한다.
* /상점은 본인이 필요할 때 직접 확인하는 방식이라고 설명한다.
* /교환 신청 후 단순 변심 취소/환불은 원칙적으로 어렵다고 설명한다.
* /인증은 제출 후 운영자 승인 시 포인트가 지급된다고 설명한다.

## 작업 5. 실제 운영 전 QA 체크리스트 작성

docs/prelaunch-qa-checklist.md 파일을 새로 만든다.

문서 제목:

# 실제 운영 전 QA 체크리스트

포함 내용:

### 1. 환경변수 확인

* DISCORD_TOKEN
* CLIENT_ID
* GUILD_ID
* LOG_CHANNEL_ID
* POINT_REDEEM_CHANNEL_ID
* ACTIVITY_REVIEW_CHANNEL_ID
* POINTS_DATA_PATH
* SHOP_ITEMS_DATA_PATH
* REDEMPTIONS_DATA_PATH
* MISSIONS_DATA_PATH
* SUBMISSIONS_DATA_PATH

실제 값은 적지 않는다.

### 2. Discord 권한 확인

* 봇 초대 권한
* Slash Command 등록 여부
* 운영자 권한
* ManageMessages 또는 Administrator 권한
* 운영자 전용 채널 접근 권한
* 로그/알림 채널 접근 권한

### 3. 참여자 명령어 테스트

* /안내
* /채널안내
* /질문
* /리디
* /포인트
* /상점
* /교환
* /체크인
* /미션
* /인증

각 명령어마다 예상 결과를 간단히 적는다.

### 4. 운영자 명령어 테스트

* /공지
* /포인트관리
* /교환관리
* /포인트로그
* /인증관리
* /운영현황
* /미션관리
* /상점관리
* /운영내보내기

각 명령어마다 예상 결과를 간단히 적는다.

### 5. 포인트 흐름 테스트

* 운영자가 포인트 지급
* 참여자가 포인트 확인
* 참여자가 상점 확인
* 참여자가 교환 신청
* 운영자가 교환 완료 처리
* 포인트로그 확인
* 운영내보내기 확인

### 6. 체크인/미션/인증 흐름 테스트

* 참여자가 체크인
* 중복 체크인 방지 확인
* 운영자가 미션 추가
* 운영자가 미션 활성화
* 참여자가 미션 확인
* 참여자가 인증 제출
* 운영자가 인증 승인
* 포인트 지급 확인
* 반려 처리 확인

### 7. 데이터 백업 확인

* /운영내보내기 요약
* /운영내보내기 JSON
* /운영내보내기 CSV
* 백업 파일 보관 위치
* 개인정보 포함 여부 확인

### 8. 배포 확인

* npm run check:release 통과
* git status --short 깨끗함
* git push 완료
* Railway success 확인
* npm run deploy 필요 여부 확인

## 작업 6. operation-guide 보강

docs/operation-guide.md를 보강한다.

포함 내용:

* 전체 운영 순서
* 실제 운영 하루 전 점검
* 운영 중 확인할 명령어
* 운영 종료 후 백업
* 교환 신청 처리 루틴
* 인증 제출 처리 루틴
* 데이터 내보내기 루틴
* 장애 또는 오류 발생 시 확인 순서

## 작업 7. export-and-backup-guide 보강

docs/export-and-backup-guide.md가 있다면 보강한다.

포함 내용:

* README와 중복되지 않게 실무적인 백업 루틴 중심으로 보강
* 언제 백업할지
* 어떤 형식으로 받을지
* 파일을 어디에 보관할지
* 외부 공유 시 개인정보 확인
* Google Sheets 연동 전까지의 임시 운영 기준

## 작업 8. release-checklist 보강

docs/release-checklist.md가 있다면 최신 검증 명령어와 배포 기준을 반영한다.

포함 내용:

* Slash Command 추가/변경 시 npm run deploy 필요
* 문서만 수정한 경우 npm run deploy 불필요
* data/*.local.json 커밋 금지
* prompts/codex는 재사용 가능한 지시서만 커밋
* check:release 통과 후 커밋
* Railway success 확인
* Discord 실제 명령어 확인

## 작업 9. 검증

작업 완료 후 아래 명령어를 실행한다.

* npm run validate:data
* npm run test:questions
* npm run check:release

이번 작업은 문서 중심이므로 별도 smoke test를 새로 추가하지 않아도 된다.

주의:

* npm run deploy는 실행하지 않는다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

* 변경된 파일 목록
* README.md에 반영한 주요 내용
* docs/README.md에 추가한 문서 링크
* 새로 작성한 문서 목록
* 운영자 명령어 가이드 요약
* 참여자 명령어 가이드 요약
* 실제 운영 전 QA 체크리스트 요약
* operation-guide 보강 내용
* release-checklist 보강 내용
* npm run validate:data 결과
* npm run test:questions 결과
* npm run check:release 결과
* 기능 코드는 수정하지 않았다는 점
* Slash Command를 추가하지 않았다는 점
* npm run deploy는 실행하지 않았다는 점
