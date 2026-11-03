// 한국관광공사 TourAPI (국문 관광정보 서비스 KorService2)
import { extractUrl, fetchRetry, fmtDate, htmlToText, https, todayKst, ymd } from './text.js';

const BASE = 'https://apis.data.go.kr/B551011/KorService2';

// 숙박은 서비스 대상이 아니므로 모든 결과에서 뺍니다 (유형 32 / 분류체계 대분류 AC)
export const isLodging = (p) => String(p.contenttypeid) === '32' || p.lclsSystm1 === 'AC';

// 공공데이터포털이 주는 오류(키·한도)를 사람이 읽을 말로: 한도 초과 때 빈 목록이나 "찾을 수 없어요"로 보이지 않게 함
function apiError(data) {
  const msg = data?.OpenAPI_ServiceResponse?.cmmMsgHeader?.errMsg;
  if (!msg) return null;
  if (/PER_SECOND/.test(msg)) return new Error('관광공사 API 호출이 너무 몰렸어요. 잠시 뒤 다시 시도해 주세요');
  if (/LIMITED_NUMBER/.test(msg)) return new Error('관광공사 API 하루 호출 한도를 넘었어요. 내일(자정 이후) 다시 시도해 주세요');
  return new Error('TourAPI 오류: ' + msg);
}

// 목록 API 공통 호출: 원본 항목 배열을 돌려줌 (region=false 면 지역 제한 없이 — 위치 기반은 좌표가 범위를 정함)
async function callList(op, extra, { region = true } = {}) {
  const params = new URLSearchParams({
    serviceKey: process.env.DATA_GO_KR_KEY, // ★ Decoding 키
    MobileOS: 'ETC',
    MobileApp: 'JejuIP',
    _type: 'json',
    ...(region && { lDongRegnCd: '50' }), // 법정동 지역코드 50 = 제주. 옛 areaCode=39 는 데이터 일부만 잡힘 (관광지 132 vs 557건, 축제는 0 vs 27건)
    ...extra,
  });
  const r = await fetchRetry(`${BASE}/${op}?${params}`);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('TourAPI 응답이 JSON이 아님: ' + text.slice(0, 120)); }
  const failed = apiError(data);
  if (failed) throw failed;
  const item = data?.response?.body?.items?.item;
  return !item ? [] : Array.isArray(item) ? item : [item];
}

// 원본 → 화면용 항목 (거리·행사 기간이 있으면 함께)
function toItem(p) {
  return {
    id: p.contentid, title: p.title, addr: p.addr1,
    image: https(p.firstimage), lng: p.mapx, lat: p.mapy, type: p.contenttypeid, lcls: p.lclsSystm2,
    ...(p.dist !== undefined && { dist: Math.round(Number(p.dist)) }),
    ...(p.eventstartdate && { start: fmtDate(p.eventstartdate), end: fmtDate(p.eventenddate) }),
  };
}

// 분류체계 코드 → 요청 변수: 4자(FD05)는 중분류 lclsSystm2, 8자(FD020100)는 소분류 lclsSystm3
const lclsParam = (code) => (code ? { [String(code).length > 4 ? 'lclsSystm3' : 'lclsSystm2']: code } : {});

// lclsSystm2: 분류체계 중분류 (예: FD05 = 카페/찻집, FD01 = 한식). 카페는 음식점(39) 안에 이 코드로 들어 있음
export async function searchTour({ keyword = '', contentTypeId = '12', rows = 10, page = 1, lclsSystm2 = '' } = {}) {
  if (contentTypeId === '32') return [];
  const extra = { numOfRows: String(rows), pageNo: String(page) };
  if (contentTypeId) extra.contentTypeId = contentTypeId;
  Object.assign(extra, lclsParam(lclsSystm2));
  if (keyword) extra.keyword = keyword;
  const list = await callList(keyword ? 'searchKeyword2' : 'areaBasedList2', extra);
  return list.filter((p) => !isLodging(p)).map(toItem);
}

// 걸러낸 뒤에도 쪽 크기가 일정하도록, 원본을 크게(100건씩) 읽어 숙박을 빼고 필요한 만큼 모은 다음 해당 쪽을 잘라 줌
async function collect(op, extra, opts, page, rows, keep = () => true) {
  const need = page * rows, kept = [];
  for (let raw = 1; kept.length < need; raw++) {
    const list = await callList(op, { ...extra, numOfRows: '100', pageNo: String(raw) }, opts);
    kept.push(...list.filter((p) => !isLodging(p) && keep(p)));
    if (list.length < 100) break;
  }
  return kept.slice((page - 1) * rows, page * rows);
}

// 위치 기반 검색 (locationBasedList2): 좌표 주변을 가까운 순으로. radius 는 미터(최대 20km)
// lclsExclude: 이 분류체계 중분류는 결과에서 뺌 (예: 음식점에서 카페 FD05 제외)
export async function searchNearby({ lat, lng, radius = 3000, contentTypeId = '', lclsSystm2 = '', lclsExclude = '', rows = 12, page = 1 } = {}) {
  const la = Number(lat), ln = Number(lng);
  if (!(la > 33.0 && la < 33.7 && ln > 126.0 && ln < 127.1)) throw new Error('제주 안의 위도·경도(lat, lng)가 필요해요');
  if (contentTypeId === '32') return [];
  const extra = {
    mapX: String(ln), mapY: String(la), radius: String(Math.min(Math.max(Number(radius) || 3000, 100), 20000)), arrange: 'E', // E = 거리순
  };
  if (contentTypeId) extra.contentTypeId = contentTypeId;
  Object.assign(extra, lclsParam(lclsSystm2));
  const keep = lclsExclude ? (p) => p.lclsSystm2 !== lclsExclude : undefined;
  return (await collect('locationBasedList2', extra, { region: false }, page, rows, keep)).map(toItem);
}

// 축제 기간 검색 (searchFestival2): from 이후(기본 오늘)에 진행 중이거나 시작하는 행사. to 가 있으면 그 날짜까지
// keyword 는 행사명 포함 여부로 걸러냄 (API 에 검색어가 없음)
export async function searchFestivals({ from = '', to = '', keyword = '', rows = 12, page = 1 } = {}) {
  const extra = { eventStartDate: ymd(from) || todayKst(), numOfRows: '100', pageNo: '1' };
  if (ymd(to)) extra.eventEndDate = ymd(to);
  const kw = String(keyword).trim();
  const list = (await callList('searchFestival2', extra))
    .filter((p) => !isLodging(p) && (!kw || String(p.title).includes(kw)));
  return list.slice((page - 1) * rows, page * rows).map(toItem);
}

// ── 상세 조회 ─────────────────────────────────────────────
// detailCommon2(소개·홈페이지·좌표) + detailIntro2(유형별 이용정보) + detailImage2(사진)
async function callDetail(op, extra) {
  const params = new URLSearchParams({
    serviceKey: process.env.DATA_GO_KR_KEY, MobileOS: 'ETC', MobileApp: 'JejuIP', _type: 'json', ...extra,
  });
  const r = await fetchRetry(`${BASE}/${op}?${params}`);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('TourAPI 응답이 JSON이 아님: ' + text.slice(0, 120)); }
  const failed = apiError(data);
  if (failed) throw failed;
  const item = data?.response?.body?.items?.item;
  return !item ? [] : Array.isArray(item) ? item : [item];
}

// 유형(contenttypeid)마다 이용정보 필드 이름이 달라서 [표시 이름, 필드] 목록으로 맞춥니다
const INTRO_FIELDS = {
  12: [['문의', 'infocenter'], ['이용시간', 'usetime'], ['휴무일', 'restdate'], ['주차', 'parking'], ['반려동물', 'chkpet'], ['유모차', 'chkbabycarriage'], ['신용카드', 'chkcreditcard']],
  14: [['이용요금', 'usefee'], ['이용시간', 'usetimeculture'], ['휴관일', 'restdateculture'], ['문의', 'infocenterculture'], ['주차', 'parkingculture'], ['주차요금', 'parkingfee']],
  15: [['장소', 'eventplace'], ['시간', 'playtime'], ['이용요금', 'usetimefestival'], ['주최', 'sponsor1'], ['주최 연락처', 'sponsor1tel'], ['프로그램', 'program']],
  39: [['대표메뉴', 'firstmenu'], ['취급메뉴', 'treatmenu'], ['영업시간', 'opentimefood'], ['휴무일', 'restdatefood'], ['문의', 'infocenterfood'], ['주차', 'parkingfood']],
};

// 목록 카드용 미리보기: 대표 사진 한 장만 (detailCommon2 한 번 — 상세 전체보다 호출이 3분의 1)
export async function getTourPreview({ id } = {}) {
  if (!id) throw new Error('id 가 필요해요');
  const [c] = await callDetail('detailCommon2', { contentId: id });
  if (!c || isLodging(c)) throw new Error('장소를 찾을 수 없어요');
  return { id: c.contentid, type: String(c.contenttypeid), title: c.title, addr: c.addr1 ?? '', image: https(c.firstimage) };
}

export async function getTourDetail({ id } = {}) {
  if (!id) throw new Error('id 가 필요해요');
  const [c] = await callDetail('detailCommon2', { contentId: id });
  if (!c || isLodging(c)) throw new Error('장소를 찾을 수 없어요');
  const type = String(c.contenttypeid);
  // 소개·사진은 없어도 기본 정보는 보여 주도록 실패하면 빈 값으로
  const [intro = {}] = await callDetail('detailIntro2', { contentId: id, contentTypeId: type }).catch(() => []);
  const imgs = await callDetail('detailImage2', { contentId: id, imageYN: 'Y', numOfRows: '10' }).catch(() => []);

  const info = INTRO_FIELDS[type]?.map(([label, key]) => ({ label, value: htmlToText(intro[key]) })).filter((r) => r.value) ?? [];
  if (type === '15' && intro.eventstartdate) {
    info.unshift({ label: '기간', value: [fmtDate(intro.eventstartdate), fmtDate(intro.eventenddate)].filter(Boolean).join(' ~ ') });
  }
  if (c.tel) info.unshift({ label: '전화', value: htmlToText(c.tel) });

  const images = [c.firstimage, ...imgs.map((i) => i.originimgurl)].filter(Boolean).map(https);
  return {
    id: c.contentid, type, title: c.title,
    addr: [c.addr1, c.addr2].filter(Boolean).join(' '),
    homepage: extractUrl(c.homepage),
    overview: htmlToText(c.overview),
    lat: c.mapy, lng: c.mapx,
    images: [...new Set(images)],
    info,
  };
}
