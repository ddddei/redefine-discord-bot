const fs = require('fs');
const path = require('path');
const { getOperationDataPaths } = require('./operationDataPaths');
const { normalizeExportFormat, toCsv, toSafeJson } = require('./exportUtils');
const { saveJsonFileAtomic } = require('./jsonStorage');

const DATA_DIR = path.join(__dirname, '..', 'data');
const OPERATION_PATHS = getOperationDataPaths();
const DEFAULT_PATHS = {
  logs: OPERATION_PATHS.dungeonworldLogs,
  logsFallback: path.join(DATA_DIR, 'dungeonworld-logs.example.json'),
  config: OPERATION_PATHS.dungeonworldConfig,
  configFallback: path.join(DATA_DIR, 'dungeonworld-config.example.json'),
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// 회차(SESSION) 콘텐츠 정의.
// 새 회차를 추가하려면:
//   1. 아래와 같은 모양의 회차 객체를 새로 만든다
//      { id, title, intro, closingNote, choices: { <choiceId>: { id, label, approachLabel, outcomes: { strong, mixed, weak } }, ... } }
//   2. SESSIONS 맵에 등록하고 SESSION_ORDER 배열에 id를 추가한다.
//   3. 해당 회차를 참여자에게 보여줄 시점이 되면 DEFAULT_SESSION_ID를 그 회차 id로 바꾼다.
// 판정 메커닉(2d6, TIER_LABELS, resolveTier)은 회차 공통이라 회차 객체 밖에 둔다.

const SESSION_01_INTRO = [
  '변방 여관 `마른 참나무`의 난로 곁, 여관 주인 마라가 묻습니다. "이런 밤에 이 마을까지 온 사람은 흔치 않은데, 당신은 무슨 일로 여기까지 왔소?" 문가에서는 경비병 토른이 창에 기대어 마을 어귀를 살피고 있습니다.',
  '대답할 틈도 없이 지도 조각이 문 아래로 밀려 들어오고, 멀리서 검은 종소리가 울립니다. 종소리는 마을 북쪽, 안개에 잠긴 탑 쪽에서 들려온 것 같습니다.',
  '고블린 정찰병이 그 지도 조각을 빼앗아 북쪽 숲길로 달아나려 합니다. 토른이 먼저 칼자루를 잡으며 당신을 돌아봅니다.',
].join('\n');

const SESSION_01_BLACK_BELL = {
  id: 'session_01_black_bell',
  title: '1회차. 변방 여관의 검은 종',
  intro: SESSION_01_INTRO,
  closingNote: '지도 조각과 숲길 표식이 다음 회차, 뿌리 아래로 이어진 길로 이어집니다. 다음에 이어서 해볼 수 있어요.',
  // introVariants: 직전 회차에서 이 참여자가 받은 결과 등급(strong/mixed/weak)에 따라 다른 도입부를 보여줄 때 사용한다.
  // 직전 회차 기록이 없으면(첫 회차이거나 아직 플레이하지 않았으면) default를 사용한다.
  introVariants: {
    default: SESSION_01_INTRO,
    strong: [
      '지난번 만남이 깔끔하게 풀린 덕에, 여관 `마른 참나무`의 마라는 당신을 반갑게 맞습니다. "지난번 그 일, 다들 칭찬하더군요."',
      '이야기를 나누는 사이 지도 조각이 문 아래로 밀려 들어오고, 멀리서 검은 종소리가 울립니다.',
      '고블린 정찰병이 그 지도 조각을 빼앗아 북쪽 숲길로 달아나려 합니다.',
    ].join('\n'),
    mixed: [
      '지난번 일은 무사히 끝났지만, 약간의 뒷말이 남았습니다. 여관 `마른 참나무`의 마라가 묻습니다. "이번엔 또 무슨 일로 왔소?"',
      '말이 끝나기도 전에 지도 조각이 문 아래로 밀려 들어오고, 멀리서 검은 종소리가 울립니다.',
      '고블린 정찰병이 그 지도 조각을 빼앗아 북쪽 숲길로 달아나려 합니다.',
    ].join('\n'),
    weak: [
      '지난번 일이 예상과 다르게 흘러간 탓에, 여관 `마른 참나무`의 마라는 조심스럽게 당신을 맞습니다. "이번엔 무사히 풀리길 바라죠."',
      '그 사이 지도 조각이 문 아래로 밀려 들어오고, 멀리서 검은 종소리가 울립니다.',
      '고블린 정찰병이 그 지도 조각을 빼앗아 북쪽 숲길로 달아나려 합니다.',
    ].join('\n'),
  },
  choices: {
    pursue: {
      id: 'pursue',
      label: '고블린을 바로 추격한다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '토른이 먼저 칼자루를 놓고 문을 박차며 달려 나가고, 당신도 곧장 그 뒤를 따라 차가운 밤공기 속으로 뛰어듭니다. "이 길로! 발자국이 비탈 쪽으로 꺾였소!" 토른이 외치는 대로 진흙투성이 비탈을 오르자, 굵은 뿌리가 땅 위로 솟은 자리에서 고블린의 발이 그대로 걸려 넘어집니다. 손에 쥐고 있던 지도 조각과 숲길 표식이 한꺼번에 허공으로 튕겨 나가고, 당신은 몸을 날려 둘 다 흠 하나 없이 받아 냅니다. 토른이 다가와 흙 묻은 표식을 받아 들고는, 안쪽에 파고든 무늬를 손끝으로 쓸어 보다 낯빛이 굳습니다. "이건… 본 적 있는 무늬요. 안개 탑 아래, 뿌리가 얽힌 길로 이어지는 표식이지." 그가 표식을 도로 건네며 낮게 덧붙입니다. "다음에 저 탑 밑으로 내려갈 일이 생기면, 이게 길잡이가 될 거요."',
        mixed: '토른과 함께 숲길로 뛰어들어 고블린의 등을 거의 따라잡았지만, 녀석은 마지막 순간 몸을 던져 낡은 울타리 너머로 빠져나갑니다. 뒤엉킨 몸싸움 중에 지도 조각 한 귀퉁이가 찢기고, 토른의 방패에도 깊게 긁힌 흔적이 남습니다. "괜찮소, 일단 숨을 돌립시다." 토른이 방패를 내려놓으며 거칠게 숨을 내쉽니다. 진흙 위에 떨어진 숲길 표식을 주워 들지만, 뿌리 무늬는 반쪽만 남아 어디로 이어지는지 가늠하기 어렵습니다. 토른이 찢어진 지도 조각을 불빛에 비춰 보며 고개를 젓습니다. "서두르면 또 이렇게 될 거요. 다음엔 이 반쪽짜리 무늬부터 제대로 맞춰 봐야겠소." 그 말이 마치 다음 걸음을 미리 일러 주는 것처럼 들립니다.',
        weak: '고블린은 지도 조각 일부를 찢어 손에 쥔 채 안개 자욱한 숲 가장자리, 어둠이 짙게 깔린 나무 사이로 사라져 버립니다. 토른이 횃불을 들고 바닥을 훑지만, 발자국은 금세 진흙과 안개 속에 뒤섞여 자취를 감춥니다. "이 상태로 더 들어가면 우리가 길을 잃을 거요." 토른이 횃불을 거두며 단호하게 말립니다. 멀리서 다시 한 번, 더 낮고 음울하게 검은 종소리가 울리고, 안개 너머 탑의 윤곽이 잠깐 드러났다가 곧 흐려집니다. 토른이 그 쪽을 바라보며 중얼거립니다. "저 탑 아래로 이어진 뿌리 길… 표식 없이 들어섰다간 우리가 먼저 삼켜질 거요." 지금은 물러서야겠지만, 그 뿌리 길은 분명 다음에 다시 마주치게 될 것 같습니다.',
      },
    },
    investigate: {
      id: 'investigate',
      label: '여관과 마을을 먼저 조사한다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '난로 곁에 머물러 마라와 토른에게 차례로 묻습니다. 여관 안은 장작 타는 냄새와 흐릿한 등불 빛으로 가득하고, 마라는 한참 머뭇거리다 입을 엽니다. "지도 조각이 문 아래로 들어오던 그 순간, 창밖으로 그림자 하나가 스쳐 지나가는 걸 봤소." 토른이 곧장 당신을 우물가로 이끕니다. 차가운 돌 틀에 둘러싸인 우물 옆, 검은 종소리가 남긴 그을음 자국이 또렷하게 찍혀 있습니다. 토른이 그 위에 손을 얹고 말합니다. "이건 안개 탑 쪽 길에서만 나는 그을음이오. 흙 속 뿌리를 타고 올라오는 길이지." 지도 조각은 손상 없이 보호했고, 마라의 보급품과 토른의 낡은 방패까지 챙겼으니, 안개 탑으로 이어진 뿌리 길의 방향을 이미 알아 둔 셈입니다. 토른이 표식을 가리키며 덧붙입니다. "다음에 저기로 내려갈 때, 이 자국이 입구를 알려 줄 거요."',
        mixed: '단서를 찾기는 했지만 시간이 꽤 걸렸습니다. 여관 안에서 마라가 그림자를 봤다고 인정하면서도 카운터를 손가락으로 두드리며 조건을 붙입니다. "보급을 내주려면, 작은 부탁 하나는 들어줘야겠소." 토른은 우물가로 안내해 그을린 표식을 발견하지만, 밤새 내린 빗물에 절반쯤 흐려진 자국을 보며 한숨을 내쉽니다. "방향은 알겠는데, 고블린은 이미 멀리 달아난 뒤요." 우물 너머 안개 속에서 탑의 윤곽이 잠깐 비쳤다가 다시 흐려집니다. 토른이 그쪽을 바라보며 말합니다. "흐려진 자국이라도 뿌리 길 방향은 가리키고 있소. 다음에 마라의 부탁부터 해결하고 가는 게 낫겠소." 마라에게 진 작은 빚이 다음 걸음을 무겁게 만들 듯합니다.',
        weak: '마을을 살피는 동안 고블린은 완전히 자취를 감췄습니다. 지도 조각은 지켜냈지만, 우물가의 표식은 밤새 내린 비에 거의 씻겨 나가 토른도 흙바닥에 무릎을 꿇고 한참을 들여다봅니다. "이 흔적만으론 방향을 가늠할 수가 없소." 그가 일어서며 고개를 젓습니다. 마라도 카운터 너머에서 조용히 지켜보다 말합니다. "그림자는 봤지만, 어디로 갔는지는 나도 모르겠소." 멀리 북쪽, 안개에 잠긴 탑 쪽에서 또 한 번 종소리가 낮게 울리고, 그 소리만이 뿌리 길이 여전히 그곳에서 기다리고 있음을 알려 줍니다. 안개 탑으로 가는 길은 다음에 처음부터 다시 찾아야 할 것 같습니다.',
      },
    },
    negotiate: {
      id: 'negotiate',
      label: '렌과 거래해 지도의 출처를 묻는다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '여관 구석, 어둑한 자리에 앉은 렌을 찾아가 지도의 출처를 묻습니다. 그는 한동안 손에 든 잔을 빙빙 돌리며 망설이다, 결국 목소리를 낮춰 입을 엽니다. "그 지도, 원래는 뿌리 아래로 이어진 길을 그린 거요. 안개 탑 밑에, 사람들이 잘 모르는 통로가 있지." 그는 탁자에 손가락으로 길을 그려 보이며 숲길 표식의 정확한 위치까지 순순히 짚어 줍니다. 옆에서 듣고 있던 토른이 팔짱을 끼고 중얼거립니다. "그 말이 맞다면, 우리가 가려는 곳은 생각보다 깊겠소." 렌이 잔을 비우며 마지막으로 한마디 덧붙입니다. "그 길, 끝까지 가 본 사람은 아직 못 봤소." 다음 숲길 판정에 분명한 이점을 만든 것은 물론, 뿌리 아래 길의 정체에 한 걸음 더 다가선 셈입니다.',
        mixed: '렌은 거래에 응하긴 하지만 순순히 넘어가지 않습니다. "공짜로 줄 만한 얘기는 아니지." 그가 잔을 내려놓으며 의자를 당겨 앉습니다. 지도의 출처가 안개 탑 아래 뿌리 길이라는 단서를 흘리는 대신, 그는 작은 부탁 하나를 들어 달라고 못을 박습니다. "어렵지 않은 일이오. 다만 지금 당장은 말 못 하지." 토른이 옆에서 못마땅한 얼굴로 헛기침을 하지만, 렌은 눈도 깜빡이지 않습니다. 결국 렌에게 작은 빚을 지게 되었고, 그 빚이 언제 어떤 모습으로 되돌아올지는 알 수 없습니다. 토른이 여관을 나서며 낮게 말합니다. "저런 자와 거래할 땐 늘 뒷맛이 남는 법이오. 다음에 뿌리 길로 들어설 때 다시 떠오를 거요."',
        weak: '렌은 지도의 출처를 먼저 숨기고 더 큰 거래를 요구합니다. "이런 얘기는 그만한 값을 치러야지." 그가 의자에 등을 기대며 팔짱을 끼고는 더 이상 말을 잇지 않습니다. 토른이 옆에서 눈치를 주지만 렌은 태연하게 잔을 다시 채울 뿐입니다. 협상은 다음으로 미뤄야 할 것 같고, 안개 탑으로 가는 단서는 여전히 손에 잡히지 않습니다. 여관 문밖에서 또 한 번 검은 종소리가 희미하게 울리고, 토른이 그 소리에 귀를 기울이며 말합니다. "렌이 입을 열든 안 열든, 저 종소리는 우리를 뿌리 길로 부르고 있소." 언젠가는 렌의 입을 열게 할 다른 방법을 찾아야 할 듯합니다.',
      },
    },
  },
};

const SESSION_02_ROOTS_BELOW = {
  id: 'session_02_roots_below',
  title: '2회차. 뿌리 아래 고블린 길',
  intro: [
    '북쪽 숲의 뿌리 아래에서 종소리와 웃음소리가 섞여 들립니다. 가짜 표식과 진짜 표식이 어지럽게 뒤섞여 있고, 그 사이로 작은 그림자가 빠르게 움직입니다.',
    '겁 많고 말 빠른 고블린 길잡이 픽이 뿌리 틈에서 고개를 내밀며 속삭입니다. "잠깐, 잠깐! 거기 그대로 서 있어요. 작은 왕님이 들으면 우리 둘 다 끝장이라고요."',
    '뿌리 아래 작은 왕이 다스리는 소굴이 바로 앞입니다. 진짜 표식과 신전으로 가는 길이 고블린들의 흥정거리 속에 함께 섞여 있습니다.',
  ].join('\n'),
  closingNote: '이끼 언덕 끝에서 물그릇 문양이 빛나고, 픽은 "돌로 만든 놈들이 그 조각을 지킨다"고 속삭입니다. 다음 회차에서 그 의미를 알게 될 것 같습니다.',
  choices: {
    trade: {
      id: 'trade',
      label: '고블린과 거래한다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '픽은 식은땀을 닦으며 고개를 끄덕입니다. "좋아요, 좋아요, 그쪽이 마음에 들어요! 작은 왕님은 반짝이는 거라면 뭐든 좋아하거든요." 작은 왕에게는 빛나는 작은 종 하나를 슬쩍 건네 시선을 돌리게 하고, 그 틈에 진짜 표식을 빼내 챙깁니다. 픽은 신전 입구의 함정 위치까지 손가락으로 가리키며 알려주고, 작은 왕은 종을 흔들며 만족스러운 웃음소리만 낼 뿐 통행을 순순히 허락합니다. 신전으로 가는 길과 픽의 길 안내까지 모두 손에 넣었습니다.',
        mixed: '작은 왕은 의자에 늘어져 앉은 채 손가락을 까딱이며 묻습니다. "지도 조각이냐, 반짝이는 장비냐, 둘 중 하나는 내놔야지. 빈손으로 내 길을 지나가겠다는 건 아니겠지?" 결국 장비 하나를 통행세로 내주고 진짜 표식을 손에 넣습니다. 픽은 안도하며 고마워하지만, 작은 왕에게 진 빚을 다음에 갚겠다는 약속을 남겨야 했고, 그 약속이 어떤 형태로 돌아올지는 아직 알 수 없습니다.',
        weak: '작은 왕은 눈을 가늘게 뜨며 코웃음을 칩니다. "흥, 가져온 게 이게 다냐? 그럼 지도 조각은 내가 갖고 있겠다. 다음에 더 좋은 걸 가져오면 생각해보지." 거래는 절반만 성사되어, 신전 길로 향하는 물그릇 문양만 겨우 보여줄 뿐 지도 조각은 끝내 돌려받지 못합니다. 픽은 미안한 얼굴로 슬쩍 시선을 피하며 작게 중얼거립니다. "다음엔 더 좋은 거 가져와요, 그래야 저도 도와줄 명분이 생기니까요." 협상은 다음 기회로 미뤄야 할 것 같습니다.',
      },
    },
    disarm: {
      id: 'disarm',
      label: '함정을 해체하며 간다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '고블린 함정꾼들이 진짜 표식을 가짜 표식 더미 속에 숨기려는 순간, 줄을 정확히 끊어 덫을 무력화합니다. 픽이 뒤에서 휘파람을 불며 뛰어나와 외칩니다. "와, 진짜 잘하네요! 작은 왕님 밑에서 십 년을 살아도 이런 솜씨는 처음 봐요. 그럼 저도 같이 가요, 안내는 제가 할게요!" 진짜 표식을 깔끔하게 손에 넣고 픽까지 길잡이로 얻은 채, 신전 입구의 함정 위치까지 미리 모두 파악했습니다.',
        mixed: '덫을 대부분 해체하지만 마지막 하나가 작동하며 뿌리 구덩이 일부가 무너져 내립니다. 픽이 흙먼지 속에서 다급하게 소리칩니다. "조심해요, 조심해요! 그거 건드리면 작은 왕님이 바로 알아챈다고요, 우리 다 잡혀가요!" 진짜 표식은 간신히 손에 넣었지만 지도 조각 한쪽이 찢어져, 3회차로 이어지는 신전 입구의 함정 하나가 이미 깨어 있는 상태로 남게 되었습니다. 픽은 다친 발을 절뚝이며 뒤따라옵니다.',
        weak: '덫의 줄을 잘못 건드려 요란한 종소리가 숲 전체에 울리고, 놀란 함정꾼이 진짜 표식을 낚아채 어둠 속으로 달아납니다. 픽이 머리를 감싸며 절규하듯 외칩니다. "안 돼, 안 돼요! 이제 작은 왕님이 직접 나올 거예요, 저 이제 죽었어요!" 파티는 무너진 뿌리 구덩이를 위험하게 건너뛸지, 픽에게 빚을 지고 도움을 받을지 그 자리에서 빠르게 선택해야 하며, 멀리서 발소리가 점점 가까워집니다.',
      },
    },
    bypass: {
      id: 'bypass',
      label: '소굴을 우회한다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '뒤집힌 표식판 무더기를 차분히 뒤지며 물그릇 문양이 새겨진 진짜 표식을 정확히 찾아냅니다. 픽이 멀리 뿌리 틈에서 손을 흔들며 작게 속삭입니다. "거기, 거기예요! 그쪽 길이 안전해요, 작은 왕님도 다리가 짧아서 잘 안 가는 곳이거든요. 잘 골랐네요." 소굴을 누구에게도 들키지 않고 빠져나가 이끼 언덕까지 곧장 도착하고, 신전 입구의 경보도 끝내 울리지 않았으며, 픽은 멀리서 손을 흔들며 배웅합니다.',
        mixed: '우회로를 찾는 데는 성공하지만 표식을 분간하는 데 시간이 꽤 걸립니다. 신전 길은 결국 열렸지만, 서두르는 사이 지도 조각 한쪽이 찢어져 3회차 입구의 함정 하나가 이미 깨어 있는 상태로 남았습니다. 픽은 멀리 그늘 속에서 "조심해서 가요, 다음엔 더 빨리 찾아봐요!"라고 외칠 뿐, 더 가까이 다가와 도와주지는 못하고 곧 어둑한 그늘 속으로 모습을 감춥니다. 시간이 늦어진 만큼 마음이 급해집니다.',
        weak: '우회로로 보였던 길이 사실은 가짜 표식이 만든 함정이었고, 발밑이 무너지며 젖은 신전 회랑으로 그대로 추락합니다. 멀리서 들리던 작은 왕의 웃음소리가 한층 더 커지며 뿌리 사이로 울립니다. "역시 멍청한 놈들이군, 다 그쪽이 알아서 떨어진 거다!" 신전을 지키는 석상이 파티의 도착을 먼저 알아챈 듯, 차가운 돌 시선이 어둠 속에서 천천히 이쪽을 향해 움직이는 것이 느껴집니다.',
      },
    },
  },
};

const SESSION_03_LOCKED_BASIN = {
  id: 'session_03_locked_basin',
  title: '3회차. 무너진 신전의 잠긴 물그릇',
  intro: [
    '무너진 신전 한가운데, 물그릇 수면 위로 세 개의 문과 검은탑의 그림자가 어른거립니다. 지하 봉인실의 문이 낮은 신음을 내며 천천히 내려앉기 시작합니다.',
    '함께 따라온 픽이 물그릇 가장자리에 쪼그려 앉아 속삭입니다. "저 안에 첫 번째 열쇠가 있어요. 근데 저 석상들, 진짜로 움직이는 거 맞죠? 저는 절대 먼저 들어가는 쪽은 안 할 거예요."',
    '슬라임이 정지 문양의 홈을 끈적하게 메우고, 미믹은 열쇠 궤짝인 척 낮은 목소리로 말을 건넵니다. 두 석상이 천천히 맞물리며 파티와 물그릇 사이를 가로막습니다.',
  ].join('\n'),
  closingNote: '첫 번째 열쇠가 있던 홈 아래에는 창으로 그은 선과 함께 "이름과 임무를 말하라"는 오크의 문장이 새겨져 있습니다. 다음 회차, 협곡의 돌다리에서 그 말의 무게를 직접 마주하게 될 것 같습니다.',
  choices: {
    block: {
      id: 'block',
      label: '석상을 정면에서 막는다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '맞물리며 좁혀오는 두 석상 사이로 몸을 끼워 넣고 그대로 버텨냅니다. 픽이 뒤에서 발을 동동 구르며 외칩니다. "그 자세 그대로요! 딱 그만큼만 더 밀어내면 돼요, 할 수 있어요!" 버티는 동안 동료가 물그릇 바닥에서 첫 번째 열쇠 조각과 문지기 이름의 일부가 새겨진 파편을 함께 건져 올리고, 봉인실 문은 완전히 닫히기 전에 멈춰 섭니다. 석상은 다시 정적으로 돌아가고, 신전을 무사히 빠져나갈 길이 또렷하게 남았습니다.',
          mixed: '석상 사이를 막아서는 데는 성공하지만, 버티는 팔다리에 돌가루가 쏠리며 작은 상처가 남습니다. 픽이 다친 곳을 보고 울먹이듯 말합니다. "괜찮아요? 미안해요, 제가 더 빨리 알려줬어야 했는데..." 첫 번째 열쇠 조각은 손에 넣었지만, 서두르는 사이 한쪽 귀퉁이에 금이 가고 맙니다. 봉인실 문도 완전히 닫히기 전에 겨우 멈췄지만, 다음에 돌다리를 건널 때 오크에게 내보일 신전의 증거가 온전치 못하다는 사실이 마음에 걸립니다.',
        weak: '두 석상이 동시에 부딪쳐 오는 무게를 견디지 못하고 옆으로 밀려나며 물그릇 가장자리에 부딪힙니다. 미믹이 그 틈을 노려 낮은 소리로 웃으며 말합니다. "고마워, 덕분에 열쇠는 내가 가져갈게." 미믹은 첫 번째 열쇠 조각을 삼키고 다리 쪽 회랑으로 달아나고, 봉인실 문은 그대로 닫혀 파티는 안쪽과 바깥쪽으로 갈립니다. 픽은 발을 동동 구르며 "저 따라갈까요, 말까요!"라고 외칠 뿐 쉽게 다가오지 못합니다.',
      },
    },
    decode: {
      id: 'decode',
      label: '정지 문양을 해석한다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '물그릇 수면에 비친 세 개의 문 그림과 석상 가슴의 정지 문양을 차분히 맞춰 봅니다. 엘룬의 낡은 기록에 남은 문장과 같은 계열의 표식임을 확인하는 순간, 석상의 움직임이 그대로 멈춥니다. 픽이 감탄하며 속삭입니다. "와, 이런 걸 다 알아채다니. 작은 왕님 밑에 있을 때는 아무도 안 가르쳐 줬는데요." 정지 문양을 완전히 밝혀 첫 번째 열쇠 조각과 문지기 이름의 일부를 동시에 읽어 내고, 오래된 맹세의 구절까지 흠 없이 회수합니다.',
        mixed: '문양을 해석하는 데는 성공하지만 시간이 꽤 걸리고, 그 사이 석상 하나가 다리까지 천천히 다가옵니다. 픽이 안절부절못하며 말합니다. "거의 다 왔어요, 근데 저 돌덩이가 너무 가까워요!" 첫 번째 열쇠 조각과 벽의 맹세 문장은 손에 넣지만, 정지 문양은 딱 한 번만 더 쓸 수 있을 만큼만 남습니다. 다음 회차에서 오크 앞에 내보일 신전의 증거를 챙기긴 했지만, 어딘가 서두른 흔적이 남습니다.',
        weak: '문양을 살피는 데 너무 몰두한 사이, 봉인실 문이 예고 없이 빠르게 내려앉습니다. 엘룬의 낡은 기록을 끝까지 읽지 못한 채 갈라진 두 무리 중 바깥쪽에 남게 되고, 픽이 안쪽에서 다급하게 외칩니다. "저 혼자 석상 질문에 답해야 해요? 잠깐만요, 저 그런 거 잘 못해요!" 물그릇이 흔들리며 문지기 이름의 암시는 흐려지지만, 오크가 지키는 다리로 이어지는 좁은 수로가 그 틈에 드러납니다.',
      },
    },
    bargain: {
      id: 'bargain',
      label: '미믹과 거래한다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '열쇠 궤짝인 척 말을 걸어온 미믹에게 솔직하게 무엇을 원하는지 묻습니다. 미믹은 잠시 망설이다 입을 쩍 벌리며 말합니다. "음... 반짝이는 거 말고, 처음 보는 이야기를 해 줘. 그럼 토해 줄게." 여관에서 가져온 작은 보급품 이야기를 들려주자 미믹은 만족스럽게 훔쳐 먹었던 첫 번째 열쇠 조각과 은빛 단추를 그대로 토해 냅니다. 석상도 그 틈에 정지 문양을 드러내, 오래된 맹세의 구절까지 깔끔하게 챙길 수 있었습니다.',
        mixed: '미믹은 거래에 응하지만 더 큰 대가를 요구합니다. "이야기 하나로는 부족해. 그 반짝이는 단추도 같이 줘야지." 결국 은빛 단추를 내주는 대신 첫 번째 열쇠 조각을 무사히 돌려받습니다. 픽은 옆에서 안도하며 "그래도 다행이에요, 저 녀석 한번 화나면 진짜 무는 거 봤거든요"라고 중얼거리지만, 다음 회차에서 쓸 수 있었던 작은 보상 하나를 미믹에게 넘겨준 셈이 되었습니다.',
        weak: '미믹은 이야기도 단추도 모두 듣고 받아 챙기더니 정작 열쇠 조각은 내놓지 않습니다. "재밌었어. 근데 열쇠는 그냥 내가 갖고 있을래." 미믹이 키득거리며 균열 속으로 숨어드는 사이 봉인실 문이 빠르게 닫히기 시작합니다. 픽이 다급하게 손짓하며 외칩니다. "안 돼요, 빨리 나가야 해요! 저 문 닫히면 진짜 못 나가요!" 첫 번째 열쇠는 다음으로 미뤄야 할 것 같습니다.',
      },
    },
  },
};

const SESSION_04_ORC_BRIDGE = {
  id: 'session_04_orc_bridge',
  title: '4회차. 오크가 지키는 다리',
  intro: [
    '협곡을 가로지르는 돌다리 한가운데, 오크 문지기 바루크가 창을 들어 다리 위에 선을 긋습니다. "이 선을 넘는 자는 이유를 대야 한다. 너희는 무엇을 위해 건너려 하느냐?"',
    '초소 쪽에서 오크 경비대장 그라스가 뿔나팔을 손에 쥔 채 파티를 가만히 지켜봅니다. 거짓을 말하면 그 즉시 나팔을 불 기세입니다.',
    '다리 아래로는 낡은 우회로가 어둡게 뻗어 있고, 신전에서 가져온 단서들이 바루크 앞에서 그 무게를 시험받을 참입니다.',
  ].join('\n'),
  closingNote: '다리를 건너자 부서진 종이 저절로 한 번 울리고, 바루크가 등 뒤에서 낮게 말합니다. "그 아래의 문지기에게도 먼저 이름과 임무를 물어라." 종루로 가는 길에 그 말의 의미가 곧 드러날 것 같습니다.',
  choices: {
    duel: {
      id: 'duel',
      label: '정식 결투를 받아들인다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '바루크의 창선 앞에 정식으로 결투를 신청합니다. 바루크는 짧게 고개를 끄덕이며 말합니다. "좋다. 선을 넘지 않고 나를 넘어뜨리면 길을 내주마." 정해진 규칙을 한 번도 어기지 않은 채 결투에서 승리하자, 바루크는 진심으로 감탄하며 오크 통행 증표를 건네고 9회차에서 갚을 빚까지 스스로 인정합니다. 초소에 늘어선 오크 병사들도 낮은 함성으로 그 승부를 인정하고, 그라스 역시 나팔을 거두며 더 이상 파티를 의심하지 않습니다. 다리 너머 종루로 가는 길이 그렇게 활짝 열립니다.',
        mixed: '결투는 치열하게 이어지고, 결국 선 안에서 바루크를 넘어뜨리는 데 성공합니다. 바루크는 숨을 고르며 말합니다. "인정한다. 하지만 통행 증표를 받으려면 한 가지 맹세부터 해라. 종루의 문지기를 함부로 베지 말고 먼저 임무를 물어라." 통과는 허락받았지만, 장비 하나를 초소에 맡기고 그 맹세까지 지켜야 다음 회차로 넘어갈 수 있게 되었습니다. 그라스는 맹세를 받아 적으며 "약속은 잊지 않겠다"고 짧게 덧붙입니다.',
        weak: '결투 중 선을 살짝 넘는 실수를 저지르자 그라스가 그 즉시 나팔을 불어 다리 양쪽을 닫아 버립니다. 바루크가 굳은 얼굴로 말합니다. "선을 넘었으니 다시 묻겠다. 첫 번째 열쇠를 맡길 것이냐, 처음부터 결투를 다시 받을 것이냐." 파티는 그 자리에서 둘 중 하나를 급히 정해야 하고, 그라스의 시선은 여전히 날카롭게 파티를 향해 있습니다. 초소의 병사들도 무기를 고쳐 잡으며 다음 명령을 기다립니다.',
      },
    },
    negotiate: {
      id: 'negotiate',
      label: '증표와 말로 협상한다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '신전에서 가져온 오래된 맹세의 구절을 꺼내 바루크에게 또박또박 읽어 줍니다. 바루크는 눈을 크게 뜨며 말합니다. "이 맹세를 아는 자라면 통과할 자격이 있다. 게다가 종루의 문지기에게도 경고를 전해 주마." 신전의 증거를 인정받은 바루크는 오크 통행 증표와 종루의 위험을 알리는 경고까지 함께 내어 주고, 그라스 역시 나팔을 거두며 길을 활짝 터 줍니다. 바루크는 떠나는 파티의 등 뒤에 "다음에도 그 구절을 잊지 마라"고 한 번 더 일러 줍니다.',
        mixed: '맹세의 구절을 보이자 바루크는 천천히 고개를 끄덕이지만 조건을 하나 답니다. "통행은 허락한다. 다만 종루의 문지기를 쓰러뜨리지 말고 반드시 임무부터 물어라, 그게 내 조건이다." 통과권은 손에 넣었지만 그 맹세를 지켜야 한다는 부담이 남고, 그라스는 여전히 의심 어린 눈으로 파티의 등 뒤를 살핍니다. 초소 병사 하나가 그 약속을 따로 기록해 두는 모습도 눈에 들어옵니다.',
        weak: '바루크는 맹세의 구절을 듣고도 미심쩍은 표정을 풀지 않습니다. "말은 그럴듯하다만, 진짜인지는 모르겠군." 그 순간 그라스가 나팔을 짧게 불어 신호를 보내고, 바루크는 낮은 목소리로 경고합니다. "거짓이라면 종루의 문지기에게 너희 이름을 먼저 전하겠다." 협상은 절반의 신뢰만 얻은 채 끝나고, 다음 회차에서 그 의심을 마주하게 될 것 같습니다. 초소를 빠져나오는 등 뒤로 병사들의 시선이 한동안 따라붙습니다.',
      },
    },
    bypass: {
      id: 'bypass',
      label: '다리 아래 우회로를 탄다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '다리 아래 낡은 우회로로 조용히 내려가 그라스의 눈을 피해 협곡을 건넙니다. 초소 벽에 걸린 종루 지도까지 몰래 확인하고 두 번째 열쇠가 걸린 봉인실의 위치를 정확히 외워 둡니다. 종루 쪽 그림자가 남긴 검은 종가루도 발견해, 바루크와 그라스 모두 모르는 사이 종루 뒤편을 먼저 선점한 채 다음 회차를 맞이할 준비를 마칩니다. 협곡을 타고 흐르는 바람 소리만이 그 흔적을 함께 지우고, 어둠 속에서 누군가 혼잣말하듯 중얼거립니다. "여기까지 아무도 못 왔을 텐데."',
        mixed: '우회로를 타는 데는 성공하지만, 좁은 길을 빠져나오며 작은 소리를 내고 맙니다. 멀리서 그라스의 목소리가 들립니다. "거기, 누구냐!" 다행히 들키지 않고 빠져나오긴 했지만, 오크 통행 증표 없이 종루에 도착한 탓에 그곳의 첫 압박을 그대로 받아야 할 처지가 됩니다. 종루 지도는 확인했지만 시간이 부족해 자세히 외우지는 못했고, 등 뒤로는 여전히 발소리가 따라붙는 듬합니다.',
        weak: '우회로 일부가 무너지며 협곡 아래 어두운 공간으로 그대로 떨어집니다. 멀리서 바루크의 목소리가 들립니다. "거짓으로 다리를 피하는 자는 종루에서도 환영받지 못할 것이다." 두 번째 열쇠가 종루 아래 있다는 사실은 알게 되었지만, 안전하게 돌아갈 퇴로를 잃고 낯선 통로 속에서 다음 길을 다시 찾아야 합니다. 무너진 돌가루 사이로 희미한 종소리만 길게 울려 퍼집니다.',
      },
    },
  },
};

const SESSION_05_BROKEN_BELFRY = {
  id: 'session_05_broken_belfry',
  title: '5회차. 무너진 종루의 문지기',
  intro: [
    '기울어진 종루 안, 부서진 종이 줄도 없이 낮게 울리고 계단이 흔들립니다. 떠돌이 기사 세린이 계단 아래에서 손을 들어 멈추라는 신호를 보냅니다.',
    '세린이 낮은 목소리로 말합니다. "저 문지기는 죽이려 들면 끝없이 일어서요. 종끈을 끊든, 말을 걸든, 봉인실로 바로 가든 — 결정은 당신들이 해야 해요."',
    '무너진 종루의 문지기가 종끈을 당길 때마다 계단 한 구간이 꺾이고, 종 그림자가 금 간 봉인실로 미끄러져 들어가 두 번째 열쇠를 덮습니다.',
  ].join('\n'),
  closingNote: '두 번째 열쇠를 들어 올리자 금 간 종 조각이 숲을 향해 한 번 울립니다. 봉인 기록에는 "돌아오는 길은 같은 발걸음을 거부한다"는 줄이 남아 있어, 다음 회차의 숲길이 결코 단순하지 않을 것을 예고합니다.',
  choices: {
    cut: {
      id: 'cut',
      label: '종끈을 먼저 끊는다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '흔들리는 계단을 박차고 올라 종끈을 정확히 끊어 냅니다. 문지기가 잠시 휘청이는 사이 세린이 환호하며 외칩니다. "그거예요! 게이지가 줄었어요, 한 번 더 밀어붙이면 끝낼 수 있어요!" 종끈을 끊어 게이지를 크게 줄이는 동시에 종 조각이 가리키는 기억의 숲 입구까지 또렷이 확인하고, 흔들리던 계단도 다시 단단하게 자리를 잡습니다. 부서진 종루 안에 잠시 정적이 내려앉고, 다음 발걸음을 옮길 여유가 생깁니다.',
        mixed: '종끈은 끊어내지만, 그 틈에 종 그림자가 금 간 종 조각을 물고 기억의 숲 쪽으로 먼저 사라집니다. 세린이 아쉬운 표정으로 말합니다. "끈은 끊었으니 다행이지만, 저 그림자가 먼저 가 버렸네요. 다음에 만나면 까다로울 거예요." 게이지는 줄었지만 숲에서 마주칠 단서 하나를 미리 빼앗긴 셈이 되었고, 종루 계단은 여전히 위태롭게 흔들립니다. 세린은 무너지는 돌가루를 털어내며 일단 다음 발걸음에 집중하자고 다독입니다.',
        weak: '종끈을 잘못 건드려 종이 오히려 더 크게 울리고, 계단 한 층이 그대로 무너져 내립니다. 세린이 다급하게 외칩니다. "조심해요! 이러면 우리가 갈라져요!" 게이지는 줄지 않은 채 파티는 봉인실 쪽과 종루 위층으로 나뉘고, 부서진 종소리가 점점 더 가까이서 울리기 시작합니다. 무너진 돌더미 너머로 세린의 목소리만 끊어질 듯 이어지고, 두 무리는 서로의 위치를 가늠하며 다시 합칠 방법을 찾아야 합니다.',
      },
    },
    talk: {
      id: 'talk',
      label: '문지기와 대화한다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '문지기 앞에 바루크의 통행 증표를 내보이며 지금도 지키는 임무가 무엇인지 묻습니다. 문지기는 공격을 멈추고 낮게 말합니다. "...임무를 묻는 자는 오랜만이군. 길을 닫으라는 명령뿐이었다." 임무를 인정받은 덕분에 공격이 그대로 멈추고, 두 번째 열쇠와 봉인 기록을 흠 없이 꺼낼 수 있었습니다. 세린은 그 모습을 보며 조용히 고개를 끄덕이고, 흔들리던 종루도 차분히 가라앉습니다.',
        mixed: '문지기에게 임무를 묻자 잠시 멈추긴 하지만, 곧 다시 종끈을 당기며 말합니다. "묻는다고 명령이 사라지진 않는다." 대화는 통했지만 완전히 멈추게 하진 못해, 누군가 무너지는 계단을 붙잡는 동안 다른 동료가 두 번째 열쇠를 챙겨야 합니다. 세린이 거들며 "일단 열쇠부터 확보해요, 나머지는 제가 막을게요!"라고 외치며 무너지는 계단을 온몸으로 받쳐 내고, 먼지 속에서도 끝까지 자리를 지킵니다.',
        weak: '문지기는 질문에 답하기는커녕 종소리로 그 말을 그대로 덮어 버립니다. "임무는 말로 풀리지 않는다." 종소리 하나가 파티의 걸음을 기억해 둔 듯 울려 퍼지고, 세린이 걱정스러운 얼굴로 말합니다. "이거 다음 회차에서도 따라올 것 같은데요..." 두 번째 열쇠는 손에 넣지 못한 채 일단 자리를 피해야 했고, 종소리는 한참 동안 귓가에 맴돌며 발걸음을 무겁게 짓누릅니다.',
      },
    },
    breach: {
      id: 'breach',
      label: '봉인실 문으로 돌파한다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '금 간 봉인실 문의 갈라진 틈을 살펴 가장 약한 지점을 정확히 찾아냅니다. 세린이 옆에서 거들며 말합니다. "여기, 이 틈이 제일 약해요. 제가 받칠게요, 지금 밀어요!" 갈라진 틈으로 정확히 비집고 들어가 무너지는 계단의 발자국까지 복사해 두고, 두 번째 열쇠와 봉인 기록을 동시에 손에 넣습니다. 세린은 안도한 표정으로 무너진 문틀에 손을 짚으며 숨을 고릅니다.',
        mixed: '틈을 찾아 들어가는 데는 성공하지만 균열이 더 크게 벌어지고 맙니다. 세린이 다급하게 말합니다. "퇴로 쪽이 무너지고 있어요! 기록을 챙길지 길을 챙길지 정해야 해요!" 결국 둘 중 하나를 포기해야 하는 상황이 되어, 두 번째 열쇠는 얻었지만 봉인 기록의 일부를 남겨 두고 빠져나와야 했습니다. 등 뒤에서 무너지는 소리가 길게 이어지고, 세린은 마지막까지 뒤를 살피며 동료들을 먼저 내보냅니다.',
        weak: '갈라진 틈을 잘못 짚어 봉인실 벽이 그대로 무너져 내립니다. 세린이 먼지 속에서 외칩니다. "뒤로! 이 안에 있으면 안 돼요!" 두 번째 열쇠의 위치는 확인했지만 안전한 퇴로를 완전히 잃고, 그 자리에서 다른 길을 다시 찾아야 하는 처지가 됩니다. 먼지가 가라앉을 때까지 누구도 쉽게 입을 열지 못하고, 무너진 돌무더기 사이로 희미한 빛줄기만 새어 들어옵니다.',
      },
    },
  },
};

const SESSION_06_MEMORY_FOREST = {
  id: 'session_06_memory_forest',
  title: '6회차. 기억의 숲과 되감긴 길',
  intro: [
    '숲 안쪽에서 부서진 종루를 떠올리게 하는 낮은 종소리가 한 번 울립니다. 이미 지나온 진흙 발자국이 파티 앞쪽에 거꾸로 찍혀 있습니다.',
    '정령 라메가 나무 사이에서 모습을 드러내며 말합니다. "이 숲은 탑을 향한 발걸음을 되돌리는 규칙을 지킨다. 너희가 그 규칙을 어떻게 대할지 보겠다."',
    '그림자 늑대의 발소리가 두 방향에서 동시에 가까워지고, 나무괴물의 뿌리가 방금 건넌 샘을 다시 앞에 세웁니다.',
  ].join('\n'),
  closingNote: '라메는 숲의 잎 위에 반복되는 발자국을 가만히 눌러 주며 말합니다. "탑의 계단에서도 이 흔적은 되돌아갈 순간을 가리킨다. 세 문 앞에서 너희가 지킬 길을 말하면, 그것이 세 번째 열쇠가 된다." 검은 성문이 머지않았습니다.',
  choices: {
    chase: {
      id: 'chase',
      label: '늑대 추격을 끊고 빠른 길을 택한다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '그림자 늑대를 갈라진 길 밖으로 몰아내며 빠른 길로 곧장 내달립니다. 라메가 멀리서 지켜보다 고개를 끄덕이며 말합니다. "규칙을 어기지 않고도 빨랐군. 그 발걸음은 인정하마." 늑대가 남긴 반대 방향 발자국까지 온전히 떠내어 되감긴 길의 흔적을 확보하고, 옛 전쟁길까지 단숨에 도달합니다. 나무 사이로 부는 바람마저 그 발걸음을 한 번 더 되짚어 주고, 라메는 그 뒤를 따르며 조용히 길의 경계를 표시해 둡니다.',
        mixed: '늑대 추격은 끊어내지만, 그 틈에 늑대 한 마리가 동료 하나의 그림자를 살짝 물고 지나갑니다. 라메가 걱정스럽게 말합니다. "그림자가 물리면 다음 장소에서 그 흔적이 먼저 되감길 것이다." 되감긴 길의 흔적은 손에 넣었지만, 다음 회차 성문 앞에서 그 동료의 위치가 먼저 흔들릴 위험을 안고 가야 합니다. 라메는 그 자리에 잎 하나를 떨어뜨려 표시를 남겨 두고, 멀어지는 늑대의 발소리를 한동안 가만히 듣습니다.',
        weak: '빠른 길로 내달리다 그림자 늑대 한 마리가 전쟁 표식 돌비석을 물고 되감긴 길 안으로 뛰어듭니다. 라메가 낮게 말합니다. "쫓아갈 텐가, 아니면 내게 빚을 질 텐가. 둘 중 하나를 골라야 한다." 파티는 그 자리에서 추격할지 라메의 도움을 빌릴지 급히 정해야 하는 상황에 놓이고, 숲은 그 결정을 기다리듯 조용해지며 나무 그림자들이 천천히 길게 늘어지고, 늑대의 붉은 눈만 멀리서 깜박입니다.',
      },
    },
    listen: {
      id: 'listen',
      label: '라메의 조건을 듣는다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '라메 앞에 멈춰 서서 조건을 묻습니다. 라메는 차분히 말합니다. "훼손되지 않은 길 하나를 남겨라. 그러면 내가 규칙을 잠시 풀어 주마." 약속을 정확히 지키며 뿌리 장벽을 통과하자, 라메는 숲의 잎 표식과 함께 "길을 남기는 자는"이라는 열린 맹세의 첫 문장을 또렷하게 들려줍니다. 라메는 떠나는 파티를 향해 가볍게 고개를 숙이며 인사를 건네고, 잎 표식이 발밑에서 은은한 빛을 머금습니다.',
        mixed: '라메는 조건을 듣고 길을 열어 주지만 한 가지를 덧붙입니다. "숲길과 전쟁 표식 돌비석을 훼손하지 않겠다고 약속해라." 약속을 받아들이는 대신 길은 무사히 열리고, 다만 그 약속을 끝까지 지켜야 한다는 부담이 다음 회차까지 이어집니다. 라메는 그 약속의 무게를 가늠하듯 한동안 파티를 가만히 바라보다가, 말없이 숲 안쪽으로 발걸음을 돌리며 나뭇잎 사이로 천천히 사라집니다.',
        weak: '라메의 조건을 제대로 듣지 못한 채 서두르다, 길 잃은 정령이 맹세 문장을 거꾸로 읊어 버립니다. 라메가 안타까운 얼굴로 말합니다. "그 문장은 거꾸로 읊으면 안 된다. 성문에서 곤란해질 것이다." 정령이 먼저 성문에 도착해 가고일에게 잘못된 호칭을 전하고 맙니다. 라메는 그 뒷모습을 향해 짧게 한숨을 내쉬며, 따라잡을 방법을 함께 찾아보자고 손을 내밉니다.',
      },
    },
    split: {
      id: 'split',
      label: '나무괴물의 뿌리를 벌린다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '나무괴물을 해치지 않고 뿌리 틈을 조심스럽게 벌려 그 아래 묻힌 전쟁 표식 돌비석을 찾아냅니다. 라메가 그 모습을 보고 감탄하듯 말합니다. "죽이지 않고 길을 냈군. 그 살아 있는 지름길은 다음 회차 성문까지 이어질 것이다." 검은 나무의 껍질 문양과 돌비석을 대조해 되감긴 길의 흔적을 완전하게 확정합니다. 나무괴물도 가지를 늘어뜨리며 조용히 길을 비켜 줍니다.',
        mixed: '뿌리를 벌리는 데는 성공하지만 열린 맹세 첫 문장의 마지막 단어가 빠진 채로 발견됩니다. 라메가 안타까워하며 말합니다. "문장이 끊겼군. 다음 장소에서 나머지를 채워야 할 것이다." 전쟁 표식 돌비석은 손에 넣었지만, 7회차에서 그 빠진 부분을 보완해야 한다는 숙제가 남습니다. 나무괴물의 뿌리도 천천히 다시 오므라들고, 라메는 빠진 단어를 되새기듯 입속으로 몇 번 되뇝니다.',
        weak: '뿌리를 벌리는 도중 나무괴물의 뿌리 장벽이 같은 샘을 다시 한번 닫아 버립니다. 라메가 낮게 경고합니다. "같은 길을 두 번 막다니, 숲이 화가 난 모양이다." 방금까지 안전했던 길 하나가 그대로 사라지고, 파티는 처음부터 다른 경로를 다시 찾아야 합니다. 멀어지는 라메의 발걸음 소리만 숲 안쪽으로 사라지고, 닫힌 샘 위로 안개가 천천히 깔리며 고요함만 남습니다.',
      },
    },
  },
};

const SESSION_07_BLACK_GATE = {
  id: 'session_07_black_gate',
  title: '7회차. 검은 성문과 탑 하층',
  intro: [
    '검은 성문 위에서 가고일 헤르가 천천히 눈을 뜹니다. 무기고에 늘어선 빈 갑옷들이 일제히 앞으로 한 걸음 나옵니다.',
    '헤르가 낮고 울리는 목소리로 묻습니다. "이름을 아는 것과 명령을 소유하는 것은 다르다. 너희는 어느 쪽을 증명하러 왔는가?"',
    '움직이는 갑옷들이 성문 틈을 방패로 봉하고, 마가목 열쇠 몸체가 알맞은 답 가까이에서만 희미하게 떨립니다.',
  ].join('\n'),
  closingNote: '계단 끝에서 세 개의 문이 동시에 보이지만, 확정하지 못한 조건의 문부터 먼저 닫히기 시작합니다. 다음 회차에서는 어느 문을 먼저 붙잡을지 서둘러 정해야 할 것 같습니다.',
  choices: {
    breach: {
      id: 'breach',
      label: '갑옷 방패벽을 정면 돌파한다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '방패로 막힌 성문 틈을 정면으로 밀어붙여 갑옷들의 대열을 무너뜨립니다. 헤르가 그 힘을 지켜보며 말합니다. "힘으로 길을 내는 자도 있지. 그 갑옷 안쪽의 이름 표식을 가져가라." 방패벽을 열어젖히며 위치를 선점하고, 갑옷 안쪽에 새겨진 이름 표식까지 확보해 세 문 중 한 곳의 확정 단서를 손에 넣습니다. 빈 갑옷들도 그제야 천천히 무기를 내려놓고 벽 쪽으로 물러섭니다.',
        mixed: '방패벽은 뚫리지만, 그 충격으로 헤르가 곧장 다른 문 하나를 먼저 닫기 시작합니다. "한 걸음을 얻었으니 다른 문은 내가 가져가겠다." 확정 단서 하나는 손에 넣었지만, 다음 회차에서 그 닫히는 문을 서둘러 붙잡지 않으면 더 큰 대가를 치러야 할 처지가 됩니다. 무기고에 늘어선 갑옷들도 다시 자세를 고쳐 잡으며 다음 명령을 기다리고, 닫히는 문틈으로 빛이 점점 가늘어집니다.',
        weak: '방패벽에 정면으로 부딪히다 균형을 잃고 계단 아래로 밀려납니다. 헤르가 차갑게 말합니다. "되감긴 걸음에는 이유가 있다." 계단이 그대로 되감겨 성문 앞 방패벽으로 되돌아가고, 세 문 중 하나가 이미 조건부로 흔들리기 시작합니다. 갑옷들의 발소리가 다시 사방에서 가까워지고, 무기고 안쪽 불빛마저 어둡게 가라앉으며 찬 공기가 발밑을 휘감고 모두의 등줄기를 서늘하게 적십니다.',
      },
    },
    riddle: {
      id: 'riddle',
      label: '가고일과 문답으로 시간을 번다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '바루크의 통행 증표를 헤르에게 내보이며 묻습니다. "이름을 안다고 명령을 소유하게 되는 건 아니다, 그렇지 않나요?" 헤르는 만족스럽게 울리는 목소리로 답합니다. "정확하다. 너희는 문지기 이름의 정확한 발음을 가질 자격이 있다." 문답을 깔끔하게 통과해 이름의 발음과 다른 문으로 가는 계단 표식까지 함께 얻습니다. 빈 갑옷들도 일제히 한 걸음 물러서며 길을 내어 줍니다.',
        mixed: '문답은 통과하지만 헤르가 선택하지 않은 문 하나를 먼저 닫기 시작합니다. "한 가지를 답했으니, 다른 하나는 서둘러야 할 것이다." 문지기 이름의 발음이라는 확정 단서는 얻었지만, 다음 회차에서 닫히기 시작한 문을 먼저 신경 써야 하는 부담이 남습니다. 헤르의 눈빛은 여전히 다음 질문을 가늠하듯 가만히 머물고, 갑옷들도 그 시선을 따라 조용히 멈춰 섭니다.',
        weak: '문답 중 머뭇거리자 헤르가 낮게 한숨을 쉬며 말합니다. "틀린 이름이 먼저 울리겠군." 헤르가 잘못된 이름을 세 문지기에게 외쳐 보내고, 다음 회차 이름의 문에서 그 거짓 호칭을 먼저 끊어 내야 하는 숙제가 생깁니다. 갑옷들도 그 메아리를 따라 일제히 고개를 돌리고, 성문 위쪽으로 낮은 진동이 길게 퍼져 나가며 한동안 가라앉지 않고 천장까지 길게 울려 퍼집니다.',
      },
    },
    rewind: {
      id: 'rewind',
      label: '계단의 되감김 규칙을 깬다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '숲에서 가져온 흔적을 되감기는 계단 한 단에 정확히 올려놓아 같은 계단이 되돌아오는 순간을 멈춥니다. 헤르가 흥미롭다는 듯 말합니다. "되감김을 멈추는 법을 아는 자라니, 드물군." 되감김 사용법을 완전히 확정하고 세 문이 있는 방의 위치까지 먼저 선점한 채 다음 회차를 준비할 수 있게 됩니다. 계단은 더 이상 흔들리지 않고 조용히 가라앉으며 발밑의 먼지도 잦아듭니다.',
        mixed: '되감김을 멈추는 데는 성공하지만, 그 과정에서 숲의 흔적을 계단 틈에 남겨 두고 와야 합니다. 헤르가 말합니다. "흔적을 두고 갔으니, 다음에 다시 찾아야 할 것이다." 계단은 멈췄지만 8회차에서 그 흔적을 되찾아야 하는 과제가 남습니다. 헤르는 그 자리를 가만히 내려다보며 기억해 두고, 갑옷들도 그 위치를 조용히 표시해 두며 천천히 흩어져 각자의 자리로 돌아갑니다.',
        weak: '흔적을 잘못 짚어 계단이 오히려 더 빠르게 되감깁니다. 헤르가 낮게 경고합니다. "규칙을 건드리면, 규칙이 너희를 기억한다." 갑옷들이 그 사이 확보했던 단서 하나를 문 그림자에게 넘기고, 다음 회차에서 그 문을 먼저 택하지 않으면 조건부 약점으로 남게 됩니다. 계단 아래로는 차가운 정적만 길게 깔리고, 멀리서 문 그림자의 웃음소리가 옅게 들리며 점점 가까워집니다.',
      },
    },
  },
};

const SESSION_08_THREE_DOORS = {
  id: 'session_08_three_doors',
  title: '8회차. 세 개의 문과 마지막 시험',
  intro: [
    '라메가 알려 준 세 번째 열쇠의 조건, "열린 길의 맹세"가 세 개의 문 사이에서 낮게 울립니다. 이름의 문, 되감긴 길의 문, 열린 맹세의 문이 동시에 닫히기 시작합니다.',
    '열쇠 그림자가 문턱마다 어른거리며 속삭입니다. "셋 다 가질 시간은 없어. 어느 문에 너희 시간을 쓸지 지금 정해."',
    '문지기들은 각자의 조건을 지키며 조용히 기다립니다. 열리는 문마다 맹세의 문장 한 조각이 분명해질 것입니다.',
  ].join('\n'),
  closingNote: '"열린 길의 맹세"는 앞선 두 열쇠 뒤에서 세 번째 조건으로 마지막 계단을 엽니다. 오늘 해결한 문은 다음 회차의 약점이 되고, 남긴 문은 미완의 책임과 조건부 약점으로 남습니다.',
  choices: {
    name: {
      id: 'name',
      label: '이름의 문을 먼저 연다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '문지기 앞에서 거짓 이름 셋 중 참이름을 정확히 골라 외칩니다. 문지기는 낮게 울리며 답합니다. "맞다. 그 이름을 함부로 소유하지 않겠다는 약속, 잊지 마라." 문지기의 이름을 온전한 약점으로 확정하고, 다음 회차에서 파수꾼의 행동 하나를 끊고 게이지를 크게 줄일 수 있는 힘을 손에 넣습니다. 이름의 문이 낮은 소리를 내며 천천히 옆으로 열리고, 문틀에 새겨진 글자들도 조용히 빛을 머금습니다.',
        mixed: '참이름을 골라내긴 했지만, 그 이름의 한 글자가 목소리에 남아 버립니다. 문지기가 말합니다. "이름을 가졌으니, 그 이름이 너희를 부를 수도 있다." 이름의 약점은 손에 넣었지만, 다음 회차에서 그 이름을 사용한 캐릭터가 먼저 파수꾼의 명령을 듣게 될 위험을 함께 안고 가야 합니다. 문은 열리지만 그 틈으로 서늘한 바람이 새어 나오고, 누군가의 이름이 희미하게 메아리칩니다.',
        weak: '머뭇거리는 사이 거짓 이름이 먼저 크게 울려 퍼집니다. 문지기가 낮게 말합니다. "거짓이 먼저 불렸으니, 그 이름은 거짓일 때만 쓸모가 있을 것이다." 이름의 문은 열렸지만 약점은 조건부로만 남고, 다음 회차에서 파수꾼이 스스로 거짓 이름을 부르는 순간에만 그 약점을 쓸 수 있게 됩니다. 문틀 너머로 정체를 알 수 없는 한기가 흘러나오고, 발밑의 그림자가 조금씩 길어집니다.',
      },
    },
    loop: {
      id: 'loop',
      label: '되감긴 길의 문을 먼저 연다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '같은 선택을 반복하지 않도록 세 번 모두 다른 방식으로 위험을 뚫고 전진합니다. 되감기는 열쇠 그림자가 문턱에서 그대로 붙잡히며 멈춥니다. 픽이 멀리서 손을 흔들며 외칩니다. "그거예요! 같은 길로 안 가니까 안 잡히네요!" 되감긴 길의 흔적을 온전한 약점으로 확정하고, 다음 회차에서 되감김을 끊을 힘을 손에 넣습니다. 문턱의 그림자도 그제야 조용히 가라앉습니다.',
        mixed: '되감긴 길의 흔적은 얻지만, 그 과정에서 파티의 짧은 시간이 탑에 남고 맙니다. 열쇠 그림자가 으스스하게 웃으며 말합니다. "시간을 두고 갔구나, 그건 돌려주지 않아." 약점은 손에 넣었지만 다음 회차에서 위치가 밀리거나 장비가 손상되는 대가를 즉시 치러야 합니다. 픽도 옆에서 그 대가를 보며 입술을 깨물고, 빼앗긴 시간의 자리를 가만히 쳐다보며 손을 모읍니다.',
        weak: '반복을 끊으려다 오히려 방금 한 선택 하나가 그대로 되감겨 버립니다. 열쇠 그림자가 낮게 속삭입니다. "거봐, 같은 길이 좋다니까." 되감긴 길의 흔적은 조건부로만 남고, 다음 회차에서 조력자가 길을 붙잡아 줄 때만 그 약점을 쓸 수 있게 됩니다. 문턱 너머로 똑같은 발자국이 다시 겹쳐 찍히고, 그림자의 웃음소리가 길게 이어지며 점점 커지다가 천천히 잦아듭니다.',
      },
    },
    vow: {
      id: 'vow',
      label: '열린 맹세의 문을 먼저 연다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '지금까지 모은 단서, 신전의 맹세 문양과 라메의 첫 문장, 헤르 앞에서 들은 둘째 문장을 차례로 맞춰 봅니다. 빠진 자리를 찾아낸 순간, 누구를 위해 길을 남길지 모두 한 문장씩 책임을 보탭니다. 문지기는 그 말을 받아들이며 조용히 말합니다. "온전한 맹세로구나." 열린 길의 맹세를 흠 없이 완성하고, 마지막 계단으로 가는 길이 따뜻하게 밝아 오며 모두의 발걸음도 한결 가벼워집니다.',
        mixed: '맹세는 완성되지만 조항 하나가 비어 있는 채로 남습니다. 문지기가 말합니다. "맹세는 들었다. 다만 빈 자리는 너희가 직접 채워야 한다." 다음 회차에서 결말을 정할 때 열쇠 하나나 조력자와의 약속 하나를 추가로 내놓아야 한다는 부담이 함께 남습니다. 문은 열리지만 그 빈 자리가 계속 마음에 걸리고, 문지기의 시선도 그 자리에 오래 머물며 떠나지 않습니다.',
        weak: '단서들을 맞춰 보는 사이 문지기가 먼저 되묻습니다. "맹세의 대상은 누구냐. 그걸 정하지 않으면 문은 열리지 않는다." 누구도 먼저 답하지 못해 맹세는 미완으로 남고, 다음 회차의 합동 돌파 질문에서 누군가 먼저 책임을 선언해야만 이 약점을 쓸 수 있게 됩니다. 문틀 위로 미완의 문장이 희미하게 새겨진 채 남고, 침묵만 한동안 무겁게 이어지며 발걸음을 무겁게 짓누릅니다.',
      },
    },
  },
};

const SESSION_09_FINAL_GATE = {
  id: 'session_09_final_gate',
  title: '9회차. 검은탑의 마지막 문',
  intro: [
    '검은탑 최상층, 첫 번째 열쇠와 두 번째 열쇠가 허공에 떠오릅니다. 파티는 검은 문 앞에서 세 번째 열쇠, "열린 길의 맹세"를 소리 내어 말합니다.',
    '맹세에 미완의 책임이 남아 있던 자리에서 문 그림자가 새어 나오고, 탑의 마지막 파수꾼이 천천히 몸을 일으킵니다.',
    '멀리서 익숙한 목소리가 들립니다. 픽이 숨을 몰아쉬며 도착해 외칩니다. "저도 왔어요! 약속했잖아요, 한 번은 도와준다고!"',
  ].join('\n'),
  closingNote: '오늘의 선택은 결말 뒤 마을, 열쇠, 문지기, 조력자의 후일담으로 남습니다. 검은탑의 이야기는 여기서 한 번 마무리되지만, 다음에 또 다른 회차로 이어 볼 수 있습니다.',
  choices: {
    strike: {
      id: 'strike',
      label: '약점을 빠르게 사용한다',
      approachLabel: '위기 넘기기',
      outcomes: {
        strong: '망설임 없이 문지기의 이름을 부르며 가장 위험한 순간에 약점을 찔러 넣습니다. 파수꾼이 잠시 휘청이는 사이 픽이 외칩니다. "지금이에요! 게이지가 확 줄었어요!" 약점 사용의 대가를 피해 가며 게이지를 크게 줄이고, 다음 동료가 움직일 틈까지 만들어 줍니다. 문 그림자도 잠시 멈춰 서며 다음 수를 가늠하고, 탑 전체가 그 충격으로 낮게 울리며 한동안 가라앉지 않습니다.',
        mixed: '약점은 정확히 통하지만, 그 대가로 위치나 장비 중 하나를 잃습니다. 파수꾼이 신음하며 한 걸음 물러서지만 픽이 걱정스럽게 말합니다. "통했는데... 그 장비 괜찮아요?" 게이지는 줄었지만, 다음 행동을 위해 잃은 것을 감수하고 나아가야 합니다. 파수꾼의 눈은 여전히 다음 표적을 가늠하듯 움직이고, 문 그림자가 그 틈을 타 슬며시 길어지며 발밑을 덮어 옵니다.',
        weak: '약점을 너무 서둘러 쓰는 바람에 오히려 꼬여 버립니다. 파수꾼이 문 그림자를 늘리며 으르렁거립니다. "그 정도로는 부족하다." 게이지는 줄지 않고, 결말 선택에 남을 불리한 조건 하나가 새로 생깁니다. 픽도 멀리서 안절부절못하며 다음 기회를 기다리고, 검은 문 너머로 차가운 바람이 새어 나오며 모두의 옷자락을 흔들고 발걸음마저 무겁게 짓누르며 한동안 자리를 떠나지 못하게 만듭니다.',
      },
    },
    call: {
      id: 'call',
      label: '조력자를 불러 위치를 지킨다',
      approachLabel: '말로 풀기',
      outcomes: {
        strong: '픽의 이름을 크게 부르며 위치를 지켜 달라고 외칩니다. 픽이 망설임 없이 뛰어들며 외칩니다. "당연하죠! 이번엔 제가 막을게요!" 호출권을 쓰지 않고도 같은 효과를 한 번 더 낮게 얻어, 파수꾼의 압박을 함께 밀어내고 다음 행동으로 자연스럽게 이어 갑니다. 픽은 그 자리에 단단히 버티고 서서 든든하게 등을 지키고, 그 미소에 모두 한숨을 돌리며 다시 앞을 봅니다.',
        mixed: '픽을 불러 위치를 지키게 하지만, 그 틈에 파수꾼이 다음 행동을 먼저 드러냅니다. 픽이 다급하게 외칩니다. "조심해요, 저놈이 뭔가 준비하고 있어요!" 호출권 하나를 소모해 위험을 막았지만, 파수꾼의 다음 수를 미리 경계해야 하는 상황이 됩니다. 픽의 손도 긴장한 듯 떨리는 게 눈에 들어오고, 다들 그 손끝을 따라 시선을 모으며 숨을 죽이고 다음 순간을 기다립니다.',
        weak: '부르는 목소리가 닿지 않았는지 픽이 늦게 도착하고, 그 사이 파수꾼이 되감김을 한 번 일으킵니다. 픽이 헐떡이며 말합니다. "미안해요, 길이 막혀서 늦었어요!" 결말 선택에 남을 조건 하나가 새로 생기고, 자리를 다시 가다듬어야 합니다. 픽은 미안한 얼굴로 옆에 바짝 붙어 서며 다음엔 늦지 않겠다고 다짐하고, 모두 그 말을 가만히 받아들이며 다시 숨을 고릅니다.',
      },
    },
    unite: {
      id: 'unite',
      label: '게이지 4칸 이하에서 합동 돌파에 집중한다',
      approachLabel: '살펴보기',
      outcomes: {
        strong: '게이지가 낮아진 틈을 살펴 모두에게 한 가지씩 역할을 나눕니다. 누가 압박을 막고, 누가 틈을 찾고, 누가 결말을 말할지 차례로 정하자 파수꾼이 낮게 말합니다. "...함께 미는 힘이라면, 막을 수 없겠군." 합동 돌파가 그대로 성공해 게이지를 한 번에 0칸으로 만들고, 마지막 문이 천천히 빛을 내며 열리며 탑 전체가 고요해지고 모두 서로를 바라보며 깊게 숨을 내쉽니다.',
        mixed: '역할을 나누는 데는 성공하지만, 한 사람의 역할이 늦게 정해지며 파수꾼에게 대가를 하나 내줘야 합니다. 파수꾼이 말합니다. "주저함은 길을 늦출 뿐이다." 합동 돌파는 통하지만, 위치나 열쇠 중 하나에 작은 대가가 붙은 채로 결말 선택으로 넘어갑니다. 문은 흔들리며 천천히 열리기 시작하고, 모두 그 틈으로 서로의 얼굴을 확인하며 다음을 준비하고 자세를 고쳐 잡습니다.',
        weak: '역할을 정하려다 의견이 갈리고, 그 틈에 파수꾼이 문 그림자를 늘려 버립니다. 파수꾼이 차갑게 말합니다. "하나로 모이지 못한 힘은 흩어질 뿐이다." 합동 돌파는 다음으로 미뤄야 하고, 결말 선택에 남을 조건 하나가 더 늘어납니다. 모두 숨을 고르며 다시 한번 서로를 바라보고, 누군가 먼저 손을 내밀어 분위기를 다잡으며 다시 자세를 잡고 마음을 가라앉힙니다.',
      },
    },
  },
};

// 10회차 이상을 추가할 때는 위 SESSION_01_BLACK_BELL ~ SESSION_09_FINAL_GATE와 같은 모양의 객체를 만들어
// 아래 SESSIONS / SESSION_ORDER에 등록한다. 예:
//   const SESSION_10_X = { id: 'session_10_x', title: '10회차. ...', ... };
//   SESSIONS[SESSION_10_X.id] = SESSION_10_X;
//   SESSION_ORDER.push(SESSION_10_X.id);
const SESSIONS = {
  [SESSION_01_BLACK_BELL.id]: SESSION_01_BLACK_BELL,
  [SESSION_02_ROOTS_BELOW.id]: SESSION_02_ROOTS_BELOW,
  [SESSION_03_LOCKED_BASIN.id]: SESSION_03_LOCKED_BASIN,
  [SESSION_04_ORC_BRIDGE.id]: SESSION_04_ORC_BRIDGE,
  [SESSION_05_BROKEN_BELFRY.id]: SESSION_05_BROKEN_BELFRY,
  [SESSION_06_MEMORY_FOREST.id]: SESSION_06_MEMORY_FOREST,
  [SESSION_07_BLACK_GATE.id]: SESSION_07_BLACK_GATE,
  [SESSION_08_THREE_DOORS.id]: SESSION_08_THREE_DOORS,
  [SESSION_09_FINAL_GATE.id]: SESSION_09_FINAL_GATE,
};

const SESSION_ORDER = [
  SESSION_01_BLACK_BELL.id,
  SESSION_02_ROOTS_BELOW.id,
  SESSION_03_LOCKED_BASIN.id,
  SESSION_04_ORC_BRIDGE.id,
  SESSION_05_BROKEN_BELFRY.id,
  SESSION_06_MEMORY_FOREST.id,
  SESSION_07_BLACK_GATE.id,
  SESSION_08_THREE_DOORS.id,
  SESSION_09_FINAL_GATE.id,
];

// 참여자가 `/던전월드`를 실행했을 때 기본으로 보여줄 회차.
// 다음 회차를 공개할 준비가 되면 이 값을 새 회차 id로 바꾼다.
const DEFAULT_SESSION_ID = SESSION_ORDER[0];

const TIER_LABELS = {
  strong: '10+ 원하는 대로 풀림',
  mixed: '7~9 해내지만 대가가 생김',
  weak: '6- 예상과 다른 전개',
};

function resolveSessionId(sessionId) {
  if (sessionId && SESSIONS[sessionId]) {
    return sessionId;
  }

  return DEFAULT_SESSION_ID;
}

function getSessionEntry(sessionId) {
  return SESSIONS[resolveSessionId(sessionId)];
}

const CLOSING_NOTE = SESSIONS[DEFAULT_SESSION_ID].closingNote;

function createEmptyLogsData() {
  return {
    isExample: false,
    description: 'Local solo dungeonworld minigame play log.',
    logs: [],
  };
}

function readLogsData(logsPath) {
  if (!fs.existsSync(logsPath)) {
    return createEmptyLogsData();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    return {
      ...createEmptyLogsData(),
      ...parsed,
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch (error) {
    console.warn('던전월드 플레이 로그를 읽지 못했습니다:', error.message);
    return createEmptyLogsData();
  }
}

function saveLogsData(logsPath, data) {
  saveJsonFileAtomic(logsPath, data);
}

function createOperationId() {
  return `dw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function resolveTier(total) {
  if (total >= 10) {
    return 'strong';
  }

  if (total >= 7) {
    return 'mixed';
  }

  return 'weak';
}

function listSessions() {
  return SESSION_ORDER.map((sessionId) => {
    const session = SESSIONS[sessionId];
    return {
      id: session.id,
      title: session.title,
      intro: session.intro,
      closingNote: session.closingNote,
    };
  });
}

function pickIntroForSession(session, previousTier) {
  const introVariants = session.introVariants || {};
  if (previousTier && introVariants[previousTier]) {
    return introVariants[previousTier];
  }

  return introVariants.default || session.intro;
}

function getPreviousSessionId(sessionId) {
  const index = SESSION_ORDER.indexOf(resolveSessionId(sessionId));
  if (index <= 0) {
    return null;
  }

  return SESSION_ORDER[index - 1];
}

function getSession(sessionId, options = {}) {
  const session = getSessionEntry(sessionId);
  return {
    id: session.id,
    title: session.title,
    intro: pickIntroForSession(session, options.previousTier),
    closingNote: session.closingNote,
  };
}

function getChoice(choiceId, sessionId) {
  const session = getSessionEntry(sessionId);
  return session.choices[choiceId] || null;
}

function listChoices(sessionId) {
  const session = getSessionEntry(sessionId);
  return Object.values(session.choices);
}

function getKnownSession(sessionId) {
  if (!sessionId || !SESSIONS[sessionId]) {
    return null;
  }

  return SESSIONS[sessionId];
}

function getLogTime(log) {
  const timestamp = new Date(log.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getLogRecords(logs) {
  return Array.isArray(logs) ? logs.filter((log) => log && typeof log === 'object') : [];
}

function getLatestLog(current, candidate) {
  if (!current) {
    return candidate;
  }

  return getLogTime(candidate) >= getLogTime(current) ? candidate : current;
}

function getLatestDungeonworldPlaysBySession(logs, options = {}) {
  const latestBySession = new Map();

  for (const log of getLogRecords(logs)) {
    if (options.userId && log.userId !== options.userId) {
      continue;
    }

    if (!getKnownSession(log.sessionId)) {
      continue;
    }

    latestBySession.set(log.sessionId, getLatestLog(latestBySession.get(log.sessionId), log));
  }

  return SESSION_ORDER
    .filter((sessionId) => latestBySession.has(sessionId))
    .map((sessionId) => latestBySession.get(sessionId));
}

function getDungeonworldContinuityContext(logs, userId, currentSessionId) {
  const currentSession = getKnownSession(currentSessionId);
  if (!currentSession) {
    return {
      currentSessionId: null,
      currentSessionTitle: null,
      previousSessionId: null,
      previousSessionTitle: null,
      previousSessionLatestPlay: null,
      previousTier: null,
      previousTierLabel: null,
    };
  }

  const previousSessionId = getPreviousSessionId(currentSession.id);
  const previousSession = previousSessionId ? SESSIONS[previousSessionId] : null;
  const latestPlayBySession = getLatestDungeonworldPlaysBySession(logs, { userId });
  const previousSessionLatestPlay = previousSessionId
    ? latestPlayBySession.find((log) => log.sessionId === previousSessionId) || null
    : null;
  const previousTier = previousSessionLatestPlay ? previousSessionLatestPlay.tier : null;

  return {
    currentSessionId: currentSession.id,
    currentSessionTitle: currentSession.title,
    previousSessionId,
    previousSessionTitle: previousSession ? previousSession.title : null,
    previousSessionLatestPlay,
    previousTier,
    previousTierLabel: previousSessionLatestPlay
      ? previousSessionLatestPlay.tierLabel || TIER_LABELS[previousTier] || null
      : null,
  };
}

function buildDungeonworldUserProgress(logs, userId, currentSessionId) {
  const records = getLogRecords(logs);
  const userLogs = records.filter((log) => log.userId === userId);
  const latestPlayBySession = getLatestDungeonworldPlaysBySession(records, { userId });
  const currentSession = getKnownSession(currentSessionId);
  const currentSessionLatestPlay = currentSession
    ? latestPlayBySession.find((log) => log.sessionId === currentSession.id) || null
    : null;
  const continuityContext = getDungeonworldContinuityContext(records, userId, currentSessionId);

  return {
    userId,
    totalPlayCount: userLogs.length,
    completedSessionCount: latestPlayBySession.length,
    currentSessionId: currentSession ? currentSession.id : null,
    currentSessionTitle: currentSession ? currentSession.title : null,
    hasPlayedCurrentSession: Boolean(currentSessionLatestPlay),
    currentSessionLatestPlay,
    latestPlayBySession,
    ...continuityContext,
  };
}

function getDungeonworldSessionCounts(logs) {
  const counts = new Map();

  for (const log of getLogRecords(logs)) {
    if (getKnownSession(log.sessionId)) {
      counts.set(log.sessionId, (counts.get(log.sessionId) || 0) + 1);
    }
  }

  return SESSION_ORDER
    .filter((sessionId) => counts.has(sessionId))
    .map((sessionId) => ({
      sessionId,
      sessionTitle: SESSIONS[sessionId].title,
      count: counts.get(sessionId),
    }))
    .sort((left, right) => {
      const countComparison = right.count - left.count;
      if (countComparison !== 0) {
        return countComparison;
      }

      return SESSION_ORDER.indexOf(left.sessionId) - SESSION_ORDER.indexOf(right.sessionId)
        || left.sessionTitle.localeCompare(right.sessionTitle, 'ko');
    });
}

function getDungeonworldChoiceCounts(logs) {
  const counts = new Map();

  for (const log of getLogRecords(logs)) {
    if (!log.choiceId) {
      continue;
    }

    const session = getKnownSession(log.sessionId);
    const sessionId = session ? session.id : log.sessionId || null;
    const choiceKey = `${sessionId || 'unknown_session'}:${log.choiceId}`;
    const item = counts.get(choiceKey) || {
      choiceKey,
      sessionId,
      sessionTitle: session ? session.title : log.sessionTitle || null,
      choiceId: log.choiceId,
      choiceLabel: log.choiceLabel || log.choiceId,
      count: 0,
    };
    item.count += 1;
    counts.set(choiceKey, item);
  }

  return [...counts.values()].sort((left, right) => {
    const countComparison = right.count - left.count;
    if (countComparison !== 0) {
      return countComparison;
    }

    const leftSessionIndex = SESSION_ORDER.indexOf(left.sessionId);
    const rightSessionIndex = SESSION_ORDER.indexOf(right.sessionId);
    const sessionComparison = (leftSessionIndex === -1 ? Number.MAX_SAFE_INTEGER : leftSessionIndex)
      - (rightSessionIndex === -1 ? Number.MAX_SAFE_INTEGER : rightSessionIndex);
    if (sessionComparison !== 0) {
      return sessionComparison;
    }

    return 0;
  });
}

function getDungeonworldTierCounts(logs) {
  const counts = { strong: 0, mixed: 0, weak: 0, unknown: 0 };

  for (const log of getLogRecords(logs)) {
    if (Object.prototype.hasOwnProperty.call(TIER_LABELS, log.tier)) {
      counts[log.tier] += 1;
    } else {
      counts.unknown += 1;
    }
  }

  return counts;
}

function getDungeonworldUniqueUserCount(logs) {
  const userIds = new Set();

  for (const log of getLogRecords(logs)) {
    if (log.userId) {
      userIds.add(log.userId);
    }
  }

  return userIds.size;
}

function getRecentDungeonworldActivity(logs, limit = 10) {
  const resolvedLimit = Math.max(0, Number(limit) || 0);
  return [...getLogRecords(logs)]
    .sort((left, right) => getLogTime(right) - getLogTime(left))
    .slice(0, resolvedLimit);
}

function getLatestSessionIdForProgress(logs) {
  const activeSessionIds = new Set(getDungeonworldSessionCounts(logs).map((item) => item.sessionId));

  for (const sessionId of [...SESSION_ORDER].reverse()) {
    if (activeSessionIds.has(sessionId)) {
      return sessionId;
    }
  }

  return DEFAULT_SESSION_ID;
}

function getDungeonworldSessionProgressCounts(logs, sessionId) {
  const session = getKnownSession(sessionId);
  if (!session) {
    return null;
  }

  const sessionLogs = getLogRecords(logs).filter((log) => log.sessionId === session.id);

  return {
    sessionId: session.id,
    sessionTitle: session.title,
    playCount: sessionLogs.length,
    uniqueUserCount: getDungeonworldUniqueUserCount(sessionLogs),
  };
}

function buildDungeonworldAnalytics(logs, options = {}) {
  const records = getLogRecords(logs);
  const progressSessionId = Object.prototype.hasOwnProperty.call(options, 'currentSessionId')
    ? options.currentSessionId
    : getLatestSessionIdForProgress(records);

  return {
    totalPlayCount: records.length,
    uniqueUserCount: getDungeonworldUniqueUserCount(records),
    sessionCounts: getDungeonworldSessionCounts(records),
    choiceCounts: getDungeonworldChoiceCounts(records),
    tierCounts: getDungeonworldTierCounts(records),
    recentActivity: getRecentDungeonworldActivity(
      records,
      Object.prototype.hasOwnProperty.call(options, 'recentLimit') ? options.recentLimit : 10
    ),
    latestSessionProgressCounts: getDungeonworldSessionProgressCounts(records, progressSessionId),
  };
}

function playChoice(choiceId, sessionId) {
  const session = getSessionEntry(sessionId);
  const choice = session.choices[choiceId];
  if (!choice) {
    throw new Error('지원하지 않는 선택지입니다.');
  }

  const die1 = rollD6();
  const die2 = rollD6();
  const total = die1 + die2;
  const tier = resolveTier(total);

  return {
    sessionId: session.id,
    sessionTitle: session.title,
    choice,
    die1,
    die2,
    total,
    tier,
    tierLabel: TIER_LABELS[tier],
    outcomeText: choice.outcomes[tier],
  };
}

function parseStartDate(startDateString) {
  if (!startDateString) {
    return null;
  }

  const parsed = new Date(startDateString);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// DUNGEONWORLD_START_DATE(캠페인 시작일) 기준으로 몇 주차가 지났는지 계산해 그 주차에 맞는 회차 id를 고른다.
// 시작일이 설정되지 않았거나 아직 시작일 전이면 1주차(SESSION_ORDER[0])를 보여준다.
// 회차 수보다 더 많은 주가 지나면 마지막 회차에 고정한다.
function resolveAutoSessionId(now = new Date()) {
  const startDate = parseStartDate(process.env.DUNGEONWORLD_START_DATE);
  if (!startDate) {
    return DEFAULT_SESSION_ID;
  }

  const elapsedMs = now.getTime() - startDate.getTime();
  const weekIndex = elapsedMs <= 0 ? 0 : Math.floor(elapsedMs / WEEK_MS);
  const clampedIndex = Math.min(SESSION_ORDER.length - 1, weekIndex);
  return SESSION_ORDER[clampedIndex];
}

function getCurrentSessionId(configRepository, now = new Date()) {
  const override = configRepository ? configRepository.getOverride() : null;
  if (override && SESSIONS[override]) {
    return override;
  }

  return resolveAutoSessionId(now);
}

function createEmptyConfigData() {
  return {
    isExample: false,
    overrideSessionId: null,
    updatedAt: null,
    updatedBy: null,
  };
}

function readConfigData(configPath, fallbackPath) {
  const pathToRead = fs.existsSync(configPath) ? configPath : fallbackPath;
  if (!pathToRead || !fs.existsSync(pathToRead)) {
    return createEmptyConfigData();
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(pathToRead, 'utf8'));
    return {
      ...createEmptyConfigData(),
      ...parsed,
    };
  } catch (error) {
    console.warn('던전월드 설정을 읽지 못했습니다:', error.message);
    return createEmptyConfigData();
  }
}


function createDungeonworldConfigRepository(paths = {}) {
  const resolvedPaths = {
    ...DEFAULT_PATHS,
    ...paths,
  };

  function getOverride() {
    const data = readConfigData(resolvedPaths.config, resolvedPaths.configFallback);
    return data.overrideSessionId || null;
  }

  function setOverride(sessionId, operatorId) {
    if (!SESSIONS[sessionId]) {
      throw new Error('존재하지 않는 회차 ID입니다.');
    }

    const data = {
      ...createEmptyConfigData(),
      overrideSessionId: sessionId,
      updatedAt: new Date().toISOString(),
      updatedBy: operatorId || null,
    };
    saveJsonFileAtomic(resolvedPaths.config, data);
    return data;
  }

  function clearOverride(operatorId) {
    const data = {
      ...createEmptyConfigData(),
      overrideSessionId: null,
      updatedAt: new Date().toISOString(),
      updatedBy: operatorId || null,
    };
    saveJsonFileAtomic(resolvedPaths.config, data);
    return data;
  }

  return {
    getOverride,
    setOverride,
    clearOverride,
  };
}

function createDungeonworldRepository(paths = {}) {
  const resolvedPaths = {
    ...DEFAULT_PATHS,
    ...paths,
  };

  function recordPlay(input) {
    const data = readLogsData(resolvedPaths.logs);
    const fallbackSession = getSessionEntry(input.sessionId);
    const record = {
      id: createOperationId(),
      sessionId: input.sessionId || fallbackSession.id,
      sessionTitle: input.sessionTitle || fallbackSession.title,
      userId: input.userId,
      displayName: input.displayName || input.userId,
      choiceId: input.choiceId,
      choiceLabel: input.choiceLabel,
      die1: input.die1,
      die2: input.die2,
      total: input.total,
      tier: input.tier,
      tierLabel: input.tierLabel,
      outcomeText: input.outcomeText,
      createdAt: new Date().toISOString(),
    };

    data.isExample = false;
    data.logs = [...(Array.isArray(data.logs) ? data.logs : []), record];
    saveLogsData(resolvedPaths.logs, data);
    return record;
  }

  function listRecentPlays(limit = 50) {
    const data = readLogsData(resolvedPaths.logs);
    return [...data.logs].reverse().slice(0, Math.max(1, limit));
  }

  function getPlayCount() {
    const data = readLogsData(resolvedPaths.logs);
    return data.logs.length;
  }

  function getLastPlayForUserInSession(userId, sessionId) {
    const data = readLogsData(resolvedPaths.logs);
    const matches = data.logs.filter((log) => log.userId === userId && log.sessionId === sessionId);
    if (matches.length === 0) {
      return null;
    }

    return matches.reduce((latest, log) => (
      new Date(log.createdAt).getTime() > new Date(latest.createdAt).getTime() ? log : latest
    ));
  }

  return {
    getLastPlayForUserInSession,
    getPlayCount,
    listRecentPlays,
    recordPlay,
  };
}

const DUNGEONWORLD_CSV_COLUMNS = [
  ['id', '기록ID'],
  ['userId', '사용자ID'],
  ['displayName', '표시이름'],
  ['sessionId', '회차ID'],
  ['choiceId', '선택ID'],
  ['choiceLabel', '선택내용'],
  ['die1', '주사위1'],
  ['die2', '주사위2'],
  ['total', '합계'],
  ['tier', '결과등급'],
  ['outcomeText', '결과텍스트'],
  ['createdAt', '생성일시'],
];

function formatTimestampForFilename(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, '-');
}

function formatAnalyticsDistribution(items, emptyText) {
  if (!Array.isArray(items) || items.length === 0) {
    return emptyText;
  }

  return items
    .map((item) => {
      const label = item.sessionTitle && item.choiceLabel
        ? `${item.sessionTitle} / ${item.choiceLabel}`
        : item.sessionTitle || item.choiceLabel || item.sessionId || item.choiceId || '항목';
      return `${label}: ${item.count}`;
    })
    .join(', ');
}

function formatTierDistribution(tierCounts) {
  return [
    `10+: ${tierCounts.strong || 0}`,
    `7-9: ${tierCounts.mixed || 0}`,
    `6-: ${tierCounts.weak || 0}`,
    `미확인: ${tierCounts.unknown || 0}`,
  ].join(', ');
}

function buildDungeonworldExportPayload(repository, options = {}) {
  const now = options.now || new Date();
  const generatedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const format = normalizeExportFormat(options.format);
  const limit = Math.min(200, Math.max(1, Number(options.limit || 50)));
  const logs = repository.listRecentPlays(limit);
  const totalPlayCount = repository.getPlayCount();
  const analyticsLogs = totalPlayCount > 0 ? repository.listRecentPlays(totalPlayCount) : [];
  const analyticsOptions = Object.prototype.hasOwnProperty.call(options, 'currentSessionId')
    ? { currentSessionId: options.currentSessionId }
    : {};
  const analytics = buildDungeonworldAnalytics(analyticsLogs, analyticsOptions);
  const exportAnalytics = {
    totalPlayCount: analytics.totalPlayCount,
    uniqueUserCount: analytics.uniqueUserCount,
    sessionCounts: analytics.sessionCounts,
    choiceCounts: analytics.choiceCounts,
    tierCounts: analytics.tierCounts,
    latestSessionProgressCounts: analytics.latestSessionProgressCounts,
  };
  const progressCounts = analytics.latestSessionProgressCounts;

  const summaryText = [
    '종류: 던전월드',
    `포함 개수: ${logs.length}`,
    `전체 플레이 수: ${totalPlayCount}`,
    `생성 시간: ${generatedAt}`,
    '',
    '집계',
    `고유 참여자 수: ${analytics.uniqueUserCount}`,
    `회차별 플레이: ${formatAnalyticsDistribution(analytics.sessionCounts, '아직 플레이 기록이 없습니다.')}`,
    `결과 등급 분포: ${formatTierDistribution(analytics.tierCounts)}`,
    `선택 분포: ${formatAnalyticsDistribution(analytics.choiceCounts, '아직 선택 기록이 없습니다.')}`,
    progressCounts
      ? `최신 회차 진행: ${progressCounts.sessionTitle} / ${progressCounts.playCount}회 / ${progressCounts.uniqueUserCount}명`
      : '최신 회차 진행: 확인할 회차가 없습니다.',
    '',
    '최근 플레이',
    ...(logs.length > 0
      ? logs.slice(0, 10).map((log) => `- ${log.displayName} / ${log.choiceLabel} / ${log.tierLabel}`)
      : ['아직 플레이 기록이 없습니다.']),
  ].join('\n');

  if (format === 'summary') {
    return {
      kind: 'dungeonworld',
      kindLabel: '던전월드',
      format,
      formatLabel: '요약',
      limit,
      generatedAt,
      content: summaryText,
      summaryText,
      data: { logs, totalPlayCount, analytics },
      isAttachment: false,
      rowCount: logs.length,
    };
  }

  const exportedData = {
    logs,
    totalPlayCount,
    analytics: format === 'json' ? exportAnalytics : analytics,
  };
  const content = format === 'csv'
    ? toCsv(logs, DUNGEONWORLD_CSV_COLUMNS)
    : toSafeJson({ exportedAt: generatedAt, kind: 'dungeonworld', limit, data: exportedData });
  const extension = format === 'csv' ? 'csv' : 'json';
  const filename = `operation-export-dungeonworld-${formatTimestampForFilename(now)}.${extension}`;

  return {
    kind: 'dungeonworld',
    kindLabel: '던전월드',
    format,
    formatLabel: format === 'csv' ? 'CSV' : 'JSON',
    limit,
    generatedAt,
    filename,
    content,
    buffer: Buffer.from(content, 'utf8'),
    summaryText,
    data: exportedData,
    isAttachment: true,
    rowCount: logs.length,
  };
}

module.exports = {
  buildDungeonworldAnalytics,
  buildDungeonworldExportPayload,
  buildDungeonworldUserProgress,
  CLOSING_NOTE,
  TIER_LABELS,
  createDungeonworldConfigRepository,
  createDungeonworldRepository,
  getDungeonworldChoiceCounts,
  getDungeonworldContinuityContext,
  getDungeonworldSessionCounts,
  getDungeonworldSessionProgressCounts,
  getDungeonworldTierCounts,
  getDungeonworldUniqueUserCount,
  getChoice,
  getCurrentSessionId,
  getLatestDungeonworldPlaysBySession,
  getPreviousSessionId,
  getRecentDungeonworldActivity,
  getSession,
  listChoices,
  listSessions,
  pickIntroForSession,
  playChoice,
  resolveAutoSessionId,
  resolveTier,
  rollD6,
};
