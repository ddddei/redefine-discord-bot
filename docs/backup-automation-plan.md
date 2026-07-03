# 운영 데이터 백업 자동화 계획

이 문서는 우선순위 1번 "운영 안정성 — 백업 자동화"의 구현 계획입니다. 승인된 계획이며, 새 세션에서 이 문서만 보고 작업을 시작할 수 있도록 배경과 결정 사항을 함께 정리합니다.

## 1. 배경과 목표

- 봇의 모든 운영 상태(포인트/상점/교환/미션/인증/리액션승인/운영지원/던전월드/일일공지 이력)는 `data/*.local.json`에 저장되며, Railway 재배포·재시작 시 파일 시스템이 초기화되면 통째로 유실될 수 있습니다.
- 현재 방어책은 수동 `/운영내보내기` + 저녁 백업 리마인더(`OPERATION_BACKUP_REMINDER_ENABLED`)뿐입니다. 사람이 잊으면 백업이 없습니다.
- 목표: **운영자 개입 없이 매일 자동으로 전체 상태 스냅샷을 비공개 운영 채널에 파일로 업로드**하고, 유실 시 그 파일로 복원할 수 있는 경로를 만듭니다.

## 2. 방식 결정 (대안 비교)

| 방식 | 판단 |
|---|---|
| **Discord 채널에 스냅샷 JSON 자동 업로드 (채택)** | 신규 의존성 0, 신규 인프라 0. Discord 자체가 오프사이트 저장소 역할. 기존 스케줄러/익스포트 코드 재사용 |
| Railway Volume | 코드 변경은 없지만 인프라 설정 의존이라 리포에서 보장 불가. 별도 운영 작업으로 병행 권장 |
| SQLite 전환 | 신규 의존성 필요 + 데이터 구조 변경. "구조 불변" 원칙과 충돌. 장기 과제로 보류 |
| Google Sheets 확장 | 이미 append-only 이벤트 로그(`googleSheetsLogger.js`)가 있음. 스냅샷 복원용으로는 부적합. 보완재로 유지 |

## 3. 스냅샷 설계

- 형식: 단일 JSON 파일. `data/*.local.json`의 **원본 내용을 그대로** 번들:

```json
{
  "generatedAt": "2026-07-03T12:00:00.000Z",
  "generatedDateKst": "2026-07-03",
  "trigger": "scheduled | catchUp",
  "files": {
    "points": { ... },
    "shopItems": { ... },
    "redemptions": { ... },
    "missions": { ... },
    "missionTemplates": { ... },
    "submissions": { ... },
    "reactionApprovals": { ... },
    "operatorSupport": { ... },
    "dungeonworldLogs": { ... },
    "dungeonworldConfig": { ... },
    "dailyMissionAnnouncements": { ... }
  }
}
```

- 존재하지 않는 파일(아직 생성 전)은 `null`로 기록. 원본 포맷을 가공하지 않으므로 복원 시 그대로 되돌려 쓸 수 있음.
- 파일명: `operation-backup-YYYYMMDD-HHmmss.json` (`exportUtils.js`의 `formatTimestampForFilename` 재사용).
- 크기 가드: 직렬화 결과가 7.5MB(Discord 기본 업로드 한도 8MB 여유분) 초과 시 업로드 대신 실패 알림.

## 4. 수정 대상 파일

| 파일 | 변경 내용 |
|---|---|
| `src/operationBackup.js` **(신규)** | ① `collectBackupSnapshot(paths?)` — 각 데이터 파일의 해석된 경로(`pointsRepository`의 `DEFAULT_PATHS` + env 오버라이드, 던전월드/일일공지 경로 규칙과 동일)에서 읽어 스냅샷 객체 생성. ② `sendOperationBackup(client, options?)` — 채널 fetch → 파일 첨부 전송 → 상태 기록. ③ `startOperationBackupScheduler(client)` — env 게이트 + KST 시각 기준 setTimeout 재예약(기존 `logging.js`의 리마인더/`dailyMissionAnnouncement.js` 스케줄러 패턴 준수). ④ 부팅 캐치업: 시작 시 오늘 예정 시각이 지났는데 오늘 발송 기록이 없으면 1회 발송(재배포 직후 공백 방지) |
| `data/operation-backups.local.json` **(런타임 생성)** | 발송 이력 상태 파일 `{ isExample: false, records: [{ date, sentAt, trigger, messageId, byteSize }] }`. 저장은 `jsonStorage.saveJsonFileAtomic` 사용. 이력은 최근 30건 유지 |
| `src/index.js` | `clientReady`에서 `startOperationBackupScheduler(client)` 호출 1줄 추가 |
| `.env.example` | `OPERATION_BACKUP_AUTO_ENABLED=false`(기본 비활성), `OPERATION_BACKUP_CHANNEL_ID=`(비우면 `LOG_CHANNEL_ID` 폴백), `OPERATION_BACKUP_TIME_KST=21:00` 추가 |
| `scripts/restore-operation-backup.js` **(신규)** | 복원 스크립트: `node scripts/restore-operation-backup.js <snapshot.json> --apply`. 기본은 dry-run으로 어떤 파일이 어떻게 바뀌는지 출력, `--apply` 시 `saveJsonFileAtomic`으로 `data/*.local.json` 복원. 기존 파일이 있으면 `--apply`만으로는 덮어쓰지 않고 `--force` 요구 |
| `scripts/test-operation-backup-flow.js` **(신규)** | 스모크 테스트 (아래 6절) |
| `scripts/check-release.js` | 신규 모듈/스크립트 문법 검사 + 스모크 실행 등록 |
| `docs/export-and-backup-guide.md` | 자동 백업 섹션 추가: 활성화 방법, 채널 권한(비공개 운영 채널 필수 — 개인정보 포함), 복원 절차 |

**건드리지 않는 것**: `pointsRepository.js`의 저장 로직, `/운영내보내기` 명령 스키마(`deploy-commands.js` 무변경 → `npm run deploy` 불필요), 기존 백업 리마인더(자동 백업과 별개 기능으로 공존, 문서에 관계 명시).

## 5. 동작 규칙

- `OPERATION_BACKUP_AUTO_ENABLED=true` + 채널 ID(직접 지정 또는 `LOG_CHANNEL_ID` 폴백)가 있어야 동작. 기본은 완전 비활성 — 기존 배포에 영향 없음.
- 매일 `OPERATION_BACKUP_TIME_KST`에 1회 발송. 발송 성공 시에만 상태 기록.
- 발송 실패(채널 없음/권한 부족/크기 초과) 시 console.warn + 다음 날 재시도. 실패가 봇의 다른 동작을 막지 않음(기존 "DM/로깅 실패는 상태 변경을 막지 않는다" 원칙 준수).
- 부팅 캐치업은 하루 1회 규칙을 공유(오늘 기록이 있으면 발송하지 않음).

## 6. 테스트 방법

`scripts/test-operation-backup-flow.js` (fake client/channel + 임시 데이터 경로, 기존 flow 테스트 패턴):

1. 스냅샷이 모든 데이터 파일을 원본 그대로 포함하고, 없는 파일은 `null`인지
2. 비활성(기본) 시 스케줄러가 아무것도 하지 않는지
3. 발송 시 파일명 형식·첨부 전송·상태 기록(records)이 맞는지
4. 같은 날 캐치업이 중복 발송하지 않는지
5. 채널 fetch 실패 시 throw 없이 경고만 남기는지
6. restore 스크립트: dry-run이 파일을 건드리지 않는지, `--apply --force`가 원본과 바이트 동일하게 복원하는지

회귀: `npm run check:release` 전체 통과.

수동 검증(선택): 테스트 서버에서 `OPERATION_BACKUP_TIME_KST`를 1~2분 뒤로 설정하고 실제 업로드 1회 확인.

## 7. 롤백 방법

- 단일 브랜치/PR(`feat/operation-backup-automation`) → `git revert` 한 번으로 복구.
- 코드 롤백 없이도 `OPERATION_BACKUP_AUTO_ENABLED=false`(기본값)로 즉시 무력화 가능.
- 데이터 구조·저장 포맷 변경이 없으므로 롤백 시 데이터 조치 불필요. 상태 파일(`operation-backups.local.json`)은 잔존해도 무해.

## 8. 주의사항

- 백업 채널은 반드시 **운영진 전용 비공개 채널**이어야 함(스냅샷에 사용자 ID·인증 원문·운영 메모 포함). 문서에 굵게 명시.
- 스냅샷은 읽기만 수행 — 리포지토리 상태를 절대 변경하지 않음.
- `restore-operation-backup.js`는 봇 정지 상태에서 실행하는 것을 문서에 명시(실행 중 복원 시 다음 저장이 덮어씀).
