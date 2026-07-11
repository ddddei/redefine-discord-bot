# 운영 콘솔 참여자 개인 카드 v1 계획서

**상태: 코드·자동 검증 완료, 실환경 QA 대기 (2026-07-11, PR #81 이후)**

## 목적

운영자가 한 참여자의 포인트·체크인·미션·교환 흐름을 여러 표에서 찾지 않고 한 화면에서 확인한다. 이 기능은 개별 케어와 데이터 대조를 돕는 admin 전용 읽기 화면이며 참여자 프로필이나 감시 도구가 아니다.

## 범위

### 포함

- 정확한 Discord 사용자 ID 조회
- 표시명·현재 포인트·상태의 최소 요약
- 체크인, 미션 제출 상태, 교환 상태, 최근 포인트 거래
- 웹게임·미니게임 보상은 포인트 거래 유형으로만 표시
- pending 지연과 데이터 정합성 QA 경고
- 항목별 전체 건수와 최근 N건(기본 10, 최대 50)

### 제외

- 참여자 목록·자동완성·부분 이름 검색
- DM 원문·안전 감지·인증 내용·첨부 URL·메시지 URL
- 운영 메모·review note·player token·게임 seed/행동 로그
- 카드 안의 쓰기 버튼, 참여자 DM, CSV 내보내기
- 새 환경변수·Slash Command·repository schema 변경

## 개인정보 원칙

Basic Auth가 적용된 `/admin`에서만 사용한다. 페이지 로드 시 누구도 자동 조회하지 않고 운영자가 정확한 사용자 ID를 입력해야 한다. 검색값·응답은 브라우저 저장소에 보관하지 않으며 응답은 기존 `no-store` 정책을 따른다. example-like 사용자는 404로 처리해 존재 여부를 노출하지 않는다.

## 응답 구조

- `participant`: userId, displayName, status, totalPoints, createdAt, updatedAt
- `counts`: checkins, submissions(status별), redemptions(status별), pointTransactions
- `recent`: 체크인 날짜, 미션 제목·상태·보상·시각, 교환 항목·상태·비용·시각, 포인트 금액·잔액·사유·유형·시각
- `warnings`: 음수 잔액, 최신 거래 잔액과 현재 잔액 불일치, 참조 미션/상점 누락, overdue pending
- `meta`: generatedAt, limit, exampleRecordsExcluded, contentRedacted: true

원문 필드는 allowlist projection으로 새 객체를 만들며 원본 객체 spread를 금지한다.

## API·UI

- `GET /api/admin/participant-card?userId=&limit=`
- userId 빈 값 400, 없는/example 대상 404, limit 5~50
- 카드 UI는 별도 검색 panel로 만들고 결과를 요약 카드와 4개 최근 이력 표로 표시한다.
- 검색 전 안내, 없음, 오류, 기록 없음 상태를 구분한다.
- 375px에서 표는 기존 가로 스크롤을 사용한다.

## 완료 기준

- 정확한 사용자만 조회되고 example·없는 사용자는 404
- 모든 이력이 해당 userId로만 필터링됨
- 금지 필드가 API 직렬화 결과와 DOM에 없음
- count는 전체 운영 기록, recent는 limit만 적용
- 공통 지연 정책과 잔액 정합성 경고 정확
- 기존 admin Phase 1~3·백업·release gate 통과
- 실제 Railway와 모바일 QA는 확인 대기

## 롤백

읽기 전용이므로 PR revert가 기본이다. 운영 데이터 migration이나 복원은 필요 없다.
