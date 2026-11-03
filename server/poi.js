import { fetchRetry } from './text.js';
// 카카오 로컬 API 카테고리 검색: 좌표 주변의 편의점·주차장·주유소를 가까운 순으로 (KAKAO_REST_KEY 필요, 서버에서만 사용)
const API = 'https://dapi.kakao.com/v2/local/search';

// 카카오 카테고리 그룹 코드 → 화면 이름 (편의점 CS2, 주차장 PK6, 주유소 OL7)
export const POI_CATEGORIES = { CS2: '편의점', PK6: '주차장', OL7: '주유소' };

// 공영주차장: 카카오 하위 분류가 '주차장 > 공영주차장' 이거나 이름에 '공영'이 든 곳
const isPublicLot = (d) => /공영주차장/.test(d.category_name ?? '') || /공영/.test(d.place_name ?? '');

const view = (d) => ({
  id: d.id, title: d.place_name, addr: d.road_address_name || d.address_name || '', tel: d.phone || '',
  dist: Number(d.distance) || 0, lat: d.y, lng: d.x, url: d.place_url ? String(d.place_url).replace(/^http:/, 'https:') : '',
  ...(d.category_group_code === 'PK6' && isPublicLot(d) && { public: true }),
});

async function docs(path, params, key) {
  const r = await fetchRetry(`${API}/${path}?${new URLSearchParams(params)}`, { headers: { Authorization: `KakaoAK ${key}` } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`카카오 장소 검색 오류(${r.status}): ${data.msg ?? '응답을 읽을 수 없어요'}`);
  return data.documents ?? [];
}

// radius: 미터(100~2000), rows: 최대 15 (카카오 한 쪽 최대)
// 주차장(PK6)은 공영주차장을 먼저 보여줌: 이름 검색("공영주차장")과 카테고리 검색 두 쪽을 합쳐 공영을 앞으로(각각 가까운 순), 남는 자리는 민간 주차장
export async function searchPoi({ lat, lng, cat, radius = 500, rows = 15 } = {}) {
  if (!POI_CATEGORIES[cat]) throw new Error('cat 은 CS2(편의점)·PK6(주차장)·OL7(주유소) 중 하나예요');
  const la = Number(lat), ln = Number(lng);
  if (!(la > 33.0 && la < 33.7 && ln > 126.0 && ln < 127.1)) throw new Error('제주 안의 위도·경도(lat, lng)가 필요해요');
  const key = process.env.KAKAO_REST_KEY;
  if (!key) throw new Error('KAKAO_REST_KEY 가 설정되지 않았어요');
  const size = Math.min(Math.max(Number(rows) || 15, 1), 15);
  const base = {
    category_group_code: cat, x: String(ln), y: String(la), sort: 'distance',
    radius: String(Math.min(Math.max(Number(radius) || 500, 100), 2000)), size: String(size),
  };
  if (cat !== 'PK6') return (await docs('category.json', base, key)).map(view);

  const [named, p1, p2] = await Promise.all([
    docs('keyword.json', { ...base, query: '공영주차장' }, key),
    docs('category.json', base, key),
    docs('category.json', { ...base, page: '2' }, key),
  ]);
  const seen = new Set();
  const all = [...named, ...p1, ...p2].filter((d) => !seen.has(d.id) && seen.add(d.id)).map((d) => ({ ...d, category_group_code: 'PK6' }));
  const byDist = (a, b) => (Number(a.distance) || 0) - (Number(b.distance) || 0);
  const pub = all.filter(isPublicLot).sort(byDist), rest = all.filter((d) => !isPublicLot(d)).sort(byDist);
  return [...pub, ...rest].slice(0, size).map(view);
}
