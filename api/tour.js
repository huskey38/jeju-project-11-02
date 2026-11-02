import { searchTour } from '../server/tour.js';

export default async function handler(req, res) {
  try {
    const { keyword = '', type = '12', page = '1', rows = '10' } = req.query;
    res.status(200).json(await searchTour({ keyword, contentTypeId: type, page: Number(page) || 1, rows: Math.min(Number(rows) || 10, 50) }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
