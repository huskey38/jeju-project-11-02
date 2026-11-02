import { useEffect, useRef, useState } from 'react'
import { loadKakao, radiusEdges } from '../lib/kakao'

// 근처 추천 핀 색 (묶음별): 음식점 감귤 · 카페 갈색 · 관광지 초록 · 편의점 하늘색 · 주차장 보라 · 주유소 붉은 벽돌색
const PIN_COLOR = { food: '#e8892b', cafe: '#8a5a2b', spot: '#2f6b52', CS2: '#3f9bb0', PK6: '#6b6f9a', OL7: '#c8553d', PK6P: '#2f6b52' }   // CS2 편의점 · PK6 주차장 · OL7 주유소 · PK6P 공영주차장

// 카카오 지도: 이 곳에 핀 1개 + (선택) 근처 추천 핀들과 반경 원 + 줌 컨트롤 + 일반/스카이뷰 전환
//   markers: [{ id, title, lat, lng, group }]   radiusM: 반경(미터, 원으로 표시)   onPickMarker(marker): 핀을 눌렀을 때
//   onFail: SDK 를 못 불렀을 때(호출하는 쪽이 Leaflet 지도로 바꿈)
// 부모가 key={좌표} 로 감싸 장소가 바뀌면 새로 만듦
export default function KakaoMap({ lat, lng, name, markers = [], radiusM, onPickMarker, onFail, height = 280 }) {
  const box = useRef(null)
  const api = useRef(null)            // { kakao, map, center, drawn: [] }
  const pick = useRef(onPickMarker)   // 최신 콜백을 쓰되 지도는 다시 만들지 않음
  const [ready, setReady] = useState(false)
  pick.current = onPickMarker

  // ① 지도 만들기
  useEffect(() => {
    let alive = true
    loadKakao().then((kakao) => {
      if (!alive || !box.current) return
      const center = new kakao.maps.LatLng(Number(lat), Number(lng))
      const map = new kakao.maps.Map(box.current, { center, level: 4 })
      map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
      map.addControl(new kakao.maps.MapTypeControl(), kakao.maps.ControlPosition.TOPRIGHT)
      new kakao.maps.Marker({ position: center, map, title: name })
      api.current = { kakao, map, center, drawn: [] }
      setReady(true)
      // 모달이 열리는 애니메이션이 끝난 뒤 크기를 다시 계산해야 타일이 깨지지 않음
      setTimeout(() => { if (alive && api.current) { map.relayout(); map.setCenter(center) } }, 350)
    }).catch(() => { if (alive) onFail?.() })
    return () => { alive = false; api.current = null; if (box.current) box.current.innerHTML = '' }
  }, [lat, lng])

  // ② 근처 추천 핀과 반경 원 (추천 목록·반경이 바뀔 때마다 다시 그림)
  useEffect(() => {
    const a = api.current
    if (!ready || !a) return
    const { kakao, map, center } = a
    a.drawn.forEach((o) => o.setMap(null))
    a.drawn = []

    const bounds = new kakao.maps.LatLngBounds()
    bounds.extend(center)
    if (radiusM) {
      const circle = new kakao.maps.Circle({
        center, radius: radiusM, strokeWeight: 2, strokeColor: '#2f6b52', strokeOpacity: 0.7, strokeStyle: 'dash',
        fillColor: '#2f6b52', fillOpacity: 0.06,
      })
      circle.setMap(map); a.drawn.push(circle)
      radiusEdges(lat, lng, radiusM).forEach(([la, ln]) => bounds.extend(new kakao.maps.LatLng(la, ln)))
    }
    markers.forEach((m) => {
      if (!Number.isFinite(Number(m.lat)) || !Number.isFinite(Number(m.lng))) return
      const pos = new kakao.maps.LatLng(Number(m.lat), Number(m.lng))
      const el = document.createElement('button')
      el.type = 'button'; el.className = 'kmap-pin'; el.title = `${m.title} 상세 보기`
      el.innerHTML = '<i></i><span></span>'
      el.querySelector('i').style.background = PIN_COLOR[m.group] ?? PIN_COLOR.spot
      el.querySelector('span').textContent = m.title      // 텍스트로만 넣어 HTML 이 해석되지 않게
      el.addEventListener('click', (e) => { e.stopPropagation(); pick.current?.(m) })
      const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1, zIndex: 3 })
      // 마우스를 올린(포커스한) 핀은 이름이 펼쳐지므로 다른 핀 위로 올림
      const raise = () => overlay.setZIndex(20), lower = () => overlay.setZIndex(3)
      el.addEventListener('mouseenter', raise); el.addEventListener('focus', raise)
      el.addEventListener('mouseleave', lower); el.addEventListener('blur', lower)
      overlay.setMap(map); a.drawn.push(overlay)
      bounds.extend(pos)
    })
    if (radiusM || markers.length) map.setBounds(bounds, 36, 36, 36, 36)
  }, [ready, markers, radiusM, lat, lng])

  return <div ref={box} className="kmap" style={{ height }} data-testid="place-map" data-map="kakao" />
}
