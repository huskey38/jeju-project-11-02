// 제주 오름 현황 조회: scripts/build-oreum.mjs 가 만든 공식 368곳(server/data/oreum.js) + 관광공사 소개글 색인의 특징 태그 (외부 API 호출 없음)
import data from './data/oreum.js';
import index from './data/placeIndex.js';
import extra from './data/oreumImages.js';
import { matchesForm } from '../src/lib/oreumForms.js';
import { isJejuCoord } from '../src/lib/geo.js';

const tagsByTour = new Map(index.items.filter((i) => i.oreum).map((i) => [String(i.id), i.otags ?? []]));
const meters = (la1, ln1, la2, ln2) => {
  const k = 111320, dy = (la1 - la2) * k, dx = (ln1 - ln2) * k * Math.cos((la1 * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

// 사진: 관광공사(공공데이터) 연결 사진 → 보완 사진(oreumImages.js: 관광공사 키워드 검색). 블로그·웹 사진은 저작권 때문에 쓰지 않음
const photo = (o) => {
  const image = o.image || extra[o.id]?.image || '';
  return image ? { image } : o.tourId ? { image: '' } : {};
};

// 화면·에이전트용 항목 (title 은 name 과 같음 — 카드 등 공용 코드가 title 을 씀)
const view = (o, dist) => ({
  id: o.id, title: o.name, name: o.name, city: o.city, addr: o.addr, elev: o.elev, area: o.area, rel: o.rel, form: o.form,
  lat: o.lat, lng: o.lng, ...(o.tourId && { tourId: o.tourId }), ...photo(o), ...(dist !== undefined && { dist }),
});

export const oreumInfo = () => ({ count: data.items.length, baseDate: data.baseDate, withCoords: data.items.filter((o) => isJejuCoord(o.lat, o.lng)).length, withTour: data.items.filter((o) => o.tourId).length });

// keyword: 이름에 든 글자, form: 형태 묶음 키(cone·round·horseshoe·mixed·etc), tags: 소개글 특징 태그(관광공사에 등록된 오름만 해당),
// sort: 'elev' 표고 높은 순, 'elev_asc' 낮은 순 (기본은 이름순·공식 연번순), lat·lng·radius(m): 그 반경 안을 가까운 순으로, id: 한 곳만
export function searchOreum({ id, keyword = '', form = '', tags = [], sort = '', lat, lng, radius = 0, rows = 12, page = 1 } = {}) {
  if (id !== undefined && id !== '') { const o = data.items.find((x) => x.id === String(id)); return o ? [view(o)] : []; }
  const kw = String(keyword).trim();
  const near = Number.isFinite(Number(lat)) && lat !== '' && lat !== undefined && Number.isFinite(Number(lng)) && Number(radius) > 0;
  let list = data.items.filter((o) =>
    (!kw || o.name.includes(kw)) && matchesForm(o.form, form)
    && tags.every((t) => o.tourId && (tagsByTour.get(o.tourId) ?? []).includes(t)));
  if (near) {
    list = list.filter((o) => isJejuCoord(o.lat, o.lng))
      .map((o) => ({ o, dist: Math.round(meters(Number(lat), Number(lng), o.lat, o.lng)) }))
      .filter((x) => x.dist <= Number(radius)).sort((a, b) => a.dist - b.dist);
    return list.slice((page - 1) * rows, page * rows).map((x) => view(x.o, x.dist));
  }
  if (sort === 'elev') list = [...list].sort((a, b) => (b.elev ?? 0) - (a.elev ?? 0));
  if (sort === 'elev_asc') list = [...list].sort((a, b) => (a.elev ?? Infinity) - (b.elev ?? Infinity));   // 표고 모름은 맨 뒤
  return list.slice((page - 1) * rows, page * rows).map((o) => view(o));
}
