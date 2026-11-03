import { useEffect, useMemo, useState } from 'react'
import { fetchOreumAll, fetchPlacePreview } from '../api/client'
import { oreumIdOf } from './oreumProgress'

// '가볼만한 곳'·'오른 오름' 목록의 카드 미리보기(사진·형태·출처): 저장된 행에는 제목밖에 없어서, 오름은 공식 목록에서, 그 밖의 관광지는 관광공사 대표 사진 한 장(1회 조회)으로 채움
// 조회한 결과는 모듈에 기억해 두어 탭을 오가도 다시 부르지 않음 (실패하면 사진 없이 기본 카드)
const cache = new Map()        // 'source:item_id' → { image } | null (조회 실패)
const pending = new Set()
export const savedKey = (f) => `${f.source}:${f.item_id}`

// 저장된 행 하나가 가리키는 공식 오름 (없으면 null) — 관광공사 id 로 저장한 오름과 공식 연번으로 저장한 오름 모두
export function oreumOfSaved(f, oreums = []) {
  const id = oreumIdOf({ source: f.source, item_id: f.item_id }, oreums)
  return id === null ? null : oreums.find((o) => String(o.id) === id) ?? null
}

export function useSavedPreviews(rows = []) {
  const [oreums, setOreums] = useState(null)
  const [, setTick] = useState(0)
  useEffect(() => { fetchOreumAll().then(setOreums).catch(() => setOreums([])) }, [])

  // 오름이 아닌 관광지는 대표 사진을 한 장씩 가져옴 (동시에 3개까지)
  useEffect(() => {
    if (!oreums) return
    let alive = true
    const todo = rows.filter((f) => f.source === 'tour' && !oreumOfSaved(f, oreums) && !cache.has(savedKey(f)) && !pending.has(savedKey(f)))
    const run = async () => {
      for (let f; (f = todo.shift());) {
        const k = savedKey(f)
        pending.add(k)
        try { const p = await fetchPlacePreview(f.item_id); cache.set(k, p?.image ? { image: p.image } : null) } catch { cache.set(k, null) }
        pending.delete(k)
        if (alive) setTick((n) => n + 1)
      }
    }
    Array.from({ length: Math.min(3, todo.length) }, run)
    return () => { alive = false }
  }, [rows, oreums])

  return useMemo(() => {
    const out = {}
    for (const f of rows) {
      const o = oreums ? oreumOfSaved(f, oreums) : null
      if (o) out[savedKey(f)] = { kind: 'oreum', name: o.name, form: o.form, elev: o.elev, city: o.city, image: o.image || '', credit: o.imageCredit }
      else if (cache.get(savedKey(f))) out[savedKey(f)] = { kind: 'tour', ...cache.get(savedKey(f)), credit: '한국관광공사' }
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, oreums, cache.size])
}
