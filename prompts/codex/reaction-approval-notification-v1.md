# Codex 작업 지시서

## 작업 이름

반응 승인 알림 정리 v1

## 목표

프로젝트 리디파인 디스코드 봇의 미션 인증 채널 반응 승인 알림 방식을 정리한다.

현재 미션 인증 채널에서 참여자가 글/사진/영상을 올리고, 운영자가 ✅ 반응을 누르면 포인트가 정상 지급된다. 다만 승인/반려 후 봇이 원본 인증 채널에 공개 답글을 남기기 때문에 실제 운영 시 인증 채널이 금방 복잡해질 수 있다.

이번 작업에서는 반응 승인 후 공개 채널 답글을 기본적으로 끄고, 필요하면 참여자에게 DM으로 안내할 수 있게 한다.

핵심 목표:

- ✅ 승인 시 원본 인증 채널에 공개 답글을 기본적으로 남기지 않는다.
- ❌ 반려 시에도 원본 인증 채널에 공개 답글을 기본적으로 남기지 않는다.
- 참여자 DM 알림을 환경변수로 켜고 끌 수 있게 한다.
- DM 전송 실패가 포인트 지급 실패로 이어지지 않게 한다.
- 운영자 로그 채널 알림과 포인트 로그 기록은 유지한다.
- 기존 미션 인증 반응 승인 기능은 유지한다.
- 기존 /포인트, /포인트로그, /운영현황 기능은 깨지지 않게 한다.
- 새 Slash Command는 추가하지 않는다.

## 현재 전제

현재 기능:

- MISSION_SUBMISSION_CHANNEL_ID에 설정된 채널에서 반응 승인 기능 작동
- 운영자가 ✅ 반응을 누르면 포인트 지급
- 운영자가 ❌ 반응을 누르면 반려 처리
- messageId 기준 중복 지급 방지
- /포인트에서 보유 포인트 확인 가능
- /포인트로그에서 지급 기록 확인 가능
- 운영자 로그 채널 알림 가능
- 현재는 승인/반려 후 원본 인증 메시지에 공개 답글이 남을 수 있음

## 중요 정책

### 공개 답글은 기본 OFF

기본값:

- REACTION_APPROVAL_PUBLIC_REPLY=false

공개 답글이 꺼져 있으면:

- 승인 시 원본 메시지에 답글을 남기지 않는다.
- 반려 시 원본 메시지에 답글을 남기지 않는다.
- 인증 채널은 참여자 인증 메시지 중심으로 깔끔하게 유지된다.

### DM 알림은 선택 ON

기본값:

- REACTION_APPROVAL_DM_USER=true

DM 알림이 켜져 있으면:

승인 시 DM 예시:

확인됐어요. 여정 포인트 20P가 지급됐습니다.

반려 시 DM 예시:

운영진이 확인했어요. 이번에는 포인트 지급 대상은 아니에요.

주의:

- DM 전송 실패는 console.warn 정도로만 남긴다.
- 사용자가 DM을 막아둔 경우에도 포인트 지급/반려 기록은 정상 유지한다.
- DM 실패 때문에 전체 처리가 실패하면 안 된다.

### 운영자 로그는 유지

운영자 로그 채널에는 기존처럼 기록을 남긴다.

우선순위:

1. 포인트 지급/반려 기록 저장
2. 포인트 로그 기록
3. 운영자 로그 채널 알림
4. 참여자 DM 알림
5. 공개 답글은 환경변수로 켜진 경우에만 전송

## 중요 주의사항

- 새 Slash Command는 추가하지 않는다.
- 기존 Slash Command 이름은 변경하지 않는다.
- .env 파일은 수정하지 않는다.
- .env.example에는 placeholder만 추가한다.
- 실제 토큰, 실제 채널 ID, 실제 개인정보는 작성하지 않는다.
- data/*.local.json은 커밋하지 않는다.
- package.json, package-lock.json은 수정하지 않는다.
- Railway, GitHub 설정은 변경하지 않는다.
- Google Sheets 연동, PostgreSQL 연동, 웹 관리자 페이지는 구현하지 않는다.
- npm run deploy는 실행하지 않는다.
- git commit, git push는 하지 않는다.
- 기존 반응 승인 기능을 깨지 않는다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

- src/reactionApproval.js
- src/logging.js
- src/pointsRepository.js
- src/pointsStore.js
- scripts/test-reaction-approval-flow.js
- scripts/check-release.js
- .env.example
- docs/participant-command-guide.md
- docs/operation-guide.md
- docs/prelaunch-qa-checklist.md
- README.md
- prompts/codex/reaction-approval-notification-v1.md

## 작업 1. 환경변수 추가

.env.example에 아래 값을 추가한다.

REACTION_APPROVAL_PUBLIC_REPLY=false
REACTION_APPROVAL_DM_USER=true

주의:

- .env 파일은 수정하지 않는다.
- 실제 값은 넣지 않는다.
- README 또는 운영 문서에 Railway Variables에 추가해야 한다고 안내한다.

## 작업 2. 공개 답글 제어

src/reactionApproval.js에서 승인/반려 후 원본 메시지에 공개 답글을 보내는 로직을 환경변수로 제어한다.

함수 후보:

- shouldSendReactionApprovalPublicReply()
- shouldDmReactionApprovalUser()

처리 기준:

- REACTION_APPROVAL_PUBLIC_REPLY가 "true"일 때만 공개 답글 전송
- 값이 없거나 false면 공개 답글 전송하지 않음

주의:

- 기존 message.reply()가 있다면 조건부로 감싼다.
- 공개 답글 실패는 전체 실패로 이어지지 않게 한다.

## 작업 3. DM 알림 추가

승인/반려 처리 후 참여자에게 DM을 보낸다.

단, REACTION_APPROVAL_DM_USER가 "true"일 때만 시도한다.

승인 DM 문구:

확인됐어요. 여정 포인트 20P가 지급됐습니다.

반려 DM 문구:

운영진이 확인했어요. 이번에는 포인트 지급 대상은 아니에요.

가능하면 아래 정보도 짧게 포함한다.

- 지급 포인트
- 미션 인증 채널에서 확인된 내용이라는 점
- /포인트로 확인 가능하다는 점

예시:

확인됐어요. 여정 포인트 20P가 지급됐습니다.  
`/포인트`에서 현재 포인트를 확인할 수 있어요.

주의:

- DM 실패는 console.warn만 남긴다.
- DM 실패가 포인트 지급 실패로 이어지지 않게 한다.
- DM에는 내부 ID, messageId, transactionId를 노출하지 않는다.

## 작업 4. 운영자 로그 유지

기존 운영자 로그 채널 알림은 유지한다.

승인 로그에는 가능하면 아래 정보를 포함한다.

- 참여자
- 지급 포인트
- 승인자
- 원본 메시지 링크
- DM 전송 여부
- 공개 답글 전송 여부

반려 로그에는 가능하면 아래 정보를 포함한다.

- 참여자
- 반려자
- 원본 메시지 링크
- DM 전송 여부
- 공개 답글 전송 여부

주의:

- 운영자 로그는 내부 확인용이므로 참여자 DM보다 자세해도 된다.
- 단, 개인정보를 과도하게 포함하지 않는다.

## 작업 5. 테스트 보강

scripts/test-reaction-approval-flow.js를 보강한다.

테스트 항목:

- REACTION_APPROVAL_PUBLIC_REPLY 기본값 false
- REACTION_APPROVAL_DM_USER 기본값 true
- 공개 답글 off 상태에서 reply 호출이 생략되는지 helper 수준에서 확인
- 공개 답글 true 상태에서 reply 대상이 활성화되는지 helper 수준에서 확인
- DM true 상태에서 DM 전송 시도 플래그가 켜지는지 확인
- DM false 상태에서 DM 전송 시도가 생략되는지 확인
- DM 실패가 승인 처리 실패로 이어지지 않는지 확인
- 승인 시 포인트 지급은 기존처럼 유지되는지 확인
- 반려 시 포인트 미지급은 기존처럼 유지되는지 확인
- 중복 승인 방지 유지

성공 시 출력:

reaction approval flow smoke test passed

## 작업 6. 문서 보강

### README.md

보강 내용:

- 반응 승인 후 공개 답글은 기본적으로 꺼져 있다는 점
- 참여자 DM 알림은 환경변수로 제어할 수 있다는 점
- 운영자 로그와 포인트 로그는 유지된다는 점

### docs/participant-command-guide.md

보강 내용:

- 인증 채널에 글/사진/영상을 올리면 운영진이 확인한다는 점
- 포인트 지급 여부는 DM 또는 /포인트로 확인할 수 있다는 점
- 채널에 공개 답글이 항상 남는 것은 아니라는 점

### docs/operation-guide.md

보강 내용:

- 운영자가 ✅ 반응을 누르면 포인트 지급
- 공개 답글은 REACTION_APPROVAL_PUBLIC_REPLY로 제어
- DM 알림은 REACTION_APPROVAL_DM_USER로 제어
- DM 실패 시에도 포인트 지급은 유지됨
- 운영 로그 채널에서 처리 기록 확인 가능

### docs/prelaunch-qa-checklist.md

보강 내용:

- REACTION_APPROVAL_PUBLIC_REPLY=false일 때 공개 답글이 남지 않는지
- REACTION_APPROVAL_DM_USER=true일 때 DM이 가는지
- DM을 막은 사용자도 포인트 지급은 되는지
- /포인트에서 포인트가 반영되는지
- /포인트로그에 기록이 남는지
- 운영자 로그 채널에 처리 기록이 남는지

## 작업 7. check-release 확인

scripts/check-release.js가 아래 테스트를 실행하는지 확인한다.

- node scripts/test-reaction-approval-flow.js

기존 테스트는 유지한다.

## 검증

작업 완료 후 아래 명령어를 실행한다.

- node scripts/test-points-store.js
- node scripts/test-points-repository.js
- node scripts/test-point-activity-flow.js
- node scripts/test-admin-management-flow.js
- node scripts/test-operation-export-flow.js
- node scripts/test-participant-ux-flow.js
- node scripts/test-reaction-approval-flow.js
- npm run validate:data
- npm run test:questions
- npm run check:release

주의:

- npm run deploy는 실행하지 않는다.
- 새 Slash Command를 추가하지 않았으므로 npm run deploy는 필요 없다.
- Railway 환경변수 추가 후에는 Railway 재배포가 필요할 수 있다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

- 변경된 파일 목록
- 공개 답글 제어 방식
- REACTION_APPROVAL_PUBLIC_REPLY 기본값
- DM 알림 제어 방식
- REACTION_APPROVAL_DM_USER 기본값
- DM 실패 처리 방식
- 운영자 로그 유지 여부
- 포인트 로그 유지 여부
- 기존 반응 승인 기능 유지 여부
- 새 Slash Command는 추가하지 않았다는 점
- npm run deploy는 실행하지 않았다는 점
- Railway에 추가해야 할 환경변수
- node scripts/test-points-store.js 결과
- node scripts/test-points-repository.js 결과
- node scripts/test-point-activity-flow.js 결과
- node scripts/test-admin-management-flow.js 결과
- node scripts/test-operation-export-flow.js 결과
- node scripts/test-participant-ux-flow.js 결과
- node scripts/test-reaction-approval-flow.js 결과
- npm run validate:data 결과
- npm run test:questions 결과
- npm run check:release 결과