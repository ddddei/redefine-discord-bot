# 운영 전 통합 점검 자동화 v1 작업 지시서

**상태: 구현 완료·실환경 QA 대기 (2026-07-11)**

## 목표

`docs/prelaunch-readiness-check-v1-plan.md` 계약에 따라 운영 환경을 변경하지 않고 누락·충돌·수동 QA 항목을 한 번에 보여주는 진단기를 구현한다.

## 구현 지시

1. 재사용 가능한 순수 진단 모듈과 CLI wrapper를 분리한다.
2. `npm run check:prelaunch`, `--json`, `--strict`를 지원한다.
3. 필수/권장 env 설정 여부, feature flag 의존성, operation data preflight 결과를 `blockers`, `warnings`, `ready`, `manualActions`, `features`로 반환한다.
4. 민감값은 어떤 출력에도 포함하지 않고 env 이름과 설정 여부만 노출한다.
5. Discord·Railway·Slash Command·모바일·실계정 확인은 자동 성공으로 간주하지 말고 수동 목록으로 남긴다.
6. 테스트, release gate, Railway env 가이드, prelaunch QA, 로드맵, 문서 인덱스를 현행화한다.

## 제약

- 네트워크 호출, env/운영 파일 변경, 실제 값 출력 금지
- 실제 운영 환경의 누락 때문에 일반 `check:release`가 실패하지 않도록 fixture 테스트만 release gate에 편입
- 운영 데이터 preflight는 기존 함수를 재사용
- CommonJS·plain Node assert 유지
- 커밋·푸시·PR·머지는 주 에이전트 담당

## 검증

- 최소 정상 env, 필수 누락, feature dependency 충돌, strict preflight 실패
- 출력과 JSON에 가짜 token/password/channel ID/URL/path가 없는지 확인
- 운영 파일 checksum·mtime 불변과 probe 잔여 파일 없음
- 기본 exit 0, `--strict` blocker exit 1
- `git diff --check`, `npm run check:release`
