import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { clampPos, movedEnough, panelPlace, parsePos } from '../lib/dragPos'
import ChatPanel from './ChatPanel'
import Oreumi from './Oreumi'

// 모든 화면 오른쪽 아래에 떠 있는 원형 AI 가이드 버튼 + 눌렀을 때 열리는 대화창
// RootLayout 안(페이지가 바뀌어도 유지되는 자리)에 있어서 어느 페이지에서나 따라다닙니다.
// 열림 여부는 이 컴포넌트가, 대화 내용은 전역 스토어가 들고 있습니다.
// 버튼은 마우스(손가락)로 누른 채 움직이면 화면 안에서 끌어 옮길 수 있고(위치는 기억함), 대화창은 버튼을 따라감.
const POS_KEY = 'oreumi-pos'
const readPos = () => { try { return parsePos(localStorage.getItem(POS_KEY)) } catch { return null } }
const savePos = (p) => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)) } catch { /* 저장이 안 돼도 동작에는 문제없음 */ } }

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(readPos)          // null = 기본 자리(오른쪽 아래), 아니면 끌어서 정한 { x, y }
  const [dragging, setDragging] = useState(false)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  const drag = useRef(null)                        // { dx, dy, sx, sy, moved } 누른 지점과 버튼 모서리의 차이
  const suppressClick = useRef(false)
  const { pathname } = useLocation()

  // Esc 로 닫기
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // 창 크기가 바뀌면 버튼이 화면 밖에 남지 않게 다시 가둠
  useEffect(() => {
    const onResize = () => {
      setVp({ w: window.innerWidth, h: window.innerHeight })
      setPos((p) => (p ? clampPos(p, window.innerWidth, window.innerHeight) : p))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (pathname === '/agent') return null   // /agent 페이지에는 대화창이 이미 있음

  const onPointerDown = (e) => {
    if (e.button !== 0) return                    // 왼쪽 버튼(또는 터치)만
    const r = e.currentTarget.getBoundingClientRect()
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && !movedEnough(e.clientX - d.sx, e.clientY - d.sy)) return
    d.moved = true
    setDragging(true)
    setPos(clampPos({ x: e.clientX - d.dx, y: e.clientY - d.dy }, window.innerWidth, window.innerHeight))
  }
  const endDrag = (e) => {
    const d = drag.current
    drag.current = null
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    if (d?.moved) {
      suppressClick.current = true                // 끌고 난 뒤에는 열기·닫기로 치지 않음
      setDragging(false)
      setPos((p) => { if (p) savePos(p); return p })
    }
  }
  const onClick = () => {
    if (suppressClick.current) { suppressClick.current = false; return }
    setOpen((v) => !v)
  }

  const fabStyle = pos ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined
  const panelStyle = pos && vp.w >= 576 ? panelPlace(pos, vp.w, vp.h) : undefined   // 모바일은 기존처럼 화면 아래 전체 너비

  return (
    <>
      {open && (
        <section className="chat-widget" role="dialog" aria-label="오롬이 대화" data-testid="chat-widget" style={panelStyle}>
          <header className="chat-widget-head">
            <span className="chat-avatar"><Oreumi size={36} /></span>
            <div className="flex-grow-1">
              <div className="fw-bold">오롬이</div>
              <div className="small text-muted">오름을 안내하는 AI 가이드 · 공공데이터를 도구로 써요</div>
            </div>
            <button type="button" className="btn-close" aria-label="대화창 닫기" onClick={() => setOpen(false)} />
          </header>
          <ChatPanel autoFocus />
        </section>
      )}
      <button
        type="button" className={`chat-fab${open ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}`} data-testid="chat-fab"
        aria-label={open ? '오롬이 닫기' : '오롬이 열기'} aria-expanded={open} title="누르면 대화, 누른 채 움직이면 옮길 수 있어요"
        style={fabStyle}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
        onClick={onClick}
      >
        {open ? <i className="bi bi-x-lg" /> : <Oreumi size={46} className="chat-fab-icon" />}
      </button>
    </>
  )
}
