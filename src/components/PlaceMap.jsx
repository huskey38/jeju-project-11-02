import { useState } from 'react'
import KakaoMap from './KakaoMap'
import LeafletMap from './LeafletMap'
import { hasKakaoKey } from '../lib/kakao'

// 한 곳을 2D 지도에 핀으로 표시. 카카오 지도(키가 있을 때)를 기본으로 쓰고,
// 키가 없거나 SDK 를 못 불러오면 Leaflet(OpenStreetMap) 지도로 대신함.
// markers·radiusM·onPickMarker 는 카카오 지도에서만 쓰임 (근처 추천 핀과 반경 원)
export default function PlaceMap(props) {
  const [kakaoFailed, setKakaoFailed] = useState(false)
  if (hasKakaoKey() && !kakaoFailed) return <KakaoMap {...props} onFail={() => setKakaoFailed(true)} />
  return <LeafletMap lat={props.lat} lng={props.lng} name={props.name} height={props.height} />
}
