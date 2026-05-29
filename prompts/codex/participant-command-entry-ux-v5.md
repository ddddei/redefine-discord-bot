# Codex 작업 지시서

## 작업 이름

참여자 명령어 진입 UX 개선 v5

## 목표

프로젝트 리디파인 디스코드 봇의 참여자 명령어 진입 흐름을 개선한다.

현재 `/상점`과 `/미션`은 선택형 UX로 개선되었지만, `/교환`과 `/인증` 명령어는 여전히 참여자가 항목 코드나 미션 코드를 직접 입력해야 하는 구조가 남아 있다.

이번 작업에서는 `/교환`과 `/인증`을 입력했을 때도 참여자가 ID나 코드를 몰라도 자연스럽게 선택 메뉴로 이어지도록 만든다.

핵심 목표:

- `/교환`을 항목 없이 실행하면 교환 가능한 항목 선택 메뉴를 보여준다.
- `/교환 항목:S001` 기존 직접 입력 방식은 유지한다.
- `/인증`을 미션 없이 실행하면 참여 가능한 미션 선택 메뉴를 보여준다.
- `/인증 미션:M001 내용:...` 기존 직접 입력 방식은 유지한다.
- `/인증`의 첨부파일 제출 흐름은 유지한다.
- 참여자 화면에서는 “ID” 표현을 줄이고 “항목”, “미션”, “신청 코드”, “미션 코드” 정도로 표현한다.
- `/교환`, `/인증` 명령어 입력 단계에서 필수 입력 때문에 막히는 느낌을 줄인다.

이번 작업에서는 Google Sheets 연동, PostgreSQL 연동, 웹 관리자 페이지는 구현하지 않는다.

## 현재 전제

현재 참여자 명령어:

- /포인트
- /상점
- /교환
- /체크인
- /미션
- /인증

현재 운영자 명령어:

- /포인트관리
- /교환관리
- /포인트로그
- /인증관리
- /운영현황
- /미션관리
- /상점관리
- /운영내보내기

현재 UX:

- /상점 → 선택 메뉴 → 교환 확인 → 교환 신청
- /미션 → 선택 메뉴 → 인증 모달
- /교환 항목:S001 직접 입력 가능
- /인증 미션id:M001 내용:... 직접 입력 가능
- /인증 첨부파일 옵션 존재

## 중요 주의사항

- 기존 명령어 이름은 변경하지 않는다.
- 새 Slash Command는 추가하지 않는다.
- 단, 기존 `/교환`, `/인증` 옵션의 required 여부와 표시명은 수정할 수 있다.
- `.env` 파일은 수정하지 않는다.
- 실제 토큰, 실제 채널 ID, 실제 개인정보는 작성하지 않는다.
- `data/*.local.json`은 커밋하지 않는다.
- package.json, package-lock.json은 수정하지 않는다.
- Railway, GitHub 설정은 변경하지 않는다.
- Google Sheets 연동은 구현하지 않는다.
- PostgreSQL 연동은 구현하지 않는다.
- 웹 관리자 페이지는 구현하지 않는다.
- npm run deploy는 실행하지 않는다.
- git commit, git push는 하지 않는다.
- Slash Command 옵션 변경이 있으므로 작업 후 사용자가 직접 npm run deploy를 실행해야 한다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

- src/deploy-commands.js
- src/handlers.js
- src/embeds.js
- src/components.js
- src/pointsRepository.js
- src/pointsStore.js
- src/logging.js
- scripts/test-participant-ux-flow.js
- scripts/test-point-activity-flow.js
- scripts/check-release.js
- docs/participant-command-guide.md
- docs/prelaunch-qa-checklist.md
- docs/operation-guide.md
- README.md
- prompts/codex/participant-command-entry-ux-v5.md

## 작업 1. /교환 항목 옵션을 선택 사항으로 변경

src/deploy-commands.js에서 `/교환` 명령어의 `항목` 옵션을 required false로 변경한다.

설명도 부드럽게 바꾼다.

권장 설명:

- 명령어 설명: 여정 포인트로 교환할 항목을 선택합니다.
- 항목 옵션 설명: 신청 코드를 알고 있다면 입력해 주세요. 비워두면 목록에서 선택할 수 있어요.

주의:

- 기존 `/교환 항목:S001` 방식은 계속 동작해야 한다.
- 기존 내부 item.id 입력도 계속 동작해야 한다.
- 항목을 입력하지 않은 경우 에러가 아니라 선택 메뉴를 보여줘야 한다.

## 작업 2. /교환만 입력했을 때 상점 선택 메뉴 표시

src/handlers.js에서 `/교환` 처리 로직을 수정한다.

흐름:

1. 사용자가 `/교환` 실행
2. 항목 옵션이 비어 있으면 active 상점 항목을 조회한다.
3. 교환 가능한 항목이 있으면 `/상점`과 같은 선택 메뉴를 보여준다.
4. 선택 메뉴에서 항목 선택 시 기존 교환 확인 화면으로 이어진다.
5. 항목이 없으면 부드럽게 안내한다.

권장 안내:

지금 교환할 수 있는 항목이 없어요.  
운영진이 새 항목을 열면 이곳에서 확인할 수 있어요.

주의:

- `/상점`의 선택 메뉴 생성 helper를 재사용한다.
- 중복 코드를 줄인다.
- 응답은 ephemeral로 유지한다.
- 포인트는 선택 단계에서 차감하지 않는다.

## 작업 3. /인증 옵션을 선택 사항으로 변경

src/deploy-commands.js에서 `/인증` 명령어 옵션을 조정한다.

기존 `미션id` 표현은 참여자에게 딱딱하다.

가능하면 옵션 이름을 `미션`으로 변경한다.

옵션 권장:

- 미션: string, required false
  - 설명: 미션 코드를 알고 있다면 입력해 주세요. 비워두면 목록에서 선택할 수 있어요.
- 내용: string, required false
  - 설명: 인증 내용을 짧게 적어 주세요.
- 첨부파일: attachment, required false
  - 설명: 사진이나 영상 인증이 필요한 경우 첨부해 주세요.

주의:

- 기존 코드에서 `미션id`를 참조하고 있다면 backward compatibility를 고려한다.
- Discord Slash Command 옵션 이름이 바뀌면 실제 등록도 바뀌므로 작업 후 npm run deploy가 필요하다.
- 가능하면 handler에서 `미션`과 기존 `미션id` 모두 읽을 수 있게 방어한다.

## 작업 4. /인증만 입력했을 때 미션 선택 메뉴 표시

src/handlers.js에서 `/인증` 처리 로직을 수정한다.

흐름:

1. 사용자가 `/인증`만 실행
2. 미션 옵션이 비어 있으면 active 미션을 조회한다.
3. active 미션이 있으면 `/미션`과 같은 선택 메뉴를 보여준다.
4. 선택 메뉴에서 미션 선택 시 기존 인증 모달로 이어진다.
5. active 미션이 없으면 부드럽게 안내한다.

권장 안내:

지금 바로 참여할 수 있는 미션은 없어요.  
운영진이 새 미션을 열면 이곳에서 확인할 수 있어요.  
오늘은 `/체크인`으로 가볍게 기록을 남겨도 괜찮아요.

주의:

- `/미션`의 선택 메뉴 생성 helper를 재사용한다.
- 응답은 ephemeral로 유지한다.
- 모달은 텍스트 인증용이다.
- 첨부파일은 slash command 직접 입력 흐름에서만 받을 수 있다.

## 작업 5. /인증 직접 입력 흐름 유지

아래 흐름은 계속 동작해야 한다.

- `/인증 미션:M001 내용:QA 테스트`
- `/인증 미션:M001 내용:QA 테스트 첨부파일:이미지`
- 기존 내부 mission.id 입력

처리 기준:

- 미션이 입력되고 내용 또는 첨부파일 중 하나가 있으면 바로 인증 제출을 생성한다.
- 미션이 입력되었지만 내용과 첨부파일이 모두 없으면 인증 모달을 띄운다.
- 미션이 없으면 미션 선택 메뉴를 띄운다.
- 첨부파일이 있는 경우 metadata를 저장한다.
- 운영자 알림에는 첨부파일 정보가 포함되어야 한다.

주의:

- 내용과 첨부파일 중 적어도 하나는 있어야 한다.
- 둘 다 없으면 모달로 내용을 받는 방향이 자연스럽다.
- 중복 제출 방지 로직은 유지한다.

## 작업 6. /미션과 /인증 선택 메뉴 helper 통합

가능하다면 `/미션`과 `/인증`이 같은 미션 선택 메뉴 helper를 사용하게 한다.

다만 customId는 구분한다.

예시:

- mission_select_from_mission
- mission_select_from_submit

또는 안전한 prefix 기반 customId를 사용한다.

주의:

- `/미션`에서 선택하면 모달로 인증 제출
- `/인증`에서 선택해도 모달로 인증 제출
- 같은 기능이면 UX가 일관되어야 한다.

## 작업 7. /상점과 /교환 선택 메뉴 helper 통합

가능하다면 `/상점`과 `/교환`이 같은 상점 선택 메뉴 helper를 사용하게 한다.

다만 customId는 구분하거나 같은 customId를 재사용할 수 있다.

주의:

- `/상점`에서 선택해도 교환 확인 화면
- `/교환`에서 선택해도 교환 확인 화면
- 선택만으로는 차감하지 않는다.

## 작업 8. 문구 개선

참여자 화면에서 아래 표현을 줄인다.

- ID
- 미션id
- 항목 ID
- 필수 항목
- 실패
- 오류
- 접수할 수 없습니다

권장 표현:

- 미션
- 미션 코드
- 신청 코드
- 아직 진행할 수 없어요
- 다시 확인해 주세요
- 선택해 주세요
- 필요한 내용을 편하게 남겨 주세요

## 작업 9. 문서 보강

### docs/participant-command-guide.md

보강 내용:

- `/교환`은 항목을 몰라도 실행할 수 있다는 점
- `/교환`을 입력하면 목록에서 고를 수 있다는 점
- `/인증`은 미션 코드를 몰라도 실행할 수 있다는 점
- `/인증`을 입력하면 미션을 선택하고 모달로 제출할 수 있다는 점
- 사진/영상 인증은 `/인증`에서 첨부파일을 함께 올릴 수 있다는 점

### docs/prelaunch-qa-checklist.md

보강 내용:

- `/교환` 단독 실행 테스트
- `/교환 항목:S001` 직접 입력 테스트
- `/인증` 단독 실행 테스트
- `/인증 미션:M001 내용:...` 직접 입력 테스트
- `/인증 미션:M001 첨부파일:...` 테스트
- 기존 내부 ID 입력 호환성 테스트
- 미션 없음/상점 없음 안내 문구 테스트

### docs/operation-guide.md

보강 내용:

- 참여자에게는 `/상점`, `/교환`, `/미션`, `/인증` 모두 선택형으로 안내할 수 있다는 점
- 코드를 몰라도 사용할 수 있게 되었으므로, 운영자는 코드보다 이름 중심으로 안내해도 된다는 점

### README.md

보강 내용:

- `/교환`과 `/인증`도 항목을 몰라도 선택형으로 사용할 수 있다는 점
- 기존 직접 입력 방식도 유지된다는 점

## 작업 10. 테스트 보강

scripts/test-participant-ux-flow.js를 보강한다.

테스트 항목:

- `/교환` 항목 옵션 없이 상점 선택 흐름을 만들 수 있는 helper 테스트
- `/교환 항목:S001` 호환성 유지
- `/인증` 미션 옵션 없이 미션 선택 흐름을 만들 수 있는 helper 테스트
- `/인증 미션:M001` 호환성 유지
- `/인증`에서 내용 없이 미션만 있으면 모달로 이어질 수 있는 분기 테스트
- `/인증`에서 내용 또는 첨부파일이 있으면 제출 생성 분기 테스트
- active 상점이 없을 때 안내 문구 테스트
- active 미션이 없을 때 안내 문구 테스트

필요하다면 scripts/test-point-activity-flow.js도 보강한다.

## 검증

작업 완료 후 아래 명령어를 실행한다.

- node scripts/test-points-store.js
- node scripts/test-points-repository.js
- node scripts/test-point-activity-flow.js
- node scripts/test-admin-management-flow.js
- node scripts/test-operation-export-flow.js
- node scripts/test-participant-ux-flow.js
- npm run validate:data
- npm run test:questions
- npm run check:release

주의:

- npm run deploy는 실행하지 않는다.
- 이번 작업은 Slash Command 옵션 변경이 있으므로 작업 후 사용자가 직접 npm run deploy를 실행해야 한다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

- 변경된 파일 목록
- `/교환` 항목 옵션이 선택 사항으로 바뀌었는지
- `/교환` 단독 실행 시 상점 선택 메뉴가 뜨는지
- `/교환 항목:S001` 기존 방식이 유지되는지
- `/인증` 미션/내용/첨부파일 옵션이 선택 사항으로 바뀌었는지
- `/인증` 단독 실행 시 미션 선택 메뉴가 뜨는지
- `/인증 미션:M001 내용:...` 기존 방식이 유지되는지
- `/인증` 첨부파일 제출이 유지되는지
- 참여자 문구 개선 내용
- 새 Slash Command는 추가하지 않았지만 기존 Slash Command 옵션이 변경되었다는 점
- npm run deploy는 실행하지 않았다는 점
- 사용자가 직접 npm run deploy를 실행해야 한다는 점
- node scripts/test-points-store.js 결과
- node scripts/test-points-repository.js 결과
- node scripts/test-point-activity-flow.js 결과
- node scripts/test-admin-management-flow.js 결과
- node scripts/test-operation-export-flow.js 결과
- node scripts/test-participant-ux-flow.js 결과
- npm run validate:data 결과
- npm run test:questions 결과
- npm run check:release 결과