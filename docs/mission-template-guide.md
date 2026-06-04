# 미션 템플릿 운영 가이드

이 문서는 `data/mission-templates.example.json`의 구조를 운영자가 이해할 수 있도록 정리한 안내 문서입니다. 해당 JSON은 예시 데이터이며, 현재 운영 중인 실제 미션 상태나 Discord 서버 설정이 아닙니다.

## 1. 파일 목적

`data/mission-templates.example.json`은 매일/오늘의 미션 UX 설계 문서에 맞춰 반복 미션과 특별 미션을 템플릿으로 정리한 기초 샘플입니다.

이 파일은 다음 용도로만 사용합니다.

- 운영자가 어떤 미션을 기본 템플릿으로 준비할지 논의합니다.
- 매일 습관 미션, 오늘의 활동 미션, 게릴라/특별 미션의 차이를 확인합니다.
- 후속 구현에서 저장 구조를 설계할 때 참고합니다.

이 파일은 실제 운영 데이터가 아닙니다. 실제 Discord 채널 ID, 사용자 ID, 토큰, 비밀번호, 참여자 제출 내용은 넣지 않습니다.

## 2. 미션 유형

| type | 의미 | 운영 기준 |
| --- | --- | --- |
| `daily_habit` | 매일 반복되는 작은 습관 미션 | 참여자가 미션 ID 없이 오늘의 미션 채널에 글이나 사진을 올리는 흐름을 기본으로 둡니다. |
| `today_activity` | 운영자가 특정 날짜에 고르는 오늘의 활동 미션 | 템플릿 중 필요한 항목을 선택해 그날의 미션으로 활성화하는 흐름을 전제로 합니다. |
| `special_event` | 게릴라/특별 미션 | 기간, 조건, 인증 기준이 복잡한 경우 기존 `/미션`, `/인증` 흐름과 함께 씁니다. |

## 3. 주요 필드

| 필드 | 설명 |
| --- | --- |
| `isExample` | 파일 전체가 예시 데이터임을 표시합니다. |
| `missionTemplates` | 운영자가 참고할 미션 템플릿 목록입니다. |
| `id` | 템플릿을 식별하는 예시 ID입니다. 실제 Discord ID가 아닙니다. |
| `key` | 운영자가 알아보기 쉬운 템플릿 키입니다. 예시에서는 `_example` suffix를 붙입니다. |
| `type` | `daily_habit`, `today_activity`, `special_event` 중 하나입니다. |
| `title` | 참여자에게 보일 수 있는 미션명입니다. |
| `description` | 미션 목적과 인증 방식을 설명하는 문구입니다. |
| `defaultRewardPoints` | 템플릿의 기본 포인트 예시입니다. 실제 지급 정책은 운영자가 확정해야 합니다. |
| `submissionMode` | 인증 접수 방식입니다. 반복 미션은 보통 `channel_message`를 사용합니다. |
| `allowedAttachmentTypes` | 허용할 인증 형태 예시입니다. `text`, `image`, `video`를 조합합니다. |
| `rewardLimit` | 중복 지급 제한 기준입니다. 반복 미션은 하루 1회를 기본 예시로 둡니다. |
| `defaultChannelRef` | 실제 채널 ID가 아니라 `today_mission_channel` 같은 참조명입니다. |
| `status` | 예시 상태입니다. 실제 운영 상태가 아니므로 `example_active`, `example_draft`처럼 표시합니다. |
| `operatorNote` | 운영자가 안내 문구나 개인정보 주의사항을 확인하기 위한 메모입니다. |

## 4. 운영 시 주의사항

- 예시 템플릿을 실제 운영 데이터로 그대로 복사하지 않습니다.
- 실제 Discord 채널 ID, 사용자 ID, 메시지 ID, 역할 ID를 이 파일에 넣지 않습니다.
- 사진 인증 미션은 얼굴, 주소, 연락처, 지도 경로, 계정명 같은 개인정보가 드러나지 않도록 안내합니다.
- 반복 미션은 여러 번 제출할 수 있어도 포인트 지급은 같은 미션 기준 하루 1회라는 원칙을 분리해서 안내합니다.
- Slash Command를 바꾸지 않아도 되는 문서/예시 데이터로만 관리합니다.

## 5. 기본 템플릿 목록

예시 파일에는 아래 템플릿이 포함되어 있습니다.

- 오늘 상태 남기기
- 물 한 잔 마시기
- 이불 정리하기
- 방 환기하기
- 10분 산책하기
- 5,000보 걷기
- 나이키 런 1km 인증하기
- 오늘의 사진 기록
- 오늘의 회고 남기기
- 게릴라 특별 미션 예시

## 6. 관련 문서

- [daily-mission-flow-plan.md](daily-mission-flow-plan.md)
- [operator-command-guide.md](operator-command-guide.md)
- [operation-guide.md](operation-guide.md)
