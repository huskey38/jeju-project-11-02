import Anthropic from '@anthropic-ai/sdk';
import { searchFestivals, searchNearby, searchTour } from '../server/tour.js';
import { getWeather } from '../server/weather.js';
import { searchHeritage } from '../server/heritage.js';
import { nearFilterOf } from '../src/lib/placeCategories.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = 'claude-sonnet-5-5';

// ① 도구 설명서: Claude는 이 설명만 보고 "어떤 도구를 언제 쓸지" 결정한다
const tools = [
  {
    name: 'search_tour_places',
    description: '한국관광공사 TourAPI로 제주의 관광지·문화시설·축제·음식점을 이름·키워드로 검색한다. 결과의 lat·lng(좌표)는 search_nearby 의 기준 위치로 쓸 수 있다. 숙박은 제공하지 않는다',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '검색어 (예: 해녀, 오름, 돌하르방)' },
        contentTypeId: { type: 'string', description: '12 관광지(기본), 14 문화시설, 15 축제·행사, 39 음식점·카페' },
      },
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
const runTool = {
  search_tour_places: searchTour,
  get_weather: getWeather,
  search_heritage: searchHeritage,
  search_nearby: async ({ lat, lng, radius_m, category = 'all' }) => {
    const f = nearFilterOf(category);
    return slim(await searchNearby({ lat, lng, radius: radius_m, contentTypeId: f.type, lclsSystm2: f.lcls, lclsExclude: f.xlcls, rows: 10 }));
  },
  search_festivals: async (a) => slim(await searchFestivals({ ...a, rows: 15 })),
};

// 오늘 날짜(한국 시간)를 알려줘야 "이번 주말·다음 달" 같은 기간 질문을 날짜로 바꿀 수 있다
const systemPrompt = () => `너는 제주 문화·콘텐츠 IP 가이드 에이전트다.
오늘은 ${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)} (한국 시간)이다.
- 장소·날씨·유산·행사 정보는 반드시 도구로 확인한 뒤 답한다.
- 도구 결과에 없는 장소는 지어내지 않는다.
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
    for (let turn = 0; turn < 5; turn++) {
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
