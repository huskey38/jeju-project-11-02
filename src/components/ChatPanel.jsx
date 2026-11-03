import { useEffect, useRef, useState } from 'react'
import { Button, Form, InputGroup, Spinner } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'
import { apiOf, stepText } from '../lib/agentSteps'

// 대화가 비어 있을 때 누르면 바로 질문이 되는 예시 (에이전트의 도구: 장소·날씨·국가유산·주변·축제)
const EXAMPLES = [
  '억새가 좋은 오름 알려줘',
  '제주공항 근처 가볍게 걸을 수 있는 오름 추천해줘',
  '내일 서귀포 날씨 보고 일몰 보기 좋은 오름 골라줘',
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
            <p className="mb-1">안녕하세요, 오름 가이드 오롬이예요! 제주 오름과 주변 장소·날씨를 공공데이터로 찾아 드려요.</p>
            <p className="small text-muted mb-2" data-testid="oreumi-name-note">‘오롬’은 오름의 제주 옛 방언 이름이에요~</p>
            <div className="d-flex flex-column gap-2 align-items-start">
              {EXAMPLES.map((q) => (
                <button key={q} type="button" className="chat-example" onClick={() => send(q)} disabled={loading}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.steps?.length > 0 && (
              <div className="msg-tools" data-testid="agent-steps" aria-label="에이전트가 호출한 도구">
                <i className="bi bi-tools me-1" />
                {m.steps.map((s, k) => (
                  <span key={k} className="msg-tool" title={`${s.tool}(${JSON.stringify(s.args)})`}>
                    {k > 0 && <i className="bi bi-arrow-right-short" />}{stepText(s)}
                    {apiOf(s) && <span className="msg-tool-api" data-testid="tool-api">{apiOf(s)}</span>}
                  </span>
                ))}
              </div>
            )}
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
