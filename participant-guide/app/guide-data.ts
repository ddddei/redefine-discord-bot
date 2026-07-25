export const guideNav = [
  { id: "quick-start", label: "빠른 시작" },
  { id: "first-72-hours", label: "처음 72시간" },
  { id: "commands", label: "Discord 명령어" },
  { id: "missions", label: "미션과 포인트" },
  { id: "help", label: "문의와 DM" },
  { id: "faq", label: "문제 해결" },
] as const;

export const quickSteps = [
  {
    title: "참여동의 안내 확인",
    description: "운영진이 안내한 참여동의 채널을 먼저 읽어\u00a0주세요.",
    complete: "안내를 읽었다면 완료",
  },
  {
    title: "이름표와 색상 고르기",
    description: "서로 편하게 알아볼\u00a0수\u00a0있는 표시를 고릅니다.",
    complete: "나를 표시할 준비가 됐다면 완료",
  },
  {
    title: "채팅창에서 /안내 실행",
    description: "처음 온 참여자용 메뉴에서 오늘 필요한 항목을 골라 봅니다.",
    complete: "/안내 화면이 열리면 완료",
  },
] as const;

export const timeline = [
  { time: "0–24시간", title: "공간 익히기", description: "기본 공지와 참여동의를 보고 이름표와\u00a0색상을\u00a0정합니다." },
  { time: "24–48시간", title: "필요한 채널 찾기", description: "/채널안내와 /질문으로 어디에 무엇을 남길지\u00a0확인합니다." },
  { time: "48–72시간", title: "가볍게 참여하기", description: "체크인이나 오늘의 미션을 살펴보고 가능한\u00a0만큼만 참여합니다." },
  { time: "72시간 이후", title: "내 방식으로 이어가기", description: "운영진 확인 후 보이는 채널이 달라질\u00a0수\u00a0있으며 역할은 평가나 등급이 아닙니다." },
] as const;

export const commands = [
  { command: "/안내", when: "처음 시작하거나 길을 잃었을 때", result: "시작 가이드와 주요 메뉴를 엽니다.", visibility: "본인에게만 표시" },
  { command: "/채널안내", when: "어디에 글을 써야 할지 모를 때", result: "주요 채널의 용도를 확인합니다.", visibility: "현재 채널에 표시" },
  { command: "/체크인", when: "오늘의 상태를 가볍게 남길 때", result: "내 상태를 기록하고 안내를 받습니다.", visibility: "본인에게만 표시" },
  { command: "/미션", when: "참여할 활동을 찾을 때", result: "현재 참여 가능한 미션을 봅니다.", visibility: "본인에게만 표시" },
  { command: "/포인트", when: "승인 결과와 잔액을 볼 때", result: "내 포인트와 최근 기록을 확인합니다.", visibility: "본인에게만 표시" },
  { command: "/상점", when: "교환 가능한 항목을 볼 때", result: "항목과 신청 전 확인 내용을 봅니다.", visibility: "본인에게만 표시" },
  { command: "/질문", when: "가벼운 질문이나 규칙이 궁금할\u00a0때", result: "자료를 찾고 필요한 경우 운영진\u00a0문의로\u00a0연결합니다.", visibility: "답변에 따라 다름" },
] as const;

export const faqs = [
  {
    question: "채널이 다른 사람보다 적게 보여요.",
    answer: "처음 72시간에는 필요한 채널부터 보이도록 운영할\u00a0수\u00a0있습니다. 72시간이 지났거나 이용이 어렵다면 운영진 문의 채널에 알려\u00a0주세요.",
  },
  {
    question: "미션을 했는데 포인트가 안 들어왔어요.",
    answer: "인증 글에 운영진의 승인 반응이 있는지 먼저 확인하고 /포인트를 실행해\u00a0주세요. 승인 후에도 기록이 없다면 인증 글 링크와 함께 운영진에게 문의해\u00a0주세요.",
  },
  {
    question: "모든 활동에 참여해야 하나요?",
    answer: "아니요. 체크인, 미션, 포인트, 미니게임과 상점은 선택 활동입니다. 읽기만 하거나 쉬어 가는 날이 있어도 괜찮습니다.",
  },
  {
    question: "봇에게 DM으로 대화해도 되나요?",
    answer: "운영진이 DM 대화 기능을 열어 둔 경우에만 짧은 대화 연습을 할\u00a0수\u00a0있습니다. 첫 DM의 기록·보존 안내를 확인하고, 상담이나 긴급 대응은 사람에게 직접 요청해\u00a0주세요.",
  },
  {
    question: "개인적인 질문은 어디에 남기나요?",
    answer: "공개 채널에 전화번호, 주소, 계정 정보 같은 개인정보를 자세히 쓰지\u00a0말고 운영진 문의 채널이나 안내받은 개별 연락 방법을 이용해\u00a0주세요.",
  },
] as const;

export const searchIndex = [
  { id: "quick-start", label: "처음 들어왔을 때 무엇을 하나요?", summary: "참여동의, 이름표와 색상, /안내 순서로 시작합니다.", keywords: "처음 시작 가입 입장 온보딩 참여동의 이름표 색상 안내" },
  { id: "first-72-hours", label: "처음 72시간에는 무엇이 달라지나요?", summary: "필요한 채널부터 익히고 선택 활동을 천천히 살펴봅니다.", keywords: "72시간 채널 역할 안보여요 적게 보여요 온보딩" },
  { id: "commands", label: "/안내 사용법", summary: "처음 온 참여자용 메뉴와 다음 행동을 확인합니다.", keywords: "명령어 슬래시 도움 시작 길 잃음" },
  { id: "commands", label: "/체크인 사용법", summary: "오늘의 상태를 본인에게만 보이게 기록합니다.", keywords: "명령어 상태 오늘 기록 출석" },
  { id: "commands", label: "/미션 사용법", summary: "현재 참여 가능한 선택형 활동을 확인합니다.", keywords: "명령어 활동 참여 인증" },
  { id: "commands", label: "/포인트 사용법", summary: "내 포인트 잔액과 최근 기록을 확인합니다.", keywords: "명령어 점수 잔액 지급 승인 결과" },
  { id: "commands", label: "/상점 사용법", summary: "교환 가능한 항목과 신청 전 확인 내용을 봅니다.", keywords: "명령어 교환 상품 신청 환불" },
  { id: "missions", label: "미션 인증과 승인", summary: "미션을 고르고 인증을 남기면 운영진 확인 후 포인트가 기록됩니다.", keywords: "미션 사진 영상 글 인증 반응 승인 지급" },
  { id: "help", label: "운영진에게 문의하기", summary: "개인적인 상황과 역할·채널 문제는 운영진 문의 채널을 이용합니다.", keywords: "문의 질문 도움 운영자 개인 비공개" },
  { id: "help", label: "봇 DM과 개인정보", summary: "DM 기능은 운영 설정에 따라 다르며 기록 안내를 먼저 확인합니다.", keywords: "디엠 대화 개인정보 기록 보존 전화번호 상담 긴급" },
  { id: "help", label: "전화로 문의하기", summary: "광명시 청년동 대표번호 02-2066-8134 (평일 09:00~18:00), 홈페이지 채널톡도 이용할 수 있습니다.", keywords: "전화 문의 대표번호 청년동 연락처 채널톡 통화" },
  { id: "faq", label: "채널이 적게 보일 때", summary: "72시간 이후에도 불편하면 운영진에게 알려\u00a0주세요.", keywords: "채널 안보여요 없음 권한 역할 72시간" },
  { id: "faq", label: "미션을 했는데 포인트가 안 들어왔어요", summary: "승인 반응과 /포인트 기록을 확인한 뒤 운영진에게\u00a0문의합니다.", keywords: "미션을 했는데 포인트가 안 들어왔어요 포인트 미지급 누락 승인 오류 안들어옴" },
] as const;
