# 운영 가이드

리디파인 디스코드 안내 봇을 혼자 운영할 때 참고하는 운영 문서입니다.

## 참여자 입장 전 최종 점검 체크리스트

- Railway에서 봇 상태가 Online인지 확인합니다.
- 로컬에서 봇이 실행 중이 아닌지 확인합니다.
- 디스코드에서 `/안내`를 실행해 응답을 확인합니다.
- 디스코드에서 `/채널안내`를 실행해 채널 안내가 정상 표시되는지 확인합니다.
- 디스코드에서 `/질문`을 실행해 FAQ 응답이 정상 표시되는지 확인합니다.
- 디스코드에서 `/공지 종류:봇사용안내`를 실행해 공지 템플릿이 정상 표시되는지 확인합니다.
- `#봇-질문로그`에 미응답 질문 로그가 기록되는지 확인합니다.
- 운영진 전용 채널을 참여자가 볼 수 없는지 권한을 확인합니다.
- 봇 사용 안내 공지를 참여자가 보기 쉬운 채널에 고정합니다.

## 참여자에게 안내할 기본 명령어

- `/안내`
- `/채널안내`
- `/질문 내용:궁금한 내용`

## 운영진용 명령어

- `/공지 종류:봇사용안내`
- `/공지 종류:일정안내`
- `/공지 종류:참여리마인드`
- `/공지 종류:준비물`
- `/공지 종류:결석안내`
- `/공지 종류:문의안내`

## 미응답 질문 로그 운영 방법

`/질문` 명령어가 FAQ에서 답변을 찾지 못하면 `LOG_CHANNEL_ID`가 설정된 경우 `#봇-질문로그`에 질문 내용과 시간이 기록됩니다.

운영 중에는 `#봇-질문로그`를 주기적으로 확인하고, 반복해서 들어오는 질문을 `data/faq.json`에 FAQ로 추가합니다. FAQ로 쓰기에는 넓은 프로그램 설명이나 배경 안내에 가까운 질문은 `data/knowledge.json`에 지식창고 항목으로 추가합니다. 반영한 뒤에는 같은 질문을 `/질문`으로 다시 테스트해 봇이 새 답변을 찾는지 확인합니다.

미응답 질문 로그에는 사용자 이름이나 사용자 ID를 기록하지 않습니다. 운영자는 질문 내용만 보고 FAQ 개선에 활용합니다.

## FAQ 수정 루틴

1. `data/faq.json`을 수정합니다.
2. 데이터 구조와 JSON 문법을 확인합니다.

```bash
npm run validate:data
```

3. 로컬에서 FAQ/지식창고 질문 매칭 결과를 확인합니다.

```bash
npm run test:questions
```

4. Fallback 질문은 이후 FAQ 또는 지식창고 보강 재료로 모아 둡니다.
5. 디스코드에서 `/질문 내용:수정한 질문 예시`를 실행해 답변을 테스트합니다.
6. 변경 내용을 확인합니다.

```bash
git status
git diff
```

7. 문제가 없으면 커밋하고 푸시합니다.

```bash
git add .
git commit -m "FAQ 업데이트"
git push
```

8. Railway에서 자동 재배포가 완료되고 봇이 Online 상태인지 확인합니다.

## 지식창고 수정 루틴

1. `data/knowledge.json`을 수정합니다.
2. 각 항목에 `id`, `title`, `keywords`, `summary`, `content`가 있는지 확인합니다.
3. 운영진 확인이 필요한 내용, 일정, 참여 확정 여부, 정신건강·위기 판단은 단정하지 않고 문의 채널이나 운영진 안내로 연결되도록 작성합니다.
4. 데이터 구조와 JSON 문법을 확인합니다.

```bash
npm run validate:data
```

5. 로컬에서 FAQ/지식창고 질문 매칭 결과를 확인합니다.

```bash
npm run test:questions
```

6. 디스코드에서 `/질문 내용:수정한 지식창고 질문 예시`를 실행해 답변을 테스트합니다.
7. FAQ 답변이 먼저 검색되고, FAQ에 없을 때 지식창고 답변이 표시되는지 확인합니다.

## 공지 템플릿 수정 루틴

1. `data/notices.json`을 수정합니다.
2. 데이터 구조와 JSON 문법을 확인합니다.

```bash
npm run validate:data
```

3. 디스코드에서 수정한 종류의 `/공지`를 실행합니다.
4. 공지 문구, 줄바꿈, 링크, 안내 대상이 의도대로 표시되는지 확인합니다.

## 채널 안내 수정 루틴

1. `data/channels.json`을 수정합니다.
2. 데이터 구조와 JSON 문법을 확인합니다.

```bash
npm run validate:data
```

3. 디스코드에서 `/채널안내`를 실행합니다.
4. 채널 이름, 설명, 분류가 실제 디스코드 서버 구조와 맞는지 확인합니다.

## 커밋 전 자동 검증 확인

커밋 전에는 로컬에서 기본 검증을 먼저 실행합니다.

```bash
node --check src/index.js
node --check src/deploy-commands.js
npm run validate:data
npm run test:questions
```

push 또는 pull request를 올린 뒤에는 GitHub의 Actions 탭이나 PR 하단 checks 영역에서 `CI` 결과가 성공인지 확인합니다. 실패한 경우 실패한 단계의 로그를 보고 수정한 뒤 다시 push합니다.

## 배포/운영 주의사항

- `.env`는 절대 커밋하지 않습니다.
- `.env.example`에는 실제 토큰이나 실제 채널 ID를 넣지 않고 예시값만 넣습니다.
- Railway Variables에는 실제 `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `LOG_CHANNEL_ID` 값을 넣습니다.
- 로컬에서 `npm run start`로 봇을 켠 상태에서 Railway 봇도 동시에 켜져 있으면 충돌할 수 있습니다.
- FAQ, 지식창고, 공지 템플릿, 채널 안내 데이터만 수정했다면 `npm run deploy`는 필요하지 않습니다.
- Slash Command 구조를 바꾸면 `npm run deploy`로 명령어를 다시 등록해야 합니다.

## 자주 쓰는 명령어 모음

```bash
git status
git diff
node --check src/index.js
node --check src/deploy-commands.js
npm run validate:data
npm run test:questions
git add .
git commit -m "..."
git push
```
