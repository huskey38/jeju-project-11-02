import { Navigate, createBrowserRouter } from 'react-router-dom'
import RootLayout from './layouts/RootLayout'
import Home from './pages/Home'
import Places from './pages/Places'
import Map3D from './pages/Map3D'
import Agent from './pages/Agent'
import NotFound from './pages/NotFound'

// ── 메뉴 목록 ────────────────────────────────────────────
// 페이지를 추가할 때: ① pages/에 파일 만들기 ② 아래 NAV_ITEMS 에 한 줄 추가 ③ routes 에 한 줄 추가
// 아이콘 이름: https://icons.getbootstrap.com
// ※ 국가유산은 '관광·문화'(Places) 안의 관광지 하위 분류로 합쳤습니다.
// ※ 관광·문화(Places)는 홈 화면에 들어가 있어 메뉴에서 뺐습니다. /places 주소는 그대로 동작합니다.
// ※ 내 즐겨찾기는 홈의 분류 버튼 '가볼만한 곳'으로 들어갔습니다. 예전 /my 주소는 그리로 이동합니다.
// ※ AI 가이드는 메뉴 대신 모든 화면에 떠 있는 원형 버튼(ChatWidget)으로 열립니다. /agent 주소는 그대로 동작합니다.
export const NAV_ITEMS = [
  { to: '/', label: '홈', icon: 'house' },
  { to: '/map3d', label: '3D 지도', icon: 'globe-asia-australia' },
]

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,      // 모든 페이지에 공통으로 보이는 틀(메뉴·푸터)
    errorElement: <NotFound />,   // 없는 주소로 들어오면
    children: [
      { index: true, element: <Home /> },
      { path: 'places', element: <Places /> },
      { path: 'map3d', element: <Map3D /> },
      { path: 'agent', element: <Agent /> },
      { path: 'my', element: <Navigate to="/?cat=saved" replace /> },   // 예전 '내 즐겨찾기' → 홈의 '가볼만한 곳'
    ],
  },
])
