import { fetchRetry } from './text.js';
// 행정안전부 일반음식점 조회서비스 (지방행정 인허가 데이터): https://apis.data.go.kr/1741000/general_restaurants/info
// 제주 영업 중인 일반음식점(약 1만 5천 곳)의 이름·업태·주소·전화·좌표. 사진·소개글은 없음. 관광공사 음식점 목록 뒤에 이어 붙임.
import proj4 from 'proj4';
import index from './data/placeIndex.js';

const BASE = 'https://apis.data.go.kr/1741000/general_restaurants/info';
// 좌표는 옛 중부원점 TM(EPSG:5174, Bessel) → 위경도로 변환
proj4.defs('EPSG:5174', '+proj=tmerc +lat_0=38 +lon_0=127.0028902777778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43 +units=m +no_defs');

// 화면의 업태 칩에서 고를 수 있는 값 (원본 '업태구분명')
export const BIZ_TYPES = ['한식', '횟집', '식육(숯불구이)', '분식', '일식', '중국식', '경양식', '통닭(치킨)'];

const norm = (s) => String(s ?? '').replace(/\([^)]*\)/g, '').replace(/[\s·.\-_,'"`]/g, '').toLowerCase();
const meters = (la1, ln1, la2, ln2) => {
  const k = 111320, dy = (la1 - la2) * k, dx = (ln1 - ln2) * k * Math.cos((la1 * Math.PI) / 180);
  return Math.hypot(dx, dy);
};
// 관광공사 음식점(색인)과 같은 가게(이름이 같고 300m 안)면 중복으로 표시
const tourFood = new Map();
for (const i of index.items) {
  if (String(i.type) !== '39') continue;
  const k = norm(i.title);
  (tourFood.get(k) ?? tourFood.set(k, []).get(k)).push(i);
}
const isDuplicate = (title, lat, lng) => (tourFood.get(norm(title)) ?? []).some((t) => meters(lat, lng, Number(t.lat), Number(t.lng)) < 300);

function toItem(r) {
  const x = Number(r.CRD_INFO_X), y = Number(r.CRD_INFO_Y);
  const ok = r.CRD_INFO_X && r.CRD_INFO_Y && Number.isFinite(x) && Number.isFinite(y);
  const [lng, lat] = ok ? proj4('EPSG:5174', 'WGS84', [x, y]) : [null, null];
  const tel = String(r.TELNO ?? '').trim();
  return {
    id: r.MNG_NO, title: r.BPLC_NM, addr: r.ROAD_NM_ADDR || r.LOTNO_ADDR || '', biz: r.BZSTAT_SE_NM || '',
    ...(tel && { tel }),
    lat: lat === null ? '' : String(lat.toFixed(6)), lng: lng === null ? '' : String(lng.toFixed(6)),
    ...(lat !== null && isDuplicate(r.BPLC_NM, lat, lng) && { dup: true }),
  };
}

async function call(cond, { rows = 12, page = 1 } = {}) {
  const params = new URLSearchParams({ serviceKey: process.env.DATA_GO_KR_KEY, pageNo: String(page), numOfRows: String(rows), returnType: 'json', ...cond });
  const text = await (await fetchRetry(`${BASE}?${params}`)).text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('일반음식점 응답이 JSON이 아님: ' + text.slice(0, 120)); }
  const item = data?.response?.body?.items?.item;
  return !item ? [] : Array.isArray(item) ? item : [item];
}

// 제주 영업 중인 일반음식점 목록. keyword = 가게 이름에 든 글자, biz = 업태(BIZ_TYPES 중 하나)
export async function searchRestaurants({ keyword = '', biz = '', rows = 12, page = 1 } = {}) {
  const cond = { 'cond[SALS_STTS_CD::EQ]': '01', 'cond[ROAD_NM_ADDR::LIKE]': '제주특별자치도' };
  if (keyword.trim()) cond['cond[BPLC_NM::LIKE]'] = keyword.trim();
  if (BIZ_TYPES.includes(biz)) cond['cond[BZSTAT_SE_NM::EQ]'] = biz;
  return (await call(cond, { rows: Math.min(rows, 100), page })).map(toItem);
}

// 한 곳의 상세 (관리번호로 조회)
export async function getRestaurant({ id } = {}) {
  if (!id) throw new Error('id 가 필요해요');
  const [r] = await call({ 'cond[MNG_NO::EQ]': String(id) }, { rows: 1 });
  if (!r) throw new Error('음식점을 찾을 수 없어요');
  const item = toItem(r);
  const info = [
    ['업태', r.BZSTAT_SE_NM], ['전화', item.tel], ['지번 주소', r.LOTNO_ADDR], ['허가일', r.LCPMT_YMD], ['영업 상태', r.DTL_SALS_STTS_NM],
  ].map(([label, value]) => ({ label, value: String(value ?? '').trim() })).filter((x) => x.value);
  return { ...item, info };
}
