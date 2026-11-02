import { getTourDetail, searchFestivals, searchNearby, searchTour } from '../server/tour.js';
import { filterByTags, searchTagged } from '../server/tags.js';

const LCLS = /^[A-Z]{2}\d{2}(\d{4})?$/;   // 분류체계 중분류(FD05) 또는 소분류(FD020100) 형식
const TAG_LIST = /^[a-z]+$/;
const TABS = ['spot', 'culture', 'festival', 'food', 'cafe', 'oreum'];
const tagsOf = (v) => String(v ?? '').split(',').filter((t) => TAG_LIST.test(t)).slice(0, 6);
const okLcls = (v) => (LCLS.test(v) ? v : '');

// GET /api/tour?keyword=&type=&lcls=&page=&rows=                      → 목록 (lcls = 분류체계 중분류, 예: FD05 카페)
// GET /api/tour?id=130857                                              → 상세 (소개·이용정보·사진·좌표)
// GET /api/tour?mode=near&lat=&lng=&radius=&type=&lcls=&xlcls=&page=&rows=  → 주변 검색 (가까운 순, dist 는 미터)
// GET /api/tour?mode=festival&from=&to=&keyword=&tags=&page=&rows=    → 축제 기간 검색 (from 기본 오늘, tags = 테마 태그로 거름)
// GET /api/tour?mode=tagged&tab=&tags=a,b&lcls=&keyword=&page=&rows=  → 테마 태그 검색 (소개글에서 뽑은 태그, 색인에서 찾음). tab=oreum 은 lat·lng·radius(미터)로 가까운 오름 순
export default async function handler(req, res) {
  try {
    const { id, mode, keyword = '', type, lcls = '', xlcls = '', lat, lng, radius, from, to, tab = '', tags = '', page = '1', rows = '10' } = req.query;
    const paging = { page: Number(page) || 1, rows: Math.min(Number(rows) || 10, mode === 'tagged' ? 100 : 50) };   // 색인 조회는 오름 전체(91곳)를 한 번에 받을 수 있게 100 까지
    if (id) return res.status(200).json(await getTourDetail({ id }));
    if (mode === 'near') {
      return res.status(200).json(await searchNearby({
        lat, lng, radius: Number(radius) || 3000, contentTypeId: type ?? '', lclsSystm2: okLcls(lcls), lclsExclude: okLcls(xlcls), ...paging,
      }));
    }
    if (mode === 'tagged') {
      if (!TABS.includes(tab)) return res.status(400).json({ error: 'tab 은 spot·culture·festival·food·cafe·oreum 중 하나예요' });
      return res.status(200).json(searchTagged({ tab, tags: tagsOf(tags), lcls: okLcls(lcls), keyword, ...(tab === 'oreum' && lat !== undefined && { lat, lng, radius: Number(radius) || 0 }), ...paging }));
    }
    if (mode === 'festival') {
      const want = tagsOf(tags);
      if (!want.length) return res.status(200).json(await searchFestivals({ from, to, keyword, ...paging }));
      // 태그로 거르면 쪽 계산이 어긋나므로, 기간 안의 행사를 한 번에 받아 거른 뒤 잘라 줌
      const all = filterByTags(await searchFestivals({ from, to, keyword, page: 1, rows: 100 }), want);
      return res.status(200).json(all.slice((paging.page - 1) * paging.rows, paging.page * paging.rows));
    }
    res.status(200).json(await searchTour({ keyword, contentTypeId: type ?? '12', lclsSystm2: okLcls(lcls), ...paging }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
