// 에이전트가 부른 도구(steps)를 대화창에 보여줄 읽기 쉬운 한 줄로 바꿈 — 코드(JSON) 대신 "장소 검색 · 해녀 → 1건"
// steps: [{ tool, args, count }]  (api/agent.js 가 돌려주는 호출 내역)
export const TOOL_LABEL = {
  search_tour_places: '장소 검색',
  search_oreum: '오름 검색',
  search_nearby: '주변 검색',
  search_festivals: '축제 검색',
  search_heritage: '국가유산 검색',
  search_restaurants: '음식점 검색',
  get_weather: '날씨 조회',
  get_place_detail: '소개글 확인',
}
const NO_COUNT = new Set(['get_place_detail'])   // 결과가 목록이 아닌 도구는 건수를 표시하지 않음

// 인자 중 사람이 알아볼 핵심 한 가지 (검색어 · 지역 · 분류 · 유형 · 시작일)
const OREUM_TAG = { sunrise: '일출·일몰', grass: '억새·꽃', view: '정상 전망', crater: '분화구', easy: '가볍게 걷기', family: '가족·아이', forest: '숲길' }
const OREUM_FORM = { cone: '원추형', round: '원형', horseshoe: '말굽형', mixed: '복합형' }
const mainArg = (a = {}) => OREUM_TAG[a.tag] || a.keyword || (a.sort === 'elev' && '표고 높은 순') || (a.sort === 'elev_asc' && '표고 낮은 순') || OREUM_FORM[a.form] || a.place || a.lcls || a.biz || a.category || a.from || (a.lat !== undefined ? '좌표 주변' : '')

export function stepText(step) {
  const label = TOOL_LABEL[step.tool] ?? step.tool
  const arg = mainArg(step.args)
  return `${label}${arg ? ` · ${arg}` : ''}${NO_COUNT.has(step.tool) ? '' : ` → ${step.count}건`}`
}

export const stepsText = (steps = []) => steps.map(stepText).join(' → ')
