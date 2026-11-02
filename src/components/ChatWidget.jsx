import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import ChatPanel from './ChatPanel'
import { CitrusIcon } from './JejuScene'

// 모든 화면 오른쪽 아래에 떠 있는 원형 AI 가이드 버튼 + 눌렀을 때 열리는 대화창
// RootLayout 안(페이지가 바뀌어도 유지되는 자리)에 있어서 어느 페이지에서나 따라다닙니다.
// 열림 여부는 이 컴포넌트가, 대화 내용은 전역 스토어가 들고 있습니다.
export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  // Esc 로 닫기
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (pathname === '/agent') return null   // /agent 페이지에는 대화창이 이미 있음

  return (
    <>
      {open && (
        <section className="chat-widget" role="dialog" aria-label="AI 가이드 대화" data-testid="chat-widget">
          <header className="chat-widget-head">
            <CitrusIcon size={28} />
            <div className="flex-grow-1">
              <div className="fw-bold">AI 가이드</div>
              <div className="small text-muted">공공데이터를 도구로 쓰는 제주 도우미</div>
            </div>
            <button type="button" className="btn-close" aria-label="대화창 닫기" onClick={() => setOpen(false)} />
          </header>
          <ChatPanel autoFocus />
        </section>
      )}
      <button
        type="button" className={`chat-fab${open ? ' is-open' : ''}`} data-testid="chat-fab"
        aria-label={open ? 'AI 가이드 닫기' : 'AI 가이드 열기'} aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <i className={`bi ${open ? 'bi-x-lg' : 'bi-stars'}`} />
      </button>
    </>
  )
}
