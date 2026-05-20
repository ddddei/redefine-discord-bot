# 프로젝트 리디파인 디스코드 안내 봇

프로젝트 리디파인 참여자들이 디스코드 안에서 프로그램 일정, 규칙, FAQ, 공지 템플릿, 채널 안내를 확인할 수 있도록 만든 안내 봇입니다.

## 지원 명령어

- `/안내`
  처음 온 참여자를 위한 디스코드 사용 안내를 보여줍니다.

- `/질문 내용:궁금한 내용`
  먼저 `data/faq.json`에서 관련 답변을 찾고, 없으면 `data/knowledge.json`에서 프로그램 지식창고를 한 번 더 검색해 안내합니다. 그래도 답변을 찾지 못한 질문은 `LOG_CHANNEL_ID`가 설정된 경우 운영진 로그 채널에 질문 내용과 시간만 기록됩니다.

- `/리디 도움`
  사용할 수 있는 명령어를 안내합니다.

- `/리디 일정`
  프로그램 일정 확인 방법을 안내합니다.

- `/리디 규칙`
  리디파인 커뮤니티 약속을 안내합니다.

- `/리디 문의`
  문의 방법을 안내합니다.

- `/공지 종류:일정안내`
  운영진이 복사해 사용할 수 있는 공지 템플릿을 보여줍니다. 실행한 사람에게만 보이도록 설정되어 있습니다.

- `/공지 종류:봇사용안내`
  참여자 입장 전에 안내 봇 사용법을 공지할 수 있는 운영진용 템플릿을 보여줍니다.

- `/채널안내`
  리디파인 디스코드 주요 채널의 용도를 안내합니다.

## data 폴더

- `data/faq.json`
  `/질문` 명령어가 검색하는 FAQ 데이터입니다. 각 항목은 `keywords`, `question`, `answer` 구조를 사용합니다.

- `data/knowledge.json`
  FAQ에 없는 질문을 보완하기 위한 프로그램 지식창고입니다. 각 항목은 `id`, `title`, `keywords`, `summary`, `content` 구조를 사용하며, 운영진 확인이 필요한 내용은 단정하지 않도록 작성합니다.
  커뮤니티 약속 관련 안내도 함께 포함합니다.

- `data/notices.json`
  `/공지` 명령어에서 사용하는 공지 템플릿입니다. 일정 안내, 봇 사용 안내, 참여 리마인드, 문의 안내, 준비물, 결석 안내 문안을 관리합니다.

- `data/channels.json`
  `/채널안내` 명령어에서 사용하는 채널 안내 데이터입니다. 제목, 소개 문구, 카테고리별 채널 설명을 관리합니다.

- `data/test-questions.json`
  운영자가 로컬에서 FAQ와 지식창고 매칭을 점검할 때 사용하는 질문 목록입니다.

JSON 파일이 없거나 문법 오류가 있어도 봇이 바로 종료되지 않도록 fallback 안내를 사용합니다. 다만 실제 운영 전에는 JSON 문법 검사를 꼭 해 주세요.

## 코드 구조

- `src/index.js`
  봇 실행 진입점입니다. Discord client를 만들고 이벤트를 연결한 뒤 로그인합니다.

- `src/handlers.js`
  `/안내`, `/질문`, `/리디`, `/공지`, `/채널안내` 명령어 응답을 처리합니다.

- `src/search.js`
  FAQ와 지식창고 질문 매칭 로직을 관리합니다. `findFaqAnswer`, `findKnowledgeAnswer`는 테스트 스크립트에서도 사용합니다.

- `src/data.js`
  `data/*.json` 파일 경로, fallback 데이터, JSON 로드를 관리합니다.

- `src/embeds.js`
  참여자에게 보여주는 Discord Embed 생성과 길이 제한 처리를 담당합니다.

- `src/logging.js`
  미응답 질문 로그 시간 포맷과 로그 전송을 담당합니다. 사용자 이름이나 사용자 ID는 기록하지 않습니다.

데이터를 수정한 뒤에는 아래 명령어로 구조와 매칭 결과를 확인해 주세요.

```bash
npm run validate:data
npm run test:questions
```

## FAQ 수정 방법

`data/faq.json`에 FAQ 항목을 추가하거나 수정하면 됩니다.

```json
{
  "keywords": ["문의", "연락", "운영진"],
  "question": "문의는 어디로 하면 되나요?",
  "answer": "궁금한 점이 있으면 디스코드 문의 채널에 남겨주세요."
}
```

- `keywords`에는 사용자가 입력할 만한 짧은 표현을 여러 개 넣어 주세요.
- `question`은 봇이 답변 제목으로 보여줄 문장입니다.
- `answer`는 봇이 실제로 안내할 답변입니다.
- 수정 후에는 JSON 쉼표, 따옴표, 대괄호가 올바른지 확인해 주세요.

## 환경변수

로컬에서는 `.env` 파일을 만들고, Railway에서는 Variables에 같은 이름으로 등록합니다. 실제 토큰이나 실제 ID는 README에 적지 않습니다.

필수:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`

선택:

- `LOG_CHANNEL_ID`
  `/질문`에서 FAQ 답변을 찾지 못한 질문을 운영진 로그 채널에 기록할 때 사용합니다. 설정하지 않아도 봇은 정상 동작합니다.

## 실행 방법

패키지 설치:

```bash
npm install
```

Slash Command 등록:

```bash
npm run deploy
```

봇 실행:

```bash
npm run start
```

## 로컬 확인

```bash
node --check src/index.js
node --check src/deploy-commands.js
npm run validate:data
npm run test:questions
```

## 자동 검증

GitHub Actions가 push와 pull request마다 기본 검증을 실행합니다. 로컬에서는 커밋 전에 아래 명령어로 먼저 확인할 수 있습니다.

```bash
npm run validate:data
npm run test:questions
```

## 개발/운영용 명령어

- `npm run validate:data`
  FAQ, 지식창고, 공지 템플릿, 채널 안내, 테스트 질문 데이터의 JSON 문법과 필수 구조를 확인합니다.

- `npm run test:questions`
  `data/test-questions.json`의 질문이 FAQ / Knowledge / Fallback 중 어디에 매칭되는지 로컬 터미널에서 확인합니다.

Slash Command 구조를 변경했을 때만 운영 서버에 `npm run deploy`로 명령어를 다시 등록합니다. 데이터만 수정했다면 보통 필요하지 않습니다.

디스코드에서는 `/질문`, `/공지 종류:봇사용안내`, `/채널안내`를 직접 실행해 응답을 확인해 주세요.

## 운영 가이드

운영 문서 전체 목록은 [docs/README.md](docs/README.md)를 참고해 주세요.

혼자 봇을 운영할 때 필요한 점검표와 수정 루틴은 [docs/operation-guide.md](docs/operation-guide.md)를 참고해 주세요.

참여자 입장 전 공지문 패키지는 [docs/participant-notice-pack.md](docs/participant-notice-pack.md)를 참고해 주세요.

운영진 문의 대응 템플릿은 [docs/operator-response-templates.md](docs/operator-response-templates.md)를 참고해 주세요.

운영 문제 상황 대응은 [docs/incident-response-guide.md](docs/incident-response-guide.md)를 참고해 주세요.

## 운영 릴리즈 체크리스트

참여자 입장 전에는 [docs/release-checklist.md](docs/release-checklist.md)를 확인해 최종 운영 점검을 진행해 주세요.
