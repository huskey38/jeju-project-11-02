// 기상청 단기예보 조회서비스 (VilageFcstInfoService_2.0)
const BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const GRID = { '제주시': [53, 38], '서귀포시': [52, 33] }; // 기상청 격자 좌표(nx, ny)
const SKY = { 1: '맑음', 3: '구름많음', 4: '흐림' };
const PTY = { 0: '없음', 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' };

// 발표시각: 02·05·08·11·14·17·20·23시 (발표 후 약 10분 뒤부터 조회 가능)
function baseDateTime() {
  const kst = new Date(Date.now() + 9 * 3600e3 - 15 * 60e3); // 한국시간, 15분 여유
  let h = [23, 20, 17, 14, 11, 8, 5, 2].find((x) => x <= kst.getUTCHours());
  let day = kst;
  if (h === undefined) { day = new Date(kst.getTime() - 24 * 3600e3); h = 23; }
  return {
    base_date: day.toISOString().slice(0, 10).replaceAll('-', ''),
    base_time: String(h).padStart(2, '0') + '00',
  };
}

export async function getWeather({ place = '제주시' } = {}) {
  const [nx, ny] = GRID[place] ?? GRID['제주시'];
  const params = new URLSearchParams({
    serviceKey: process.env.DATA_GO_KR_KEY,
    dataType: 'JSON', numOfRows: '300', pageNo: '1',
    nx: String(nx), ny: String(ny), ...baseDateTime(),
  });
  const r = await fetch(`${BASE}?${params}`);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('기상청 응답이 JSON이 아님: ' + text.slice(0, 120)); }

  const items = data?.response?.body?.items?.item ?? [];
  const slots = {}; // "날짜 시간" → { TMP, SKY, PTY, POP }
  for (const it of items) {
    const key = `${it.fcstDate} ${it.fcstTime}`;
    (slots[key] ??= {})[it.category] = it.fcstValue;
  }
  return Object.entries(slots).slice(0, 6).map(([time, v]) => ({
    place, time, temp: Number(v.TMP), sky: SKY[v.SKY] ?? v.SKY,
    rain: PTY[v.PTY] ?? v.PTY, pop: Number(v.POP), // pop = 강수확률(%)
  }));
}

// ── 장소·날짜별 예보 (상세 팝업용) ─────────────────────────────────────────
// 오늘~3일 이내: 장소 좌표를 기상청 격자로 바꿔 단기예보(getVilageFcst)를 쓰고,
// 4~10일: 제주 전체 하나의 중기예보(육상 11G00000, 기온 제주시 11G00201)를 씁니다 — 장소와 상관없이 같은 값.
const MID_BASE = 'https://apis.data.go.kr/1360000/MidFcstInfoService';
const MID_LAND = '11G00000', MID_TEMP = '11G00201';
const DAY_MS = 86400000;

// 위경도 → 기상청 격자(nx, ny): 기상청 공식 변환식(람베르트 정형 투영)
export function toGrid(lat, lng) {
  const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0, OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
  const D = Math.PI / 180;
  const re = RE / GRID, slat1 = SLAT1 * D, slat2 = SLAT2 * D, olon = OLON * D, olat = OLAT * D;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + Number(lat) * D * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = Number(lng) * D - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return [Math.floor(ra * Math.sin(theta) + XO + 0.5), Math.floor(ro - ra * Math.cos(theta) + YO + 0.5)];
}

const kstNow = (now = Date.now()) => new Date(now + 9 * 3600e3);
export const todayKst = (now) => kstNow(now).toISOString().slice(0, 10);
const dayDiff = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);

// 중기예보 발표(tmFc): 매일 06·18시 (발표 후 30분 뒤부터 조회). 그 전이면 직전 발표
export function midBase(now = Date.now()) {
  const k = kstNow(now - 30 * 60e3);
  let day = k, h = 18;
  if (k.getUTCHours() >= 18) h = 18;
  else if (k.getUTCHours() >= 6) h = 6;
  else day = new Date(k.getTime() - DAY_MS);
  const date = day.toISOString().slice(0, 10);
  return { date, tmFc: date.replaceAll('-', '') + String(h).padStart(2, '0') + '00' };
}

const precipOf = (text) => (/소나기/.test(text) ? '소나기' : /눈/.test(text) ? '눈' : /비/.test(text) ? '비' : '');

// 단기예보 항목들 → 날짜별 요약 { 'YYYY-MM-DD': { tmin, tmax, sky, precip, pop } }
export function summarizeShort(items) {
  const byDate = {};
  for (const it of items) {
    const d = `${it.fcstDate.slice(0, 4)}-${it.fcstDate.slice(4, 6)}-${it.fcstDate.slice(6, 8)}`;
    (byDate[d] ??= []).push(it);
  }
  const out = {};
  for (const [d, list] of Object.entries(byDate)) {
    const nums = (cat) => list.filter((x) => x.category === cat).map((x) => Number(x.fcstValue));
    const tmp = nums('TMP'), tmn = nums('TMN'), tmx = nums('TMX');
    const skies = list.filter((x) => x.category === 'SKY' && x.fcstTime >= '0600' && x.fcstTime <= '2100').map((x) => x.fcstValue);
    const pool = skies.length ? skies : list.filter((x) => x.category === 'SKY').map((x) => x.fcstValue);
    const count = {};
    for (const v of pool) count[v] = (count[v] ?? 0) + 1;
    const sky = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
    const pty = nums('PTY').filter((v) => v > 0);
    const pop = nums('POP');
    if (!tmp.length && !tmn.length && !tmx.length) continue;
    out[d] = {
      tmin: tmn.length ? tmn[0] : Math.min(...tmp), tmax: tmx.length ? tmx[0] : Math.max(...tmp),
      sky: SKY[sky] ?? '', precip: pty.length ? PTY[pty[0]] : '', pop: pop.length ? Math.max(...pop) : null,
    };
  }
  return out;
}

// 중기예보(육상·기온) → d일 뒤(4~10) 요약
export function midDay(land, ta, d) {
  const am = land[`wf${d}Am`], pm = land[`wf${d}Pm`], one = land[`wf${d}`];
  const sky = one ?? (am && pm && am !== pm ? `${am} → ${pm}` : pm ?? am ?? '');
  const pops = [land[`rnSt${d}Am`], land[`rnSt${d}Pm`], land[`rnSt${d}`]].filter((v) => v !== undefined);
  return {
    tmin: ta?.[`taMin${d}`] ?? null, tmax: ta?.[`taMax${d}`] ?? null,
    sky, precip: precipOf(sky), pop: pops.length ? Math.max(...pops) : null,
  };
}

async function midCall(op, regId, tmFc) {
  const params = new URLSearchParams({ serviceKey: process.env.DATA_GO_KR_KEY, dataType: 'JSON', numOfRows: '10', pageNo: '1', regId, tmFc });
  const text = await (await fetch(`${MID_BASE}/${op}?${params}`)).text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('중기예보 응답이 JSON이 아님: ' + text.slice(0, 120)); }
  return data?.response?.body?.items?.item?.[0] ?? {};
}

async function shortCall(lat, lng) {
  const [nx, ny] = toGrid(lat, lng);
  const params = new URLSearchParams({
    serviceKey: process.env.DATA_GO_KR_KEY, dataType: 'JSON', numOfRows: '1000', pageNo: '1',
    nx: String(nx), ny: String(ny), ...baseDateTime(),
  });
  const text = await (await fetch(`${BASE}?${params}`)).text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('기상청 응답이 JSON이 아님: ' + text.slice(0, 120)); }
  return summarizeShort(data?.response?.body?.items?.item ?? []);
}

// dates: 'YYYY-MM-DD' 목록 → 날짜마다 { date, kind: 'short'|'mid'|'none', tmin, tmax, sky, precip, pop }
//   short = 이 장소 좌표 기준 단기예보, mid = 제주 전체 중기예보, none = 예보 범위 밖(과거·10일 초과)
export async function getForecast({ lat, lng, dates }, now = Date.now()) {
  const today = todayKst(now);
  const base = midBase(now);
  const wantMid = dates.some((d) => { const k = dayDiff(base.date, d); return dayDiff(today, d) > 0 && k >= 4 && k <= 10; });
  const [short, mid] = await Promise.all([
    shortCall(lat, lng),
    wantMid ? Promise.all([midCall('getMidLandFcst', MID_LAND, base.tmFc), midCall('getMidTa', MID_TEMP, base.tmFc)]) : null,
  ]);
  return dates.map((date) => {
    if (short[date]) return { date, kind: 'short', ...short[date] };
    const k = dayDiff(base.date, date);
    if (mid && dayDiff(today, date) > 0 && k >= 4 && k <= 10) return { date, kind: 'mid', ...midDay(mid[0], mid[1], k) };
    return { date, kind: 'none' };
  });
}
