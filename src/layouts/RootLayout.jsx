import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Container, Toast, ToastContainer } from 'react-bootstrap'
import ChatWidget from '../components/ChatWidget'
import { useAppStore } from '../store/useAppStore'
import { isSupabaseReady } from '../lib/supabase'

export default function RootLayout() {
  const toasts = useAppStore((s) => s.toasts)
  const nickname = useAppStore((s) => s.nickname)
  const loadFavorites = useAppStore((s) => s.loadFavorites)

  // 어느 화면에서나 감귤 아이콘이 "담김" 상태를 알 수 있도록, 시작할 때와 닉네임이 바뀔 때 즐겨찾기를 불러옴
  // (닉네임을 입력하는 동안 키 입력마다 조회하지 않도록 잠깐 기다림)
  useEffect(() => {
    if (!isSupabaseReady) return
    const t = setTimeout(() => loadFavorites(), 400)
    return () => clearTimeout(t)
  }, [nickname, loadFavorites])

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* 상단 메뉴(Navbar)는 제거했습니다. 페이지 주소는 그대로이고, 메뉴 목록은 router.jsx 의 NAV_ITEMS 에 남겨 두었습니다 */}
      <main className="flex-grow-1 py-4">
        <Container>
          <Outlet />   {/* ← 여기에 주소에 맞는 페이지가 들어갑니다 */}
        </Container>
      </main>

      <footer className="py-3 border-top bg-light">
        <Container className="small text-muted">
          데이터 출처: 공공데이터포털 외 · 한국관광공사 TourAPI · 국가유산청
        </Container>
      </footer>

      {/* 어느 페이지에서나 따라다니는 AI 가이드 원형 버튼 + 대화창 */}
      <ChatWidget />

      {/* 스토어의 toast() 로 띄운 알림 */}
      <ToastContainer position="bottom-end" className="p-3 position-fixed">
        {toasts.map((t) => (
          <Toast key={t.id} bg={t.variant}>
            <Toast.Body className="text-white">{t.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </div>
  )
}
