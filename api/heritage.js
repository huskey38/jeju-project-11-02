import { getHeritageDetail, searchHeritage } from '../server/heritage.js';

// GET /api/heritage?keyword=&page=&rows=  → 목록
// GET /api/heritage?kdcd=&asno=&ctcd=     → 상세 (목록 결과의 코드로 조회)
export default async function handler(req, res) {
  try {
    const { keyword, kdcd, asno, ctcd, page = '1', rows = '10' } = req.query;
    if (asno) return res.status(200).json(await getHeritageDetail({ kdcd, asno, ctcd }));
    res.status(200).json(await searchHeritage({ keyword, page: Number(page) || 1, rows: Math.min(Number(rows) || 10, 50) }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
