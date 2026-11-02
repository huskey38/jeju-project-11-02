import { searchOreum } from '../server/oreum.js';

const KEY = /^[a-z]+$/;

// GET /api/oreum?keyword=&form=&tags=a,b&sort=elev&lat=&lng=&radius=&page=&rows=   → 제주 오름 현황(공식 368곳) 목록 (rows 최대 400)
// GET /api/oreum?id=1                                                              → 한 곳 (공식 연번)
export default async function handler(req, res) {
  try {
    const { id, keyword = '', form = '', tags = '', sort = '', lat, lng, radius, page = '1', rows = '12' } = req.query;
    res.status(200).json(searchOreum({
      id, keyword, form: KEY.test(form) ? form : '', tags: String(tags).split(',').filter((t) => KEY.test(t)).slice(0, 6),
      sort: ['elev', 'elev_asc'].includes(sort) ? sort : '', ...(lat !== undefined && { lat, lng, radius: Number(radius) || 0 }),
      page: Number(page) || 1, rows: Math.min(Number(rows) || 12, 400),
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
