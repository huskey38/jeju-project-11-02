import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Vite 에서는 Leaflet 기본 마커 이미지 경로를 직접 알려줘야 함
const pin = L.icon({
  iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow,
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
})

// 모달이 열리는 애니메이션이 끝난 뒤 크기를 다시 계산해야 타일이 깨지지 않음
function Resize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 300)
    return () => clearTimeout(t)
  }, [map])
  return null
}

// 대체 지도: 카카오 지도를 쓸 수 없을 때(키 없음·SDK 로드 실패) 핀 1개를 OpenStreetMap 으로 보여줌
export default function LeafletMap({ lat, lng, name, height = 260 }) {
  const center = [Number(lat), Number(lng)]
  return (
    <MapContainer center={center} zoom={14} style={{ height, borderRadius: '1rem' }} scrollWheelZoom={false} data-testid="place-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={center} icon={pin} title={name} />
      <Resize />
    </MapContainer>
  )
}
