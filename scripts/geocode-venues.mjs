// 공연장 주소 → 좌표 (일회성): node --env-file=.env scripts/geocode-venues.mjs
//   .env 의 KAKAO_REST_KEY (카카오 디벨로퍼스 REST API 키) 가 필요합니다. 좌표가 이미 있는 공연장은 건너뜁니다.
//   1) 주소 검색(address.json) → 2) 못 찾으면 장소 검색(keyword.json: '제주 + 공연장명') 으로 한 번 더 시도
import venues from '../server/data/venues.js'
import { writeVenuesFile } from './build-venues.mjs'

const API = 'https://dapi.kakao.com/v2/local/search'
const inJeju = (lat, lng) => lat > 33.0 && lat < 33.7 && lng > 126.0 && lng < 127.1

// 응답 → { lat, lng } (제주 안의 첫 결과만). x = 경도, y = 위도
export function pickCoord(json) {
  for (const d of json?.documents ?? []) {
    const lat = Number(d.y), lng = Number(d.x)
    if (inJeju(lat, lng)) return { lat, lng }
  }
  return null
}

export async function geocode(v, key, fetchImpl = fetch) {
  const call = async (path, query) => {
    const r = await fetchImpl(`${API}/${path}?${new URLSearchParams({ query })}`, { headers: { Authorization: `KakaoAK ${key}` } })
    if (!r.ok) throw new Error(`카카오 응답 ${r.status}: ${(await r.text()).slice(0, 120)}`)
    return r.json()
  }
  return pickCoord(await call('address.json', v.geoAddr)) ?? pickCoord(await call('keyword.json', `제주 ${v.name}`))
}

if (process.argv[1]?.endsWith('geocode-venues.mjs')) {
  const key = process.env.KAKAO_REST_KEY
  if (!key) { console.error('KAKAO_REST_KEY 가 없어요. .env 에 넣고 `node --env-file=.env scripts/geocode-venues.mjs` 로 실행하세요.'); process.exit(1) }
  const list = venues.map((v) => ({ ...v }))
  const failed = []
  for (const v of list) {
    if (v.lat != null && v.lng != null) continue
    try {
      const c = await geocode(v, key)
      if (c) Object.assign(v, c); else failed.push(`${v.name} (${v.geoAddr})`)
    } catch (e) { console.error(e.message); process.exit(1) }   // 키 오류 등은 바로 중단
  }
  writeVenuesFile(list)
  console.log(`좌표 ${list.filter((v) => v.lat != null).length}/${list.length}건`)
  if (failed.length) console.log('못 찾은 곳:\n- ' + failed.join('\n- '))
}
