// 오름 소개 보강 (일회성): node --env-file=.env scripts/build-oreum-intro.mjs
//   '제주특별자치도_관내_관광지데이터'(공공데이터포털 15111742, 2025-12-31 기준 1,046곳)에서 공식 오름 368곳과 안전하게 일치하는 곳만 골라
//   소개글·편의시설·주차·관리기관을 server/data/oreumIntro.js 로 저장합니다. 불확실하면 넣지 않습니다.
// 안전 규칙(모두 만족해야 연결):
//   1) 이름이 같음(괄호·공백·'오름' 접미사 뗀 형태, 관광지명 괄호 속 별칭 포함)
//   2) 좌표가 가까움(MAX_DIST 이내) — 같은 이름의 다른 오름을 거름
//   3) 반경 안의 후보 행이 하나뿐이고, 한 행은 한 오름에만 연결 (같은 이름의 오름 둘이 한 행을 가리키면 둘 다 제외)
//   4) 1km 넘게 떨어진 곳은 그 행 좌표를 역지오코딩(카카오)한 동·리가 공식 소재지의 동·리와 같아야 함
// 필요한 키: DATA_GO_KR_KEY, KAKAO_REST_KEY (.env)
import { writeFile } from 'node:fs/promises'
import data from '../server/data/oreum.js'

const SOURCE = 'https://api.odcloud.kr/api/15111742/v1/uddi:735137ac-cee5-42f5-9119-a8b6c9f784dc'
const OUT = 'server/data/oreumIntro.js'
const MAX_DIST = 2500   // m
const FAR = 1000        // m — 이보다 멀면 동·리까지 확인

const rows = []
for (let page = 1; rows.length === 0 || rows.length < rows.total; page++) {
  const url = `${SOURCE}?page=${page}&perPage=500&returnType=JSON&serviceKey=${encodeURIComponent(process.env.DATA_GO_KR_KEY)}`
  const j = await (await fetch(url)).json()
  if (!j.data) throw new Error('관광지데이터 응답 오류: ' + JSON.stringify(j).slice(0, 200))
  rows.total = j.totalCount
  rows.push(...j.data)
  if (j.data.length === 0) break
}
console.log(`관광지데이터 ${rows.length}곳`)

const norm = (s) => String(s ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\s/g, '').replace(/오름$/, '')
const aliases = (s) => [norm(s), ...[...String(s ?? '').matchAll(/\(([^)]*)\)/g)].flatMap((m) => m[1].split(/[+·,]/).map(norm))].filter((x) => x.length >= 2)
const meters = (la1, ln1, la2, ln2) => Math.hypot((la1 - la2) * 111320, (ln1 - ln2) * 111320 * Math.cos((la1 * Math.PI) / 180))

const lastWord = (s) => String(s).split(' ').at(-1)
const regionOf = (addr) => [...String(addr).matchAll(/([가-힣0-9]+(?:읍|면|동|리|가))(?=\s|$)/g)].map((m) => m[1]).filter((x) => !/^(제주시|서귀포시)$/.test(x)).at(-1) ?? ''
const root = (s) => String(s).replace(/[0-9일이삼]+(?=[동리]$)/, '')
async function dongOf(lat, lng) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`, { headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_KEY}` } })
      return lastWord((await r.json()).documents?.[0]?.address?.region_3depth_name ?? '')
    } catch { await new Promise((res) => setTimeout(res, 800)) }
  }
  return ''
}

const claims = new Map()   // 행 연번 → [{ o, dist }]
const skipped = { far: [], ambiguous: [], region: [] }
for (const o of data.items) {
  const n = norm(o.name)
  const byName = rows.filter((r) => aliases(r['관광지명']).includes(n))
  if (!byName.length) continue
  const near = byName.map((r) => ({ r, dist: Math.round(meters(o.lat, o.lng, +r['위도'], +r['경도'])) })).filter((x) => x.dist <= MAX_DIST)
  if (near.length === 0) { skipped.far.push(o.name); continue }
  if (near.length > 1) { skipped.ambiguous.push(o.name); continue }
  if (near[0].dist > FAR && root(await dongOf(+near[0].r['위도'], +near[0].r['경도'])) !== root(regionOf(o.addr))) { skipped.region.push(o.name); continue }
  const c = claims.get(near[0].r['연번']) ?? []
  c.push({ o, dist: near[0].dist }); claims.set(near[0].r['연번'], c)
}

// 한 행을 여러 오름이 가리키면 모두 제외
const fix = (t) => String(t ?? '').replace(/·\s/g, ', ').replace(/\s+/g, ' ').trim()   // 원본은 쉼표가 '·' 로 바뀌어 있음
const cleanFac = (s) => [...new Set(String(s ?? '').split('+').map((x) => x.trim()).filter((x) => x.length >= 2 && !/[(]$/.test(x) && !/^[^(]*\)$/.test(x)))]
const out = {}
for (const [no, list] of claims) {
  if (list.length > 1) { for (const c of list) skipped.ambiguous.push(c.o.name); continue }
  const { o, dist } = list[0], r = rows.find((x) => x['연번'] === no)
  out[o.id] = {
    name: r['관광지명'], dist, intro: fix(r['관광지소개']),
    facilities: cleanFac(r['공공편익시설정보']),
    ...(r['주차가능수'] && { parking: Number(r['주차가능수']) }),
    ...(r['관리기관명'] && { org: r['관리기관명'].trim() }),
    ...(r['관리기관전화번호'] && { tel: String(r['관리기관전화번호']).trim() }),
  }
}

console.log(`연결 ${Object.keys(out).length}곳 | 거리 불일치 제외 ${skipped.far.length} · 소재지 불일치 제외 ${skipped.region.length} · 모호 제외 ${skipped.ambiguous.length}`)
console.log('거리 분포: ≤300m', Object.values(out).filter((x) => x.dist <= 300).length, '/ ≤1km', Object.values(out).filter((x) => x.dist <= 1000).length, '/ ≤2.5km', Object.keys(out).length)
await writeFile(OUT, `// scripts/build-oreum-intro.mjs 가 만든 파일 — 직접 고치지 마세요.\n// 제주특별자치도_관내_관광지데이터(2025-12-31, 공공데이터포털 15111742) 중 공식 오름과 이름·좌표가 안전하게 일치한 곳의 소개·편의시설·주차·관리기관\nexport default ${JSON.stringify({ source: '제주특별자치도_관내_관광지데이터', baseDate: '2025-12-31', items: out })}\n`)
console.log(`완료: ${OUT}`)
