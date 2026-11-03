import { Button, Modal } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'

// 닉네임을 새로 만든 직후 한 번 띄우는 안내: 내 기록이 어디에 어떻게 저장되는지. 닫기 버튼으로 닫음
export default function NicknameWelcome() {
  const welcome = useAppStore((s) => s.nicknameWelcome)
  const close = useAppStore((s) => s.closeNicknameWelcome)
  return (
    <Modal show={!!welcome} onHide={close} centered data-testid="nickname-welcome">
      <Modal.Header closeButton>
        <Modal.Title className="fs-5"><i className="bi bi-bookmark-check-fill me-2 text-success" />내 기록은 이렇게 저장돼요</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="text-center mb-3">
          <div className="small text-muted">내 닉네임</div>
          <div className="fs-4 fw-bold" data-testid="welcome-nickname">{welcome?.nickname}</div>
        </div>
        <ul className="small mb-0 ps-3 welcome-list">
          <li><strong>서버에 저장돼요.</strong> ‘올랐어요’·‘담아 두기’ 기록은 이 기기가 아니라 서버에 이 닉네임으로 보관돼요. 브라우저를 닫아도, 기록을 지워도 남아 있어요.</li>
          <li><strong>다른 기기에서도 볼 수 있어요.</strong> 다른 폰·컴퓨터에서 닉네임을 <strong>번호(#숫자)까지 그대로</strong> 입력하면 같은 기록이 나와요.</li>
          <li><strong>로그인이 아니에요.</strong> 비밀번호가 없어서, 번호까지 아는 사람은 내 기록을 볼 수 있어요. 닉네임은 남에게 알리지 말고 따로 적어 두세요.</li>
          <li><strong>번호를 잊으면 되찾을 수 없어요.</strong> 닉네임을 새로 만들면 새 기록으로 시작해요.</li>
        </ul>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="success" onClick={close} data-testid="welcome-close">확인했어요, 닫기</Button>
      </Modal.Footer>
    </Modal>
  )
}
