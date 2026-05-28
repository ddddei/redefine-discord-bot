# Codex 작업 지시서

## 작업 이름

참여자 UX 다듬기 v3

## 목표

프로젝트 리디파인 디스코드 봇의 참여자용 `/상점`, `/교환`, `/미션`, `/인증` 흐름을 한 번 더 단순화한다.

현재 v2에서 `/상점`과 `/미션`의 선택형 UX, 교환 확인 버튼, 인증 모달, `/인증` 첨부파일 옵션이 추가되었다. 방향은 좋아졌지만 실제 테스트 결과 다음 문제가 남아 있다.

- `/상점` 목록에 아직 읽을 내용이 많다.
- S001 같은 신청 코드가 상품명과 함께 크게 보이면 참여자에게 복잡하게 느껴진다.
- Discord 메시지 색상이 단조로워 상품 유형 구분이 어렵다.
- “신청하지 않기” 버튼을 누르면 바로 종료되어 실수처럼 느껴질 수 있다.
- 첨부파일 인증은 가능해졌지만 채팅창에서 직접 입력하는 방식이 여전히 복잡하다.
- 운영자 알림이 어디로 갔는지 운영자가 바로 알기 어렵다.

이번 작업에서는 기능을 더 늘리기보다 참여자가 덜 읽고, 덜 외우고, 덜 헷갈리도록 문구와 구성 요소를 정리한다.

## 중요 주의사항

- 새 Slash Command는 추가하지 않는다.
- 기존 Slash Command 이름은 변경하지 않는다.
- `/인증` 첨부파일 옵션은 유지한다.
- `.env` 파일은 수정하지 않는다.
- 실제 토큰, 실제 채널 ID, 실제 개인정보는 작성하지 않는다.
- `data/*.local.json`은 커밋하지 않는다.
- Google Sheets 연동, PostgreSQL 연동, 웹 관리자 페이지는 구현하지 않는다.
- npm run deploy는 실행하지 않는다.
- git commit, git push는 하지 않는다.

## 수정 가능 파일

필요한 경우 아래 파일만 수정하거나 생성한다.

- src/handlers.js
- src/embeds.js
- src/components.js
- src/pointsRepository.js
- src/pointsStore.js
- src/logging.js
- scripts/test-participant-ux-flow.js
- scripts/check-release.js
- docs/participant-command-guide.md
- docs/prelaunch-qa-checklist.md
- docs/operation-guide.md
- README.md
- prompts/codex/participant-ux-polish-v3.md

## 작업 1. /상점 목록에서 신청 코드 노출 최소화

참여자용 `/상점` 목록에서는 S001 같은 코드를 크게 노출하지 않는다.

현재처럼 `S001 · 청년동 포인트 전환권 100P`로 시작하면 참여자가 코드부터 보게 되어 복잡하게 느낄 수 있다.

권장 표시:

🟢 청년동 포인트 전환권 100P  
필요 포인트 100P · 청년동 내부 사용

🎁 프로그램 굿즈  
필요 포인트 300P · 수량 운영진 확인

주의:

- 드롭다운 option label에는 S001을 유지해도 된다.
- `/교환 항목:S001` 직접 입력 호환성은 유지한다.
- 참여자 화면의 본문에서는 “S001”을 크게 강조하지 않는다.
- 필요하다면 상세 확인 화면 하단에 “직접 입력용 신청 코드: S001” 정도로 작게만 표시한다.
- “항목 ID”라는 표현은 참여자 화면에서 사용하지 않는다.
- “신청 코드”라는 표현을 사용한다.

## 작업 2. 상품 유형 구분을 이모지와 태그로 보완

Discord는 일반 텍스트 일부에 색상을 직접 넣기 어렵다.

따라서 상품 유형별 이모지와 짧은 태그를 사용한다.

권장 매핑:

- youthCenterPoint: 🟢 청년동 포인트
- reward: 🎁 리워드
- goods: 🎁 굿즈
- event: ✨ 이벤트
- subscription 또는 구독권 성격: 🎟️ 구독권

상점 목록과 상세 확인 화면에 유형을 짧게 표시한다.

예시:

🟢 청년동 포인트  
청년동 포인트 전환권 100P

🎁 리워드  
프로그램 굿즈

주의:

- 설명 문장은 짧게 유지한다.
- 너무 많은 정보를 한 번에 보여주지 않는다.

## 작업 3. 교환 신청 확인 화면 더 단순화

상점 선택 후 나오는 교환 신청 전 확인 화면을 더 짧게 만든다.

권장 구조:

제목:
교환 신청 전 확인해 주세요

내용:

🟢 청년동 포인트 전환권 100P  
필요 포인트: 100P  
현재 포인트: 500P  
신청 후 포인트: 400P

신청하면 포인트가 차감돼요.  
단순 변심에 따른 취소나 환불은 원칙적으로 어렵습니다.

버튼:

- 교환 신청하기
- 신청하지 않기

하단에 필요한 경우:

직접 입력용 신청 코드: S001

주의:

- 내부 item.id는 참여자 화면에 노출하지 않는다.
- 설명이 긴 경우 한두 문장으로 자른다.

## 작업 4. 신청하지 않기 2단계 확인 추가

“신청하지 않기” 버튼을 누르면 바로 종료하지 않고 한 번 더 확인한다.

흐름:

1. 사용자가 상점 항목 선택
2. 교환 신청 전 확인 화면 표시
3. 사용자가 “신청하지 않기” 클릭
4. 봇이 재확인 화면 표시

재확인 화면 문구:

교환 신청을 종료할까요?  
아직 포인트는 차감되지 않았어요.

버튼:

- 네, 종료할게요
- 다시 확인할게요

동작:

- “네, 종료할게요” 클릭 시 신청 종료
- “다시 확인할게요” 클릭 시 이전 교환 확인 화면으로 돌아감

주의:

- 이 기능은 접수된 교환 신청의 취소 기능이 아니다.
- 참여자용 환불/취소 기능을 새로 만들지 않는다.
- 버튼 customId 길이 제한을 고려한다.
- itemId를 customId에 넣을 경우 안전하게 처리한다.

## 작업 5. 교환 신청 접수 실패 문구 개선

현재 “아직 포인트 기록이 없어 교환 신청을 접수할 수 없어요” 같은 문구는 차갑게 느껴질 수 있다.

권장 문구:

현재 포인트 기록이 없어 아직 신청할 수 없어요.  
먼저 체크인이나 미션 참여 후 다시 확인해 주세요.

또는 포인트 부족 상황:

현재 보유 포인트가 조금 부족해요.  
필요 포인트와 내 포인트를 다시 확인해 주세요.

주의:

- 실패, 오류 같은 표현을 줄인다.
- 참여자가 다음 행동을 알 수 있게 한다.
- `/포인트`, `/미션`, `/체크인`으로 이어질 수 있게 안내한다.

## 작업 6. /미션 목록 정보량 추가 축소

`/미션` 목록도 상품처럼 짧게 표시한다.

권장 표시:

🌱 오늘의 짧은 회고  
지급 포인트 20P · 글로 인증

📷 사진 인증 미션  
지급 포인트 30P · 사진/영상 가능

드롭다운 option label에는 M001을 유지해도 된다.

본문에서는 M001을 크게 강조하지 않는다.

필요한 경우 상세 안내에만:

직접 입력용 미션 코드: M001

주의:

- 내부 mission.id는 참여자 본문에 노출하지 않는다.
- “미션 ID” 대신 “미션 코드”라고 표현한다.
- 미션은 선택형 활동이라는 문구를 유지한다.

## 작업 7. /인증 첨부파일 안내 단순화

`/인증` 명령어에 첨부파일 옵션이 있다는 점을 참여자가 이해하기 쉽게 안내한다.

권장 문구:

글로 남길 수 있는 미션은 `/미션`에서 선택해 제출할 수 있어요.  
사진이나 영상이 필요한 경우 `/인증`에서 첨부파일을 함께 올려 주세요.

주의:

- 첨부파일 옵션은 유지한다.
- 채팅창에서 직접 입력하는 방식이 복잡해 보이지 않도록 문구를 줄인다.
- 모달은 텍스트 인증용이라는 점을 문서에 남긴다.

## 작업 8. 운영자 알림 전송 여부 확인 강화

교환 신청 또는 인증 제출 시 운영자 채널 알림이 어디로 갔는지 알기 어렵다.

다음 중 가능한 범위로 보강한다.

- console.info에 알림 전송 성공 로그를 남긴다.
- console.warn에 채널 미설정 또는 전송 실패 로그를 남긴다.
- /운영현황에서 확인 가능하다는 안내는 유지한다.
- 운영자 알림 채널이 설정되어 있지 않은 경우 로그에 명확히 남긴다.

권장 로그 예시:

[redeem-alert] sent to POINT_REDEEM_CHANNEL_ID
[redeem-alert] skipped: POINT_REDEEM_CHANNEL_ID and LOG_CHANNEL_ID are not configured
[submission-alert] sent to ACTIVITY_REVIEW_CHANNEL_ID
[submission-alert] failed: missing channel permission

주의:

- 참여자 응답에는 운영자 알림 상태를 자세히 노출하지 않는다.
- 알림 실패가 참여자 신청 실패로 이어지지 않게 한다.

## 작업 9. 문서 보강

### docs/participant-command-guide.md

보강 내용:

- 상점 목록에서는 상품을 먼저 보고, 신청 코드는 보조 정보라는 점
- 신청하지 않기를 누르면 한 번 더 확인한다는 점
- “네, 종료할게요”를 눌러야 신청이 종료된다는 점
- 글 인증은 /미션 선택 후 모달 사용
- 사진/영상 인증은 /인증 첨부파일 사용

### docs/prelaunch-qa-checklist.md

보강 내용:

- /상점 목록에서 내부 ID가 노출되지 않는지
- 상품 유형 이모지가 보이는지
- 신청하지 않기 2단계 확인 테스트
- 다시 확인할게요 버튼 테스트
- 네, 종료할게요 버튼 테스트
- 포인트 차감 없음 확인
- /미션 목록에서 내부 ID가 노출되지 않는지
- /인증 첨부파일 안내 확인
- 운영자 알림 성공/실패 로그 확인

### docs/operation-guide.md

보강 내용:

- 운영자는 상점/미션 제목을 짧고 명확하게 작성한다.
- 상점/미션 본문에서는 코드보다 이름과 목적이 먼저 보이도록 한다.
- 사진/영상 인증이 필요한 미션은 운영자가 사전에 안내한다.
- 운영자 알림 채널이 설정되어 있는지 운영 전 점검한다.

### README.md

보강 내용:

- 상점/미션이 더 단순한 선택형 흐름으로 개선되었다는 점
- 글 인증은 모달, 사진/영상 인증은 첨부파일 방식이라는 점

## 작업 10. 테스트 보강

scripts/test-participant-ux-flow.js를 보강한다.

테스트 항목:

- 참여자용 상점 summary에 내부 item.id가 직접 노출되지 않는지
- S001 신청 코드는 mapping에 유지되는지
- /교환 항목:S001 호환성이 유지되는지
- 신청하지 않기 confirmation customId 생성/파싱 테스트
- 다시 확인하기 customId 생성/파싱 테스트
- 참여자용 미션 summary에 내부 mission.id가 직접 노출되지 않는지
- M001 미션 코드는 mapping에 유지되는지
- /인증 미션id:M001 호환성이 유지되는지
- 상품 유형 이모지/라벨 helper 테스트
- 첨부파일 metadata normalize helper가 유지되는지

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
- 이번 작업은 새 Slash Command를 추가하지 않으므로 보통 npm run deploy는 필요 없다.

## 완료 후 요약

완료 후 아래 내용을 요약한다.

- 변경된 파일 목록
- /상점에서 S001 노출을 줄였는지
- 상품 유형 이모지/태그 적용 여부
- 교환 확인 화면 간소화 내용
- 신청하지 않기 2단계 확인 추가 여부
- /미션에서 M001 노출을 줄였는지
- /인증 첨부파일 안내 개선 내용
- 운영자 알림 로그 보강 내용
- 기존 /교환 항목:S001 지원 유지 여부
- 기존 /인증 미션id:M001 지원 유지 여부
- npm run deploy는 실행하지 않았다는 점
- node scripts/test-points-store.js 결과
- node scripts/test-points-repository.js 결과
- node scripts/test-point-activity-flow.js 결과
- node scripts/test-admin-management-flow.js 결과
- node scripts/test-operation-export-flow.js 결과
- node scripts/test-participant-ux-flow.js 결과
- npm run validate:data 결과
- npm run test:questions 결과
- npm run check:release 결과