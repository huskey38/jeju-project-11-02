// 장소 소개글 → 테마 태그 색인 만들기 (일회성·이어하기 가능): node --env-file=.env scripts/build-tags.mjs
//   1) TourAPI 목록(관광지 12·문화시설 14·축제 15·음식점/카페 39, 숙박 제외)을 모두 받고
//   2) 장소마다 소개글(detailCommon2)을 받아 src/lib/placeTags.js 규칙으로 태그를 붙여
//   3) server/data/placeIndex.js 로 저장합니다. 소개글 본문은 저장하지 않고 태그만 남깁니다.
// 받은 소개글은 임시 폴더(jeju-tag-cache.json)에 보관해, 일일 호출 한도에 걸려 멈춰도 다시 돌리면 이어서 받습니다.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tabOfItem, tagsOf } from '../src/lib/placeTags.js'

const BASE = 'https://apis.data.go.kr/B551011/KorService2'
const CACHE = join(tmpdir(), 'jeju-tag-cache.json')
const OUT = 'server/data/placeIndex.js'
const TYPES = ['12', '14', '15', '39']
const CONCURRENCY = 2   // 초당 호출 한도가 낮아 천천히 (한도에 걸리면 잠깐 쉬고 다시 시도)

class Quota extends Error {}

async function call(op, extra) {
  const params = new URLSearchParams({ serviceKey: process.env.DATA_GO_KR_KEY, MobileOS: 'ETC', MobileApp: 'JejuIP', _type: 'json', ...extra })
  for (let attempt = 1; ; attempt++) {
    try {
      const text = await (await fetch(`${BASE}/${op}?${params}`, { signal: AbortSignal.timeout(40000) })).text()
      if (/PER_SECOND/.test(text)) { await new Promise((r) => setTimeout(r, 1500)); attempt--; continue }   // 초당 한도: 쉬었다가 다시
      if (/LIMITED_NUMBER|SERVICE_KEY_IS_NOT_REGISTERED|SERVICE ACCESS DENIED/i.test(text)) throw new Quota(text.slice(0, 160))
      const item = JSON.parse(text)?.response?.body?.items?.item
      return !item ? [] : Array.isArray(item) ? item : [item]
    } catch (e) {
      if (e instanceof Quota || attempt >= 3) throw e
    }
  }
}

const isLodging = (p) => String(p.contenttypeid) === '32' || p.lclsSystm1 === 'AC'
const https = (u) => (u ? String(u).replace(/^http:/, 'https:') : '')
const clean = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim()

// 1) 목록
const list = []
for (const type of TYPES) {
  for (let page = 1; ; page++) {
    const rows = await call('areaBasedList2', { lDongRegnCd: '50', contentTypeId: type, numOfRows: '100', pageNo: String(page) })
    list.push(...rows.filter((p) => !isLodging(p)))
    if (rows.length < 100) break
  }
  console.log(`목록 유형 ${type}: 누적 ${list.length}건`)
}

// 2) 소개글 (캐시에 없는 것만)
let cache = {}
try { cache = JSON.parse(await readFile(CACHE, 'utf8')) } catch { /* 처음 */ }
const todo = list.filter((p) => cache[p.contentid] === undefined)
console.log(`소개글 받기: 전체 ${list.length}건 중 남은 ${todo.length}건`)
let done = 0, stopped = ''
const save = () => writeFile(CACHE, JSON.stringify(cache))
async function worker() {
  for (let p; !stopped && (p = todo.shift());) {
    try {
      const [c] = await call('detailCommon2', { contentId: p.contentid })
      cache[p.contentid] = clean(c?.overview)
    } catch (e) {
      if (e instanceof Quota) { stopped = e.message; return }
      console.log(`  건너뜀 ${p.contentid} ${p.title}: ${e.message.slice(0, 60)}`)
    }
    if (++done % 50 === 0) { console.log(`  ${done}건 완료`); await save() }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))
await save()
if (stopped) console.log(`⚠ 호출 한도 등으로 중단: ${stopped}\n  받은 만큼만 색인에 반영합니다. 한도가 풀린 뒤 다시 실행하면 이어서 받습니다.`)

// 3) 색인 저장 (소개글이 없으면 이름만으로 태그)
const items = []
let withText = 0
for (const p of list) {
  const tab = tabOfItem({ type: p.contenttypeid, lcls: p.lclsSystm2 })
  if (!tab) continue
  const text = cache[p.contentid]
  if (text) withText++
  items.push({
    id: p.contentid, title: p.title, addr: p.addr1 ?? '', image: https(p.firstimage), lng: p.mapx, lat: p.mapy,
    type: String(p.contenttypeid), lcls: p.lclsSystm2 ?? '', lcls3: p.lclsSystm3 ?? '', tags: tagsOf(tab, `${p.title} ${text ?? ''}`),
  })
}
await mkdir('server/data', { recursive: true })
await writeFile(OUT, `// scripts/build-tags.mjs 가 만든 파일 — 직접 고치지 마세요.\n// 장소별 테마 태그 색인 (소개글 ${withText}/${items.length}건 반영, 나머지는 이름만으로 태그)\nexport default ${JSON.stringify({ builtAt: new Date().toISOString().slice(0, 10), withText, items })}\n`)
const count = {}
for (const i of items) for (const t of i.tags) count[`${tabOfItem({ type: i.type, lcls: i.lcls })}.${t}`] = (count[`${tabOfItem({ type: i.type, lcls: i.lcls })}.${t}`] ?? 0) + 1
console.log(`완료: ${items.length}건 (소개글 ${withText}건)`, count)
