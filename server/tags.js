// 테마 태그 조회: scripts/build-tags.mjs 가 만든 색인(server/data/placeIndex.js)에서 찾음 (외부 API 호출 없음)
import index from './data/placeIndex.js';
import { tabOfItem } from '../src/lib/placeTags.js';

const byId = new Map(index.items.map((i) => [String(i.id), i]));

// 화면용 항목 모양 (toItem 과 같은 필드)
const view = ({ id, title, addr, image, lng, lat, type, lcls }) => ({ id, title, addr, image, lng, lat, type, lcls });
const hasAll = (item, tags) => tags.every((t) => item.tags.includes(t));

// tab: spot|culture|festival|food|cafe, tags: 모두 가진 곳만(AND), lcls: 분류 코드(4자 중분류/8자 소분류, 선택), keyword: 이름 포함(선택)
export function searchTagged({ tab, tags = [], lcls = '', keyword = '', rows = 12, page = 1 } = {}) {
  const kw = String(keyword).trim();
  const list = index.items.filter((i) =>
    tabOfItem(i) === tab && hasAll(i, tags)
    && (!lcls || (lcls.length > 4 ? i.lcls3 === lcls : i.lcls === lcls))
    && (!kw || i.title.includes(kw)));
  return list.slice((page - 1) * rows, page * rows).map(view);
}

// 이미 받은 목록(예: 기간으로 찾은 축제)에서 태그를 모두 가진 곳만 남김. 색인에 없는 항목(새로 생긴 행사 등)은 제외
export const filterByTags = (list, tags) => (tags.length ? list.filter((p) => { const i = byId.get(String(p.id)); return i && hasAll(i, tags); }) : list);

export const indexInfo = () => ({ builtAt: index.builtAt, count: index.items.length, withText: index.withText });
