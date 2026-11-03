import { useEffect, useState } from 'react'

// 아래로 내려가면 오른쪽 아래(AI 가이드 버튼 위)에 나타나는 '맨 위로' 버튼 — 긴 오름 목록(31쪽)에서 위로 한 번에 돌아가기
const SHOW_AFTER = 480   // 이만큼(px) 내려가면 보임

export default function ScrollTopButton() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let raf = 0
    const update = () => { raf = 0; setShow(window.scrollY > SHOW_AFTER) }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf) }
  }, [])

  const toTop = () => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches   // '동작 줄이기' 설정이면 바로 이동
    window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' })
  }

  return (
    <button type="button" className={`scroll-top${show ? ' is-visible' : ''}`} onClick={toTop}
      aria-label="맨 위로 이동" title="맨 위로" tabIndex={show ? 0 : -1} aria-hidden={!show} data-testid="scroll-top">
      <i className="bi bi-chevron-up" aria-hidden="true" />맨 위로
    </button>
  )
}
