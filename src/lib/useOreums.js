import { useEffect, useState } from 'react'
import { fetchOreumAll } from '../api/client'

// 공식 오름 전체 목록(한 번 받아 두고 재사용) — 도감·진행률·추천 같은 화면들이 함께 씀
export function useOreums() {
  const [state, setState] = useState({ list: null, error: '' })
  useEffect(() => {
    let alive = true
    fetchOreumAll().then((list) => { if (alive) setState({ list, error: '' }) }).catch((e) => { if (alive) setState({ list: null, error: e.message }) })
    return () => { alive = false }
  }, [])
  return state
}
