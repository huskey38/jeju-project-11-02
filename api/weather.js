import { getForecast, getWeather } from '../server/weather.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req, res) {
  try {
    // 장소·날짜별 예보: /api/weather?lat=&lng=&dates=2026-11-02,2026-11-06
    if (req.query.lat !== undefined) {
      const lat = Number(req.query.lat), lng = Number(req.query.lng);
      if (!(lat > 33 && lat < 34 && lng > 126 && lng < 127.2)) return res.status(400).json({ error: '제주 안의 좌표(lat, lng)가 필요해요' });
      const dates = String(req.query.dates ?? '').split(',').filter((d) => DATE.test(d)).slice(0, 3);
      if (!dates.length) return res.status(400).json({ error: 'dates 는 YYYY-MM-DD 형식이에요' });
      return res.status(200).json(await getForecast({ lat, lng, dates }));
    }
    res.status(200).json(await getWeather({ place: req.query.place }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
