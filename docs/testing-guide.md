# 운영 점검 자동화 패키지 테스트 가이드

## 목적

이 문서는 FAQ, 지식창고, 공지 템플릿, 채널 안내 데이터가 로컬에서 정상인지 확인하고, 실제 질문이 FAQ / Knowledge / Fallback 중 어디로 매칭되는지 점검하기 위한 운영 절차를 정리합니다.

## 데이터 검증

데이터 파일 구조와 JSON 문법을 확인합니다.

```bash
npm run validate:data
```

정상이라면 `data/faq.json`, `data/knowledge.json`, `data/notices.json`, `data/channels.json`, `data/test-questions.json`이 정상이라고 출력됩니다. 실패하면 메시지에 표시된 파일과 항목을 수정한 뒤 다시 실행합니다.

## 질문 매칭 점검

운영 점검용 질문이 FAQ, Knowledge, Fallback 중 어디에 매칭되는지 확인합니다.

```bash
npm run test:questions
```

카테고리별 결과와 마지막 요약을 보고, Fallback 질문 목록을 FAQ 또는 지식창고 보강 후보로 사용합니다.

## FAQ 또는 Knowledge 수정 후 확인 순서

1. `data/faq.json` 또는 `data/knowledge.json`을 수정합니다.
2. `npm run validate:data`로 JSON 문법과 필수 필드를 확인합니다.
3. `npm run test:questions`로 질문 매칭 결과를 확인합니다.
4. 필요한 경우 디스코드에서 `/질문 내용:테스트 질문`을 실행해 최종 응답을 확인합니다.

## Fallback 질문이 많을 때

Fallback이 많으면 운영자가 실제로 받을 가능성이 높은 질문부터 골라 보강합니다. 짧고 반복되는 질문은 `data/faq.json`에 추가하고, 프로그램 설명처럼 넓은 배경 안내가 필요한 질문은 `data/knowledge.json`에 추가합니다.

## 엉뚱한 FAQ로 매칭될 때

의도와 다른 FAQ로 연결되면 해당 FAQ의 `keywords`가 너무 넓은지 확인합니다. 여러 주제에 걸쳐 쓰이는 단어는 줄이고, 사용자가 실제로 입력할 만한 구체적인 표현을 추가합니다. FAQ가 우선 매칭되므로, 지식창고로 보내고 싶은 질문이 FAQ에 잡히면 FAQ keywords를 먼저 조정합니다.

## 디스코드 최종 확인 명령어

데이터 수정 후 로컬 점검이 끝나면 디스코드에서 아래 명령어를 직접 확인합니다.

- `/안내`
- `/질문 내용:처음 왔는데 뭐부터 해요?`
- `/질문 내용:TRPG는 뭐 하는 거예요?`
- `/질문 내용:완전히 관련 없는 테스트 질문입니다`
- `/리디 도움`
- `/리디 일정`
- `/리디 규칙`
- `/리디 문의`
- `/공지 종류:봇사용안내`
- `/채널안내`

## Railway 배포 전후 확인 루틴

배포 전에는 `node --check src/index.js`, `node --check src/deploy-commands.js`, `npm run validate:data`, `npm run test:questions`를 실행합니다. 배포 후에는 Railway에서 봇 상태가 Online인지 확인하고, 디스코드에서 `/안내`, `/질문`, `/채널안내`, `/공지` 응답을 확인합니다.

## Slash Command 등록

`npm run deploy`는 Slash Command 구조를 변경했을 때만 필요합니다. FAQ, 지식창고, 공지 템플릿, 채널 안내 데이터만 수정했다면 보통 다시 실행하지 않아도 됩니다.
