import Anthropic from '@anthropic-ai/sdk';
import { getTourDetail, searchFestivals, searchNearby, searchTour } from '../server/tour.js';
import { BIZ_TYPES, searchRestaurants } from '../server/restaurants.js';
import { searchOreum } from '../server/oreum.js';
import { TAG_RULES } from '../src/lib/placeTags.js';
import { getWeather } from '../server/weather.js';
import { searchHeritage } from '../server/heritage.js';
import { nearFilterOf } from '../src/lib/placeCategories.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5-5';

// ① 도구 설명서: Claude는 이 설명만 보고 "어떤 도구를 언제 쓸지" 결정한다
const OREUM_TAGS = TAG_RULES.oreum.map((t) => t.key);
const tools = [
  {
    name: 'search_oreum',
    description: '제주 오름 현황(제주특별자치도 공식 368곳: 이름·행정시·소재지·표고·형태·면적·비고, 모두 좌표 있음)에서 오름을 찾는다. 오름 질문은 search_tour_places 보다 먼저 이 도구를 쓴다. 이름(keyword)·형태(form)로 거르고 sort=elev 로 표고 높은 순·sort=elev_asc 로 낮은 순, 기준 좌표(lat·lng)와 radius_m 을 주면 그 반경 안의 오름을 가까운 순으로 준다("근처 오름"은 기준 장소를 search_tour_places 로 먼저 찾아 좌표를 얻는다). tag(일출·일몰, 억새·꽃, 정상 전망, 분화구, 가볍게 걷기, 가족, 숲길)는 관광공사 소개글에서 뽑은 특징이라 관광공사에 등록된 약 80곳에만 있다. 결과에 tour_id 가 있으면 get_place_detail 로 사진·소개글 설명을 확인할 수 있다(없는 오름은 공식 정보만 있음)',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '오름 이름에 든 글자 (예: 새별, 다랑쉬)' },
        form: { type: 'string', enum: ['cone', 'round', 'horseshoe', 'mixed'], description: '형태: cone 원추형 / round 원형 / horseshoe 말굽형 / mixed 복합형' },
        sort: { type: 'string', enum: ['elev', 'elev_asc'], description: 'elev = 표고 높은 순("가장 높은 오름"), elev_asc = 표고 낮은 순("가장 낮은 오름")' },
        tag: { type: 'string', enum: OREUM_TAGS, description: 'sunrise 일출·일몰 / grass 억새·꽃 / view 정상 전망 / crater 분화구·굼부리 / easy 가볍게 걷기 / family 가족·아이 / forest 숲길·자연' },
        lat: { type: 'number', description: '기준 위도 (제주 안)' },
        lng: { type: 'number', description: '기준 경도 (제주 안)' },
        radius_m: { type: 'number', description: '반경(미터), 기본 5000, 최대 30000' },
      },
    },
  },
  {
    name: 'search_tour_places',
    description: '한국관광공사 TourAPI로 제주의 관광지·문화시설·축제·음식점을 검색한다. keyword 는 **장소 이름**에 든 글자만 찾는다(소개글은 보지 않음). 이름에 없는 종류("동물원", "오름" 등)로 찾으려면 keyword 대신(또는 함께) lcls 분류 코드를 쓴다. 결과의 lat·lng(좌표)는 search_nearby 의 기준 위치로 쓸 수 있다. 숙박은 제공하지 않는다',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '이름에 든 검색어 (예: 해녀, 오름, 돌하르방)' },
        contentTypeId: { type: 'string', description: '12 관광지(기본), 14 문화시설, 15 축제·행사, 39 음식점·카페. lcls 를 쓰면 생략해 모든 유형에서 찾는다' },
        lcls: { type: 'string', description: '분류체계 코드(선택). 중분류 4자 또는 소분류 8자. 예: VE02 테마공원(테마파크·워터파크·동물원·수족관 모두 여기 들어감), VE020300 동물원, VE020400 수족관, VE01 랜드마크(전망대·다리), NA01 자연경관(산·오름), NA02 하천·해양, NA03 자연생태, EX 체험(EX03 농·산·어촌), HS01 역사유적지, FD01 한식, FD05 카페. 분류가 어긋난 곳이 있으니(예: 조류 동물원인 화조원은 VE020300 이 아니라 테마파크 VE020100) 동물원·수족관은 VE02 전체를 조회한 뒤 이름과 소개글로 고른다' },
      },
    },
  },
  {
    name: 'search_restaurants',
    description: '행정안전부 일반음식점 인허가 데이터(제주 영업 중 약 1만 5천 곳: 이름·업태·주소·전화·좌표)에서 가게를 찾는다. search_tour_places 는 관광공사에 등록된 약 700곳뿐이라, 동네 식당·특정 업태(횟집·식육구이 등)를 찾을 때는 이 도구가 훨씬 많이 나온다. 사진·소개글은 없다. keyword 는 가게 이름에 든 글자만 찾는다. 이미 관광공사 목록에 있는 곳이 겹쳐 나올 수 있다(dup=true 는 겹침)',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '가게 이름에 든 글자 (예: 흑돼지, 국수, 몸국)' },
        biz: { type: 'string', enum: BIZ_TYPES, description: '업태(선택)' },
      },
    },
  },
  {
    name: 'get_place_detail',
    description: '장소 하나의 소개글(overview)과 이용 정보를 읽는다. search_tour_places 로 찾은 후보가 사용자가 원하는 곳이 맞는지(예: "동물을 볼 수 있는 곳인가") 소개글로 확인할 때 쓴다. 이름만으로 판단이 안 되면 후보 몇 곳(많아야 3곳)만 확인한다',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: '장소 id (search_tour_places 결과의 id)' } },
      required: ['id'],
    },
  },
  {
    name: 'search_nearby',
    description: '좌표 주변의 장소를 가까운 순으로 검색한다(위치 기반). "근처·주변·가까운" 질문에 쓴다. 기준 좌표는 먼저 search_tour_places 로 기준 장소를 찾아 그 결과의 lat·lng 를 쓴다. 각 결과의 dist 는 기준점으로부터의 거리(미터)다',
    input_schema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: '기준 위도 (제주 안, 예: 33.4996)' },
        lng: { type: 'number', description: '기준 경도 (제주 안, 예: 126.5312)' },
        radius_m: { type: 'number', description: '반경(미터), 기본 3000, 최대 20000' },
        category: { type: 'string', enum: ['all', 'spot', 'culture', 'festival', 'food', 'cafe'], description: 'all 전체, spot 관광지, culture 문화시설, festival 축제·행사, food 음식점(카페 제외), cafe 카페' },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'search_festivals',
    description: '기간으로 제주의 축제·행사를 검색한다. from 이후(기본 오늘)에 진행 중이거나 시작하는 행사가 나오고, to 를 주면 그 날짜까지로 좁힌다. "이번 주말·다음 달·○월 축제" 같은 질문에 쓴다',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '시작일 YYYY-MM-DD (생략하면 오늘)' },
        to: { type: 'string', description: '종료일 YYYY-MM-DD (생략 가능)' },
        keyword: { type: 'string', description: '행사명에 포함된 글자 (선택)' },
      },
    },
  },
  {
    name: 'get_weather',
    description: '기상청 단기예보로 제주시/서귀포시의 앞으로 몇 시간 기온·하늘·강수를 조회한다',
    input_schema: {
      type: 'object',
      properties: { place: { type: 'string', enum: ['제주시', '서귀포시'] } },
      required: ['place'],
    },
  },
  {
    name: 'search_heritage',
    description: '국가유산청 API로 제주의 국가유산(문화재)을 이름으로 검색한다',
    input_schema: { type: 'object', properties: { keyword: { type: 'string' } } },
  },
];

// ② 도구 이름 → 실제 실행할 함수
// 도구 결과는 모델이 읽기 쉽고 토큰이 덜 들도록 필요한 필드만 남김
const slim = (list) => list.map(({ id, title, type, lcls, addr, dist, start, end, lat, lng }) => ({ id, title, type, lcls, addr, dist, start, end, lat, lng }));
const LCLS = /^[A-Z]{2}\d{2}(\d{4})?$/;   // 분류체계 중분류 4자(VE02) 또는 소분류 8자(VE020300)
const runTool = {
  // lcls 를 주면 분류로 찾기: 유형 제한을 풀고 더 많이(30곳) 가져옴. 숙박(AC)은 쓰지 않음
  search_tour_places: async ({ keyword = '', contentTypeId, lcls = '' } = {}) => {
    const code = LCLS.test(lcls) && !lcls.startsWith('AC') ? lcls : ''
    return slim(await searchTour({ keyword, contentTypeId: code && !contentTypeId ? '' : (contentTypeId ?? '12'), lclsSystm2: code, rows: code ? 30 : 10 }))
  },
  search_oreum: async ({ tag, keyword = '', form = '', sort = '', lat, lng, radius_m = 5000 } = {}) => {
    const near = lat !== undefined && lng !== undefined && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    return searchOreum({
      keyword, form, sort, tags: OREUM_TAGS.includes(tag) ? [tag] : [], rows: 10,
      ...(near && { lat, lng, radius: Math.min(Math.max(Number(radius_m) || 5000, 100), 30000) }),
    }).map(({ id, name, city, addr, elev, form: f, lat: la, lng: ln, dist, tourId }) => ({ id, title: name, city, addr, elev, form: f, lat: la, lng: ln, ...(dist !== undefined && { dist }), ...(tourId && { tour_id: tourId }) }))
  },
  search_restaurants: async ({ keyword = '', biz = '' } = {}) =>
    (await searchRestaurants({ keyword, biz, rows: 15 })).map(({ id, title, biz: b, addr, tel, lat, lng, dup }) => ({ id, title, biz: b, addr, tel, lat, lng, ...(dup && { dup }) })),
  get_place_detail: async ({ id } = {}) => {
    const d = await getTourDetail({ id: String(id ?? '') })
    return { id: d.id, title: d.title, type: d.type, addr: d.addr, overview: d.overview.slice(0, 400), info: d.info.slice(0, 4) }
  },
  get_weather: getWeather,
  search_heritage: searchHeritage,
  search_nearby: async ({ lat, lng, radius_m, category = 'all' }) => {
    const f = nearFilterOf(category);
    return slim(await searchNearby({ lat, lng, radius: radius_m, contentTypeId: f.type, lclsSystm2: f.lcls, lclsExclude: f.xlcls, rows: 10 }));
  },
  search_festivals: async (a) => slim(await searchFestivals({ ...a, rows: 15 })),
};

// 오늘 날짜(한국 시간)를 알려줘야 "이번 주말·다음 달" 같은 기간 질문을 날짜로 바꿀 수 있다
const systemPrompt = () => `너는 제주 오름 가이드 에이전트다. 오름을 중심으로, 그 주변 장소·날씨·행사까지 안내한다.
오늘은 ${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)} (한국 시간)이다.
- 장소·날씨·유산·행사 정보는 반드시 도구로 확인한 뒤 답한다.
- 도구 결과에 없는 장소는 지어내지 않는다.
- 오름을 묻는 질문은 search_oreum 으로 먼저 찾는다(이름 keyword, 형태 form, "가장 높은"은 sort=elev, "가장 낮은"은 sort=elev_asc, 특징은 tag, "근처"는 좌표+반경). 자세한 설명은 get_place_detail 로 소개글을 확인한다. 오름에 가기 전후로 날씨와 근처 음식점·카페를 이어서 안내하면 좋다.
- search_tour_places 의 keyword 는 장소 이름에 든 글자만 찾는다. "동물원·수족관·체험"처럼 이름에 없을 수 있는 종류를 물으면, keyword 로 0건이어도 포기하지 말고 lcls 분류 코드(예: 동물·테마파크는 VE02)로 후보를 모은 뒤 이름·소개글(get_place_detail, 많아야 3곳)로 알맞은 곳을 골라 답한다.
- 관광공사에 없는 동네 식당이나 특정 업태(횟집·식육구이·분식 등)는 search_restaurants 로도 찾는다 (이름에 든 글자만 찾고 사진·소개글은 없다).
- 그래도 찾지 못했으면 이름 기준 검색의 한계라고 솔직히 알리고, 가까운 대안을 제안한다.
- "근처·주변" 질문은 기준 장소를 search_tour_places 로 찾아 좌표를 얻은 뒤 search_nearby 로 가까운 순 결과를 확인한다. 거리(dist)는 미터 단위다.
- 날짜·기간이 있는 축제·행사 질문은 날짜를 YYYY-MM-DD 로 바꿔 search_festivals 를 쓴다.
- 숙박(호텔·펜션 등)은 다루지 않는다. 물어보면 제공하지 않는 정보라고 알린다.
- 비가 오거나 강수확률이 높으면 실내 대안을 함께 제안한다.
- 답은 한국어로, 5문장 이내로 짧게.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { message, history = [] } = req.body ?? {};
  const messages = [...history.slice(-10), { role: 'user', content: message }]; // 최근 10개만 보내 비용 절약
  const steps = []; // 화면에 "에이전트가 무엇을 했는지" 보여주기용

  try {
    // ③ 에이전트 루프: 생각 → 도구 호출 → 결과 확인 → (반복) → 최종 답
    for (let turn = 0; turn < 5; turn++) {   // 루프 상한 5회 (안내서의 Claude 키 규칙)
      const r = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(),
        tools,
        messages,
      });

      if (r.stop_reason !== 'tool_use') {
        const answer = r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
        return res.status(200).json({ answer, steps });
      }

      messages.push({ role: 'assistant', content: r.content }); // Claude의 도구 호출 요청을 대화에 기록
      const results = [];
      for (const block of r.content) {
        if (block.type !== 'tool_use') continue;
        let result;
        try { result = await runTool[block.name](block.input ?? {}); }
        catch (e) { result = { error: e.message }; }
        steps.push({ tool: block.name, args: block.input, count: Array.isArray(result) ? result.length : 0 });
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'user', content: results }); // 도구 결과를 Claude에게 돌려줌
    }
    res.status(200).json({ answer: '도구 호출이 너무 많아 중단했어요. 질문을 좁혀 주세요.', steps });
  } catch (e) {
    // 429 = 호출 한도 초과, 401 = 키 오류
    res.status(e.status ?? 500).json({ error: e.status === 429 ? '사용량이 많아요. 1분 뒤 다시 시도하세요.' : e.message });
  }
}
