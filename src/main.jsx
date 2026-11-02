import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

// ── 디자인 ───────────────────────────────────────────────
// Bootstrap 5 기본 위에 styles/theme.css 가 색·모서리·그림자를 덮어씁니다 (골든 크림 + 세이지 그린 + 제주 포인트 색).
// 예전 Bootswatch 테마로 돌아가려면 이 줄을 'bootswatch/dist/minty/bootstrap.min.css' 로 바꾸고 theme.css 를 되돌리세요.
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './styles/theme.css'

import { router } from './router'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
