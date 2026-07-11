# Prompts

이 폴더는 Codex CLI 등 자동화 도구에 작업을 맡길 때 사용하는 재사용 가능한 작업 지시서를 보관합니다.

## 원칙

- 공식 운영 문서는 `docs/`에 둡니다.
- 재사용 가능한 작업 지시서만 `prompts/`에 보관합니다.
- 일회성 임시 지시서는 커밋하지 않습니다.
- 실제 토큰, 채널 ID, API Key, 참여자 개인정보, 민감한 사연 원문은 포함하지 않습니다.
- 프롬프트는 현재 코드와 달라질 수 있으므로, 실행 전 항상 main 브랜치 최신 상태를 기준으로 확인합니다.

## 현재 권장 작업 순서

운영 데이터 안전화와 참여자 DM 실운영 준비는 `main`에 반영됐습니다. 다음 코드 작업은 대형 interaction handler의 기능 무변경 분할을 권장합니다.

1. 최신 `main`과 [현행화 로드맵](../docs/next-work-roadmap-2026-07.md) 확인
2. [handlers 모듈 분할 v1 계획서](../docs/handlers-modularization-v1-plan.md) 검토
3. [handlers 모듈 분할 v1 작업 지시서](codex/handlers-modularization-v1.md) 실행
4. 주 에이전트 최종 검수와 전체 release gate
5. PR CI 성공 후 머지

운영 콘솔 쓰기와 운영 리마인더 지시서는 별도로 존재하지만 현재 리마인더 지시서는 운영 콘솔 Phase 1을 선행조건으로 둡니다. 선행조건이 충족되기 전 그대로 실행하지 않습니다.
