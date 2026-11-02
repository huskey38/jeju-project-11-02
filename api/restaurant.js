import { getRestaurant, searchRestaurants } from '../server/restaurants.js';

// GET /api/restaurant?keyword=&biz=&page=&rows=   → 제주 일반음식점 목록 (행정안전부 인허가 데이터, 관광공사와 같은 가게는 dup:true)
// GET /api/restaurant?id=6510000-101-2026-00725   → 한 곳의 상세
export default async function handler(req, res) {
  try {
    const { id, keyword = '', biz = '', page = '1', rows = '12' } = req.query;
    if (id) return res.status(200).json(await getRestaurant({ id }));
    res.status(200).json(await searchRestaurants({ keyword, biz, page: Number(page) || 1, rows: Math.min(Number(rows) || 12, 100) }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
