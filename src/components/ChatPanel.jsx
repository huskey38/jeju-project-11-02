import { useEffect, useRef, useState } from 'react'
import { Button, Form, InputGroup, Spinner } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'

// 대화가 비어 있을 때 누르면 바로 질문이 되는 예시 (에이전트의 도구: 장소·날씨·국가유산·주변·축제)
const EXAMPLES = [
  '제주시청 근처 카페 알려줘',
  '이번 달에 열리는 축제 알려줘',
  '내일 서귀포에 비 오면 갈 만한 실내 장소 추천해줘',
]

// AI 에이전트와의 대화 (메시지 목록 + 입력창) — 대화 내용은 전역 스토어에 있어 페이지를 옮겨도 유지됩니다.
// 플로팅 대화창(ChatWidget)과 /agent 페이지가 함께 사용합니다.
export default function ChatPanel({ autoFocus = false, height }) {
  const messages = useAppStore((s) => s.messages)
  const loading = useAppStore((s) => s.chatLoading)
  const sendMessage = useAppStore((s) => s.sendMessage)
  const [input, setInput] = useState('')
  const listRef = useRef(null)
  const inputRef = useRef(null)

  // 새 메시지가 오면 맨 아래로
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])
  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  function send(text) {
    const q = text.trim()
    if (!q || loading) return
    sendMessage(q)
    setInput('')
  }

  return (
    <div className="chat-panel" style={height ? { height } : undefined}>
      <div className="chat-list" ref={listRef} data-testid="chat-list">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p className="mb-2">안녕하세요! 제주 장소·날씨·행사를 공공데이터로 찾아 드려요.</p>
            <div className="d-flex flex-column gap-2 align-items-start">
              {EXAMPLES.map((q) => (
                <button key={q} type="button" className="chat-example" onClick={() => send(q)} disabled={loading}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {/* 에이전트가 부른 도구 목록(m.steps)은 데이터에는 남기되 화면에는 보이지 않게 함 */}
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
          </div>
        ))}
        {loading && <div className="small text-muted"><Spinner size="sm" className="me-2" />에이전트가 도구를 사용하는 중...</div>}
      </div>
      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(input) }}>
        <InputGroup>
          <Form.Control ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="질문을 입력하세요" aria-label="질문" />
          <Button type="submit" disabled={loading || !input.trim()} aria-label="보내기"><i className="bi bi-send" /></Button>
        </InputGroup>
      </form>
    </div>
  )
}
