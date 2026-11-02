import { Card } from 'react-bootstrap'
import PageHeader from '../components/PageHeader'
import ChatPanel from '../components/ChatPanel'

// 전체 화면 대화 페이지 (메뉴에서는 빠지고, 어느 화면에서나 쓰는 플로팅 AI 가이드 버튼이 대신함. 주소 /agent 로는 계속 열림)
export default function Agent() {
  return (
    <>
      <PageHeader icon="robot" title="AI 가이드" subtitle="공공데이터 API를 도구로 쓰는 에이전트" />
      <Card className="chat-box mb-3"><ChatPanel height="65vh" /></Card>
    </>
  )
}
