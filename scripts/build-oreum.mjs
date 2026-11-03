// 제주 오름 현황(공식 368곳) 수집 (일회성): node --env-file=.env scripts/build-oreum.mjs
//   1) 공공데이터포털 '제주특별자치도_오름현황'(odcloud, 2025-12-31 기준)을 받고
//   2) 관광공사 오름(소개글 색인, server/data/placeIndex.js)과 이름으로 맞춰 tourId·사진·좌표를 붙이고
//   3) 맞지 않은 곳은 카카오 주소 검색(지오코딩)으로 좌표를 구해 server/data/oreum.js 로 저장합니다.
// 필요한 키: DATA_GO_KR_KEY, KAKAO_REST_KEY (.env)
import { writeFile } from 'node:fs/promises'
import index from '../server/data/placeIndex.js'
import { isJejuCoord } from '../src/lib/geo.js'
import { applyFix } from './oreum-fix.mjs'

const SOURCE = 'https://api.odcloud.kr/api/15043497/v1/uddi:e2b01efa-220d-4773-be00-ae6d34628a0c'   // 오름현황 20251231
const OUT = 'server/data/oreum.js'
const KAKAO = 'https://dapi.kakao.com/v2/local/search'

// 이름 맞추기용: 괄호·공백·'오름' 접미사를 뗀 형태
const norm = (s) => String(s ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\s/g, '').replace(/오름$/, '')
const alt = (s) => [...String(s ?? '').matchAll(/\(([^)]*)\)/g)].map((m) => norm(m[1]))   // 제목 괄호 속 다른 이름 (예: 소머리오름(우도봉))

// 1) 공식 목록
const rows = []
for (let page = 1; rows.length === 0 || rows.length < rows.total; page++) {
  const url = `${SOURCE}?page=${page}&perPage=100&returnType=JSON&serviceKey=${encodeURIComponent(process.env.DATA_GO_KR_KEY)}`
  const j = await (await fetch(url)).json()
  if (!j.data) throw new Error('오름현황 응답 오류: ' + JSON.stringify(j).slice(0, 200))
  rows.total = j.totalCount
  rows.push(...j.data)
  if (j.data.length === 0) break
}
console.log(`공식 오름 ${rows.length}곳`)

// 2) 관광공사 오름과 이름 맞추기
const tour = index.items.filter((i) => i.oreum)
const byExact = new Map(), used = new Set()
for (const t of tour) byExact.set(norm(t.title), t)
// 표기가 달라 자동으로 못 맞추는 곳: 공식 연번 → 관광공사 제목
const ALIAS = { 23: '거슨새미오름', 68: '족은노꼬메오름', 69: '큰노꼬메오름', 278: '열안지오름(봉개동)' }
const matchTour = (name, id) => {
  const n = norm(name)
  if (ALIAS[id]) { const t = tour.find((x) => x.title === ALIAS[id]); return t && !used.has(t.id) ? (used.add(t.id), t) : null }
  let t = byExact.get(n)
  if (!t) t = tour.find((x) => alt(x.title).includes(n))                                   // 괄호 속 이름
  if (t && Object.values(ALIAS).includes(t.title)) t = null                               // 별칭으로 정해 둔 곳은 자동 맞춤에서 제외
  if (!t && n.length >= 3) t = tour.find((x) => norm(x.title).length >= 3 && (norm(x.title).includes(n) || n.includes(norm(x.title))))   // 포함 관계(3글자 이상)
  return t && !used.has(t.id) ? (used.add(t.id), t) : null
}

// 3) 카카오 지오코딩 (주소 → 키워드 순서로 시도)
const key = process.env.KAKAO_REST_KEY
const kakao = async (path, q) => {
  const r = await fetch(`${KAKAO}/${path}?${new URLSearchParams({ query: q })}`, { headers: { Authorization: `KakaoAK ${key}` } })
  if (!r.ok) throw new Error(`카카오 ${r.status}`)
  return (await r.json()).documents ?? []
}
async function geocode(o) {
  const tries = [['address.json', o.소재지], ['address.json', String(o.소재지).replace(/\s*산\s*(\d)/, ' $1')], ['keyword.json', `${o.오름명} 제주`]]
  for (const [path, q] of tries) {
    try {
      const d = (await kakao(path, q)).find((x) => isJejuCoord(x.y, x.x))
      if (d) return { lat: Number(Number(d.y).toFixed(6)), lng: Number(Number(d.x).toFixed(6)), by: path.startsWith('address') ? 'addr' : 'keyword' }
    } catch (e) { /* 다음 방법 */ }
  }
  return null
}

const out = []
const failed = [], stats = { tour: 0, addr: 0, keyword: 0 }
const queue = rows.map((o, i) => ({ o, i }))
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let job; (job = queue.shift());) {
    const { o } = job
    const t = matchTour(o.오름명, o.연번)
    let pos = null
    if (t && isJejuCoord(t.lat, t.lng)) { pos = { lat: Number(t.lat), lng: Number(t.lng) }; stats.tour++ }
    else { const g = await geocode(o); if (g) { pos = { lat: g.lat, lng: g.lng }; stats[g.by]++ } }
    if (!pos) failed.push(o.오름명)
    out[job.i] = {
      id: String(o.연번), name: o.오름명, city: o.행정시, addr: o.소재지, elev: Number(o.표고) || null, area: Number(o.면적) || null,
      rel: Number(o.비고) || null, form: o.형태 || '', lat: pos?.lat ?? null, lng: pos?.lng ?? null,
      ...(t && { tourId: String(t.id), image: t.image || '' }),
    }
  }
}))
console.log('좌표 출처', stats, '| 좌표 실패', failed.length, failed.join(', '))
console.log('관광공사와 맞춘 곳', out.filter((x) => x.tourId).length, '/ 관광공사 오름', tour.length, '→ 못 맞춘 관광공사 오름:', tour.filter((t) => !used.has(t.id)).map((t) => t.title).join(', '))

console.log('좌표 검증 수정표 적용:', applyFix(out).join(', '))   // scripts/oreum-fix.mjs
await writeFile(OUT, `// scripts/build-oreum.mjs 가 만든 파일 — 직접 고치지 마세요.\n// 제주특별자치도_오름현황(2025-12-31, 공공데이터포털 15043497) ${out.length}곳 + 좌표(관광공사 또는 카카오 지오코딩) + 관광공사 오름과의 연결(tourId)\nexport default ${JSON.stringify({ source: '제주특별자치도_오름현황', baseDate: '2025-12-31', items: out })}\n`)
console.log(`완료: ${OUT}`)
