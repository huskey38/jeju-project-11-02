// 사진 없는 오름 채우기 (일회성): node --env-file=.env scripts/fill-oreum-images.mjs
//   tour : 관광공사 키워드 검색(여러 표기로)으로 이름이 맞는 사진을 찾음 — 출처 '관광공사'
//   (블로그·카페·뉴스 등 웹 사진은 저작권 때문에 쓰지 않습니다)
// 결과는 server/data/oreumImages.js ({ 공식연번: { image, by, title } }) 에 쌓이며, 오름 현황을 다시 만들어도 남습니다.
import { readFile, writeFile } from 'node:fs/promises'
import data from '../server/data/oreum.js'
import { searchTour } from '../server/tour.js'

const OUT = 'server/data/oreumImages.js'
const stage = 'tour'
let found = {}
try { found = (await import('../' + OUT + '?t=' + Date.now())).default } catch { /* 처음 */ }

const norm = (s) => String(s ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\s/g, '').replace(/오름$/, '')
const variants = (name) => {
  const base = name.replace(/\([^)]*\)/g, '').trim(), inner = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1])
  const b = base.replace(/오름$/, '')
  return [...new Set([base, b + '오름', b, ...inner.map((x) => x.replace(/오름$/, '') + '오름')])].filter((x) => x.length >= 2)
}
const save = () => writeFile(OUT, `// scripts/fill-oreum-images.mjs 가 만든 파일 — 공식 오름현황에 사진이 없는 오름의 보완 사진\n// by: 'tour' 관광공사 / 'kakao' 카카오 이미지 검색(블로그·카페 글, link 는 원문)\nexport default ${JSON.stringify(found)}\n`)
const missing = data.items.filter((o) => !o.image && !found[o.id]).slice(0, Number(process.env.LIMIT) || 9999)
const pool = async (list, n, fn) => { const q = [...list]; await Promise.all(Array.from({ length: n }, async () => { for (let x; (x = q.shift());) await fn(x) })) }

if (stage === 'tour') {
  const taken = new Set(Object.values(found).map((f) => f.image).concat(data.items.map((o) => o.image).filter(Boolean)))
  // 같은 이름이 둘 이상인 오름(예: 거친오름)은 어느 쪽 사진인지 알 수 없어 건너뜀
  const dup = new Map(); for (const o of data.items) dup.set(norm(o.name), (dup.get(norm(o.name)) ?? 0) + 1)
  await pool(missing, 2, async (o) => {
    if (dup.get(norm(o.name)) > 1) return
    const want = norm(o.name)
    for (const v of variants(o.name)) {
      let list = []
      for (let tries = 0; tries < 4; tries++) { try { list = await searchTour({ keyword: v, contentTypeId: '', rows: 10 }); break } catch (e) { if (/하루/.test(e.message)) throw e; await new Promise((r) => setTimeout(r, 1500)) } }
      const hit = list.find((x) => x.image && !taken.has(x.image) && norm(x.title) === want)
      if (hit) { found[o.id] = { image: hit.image, by: 'tour', title: hit.title }; taken.add(hit.image); console.log('tour', o.id, o.name, '←', hit.title); return }
    }
  })
  await save()
  console.log('관광공사로 채움', Object.values(found).filter((f) => f.by === 'tour').length, '/ 남은', data.items.filter((o) => !o.image && !found[o.id]).length)
}
