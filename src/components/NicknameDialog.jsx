import { useEffect, useState } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'
import { NAME_MAX, isFullNickname } from '../lib/nickname'

// 닉네임 만들기·바꾸기 창 (store 의 nicknameDialog 가 열고 닫음)
//  - "이름" 만 쓰면 뒤에 #번호 4자리를 붙여 새 닉네임을 만들고, "이름#1234" 로 쓰면 이미 있는 닉네임으로 들어갑니다.
//  - 닉네임이 없는 채로 감귤(가볼만한 곳)·가봤어요를 누르면 이 창이 먼저 뜨고, 만든 뒤 누르려던 동작이 이어집니다.
export default function NicknameDialog() {
  const open = useAppStore((s) => s.nicknameDialog.open)
  const pending = useAppStore((s) => s.nicknameDialog.pending)
  const nickname = useAppStore((s) => s.nickname)
  const close = useAppStore((s) => s.closeNicknameDialog)
  const createNickname = useAppStore((s) => s.createNickname)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) { setText(''); setError(''); setBusy(false) } }, [open])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const r = await createNickname(text)
    setBusy(false)
    if (r.error) setError(r.error)
  }
  const enter = isFullNickname(text)   // 번호까지 쓰면 '만들기' 가 아니라 '들어가기'

  return (
    <Modal show={open} onHide={close} centered data-testid="nickname-dialog">
      <Form onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">{nickname ? '닉네임 바꾸기' : '나만의 닉네임 만들기'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pending && <div className="small text-muted mb-2">닉네임을 만들면 방금 누른 {pending.kind === 'visit' ? '‘올랐어요’' : '‘담아둔 곳’ 담기'}가 이어서 처리돼요.</div>}
          {nickname && <div className="small mb-2">지금 닉네임: <strong>{nickname}</strong></div>}
          <Form.Control autoFocus value={text} maxLength={NAME_MAX + 5} placeholder="예: 오름러버" aria-label="닉네임"
            onChange={(e) => { setText(e.target.value); setError('') }} isInvalid={!!error} />
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
          <Form.Text className="d-block mt-2">
            이름 뒤에 <strong>#번호 4자리</strong>가 자동으로 붙어서(예: 오름러버#4821) 같은 이름을 쓰는 다른 사람과 목록이 섞이지 않아요.
            다른 기기에서는 번호까지 그대로 입력하면 같은 목록으로 들어와요. (로그인이 아니라서 번호를 아는 사람은 내 목록을 볼 수 있어요)
          </Form.Text>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={close}>닫기</Button>
          <Button type="submit" disabled={busy || !text.trim()} data-testid="nickname-submit">{enter ? '이 닉네임으로 들어가기' : '닉네임 만들기'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
