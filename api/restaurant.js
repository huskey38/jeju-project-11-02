import { getRestaurant, searchRestaurants } from '../server/restaurants.js';

// GET /api/restaurant?keyword=&biz=&page=&rows=   → 제주 일반음식점 목록 (행정안전부 인허가 데이터, 관광공사와 같은 가게는 dup:true)
// GET /api/restaurant?id=6510000-101-2026-00725   → 한 곳의 상세
export default async function handler(req, res) {
  try {
    const { id, keyword = '', biz = '', page = '1', rows = '12' } = req.query;
    // 공공데이터 원본이 2~10초로 느려서, 같은 요청은 CDN(Vercel 엣지)이 6시간 기억하고(그 뒤 하루는 옛 응답을 먼저 주며 뒤에서 갱신) 즉시 응답. 인허가 데이터라 자주 바뀌지 않음
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400');
    if (id) return res.status(200).json(await getRestaurant({ id }));
    res.status(200).json(await searchRestaurants({ keyword, biz, page: Number(page) || 1, rows: Math.min(Number(rows) || 12, 100) }));
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');   // 오류는 기억하지 않음
    res.status(500).json({ error: e.message });
  }
}
