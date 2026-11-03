// 제주 오름 현황 조회: scripts/build-oreum.mjs 가 만든 공식 368곳(server/data/oreum.js) + 관광공사 소개글 색인의 특징 태그 (외부 API 호출 없음)
import data from './data/oreum.js';
import index from './data/placeIndex.js';
import extra from './data/oreumImages.js';
import intro from './data/oreumIntro.js';
import summary from './data/oreumSummary.js';
import { matchesForm } from '../src/lib/oreumForms.js';
import { isJejuCoord } from '../src/lib/geo.js';

const tagsByTour = new Map(index.items.filter((i) => i.oreum).map((i) => [String(i.id), i.otags ?? []]));
const meters = (la1, ln1, la2, ln2) => {
  const k = 111320, dy = (la1 - la2) * k, dx = (ln1 - ln2) * k * Math.cos((la1 * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

// 사진: 관광공사(공공데이터) 연결 사진 → 보완 사진(oreumImages.js: 관광공사 키워드 검색·비짓제주). 블로그·웹 사진은 저작권 때문에 쓰지 않음
const CREDIT = { tour: '한국관광공사', visitjeju: '비짓제주(제주관광공사)', 'jeju-aerial': '제주특별자치도(오름 항공뷰)' };   // 사진 출처 표기 (화면에서 사진 밑에 보여 줌)
const photo = (o) => {
  const e = extra[o.id];
  const image = o.image || e?.image || '';
  const credit = o.image ? CREDIT.tour : CREDIT[e?.by];
  return image ? { image, ...(credit && { imageCredit: credit }) } : o.tourId ? { image: '' } : {};
};

// 공식 소개 보강(oreumIntro.js: 관내 관광지데이터와 이름·좌표가 안전하게 일치한 오름만): 소개글·편의시설·주차·관리기관
const introOf = (id) => {
  const e = intro.items[id];
  return e ? { intro: e.intro, ...(e.facilities.length && { facilities: e.facilities }), ...(e.parking && { parking: e.parking }), ...(e.org && { org: e.org }), ...(e.tel && { tel: e.tel }) } : {};
};

// 이름 유래·특징 한 줄(oreumSummary.js: 제주오름요약설명과 이름·좌표가 안전하게 일치한 오름만, 2021-11-30 기준)
const summaryOf = (id) => (summary.items[id] ? { summary: summary.items[id].text } : {});

// 화면·에이전트용 항목 (title 은 name 과 같음 — 카드 등 공용 코드가 title 을 씀)
const view = (o, dist) => ({
  id: o.id, title: o.name, name: o.name, city: o.city, addr: o.addr, elev: o.elev, area: o.area, rel: o.rel, form: o.form,
  lat: o.lat, lng: o.lng, ...(o.tourId && { tourId: o.tourId }), ...photo(o), ...introOf(o.id), ...summaryOf(o.id), ...(dist !== undefined && { dist }),
});

// 추천순(처음 온 사람용): ① 널리 알려진 대표 오름(FEATURED, 이 순서대로) → ② 사진이 있고 가볍게 오를 수 있는(표고 400m 이하) 오름, 낮은 순 → ③ 그 밖에 사진이 있는 오름, 낮은 순 → ④ 나머지(공식 연번순)
export const FEATURED = ['214', '289', '86', '255', '122', '56', '146', '170', '21', '201', '105', '243'];   // 새별·용눈이·다랑쉬·아부·따라비·금오름·물영아리·백약이·거문·산굼부리·도두봉·송악산
export const EASY_M = 400;
const rankOf = (o) => {
  const f = FEATURED.indexOf(o.id);
  if (f >= 0) return [0, f];
  const hasPhoto = !!photo(o).image, elev = o.elev ?? Infinity;
  if (hasPhoto && elev <= EASY_M) return [1, elev];
  if (hasPhoto) return [2, elev];
  return [3, 0];
};
const byRecommend = (a, b) => { const x = rankOf(a), y = rankOf(b); return x[0] - y[0] || x[1] - y[1]; };   // sort 는 안정 정렬이라 같은 순위는 공식 연번 순서를 지킴

export const oreumInfo = () => ({ count: data.items.length, baseDate: data.baseDate, withCoords: data.items.filter((o) => isJejuCoord(o.lat, o.lng)).length, withTour: data.items.filter((o) => o.tourId).length });

// keyword: 이름에 든 글자, form: 형태 묶음 키(cone·round·horseshoe·mixed·etc), tags: 소개글 특징 태그(관광공사에 등록된 오름만 해당),
// sort: 'recommend' 추천순(대표 오름 → 사진 있고 가벼운 오름 순), 'elev' 표고 높은 순, 'elev_asc' 낮은 순 (기본은 이름순·공식 연번순), lat·lng·radius(m): 그 반경 안을 가까운 순으로, id: 한 곳만
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
  if (sort === 'recommend') list = [...list].sort(byRecommend);
  if (sort === 'elev') list = [...list].sort((a, b) => (b.elev ?? 0) - (a.elev ?? 0));
  if (sort === 'elev_asc') list = [...list].sort((a, b) => (a.elev ?? Infinity) - (b.elev ?? Infinity));   // 표고 모름은 맨 뒤
  return list.slice((page - 1) * rows, page * rows).map((o) => view(o));
}
