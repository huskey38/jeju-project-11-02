import { getTourDetail, searchFestivals, searchNearby, searchTour } from '../server/tour.js';

const LCLS = /^[A-Z]{2}\d{2}(\d{4})?$/;   // 분류체계 중분류(FD05) 또는 소분류(FD020100) 형식
const okLcls = (v) => (LCLS.test(v) ? v : '');

// GET /api/tour?keyword=&type=&lcls=&page=&rows=                      → 목록 (lcls = 분류체계 중분류, 예: FD05 카페)
// GET /api/tour?id=130857                                              → 상세 (소개·이용정보·사진·좌표)
// GET /api/tour?mode=near&lat=&lng=&radius=&type=&lcls=&xlcls=&page=&rows=  → 주변 검색 (가까운 순, dist 는 미터)
// GET /api/tour?mode=festival&from=&to=&keyword=&page=&rows=           → 축제 기간 검색 (from 기본 오늘)
export default async function handler(req, res) {
  try {
    const { id, mode, keyword = '', type, lcls = '', xlcls = '', lat, lng, radius, from, to, page = '1', rows = '10' } = req.query;
    const paging = { page: Number(page) || 1, rows: Math.min(Number(rows) || 10, 50) };
    if (id) return res.status(200).json(await getTourDetail({ id }));
    if (mode === 'near') {
      return res.status(200).json(await searchNearby({
        lat, lng, radius: Number(radius) || 3000, contentTypeId: type ?? '', lclsSystm2: okLcls(lcls), lclsExclude: okLcls(xlcls), ...paging,
      }));
    }
    if (mode === 'festival') return res.status(200).json(await searchFestivals({ from, to, keyword, ...paging }));
    res.status(200).json(await searchTour({ keyword, contentTypeId: type ?? '12', lclsSystm2: okLcls(lcls), ...paging }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
