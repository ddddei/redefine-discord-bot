# 작업 지시서 — 운영 콘솔 참여자 개인 카드 v1

> 기준: PR #81 이후 `main`. 구현은 서브 에이전트, 개인정보·정합성 최종 검수는 5.6 Sol.

## 목표와 금지

[계획서](../../docs/admin-participant-card-v1-plan.md)를 구현한다. 정확한 Discord userId로 한 참여자의 최소 운영 이력을 읽기 전용으로 보여준다.

금지: 참여자 열거·이름 검색·자동완성, DM/인증 원문·첨부·URL·메모·token·seed 노출, 상태 변경, 참여자 메시지, repository/schema/env/Slash Command 변경, 새 dependency.

## 구현 구조

### `src/adminParticipantCard.js` 신규

- `buildAdminParticipantCard(repository, { userId, limit, now, env })`
- `repository.loadState()`와 기존 공개 read API만 사용한다.
- 모든 컬렉션에 `filterOperationalRecords` 적용 후 정확한 userId 필터.
- 사용자도 example-like이면 not-found 결과.
- allowlist projection만 사용하고 원본 record spread 금지.
- 미션·상점 이름은 운영 레코드 map으로 연결하되 누락은 warning.
- pending 교환·미션 제출은 `opsDelayPolicy` metadata 재사용.
- 잔액 검증: 현재 `totalPoints`와 해당 사용자의 최신 transaction `balanceAfter`; 거래가 없으면 불일치 경고를 만들지 않는다.
- 날짜 정렬은 invalid date에 안전하고 deterministic tie-break를 둔다.
- limit 기본 10, 최소 5, 최대 50.

반환 객체는 계획서 응답 구조만 허용한다. 다음 key가 직렬화 결과 어디에도 없어야 한다: `content`, `contentSummary`, `attachment`, `attachmentUrls`, `messageUrl`, `note`, `reviewNote`, `playerToken`, `seed`, `log`, `notificationSettings`, `notificationResults`.

### API

`src/adminServer.js` GET router에 `/api/admin/participant-card` 추가. 기존 Basic Auth·no-store 사용.

- userId trim 후 필수, 120자 상한
- 400 `INVALID_USER_ID`, 404 `PARTICIPANT_NOT_FOUND`
- 예상하지 못한 오류는 500 일반 메시지, 내부 경로·원문 비노출
- write token 불필요, POST 경로 추가 없음

### UI

`public/admin/index.html`, `admin.js`, `admin.css`:

- 운영 요약 다음에 “참여자 개인 카드” panel
- 정확한 사용자 ID input, 조회, 지우기
- localStorage/sessionStorage/history URL에 검색값 저장 금지
- Enter 조회, 중복 요청 중 버튼 disabled, 마지막 요청만 렌더링
- participant 요약, warnings, counts, 최근 4종 표
- 사용자 ID는 카드 내부에만 표시하고 toast·document title에 넣지 않는다.
- 응답 문자열은 기존 escape helper 사용.

## 테스트

`scripts/test-admin-participant-card-flow.js` 신규, release gate 등록.

1. 인증 없음 401, userId 없음 400, 없는/example 404
2. 다른 사용자의 모든 기록 배제
3. 체크인/미션/교환/거래 count와 recent limit
4. content·attachment·URL·note·token·seed 등 금지 key/value 비노출
5. 미션·상점 연결명과 누락 warning
6. latest balance mismatch·negative balance·overdue warning
7. invalid dates와 limit 경계
8. GET이 어떤 local JSON도 변경하지 않음(checksum/mtime)
9. 응답 no-store와 UI 정적 계약(검색 전 자동 fetch 없음, storage API 없음)
10. 기존 admin dashboard/write/webgame/reminder 테스트 회귀

## 수정 가능 파일

- `src/adminParticipantCard.js` 신규
- `src/adminServer.js`
- `public/admin/index.html`, `public/admin/admin.js`, `public/admin/admin.css`
- `scripts/test-admin-participant-card-flow.js`, `scripts/check-release.js`
- `README.md`, `docs/operator-dashboard-guide.md`, `docs/prelaunch-qa-checklist.md`
- `docs/admin-participant-card-v1-plan.md`, `docs/next-work-roadmap-2026-07.md`, `docs/ops-console-master-plan.md`, `docs/README.md`, `prompts/README.md`

`pointsRepository`, 운영 데이터 경로, 실제 env/local 파일 수정 금지.

## 검증

```bash
node --check src/adminParticipantCard.js
node --check src/adminServer.js
node --check public/admin/admin.js
node scripts/test-admin-participant-card-flow.js
node scripts/test-admin-dashboard-flow.js
node scripts/test-admin-write-flow.js
node scripts/test-admin-webgame-ops-flow.js
node scripts/test-ops-reminder-flow.js
npm run check:release
git diff --check
```

실제 Railway·375px QA는 확인 대기. push·PR·merge·deploy 금지, 최종 검수 전 commit 금지.
