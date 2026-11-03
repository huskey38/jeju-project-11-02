// 오름 이름 유래·특징 한 줄 보강 (일회성): node --env-file=.env scripts/build-oreum-summary.mjs
//   '제주특별자치도_제주오름요약설명'(공공데이터포털 15096996, 2021-11-30 기준 90곳)의 설명에서, "비고 N m의 ○형 화구를 지닌 화산체이다" 같은
//   틀(화면에 이미 있는 비고·형태와 겹침)을 빼고 남는 이름 유래·특징만 server/data/oreumSummary.js 로 저장합니다.
// 안전 규칙: 이름이 같음 · 좌표 2.5km 이내 · 후보가 하나뿐 · 한 행은 한 오름에만 (같은 이름의 다른 오름은 제외). 남는 내용이 없으면 넣지 않음.
// 필요한 키: DATA_GO_KR_KEY (.env)
import { writeFile } from 'node:fs/promises'
import data from '../server/data/oreum.js'

const OUT = 'server/data/oreumSummary.js'
const MAX_DIST = 2500   // m

async function getJson(url) {
  for (let t = 0; ; t++) {
    try { return await (await fetch(url, { signal: AbortSignal.timeout(30000) })).json() }
    catch (e) { if (t >= 4) throw e; await new Promise((r) => setTimeout(r, 3000)) }
  }
}
const sw = await getJson('https://infuser.odcloud.kr/oas/docs?namespace=15096996/v1')
const path = Object.keys(sw.paths)[0]
const rows = []
for (let page = 1; ; page++) {
  const j = await getJson(`https://api.odcloud.kr/api${path}?page=${page}&perPage=100&returnType=JSON&serviceKey=${encodeURIComponent(process.env.DATA_GO_KR_KEY)}`)
  if (!j.data) throw new Error('오름요약설명 응답 오류: ' + JSON.stringify(j).slice(0, 200))
  rows.push(...j.data)
  if (rows.length >= j.totalCount || !j.data.length) break
}
console.log(`오름요약설명 ${rows.length}곳`)

const norm = (s) => String(s ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\s/g, '').replace(/오름$/, '')
const meters = (la1, ln1, la2, ln2) => Math.hypot((la1 - la2) * 111320, (ln1 - ln2) * 111320 * Math.cos((la1 * Math.PI) / 180))

import { strip } from './oreum-summary-strip.mjs'

const claims = new Map()
for (const o of data.items) {
  const near = rows.filter((r) => norm(r['오름명']) === norm(o.name))
    .map((r) => ({ r, dist: Math.round(meters(o.lat, o.lng, +r['위도'], +r['경도'])) })).filter((x) => x.dist <= MAX_DIST)
  if (near.length !== 1) continue
  const l = claims.get(near[0].r['오름명']) ?? []; l.push({ o, dist: near[0].dist, r: near[0].r }); claims.set(near[0].r['오름명'], l)
}
const out = {}, skippedTemplate = []
for (const list of claims.values()) {
  if (list.length > 1) continue
  const { o, dist, r } = list[0]
  const text = strip(r['설명'])
  if (text.replace(/[.\s]/g, '').length < 8) { skippedTemplate.push(o.name); continue }   // 남는 내용이 없으면(틀뿐이면) 넣지 않음
  out[o.id] = { name: r['오름명'], dist, text }
}
console.log(`안전 일치 ${[...claims.values()].filter((l) => l.length === 1).length}곳 → 유래·특징 ${Object.keys(out).length}곳 (틀뿐이라 제외 ${skippedTemplate.length}: ${skippedTemplate.join(', ')})`)
await writeFile(OUT, `// scripts/build-oreum-summary.mjs 가 만든 파일 — 직접 고치지 마세요.\n// 제주특별자치도_제주오름요약설명(2021-11-30, 공공데이터포털 15096996) 중 공식 오름과 이름·좌표가 안전하게 일치한 곳의 이름 유래·특징(틀 문장 제외)\nexport default ${JSON.stringify({ source: '제주특별자치도_제주오름요약설명', baseDate: '2021-11-30', items: out })}\n`)
console.log(`완료: ${OUT}`)
