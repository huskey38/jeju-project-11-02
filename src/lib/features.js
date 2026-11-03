// 기능 스위치 — 오름 한 걸음의 '채워 가는 느낌' 기능을 하나씩 켜고 끌 수 있습니다.
// 값을 false 로 바꾸면 그 기능의 화면·동작이 나오지 않습니다 (연결 지점이 모두 이 스위치로 감싸져 있음).
// 아예 빼려면: 스위치 false → 해당 컴포넌트 파일 삭제 → 연결 지점(아래 주석의 파일)에서 import·사용 줄 삭제.
export const FEATURES = {
  stampBook: true,          // 1 오름 도감(스탬프 북)       — src/components/StampBook.jsx            · 가본 곳 탭(OreumProgress)
  progressBreakdown: true,  // 2 형태·지역별 진행률          — src/components/ProgressBreakdown.jsx    · 가본 곳 탭(OreumProgress)
  nextStep: true,           // 3 다음 한 걸음 추천           — src/components/NextStep.jsx             · 가본 곳 탭(OreumProgress)
  visitEffect: true,        // 4 깃발 꽂는 순간 연출         — src/components/VisitEffect.jsx          · 전체 레이아웃(RootLayout)
  visitedFilter: true,      // 5 카드 가본 표시·안 간 오름 필터 — Places.jsx · ItemCard.jsx(flag)          · 오름 탭
  visitPhoto: true,         // 7 오름 인증사진(본인만 보기)  — src/components/VisitPhoto.jsx · src/lib/visitPhotos.js  · 정보 카드(Places)·오름 도감(StampBook)
  homeProgress: true,       // 6 메인 소개의 내 걸음 안내    — src/components/MyStepLine.jsx           · 메인(OreumIntro)
}
