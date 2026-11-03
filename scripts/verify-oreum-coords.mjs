// 오름 좌표 검증 (일회성): node --env-file=.env scripts/verify-oreum-coords.mjs
//   각 오름 좌표를 카카오 역지오코딩(좌표→주소)해서 나온 법정동·리가 공식 소재지의 동·리와 같은지 비교합니다.
//   어긋난 곳은 '관광지데이터' 좌표(이름이 같고 가까운 후보가 아니어도 이름이 같은 행 전부)도 같은 방식으로 따져,
//   공식 소재지와 일치하는 후보가 있으면 그 좌표를 제안합니다. 결과는 scripts/_coord-report.json 에 저장(검토용).
// 필요한 키: DATA_GO_KR_KEY, KAKAO_REST_KEY (.env)
import { writeFile } from 'node:fs/promises'
import data from '../server/data/oreum.js'

const KEY = process.env.KAKAO_REST_KEY
const SOURCE = 'https://api.odcloud.kr/api/15111742/v1/uddi:735137ac-cee5-42f5-9119-a8b6c9f784dc'

// 공식 소재지에서 마지막 읍·면·동·리 이름 (예: '제주시 한림읍 금악리 산 1' → '금악리', '제주시 오라일동 ...' → '오라일동')
const regionOf = (addr) => [...String(addr).matchAll(/([가-힣0-9]+(?:읍|면|동|리|가))(?=\s|$)/g)].map((m) => m[1]).filter((x) => !/^(제주시|서귀포시)$/.test(x)).at(-1) ?? ''
const sameRegion = (a, b) => a && b && (a === b || a.replace(/[0-9]+(?=동|가)/, '') === b.replace(/[0-9]+(?=동|가)/, ''))   // 오라일동·오라이동 같은 번호 동은 '오라동' 계열로 느슨히
const dongRoot = (s) => String(s).replace(/[0-9일이삼]+(?=[동리]$)/, '')   // 오라일동→오라동, 이도이동→이도동, 무릉1리→무릉리

async function reverse(lat, lng) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`, { headers: { Authorization: `KakaoAK ${KEY}` } })
      if (!r.ok) throw new Error(r.status)
      const a = (await r.json()).documents?.[0]?.address
      return a ? { region: String(a.region_3depth_name).split(' ').at(-1), full: a.address_name } : { region: '', full: '' }   // '한경면 청수리' → '청수리'
    } catch { await new Promise((res) => setTimeout(res, 800)) }
  }
  return { region: '', full: '?' }
}
const matches = (official, got) => !!got && (got === official || dongRoot(got) === dongRoot(official))

// 공공데이터포털 연결이 가끔 시간 초과되어 몇 번 다시 시도
async function getJson(url) {
  for (let t = 0; ; t++) {
    try { return await (await fetch(url, { signal: AbortSignal.timeout(30000) })).json() }
    catch (e) { if (t >= 4) throw e; await new Promise((r) => setTimeout(r, 3000)) }
  }
}

// 관광지데이터(이름이 같은 후보 좌표용)
const rows = []
for (let page = 1; rows.length === 0 || rows.length < rows.total; page++) {
  const j = await getJson(`${SOURCE}?page=${page}&perPage=500&returnType=JSON&serviceKey=${encodeURIComponent(process.env.DATA_GO_KR_KEY)}`)
  rows.total = j.totalCount; rows.push(...j.data); if (!j.data.length) break
}
const norm = (s) => String(s ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\s/g, '').replace(/오름$/, '')
const aliases = (s) => [norm(s), ...[...String(s ?? '').matchAll(/\(([^)]*)\)/g)].flatMap((m) => m[1].split(/[+·,]/).map(norm))].filter((x) => x.length >= 2)

const results = []
const queue = [...data.items]
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let o; (o = queue.shift());) {
    const official = regionOf(o.addr)
    const got = await reverse(o.lat, o.lng)
    const ok = matches(official, got.region)
    const rec = { id: o.id, name: o.name, official, ours: got.region, ok, lat: o.lat, lng: o.lng, tourId: o.tourId ?? null }
    if (!ok) {
      // 이름이 같은 관광지데이터 행의 좌표도 역지오코딩해 공식 동·리와 맞는지 확인
      const n = norm(o.name)
      rec.candidates = []
      for (const r of rows.filter((x) => aliases(x['관광지명']).includes(n))) {
        const g = await reverse(+r['위도'], +r['경도'])
        rec.candidates.push({ name: r['관광지명'], lat: +r['위도'], lng: +r['경도'], region: g.region, match: matches(official, g.region) })
      }
    }
    results.push(rec)
  }
}))
results.sort((a, b) => Number(a.id) - Number(b.id))
const bad = results.filter((r) => !r.ok)
console.log(`368곳 중 공식 동·리와 일치 ${results.length - bad.length}곳 / 불일치 ${bad.length}곳`)
console.log('불일치 중 관광지데이터 후보가 공식 동·리와 일치:', bad.filter((r) => r.candidates?.some((c) => c.match)).length, '/ 후보 없음 또는 후보도 불일치:', bad.filter((r) => !r.candidates?.some((c) => c.match)).length)
await writeFile('scripts/_coord-report.json', JSON.stringify(results, null, 1))
console.log('보고서: scripts/_coord-report.json')
