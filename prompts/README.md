# Prompts

이 폴더는 Codex CLI 등 자동화 도구에 작업을 맡길 때 사용하는 재사용 가능한 작업 지시서를 보관합니다.

## 원칙

- 공식 운영 문서는 `docs/`에 둡니다.
- 재사용 가능한 작업 지시서만 `prompts/`에 보관합니다.
- 일회성 임시 지시서는 커밋하지 않습니다.
- 실제 토큰, 채널 ID, API Key, 참여자 개인정보, 민감한 사연 원문은 포함하지 않습니다.
- 프롬프트는 현재 코드와 달라질 수 있으므로, 실행 전 항상 main 브랜치 최신 상태를 기준으로 확인합니다.

## 현재 권장 작업 순서

운영 전 통합 점검 자동화 v1까지 코드·자동 검증이 완료됐습니다. 다음 작업은 저녁 Railway·Discord 실환경 QA이며, 코드 후속 작업은 실제 운영 데이터가 쌓인 뒤 판단합니다.

1. 최신 `main`과 [현행화 로드맵](../docs/next-work-roadmap-2026-07.md) 확인
2. [운영 전 통합 점검 자동화 v1 계획서](../docs/prelaunch-readiness-check-v1-plan.md) 검토
3. `npm run check:prelaunch`로 설정 전 누락 목록 확인
4. Railway·Discord 설정 후 `npm run check:prelaunch -- --strict` 실행
5. 수동 QA 결과를 기록하고 실제 운영 데이터 축적 후 후속 작업 결정

Phase 3는 운영 콘솔 Phase 1·2의 상태와 공통 운영 데이터 경로를 전제로 현행화됐습니다. 구현 전 최신 `main`과 Railway 단일 인스턴스 전제를 다시 확인합니다.
