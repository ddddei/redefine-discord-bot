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

운영 중에는 `#봇-질문로그`를 주기적으로 확인하고, 반복해서 들어오는 질문을 `data/faq.json`에 FAQ로 추가합니다. FAQ에 반영한 뒤에는 같은 질문을 `/질문`으로 다시 테스트해 봇이 새 답변을 찾는지 확인합니다.

미응답 질문 로그에는 사용자 이름이나 사용자 ID를 기록하지 않습니다. 운영자는 질문 내용만 보고 FAQ 개선에 활용합니다.

## FAQ 수정 루틴

1. `data/faq.json`을 수정합니다.
2. JSON 문법을 확인합니다.

```bash
node -e "JSON.parse(require('fs').readFileSync('data/faq.json', 'utf8')); console.log('faq.json OK')"
```

3. 디스코드에서 `/질문 내용:수정한 질문 예시`를 실행해 답변을 테스트합니다.
4. 변경 내용을 확인합니다.

```bash
git status
git diff
```

5. 문제가 없으면 커밋하고 푸시합니다.

```bash
git add .
git commit -m "FAQ 업데이트"
git push
```

6. Railway에서 자동 재배포가 완료되고 봇이 Online 상태인지 확인합니다.

## 공지 템플릿 수정 루틴

1. `data/notices.json`을 수정합니다.
2. JSON 문법을 확인합니다.

```bash
node -e "JSON.parse(require('fs').readFileSync('data/notices.json', 'utf8')); console.log('notices.json OK')"
```

3. 디스코드에서 수정한 종류의 `/공지`를 실행합니다.
4. 공지 문구, 줄바꿈, 링크, 안내 대상이 의도대로 표시되는지 확인합니다.

## 채널 안내 수정 루틴

1. `data/channels.json`을 수정합니다.
2. JSON 문법을 확인합니다.

```bash
node -e "JSON.parse(require('fs').readFileSync('data/channels.json', 'utf8')); console.log('channels.json OK')"
```

3. 디스코드에서 `/채널안내`를 실행합니다.
4. 채널 이름, 설명, 분류가 실제 디스코드 서버 구조와 맞는지 확인합니다.

## 배포/운영 주의사항

- `.env`는 절대 커밋하지 않습니다.
- `.env.example`에는 실제 토큰이나 실제 채널 ID를 넣지 않고 예시값만 넣습니다.
- Railway Variables에는 실제 `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `LOG_CHANNEL_ID` 값을 넣습니다.
- 로컬에서 `npm run start`로 봇을 켠 상태에서 Railway 봇도 동시에 켜져 있으면 충돌할 수 있습니다.
- Slash Command 구조를 바꾸면 `npm run deploy`로 명령어를 다시 등록해야 합니다.

## 자주 쓰는 명령어 모음

```bash
git status
git diff
node --check src/index.js
node --check src/deploy-commands.js
node -e "JSON.parse(require('fs').readFileSync('data/faq.json', 'utf8')); console.log('faq.json OK')"
node -e "JSON.parse(require('fs').readFileSync('data/notices.json', 'utf8')); console.log('notices.json OK')"
node -e "JSON.parse(require('fs').readFileSync('data/channels.json', 'utf8')); console.log('channels.json OK')"
git add .
git commit -m "..."
git push
```
