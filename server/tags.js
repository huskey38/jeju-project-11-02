// 테마 태그 조회: scripts/build-tags.mjs 가 만든 색인(server/data/placeIndex.js)에서 찾음 (외부 API 호출 없음)
import index from './data/placeIndex.js';
import { tabOfItem } from '../src/lib/placeTags.js';

const byId = new Map(index.items.map((i) => [String(i.id), i]));

// 화면용 항목 모양 (toItem 과 같은 필드)
const view = ({ id, title, addr, image, lng, lat, type, lcls }) => ({ id, title, addr, image, lng, lat, type, lcls });
const hasAll = (item, tags) => tags.every((t) => item.tags.includes(t));

// 두 점 사이 거리(미터)
const meters = (la1, ln1, la2, ln2) => {
  const k = 111320, dy = (la1 - la2) * k, dx = (ln1 - ln2) * k * Math.cos((la1 * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

// tab: spot|culture|festival|food|cafe|oreum, tags: 모두 가진 곳만(AND), lcls: 분류 코드(4자 중분류/8자 소분류, 선택), keyword: 이름 포함(선택)
// 오름 탭만: lat·lng·radius(미터)를 주면 그 반경 안의 오름을 가까운 순으로 (dist 포함)
export function searchTagged({ tab, tags = [], lcls = '', keyword = '', lat, lng, radius = 0, rows = 12, page = 1 } = {}) {
  const kw = String(keyword).trim();
  const near = tab === 'oreum' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(radius) > 0;
  let list = index.items.filter((i) =>
    (tab === 'oreum' ? i.oreum && tags.every((t) => (i.otags ?? []).includes(t)) : tabOfItem(i) === tab && hasAll(i, tags))
    && (!lcls || (lcls.length > 4 ? i.lcls3 === lcls : i.lcls === lcls))
    && (!kw || i.title.includes(kw)));
  if (near) {
    list = list.map((i) => ({ ...i, dist: Math.round(meters(Number(lat), Number(lng), Number(i.lat), Number(i.lng))) }))
      .filter((i) => i.dist <= Number(radius)).sort((a, b) => a.dist - b.dist);
  }
  return list.slice((page - 1) * rows, page * rows).map((i) => ({ ...view(i), ...(near && { dist: i.dist }) }));
}

// 이미 받은 목록(예: 기간으로 찾은 축제)에서 태그를 모두 가진 곳만 남김. 색인에 없는 항목(새로 생긴 행사 등)은 제외
export const filterByTags = (list, tags) => (tags.length ? list.filter((p) => { const i = byId.get(String(p.id)); return i && hasAll(i, tags); }) : list);

export const indexInfo = () => ({ builtAt: index.builtAt, count: index.items.length, withText: index.withText });
