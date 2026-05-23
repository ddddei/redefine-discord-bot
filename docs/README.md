# 프로젝트 리디파인 디스코드 봇 운영 문서

프로젝트 리디파인 디스코드 봇과 서버 운영에 필요한 문서들을 한눈에 찾을 수 있도록 정리한 인덱스 문서입니다.

## 1. 문서 사용 방법

운영 상황에 따라 필요한 문서를 먼저 찾아보면 됩니다.

참여자 입장 전에는 공지문, 문의 대응 문구, 릴리즈 체크리스트를 함께 확인해 주세요. 운영 중에는 운영 가이드와 문의 대응 템플릿을 참고하면 좋습니다. FAQ나 지식창고 데이터를 수정한 뒤에는 테스트 가이드와 운영 가이드에 따라 검증해 주세요. 배포 전후에는 릴리즈 체크리스트로 빠진 항목이 없는지 확인하는 것을 권장합니다.

코드나 데이터 수정 여부에 따라 확인할 문서가 달라질 수 있습니다. 문서만 수정한 경우에도 `git status --short`와 `git diff --stat`으로 변경 범위를 확인해 주세요.

## 2. 빠른 문서 안내표

| 문서명 | 용도 | 언제 사용하는지 | 주요 확인 내용 |
| --- | --- | --- | --- |
| [operation-guide.md](operation-guide.md) | 평소 운영 루틴과 수정 절차 안내 | 운영 중, 데이터 수정 전후, 문의 대응 흐름 확인 시 | 운영 점검표, 데이터 수정 루틴, 검증 명령어, 운영 시 주의사항 |
| [prelaunch-automation-audit.md](prelaunch-automation-audit.md) | 운영 전 자동 점검 리포트 | 참여자 입장 전 자동화에 맡길 작업과 수동 확인 작업을 구분할 때 | 구현 기능 요약, 운영 문서 현황, 남은 작업, 자동화 적합/위험 작업, 다음 개발 후보 |
| [testing-guide.md](testing-guide.md) | 로컬 검증과 질문 매칭 테스트 안내 | 봇 기능, FAQ, Knowledge, 테스트 질문을 수정한 뒤 | `validate:data`, `test:questions`, 매칭 결과 해석, Fallback 확인 |
| [release-checklist.md](release-checklist.md) | 참여자 입장 전 최종 점검 | 운영 시작 직전, 배포 전후, 공지 게시 전 | 환경 설정 확인, 데이터 검증, 명령어 점검, 운영 준비 상태 |
| [participant-notice-pack.md](participant-notice-pack.md) | 디스코드 공지 채널에 올릴 안내문 모음 | 참여자 입장 전, 공지 채널 세팅 시 | 첫 안내문, 봇 사용 안내, 커뮤니티 약속, 문의 방법, 채널별 안내문 |
| [operator-response-templates.md](operator-response-templates.md) | 운영진 문의 대응 문구 모음 | 문의 채널, DM, 익명고민채널, 봇 질문로그 확인 후 | 답변 템플릿, 민감 상황 대응, 신고 대응, 내부 확인 체크리스트 |
| [incident-response-guide.md](incident-response-guide.md) | 운영 문제 상황 대응 절차 | 봇 오류, 배포 오류, 권한 문제, 커뮤니티 안전 문제가 발생했을 때 | 빠른 확인 순서, 기술 문제 대응, 안전 문제 대응, 대응 후 기록 |
| [onboarding-role-channel-plan.md](onboarding-role-channel-plan.md) | 72시간 온보딩 역할/채널 구조 설계안 | 선발 참여자 입장 전, 온보딩 밀도와 채널 공개 범위를 정할 때 | 내부 분류, 공개 역할명, 역할별 채널 공개 예시, 72시간 흐름 |
| [onboarding-operation-runbook.md](onboarding-operation-runbook.md) | 72시간 온보딩 운영 런북 | 선발 참여자 60명을 초대하고 입장 후 72시간 운영 절차를 확인할 때 | 초대 전 체크리스트, 시간대별 운영, 역할별 확인 포인트, 전환 기준 |
| [onboarding-message-pack.md](onboarding-message-pack.md) | 72시간 온보딩 운영 메시지 패키지 | 입장 직후부터 72시간 이후 전환까지 실제 공지, DM, 문의 답변을 준비할 때 | 시간대별 공지, 역할별 안내, 문의 대응, DM 템플릿, 게시 순서 |
| [discord-permission-setup-guide.md](discord-permission-setup-guide.md) | Discord 역할/채널 권한 수동 세팅 가이드 | 실제 서버에서 온보딩 역할과 채널 권한을 수동으로 설정하기 전 | 권장 역할, 채널 공개 범위, 운영진 전용 채널 숨김, 봇 권한, 테스트 체크리스트 |
| [api-rag-plan.md](api-rag-plan.md) | 향후 API/RAG 연동 설계안 | OpenAI/Gemini API 또는 RAG 도입을 검토할 때 | 권장 답변 흐름, 개인정보 원칙, 프롬프트 방향, 단계별 도입 계획 |
| [knowledge-audit.md](knowledge-audit.md) | FAQ와 Knowledge 역할 구분 기준 | FAQ/Knowledge 중복 정리, 질문 매칭 품질 점검 시 | 중복 주제 분리, keywords 보강 후보, FAQ와 Knowledge 역할 기준 |

## 3. 상황별 추천 문서

### 참여자 입장 전

- [release-checklist.md](release-checklist.md)
- [onboarding-role-channel-plan.md](onboarding-role-channel-plan.md)
- [onboarding-operation-runbook.md](onboarding-operation-runbook.md)
- [onboarding-message-pack.md](onboarding-message-pack.md)
- [discord-permission-setup-guide.md](discord-permission-setup-guide.md)
- [participant-notice-pack.md](participant-notice-pack.md)
- [operator-response-templates.md](operator-response-templates.md)

선발 참여자 입장 전에는 온보딩 역할/채널 구조, 72시간 운영 런북, 온보딩 메시지 패키지, Discord 권한 수동 세팅 가이드를 먼저 확인한 뒤, 참여자에게 보일 공지와 운영진 내부 대응 문구를 준비하고, 릴리즈 체크리스트로 최종 상태를 확인해 주세요.

### 봇 기능이나 데이터 수정 후

- [testing-guide.md](testing-guide.md)
- [operation-guide.md](operation-guide.md)
- [release-checklist.md](release-checklist.md)

수정 후에는 데이터 검증과 질문 매칭 결과를 확인하고, 운영에 영향을 주는 변경이라면 릴리즈 체크리스트까지 확인해 주세요.

### FAQ 또는 지식창고를 수정할 때

- [knowledge-audit.md](knowledge-audit.md)
- [testing-guide.md](testing-guide.md)
- [operation-guide.md](operation-guide.md)

FAQ는 짧은 즉답, Knowledge는 프로그램 구조와 운영 원칙 설명이라는 역할을 유지해 주세요. keywords를 수정한 뒤에는 질문 매칭 결과를 확인합니다.

### 디스코드 공지를 올릴 때

- [participant-notice-pack.md](participant-notice-pack.md)
- [onboarding-message-pack.md](onboarding-message-pack.md)
- [operation-guide.md](operation-guide.md)

공지 문구는 상황에 맞게 날짜, 장소, 링크, 채널명만 수정해서 사용하면 됩니다. 72시간 온보딩 중 게시할 메시지는 온보딩 메시지 패키지를 함께 확인해 주세요. 확정되지 않은 내용은 운영진 확인 후 게시해 주세요.

### 참여자 문의에 답변할 때

- [operator-response-templates.md](operator-response-templates.md)
- [knowledge-audit.md](knowledge-audit.md)

운영진 답변은 참여자를 평가하거나 압박하지 않는 톤을 유지해 주세요. FAQ/Knowledge에 반영할 만한 반복 질문은 knowledge audit 기준으로 정리합니다.

### 운영 시작 직전 최종 점검

- [release-checklist.md](release-checklist.md)

참여자 입장 전에는 릴리즈 체크리스트를 기준으로 환경, 데이터, 명령어, 공지, 운영 대응 준비 상태를 확인해 주세요.

### 운영 중 문제 상황이 생겼을 때

- [incident-response-guide.md](incident-response-guide.md)

봇 오류, 배포 실패, 권한 문제, 커뮤니티 안전 문제, 위기 표현이 포함된 메시지는 문제 상황 대응 가이드를 먼저 확인해 주세요.

### API/RAG 연동을 검토할 때

- [api-rag-plan.md](api-rag-plan.md)

OpenAI/Gemini API 또는 RAG 구조는 기존 FAQ/Knowledge 흐름을 대체하지 않고 보조하는 방향으로 검토해 주세요.

## 4. 기본 운영 명령어 모음

```bash
git status --short
git diff --stat
npm run check:release
npm run validate:data
npm run test:questions
node --check src/index.js
node --check src/deploy-commands.js
```

참여자 입장 전이나 배포 전 최종 점검에는 `npm run check:release`로 기본 검사를 한 번에 실행합니다. 데이터만 수정한 경우에는 보통 `npm run validate:data`와 `npm run test:questions`를 우선 확인합니다. 코드 파일을 수정한 경우에는 `node --check` 명령어도 함께 실행해 주세요.

## 5. 운영 문서 수정 시 주의사항

- 문서만 수정하는 작업에서는 `src/*.js`, `data/*.json`, `package.json`, `.env`를 변경하지 않습니다.
- 실제 토큰, 실제 채널 ID, 실제 환경변수 값은 문서에 적지 않습니다.
- 운영 기준이 확정되지 않은 내용은 단정하지 않고 운영진 확인이 필요하다고 남깁니다.
- 참여자에게 보이는 문구는 따뜻하고 차분하게 작성하되, 안전과 개인정보 관련 내용은 명확하게 안내합니다.
