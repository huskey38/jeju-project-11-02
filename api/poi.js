import { searchPoi } from '../server/poi.js';

// GET /api/poi?lat=&lng=&cat=CS2|PK6|OL7&radius=500   → 좌표 주변의 편의점(CS2)·주차장(PK6)·주유소(OL7), 가까운 순 (dist 는 미터)
export default async function handler(req, res) {
  try {
    const { lat, lng, cat, radius } = req.query;
    res.status(200).json(await searchPoi({ lat, lng, cat, radius: Number(radius) || 500 }));
  } catch (e) {
    res.status(e.message.includes('필요해요') || e.message.startsWith('cat') ? 400 : 500).json({ error: e.message });
  }
}
