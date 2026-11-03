// 사진 없는 오름에 비짓제주(제주관광공사) 대표 사진 붙이기 (일회성): node --env-file=.env scripts/build-oreum-photos.mjs
//   비짓제주 관광정보 OPEN API 의 관광지 콘텐츠를 받아, 공식 오름 368곳과 안전하게 일치하는 곳 중 '지금 사진이 없는' 오름만
//   server/data/oreumImages.js 에 추가합니다 (기존 관광공사 사진·다른 항목은 그대로 둠).
// 안전 규칙(모두 만족): 이름이 같음(괄호 별칭 포함) · 좌표 2.5km 이내 · 후보가 하나뿐 · 1km 넘으면 주소의 읍면동·리까지 일치 · 한 콘텐츠는 한 오름에만
// 필요한 키: VISITJEJU_API_KEY (.env) — 안내서의 http 는 연결이 끊겨 https 로 호출
import { writeFile } from 'node:fs/promises'
import data from '../server/data/oreum.js'
import images from '../server/data/oreumImages.js'

const KEY = process.env.VISITJEJU_API_KEY
const URL_BASE = 'https://api.visitjeju.net/vsjApi/contents/searchList'
const OUT = 'server/data/oreumImages.js'
const MAX_DIST = 2500, FAR = 1000   // m

const all = []
for (let page = 1; ; page++) {
  let j
  for (let t = 0; t < 4 && !j?.items; t++) {
    try { j = await (await fetch(`${URL_BASE}?apiKey=${encodeURIComponent(KEY)}&locale=kr&page=${page}`, { signal: AbortSignal.timeout(30000) })).json() }
    catch { await new Promise((r) => setTimeout(r, 1500)) }
  }
  if (!j?.items) throw new Error('비짓제주 응답 오류(키·네트워크 확인): page ' + page)
  all.push(...j.items)
  if (page >= j.pageCount) break
  await new Promise((r) => setTimeout(r, 120))   // 초당 30건 제한
}
const spots = all.filter((x) => x.contentscd?.value === 'c1')   // 관광지
console.log(`비짓제주 ${all.length}건 중 관광지 ${spots.length}건`)

const norm = (s) => String(s ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\s/g, '').replace(/오름$/, '')
const aliases = (s) => [norm(s), ...[...String(s ?? '').matchAll(/\(([^)]*)\)/g)].flatMap((m) => m[1].split(/[+·,\s]/).map(norm))].filter((x) => x.length >= 2)
const meters = (la1, ln1, la2, ln2) => Math.hypot((la1 - la2) * 111320, (ln1 - ln2) * 111320 * Math.cos((la1 * Math.PI) / 180))
const ri = (addr) => [...String(addr).matchAll(/([가-힣0-9]+(?:읍|면|동|리|가))(?=\s|$)/g)].map((m) => m[1]).filter((x) => !/^(제주시|서귀포시)$/.test(x)).at(-1) ?? ''
const root = (s) => String(s).replace(/[0-9일이삼]+(?=[동리]$)/, '')

const claims = new Map()
for (const o of data.items) {
  const n = norm(o.name)
  const near = spots.filter((x) => aliases(x.title).includes(n)).map((x) => ({ x, d: Math.round(meters(o.lat, o.lng, +x.latitude, +x.longitude)) })).filter((c) => c.d <= MAX_DIST)
  if (near.length !== 1) continue
  const c = near[0]
  if (c.d > FAR && root(ri(c.x.address)) !== root(ri(o.addr))) continue
  const l = claims.get(c.x.contentsid) ?? []; l.push({ o, c }); claims.set(c.x.contentsid, l)
}

const added = {}
let matched = 0
for (const list of claims.values()) {
  if (list.length > 1) continue
  matched++
  const { o, c } = list[0]
  const photo = c.x.repPhoto?.photoid?.imgpath
  if (o.image || images.items?.[o.id] || images[o.id]) continue   // 이미 사진이 있는 오름은 건드리지 않음
  if (!/^https:\/\//.test(photo ?? '')) continue
  added[o.id] = { image: photo, by: 'visitjeju', title: c.x.title }
}
console.log(`안전 일치 ${matched}곳 중 새 사진 ${Object.keys(added).length}곳 추가`)

const merged = { ...images, ...added }
await writeFile(OUT, `// 공식 오름현황에 사진이 없는 오름의 보완 사진 — scripts/fill-oreum-images.mjs(관광공사 TourAPI)·scripts/build-oreum-photos.mjs(비짓제주)가 만든 파일\n// by: 'tour' 관광공사 TourAPI / 'visitjeju' 비짓제주(제주관광공사) — 화면에서 출처를 표시함\nexport default ${JSON.stringify(merged)}\n`)
console.log(`완료: ${OUT} (전체 ${Object.keys(merged).length}곳)`)
