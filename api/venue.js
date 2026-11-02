import { getVenueDetail, searchVenues } from '../server/venues.js';

// GET /api/venue?keyword=&page=&rows=  → 공연장 목록 (제주도내 공연장 현황, 파일 데이터)
// GET /api/venue?id=v1                  → 공연장 상세
export default function handler(req, res) {
  try {
    const { id, keyword = '', page = '1', rows = '12' } = req.query;
    if (id) return res.status(200).json(getVenueDetail({ id }));
    res.status(200).json(searchVenues({ keyword, page: Number(page) || 1, rows: Math.min(Number(rows) || 12, 50) }));
  } catch (e) {
    res.status(e.message.includes('찾을 수 없어요') ? 404 : 500).json({ error: e.message });
  }
}
