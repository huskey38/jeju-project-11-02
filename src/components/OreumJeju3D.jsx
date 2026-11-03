import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { TERRAIN, heightAt, isJejuCoord, setHeightField, toXZ } from '../lib/geo'
import { atmosphereAt } from '../lib/oreumAtmosphere'
import { regionProgress } from '../lib/oreumRegions'
import { fmtDate } from '../lib/oreumStats'
import { FEATURES } from '../lib/features'
import { usePhotoStore } from '../store/usePhotoStore'

const SEA_FLOOR = -0.08 // 바다 밑 지형 높이(3D 단위)

// DEM 높이맵(Terrarium 인코딩 PNG)을 읽어 미터 단위 높이 배열로 만들고 geo.js 에 등록
// 반환: 'loading' | 'ready' | 'failed'
function useHeightField() {
  const [state, setState] = useState('loading')
  useEffect(() => {
    let alive = true
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.width; c.height = img.height
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0)
      const px = ctx.getImageData(0, 0, img.width, img.height).data
      const data = new Float32Array(img.width * img.height)
      for (let k = 0; k < data.length; k++) data[k] = px[k * 4] * 256 + px[k * 4 + 1] + px[k * 4 + 2] / 256 - 32768
      setHeightField({ data, w: img.width, h: img.height })
      if (alive) setState('ready')
    }
    img.onerror = () => { if (alive) setState('failed') }
    img.src = '/terrain/height.png'
    return () => { alive = false }
  }, [])
  return state
}

// 높이(미터)별 색: 바닷가 연초록 → 들판 연두 → 중산간 노랑·갈색 → 한라산 회색 → 정상 흰색 (사진 대신 단순한 색 지도)
const STOPS = [[0, '#a8d98a'], [150, '#8fcf73'], [400, '#cdd079'], [800, '#c39a62'], [1300, '#9a948c'], [1700, '#d9d6d0'], [1950, '#ffffff']].map(([m, c]) => [m, new THREE.Color(c)])
const FOAM = new THREE.Color('#f3f8e6')   // 해안선 둘레의 옅은 포말 띠
const SHALLOW = new THREE.Color('#5db7cf')   // 바다 밑 지형 색 = 바다 판 색 (경계 사각형이 보이지 않게)
function colorAt(meters, out) {
  if (meters <= 0) return out.copy(SHALLOW)
  for (let k = 1; k < STOPS.length; k++) {
    if (meters <= STOPS[k][0]) return out.lerpColors(STOPS[k - 1][1], STOPS[k][1], (meters - STOPS[k - 1][0]) / (STOPS[k][0] - STOPS[k - 1][0]))
  }
  return out.copy(STOPS.at(-1)[1])
}

// 단순한 지형: DEM 높이로 정점을 올리고, 높이에 따라 정점 색을 입힘 (질감·법선 지도 없음 → 가볍고 귤이 잘 보임)
function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(TERRAIN.width, TERRAIN.depth, 220, 132)
    g.rotateX(-Math.PI / 2)
    g.translate(TERRAIN.x0, 0, TERRAIN.z0)            // 지형 이미지 범위의 중심으로 옮김
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const h = heightAt(pos.getX(i), pos.getZ(i))
      pos.setY(i, h <= 0 ? SEA_FLOOR : h)
      const meters = h / TERRAIN.metersToUnit
      colorAt(meters, c)
      if (meters > 0 && meters < 9) c.lerp(FOAM, 0.55 * (1 - meters / 9))   // 바닷가 9m 이하: 해안선이 하얗게 이어짐
      col.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return <mesh geometry={geo}><meshLambertMaterial vertexColors /></mesh>
}

// 높이맵을 못 불러왔을 때의 대체 지형 (단색 섬)
function FallbackIsland() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(18, 9, 120, 60)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = []
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const inside = (x / 8.4) ** 2 + (z / 3.7) ** 2
      const h = inside <= 1 ? heightAt(x, z) + (1 - inside) * 0.25 : SEA_FLOOR
      pos.setY(i, h)
      if (h < 0) c.set('#1e6f9f')
      else if (h > 1.4) c.set('#9e9e9e')
      else if (h > 0.7) c.set('#8d6e63')
      else c.set('#6aa84f')
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return <mesh geometry={geo}><meshStandardMaterial vertexColors flatShading /></mesh>
}

// 바다: 섬 가까이는 밝고 얕은 물색, 멀어질수록 깊은 색 (정점 색 그라데이션 — 한 장짜리 면이라 렉 없음). 색은 등반률에 따라 달라짐
function Sea({ shallow, deep }) {
  const ref = useRef()
  const geo = useMemo(() => new THREE.RingGeometry(0.01, 220, 56, 44), [])
  useLayoutEffect(() => {
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3)
    const a = new THREE.Color(shallow), b = new THREE.Color(deep), c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i))
      const t = Math.min(1, Math.max(0, (r - 7) / 45)); c.lerpColors(a, b, t * t * (3 - 2 * t))
      col.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  }, [geo, shallow, deep])
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = -0.02 + Math.sin(clock.elapsedTime) * 0.005
  })
  return (
    <mesh ref={ref} geometry={geo} rotation={[-Math.PI / 2, 0, 0]}>
      <meshLambertMaterial vertexColors />
    </mesh>
  )
}

// 오름 좌표 근처(약 600m)에서 가장 높은 곳으로 옮김 — 공식 좌표가 기슭일 수 있어 '정상'에 마크가 서도록
function peakOf(x, z) {
  let bx = x, bz = z, by = Math.max(0, heightAt(x, z))
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
    if (i * i + j * j > 16) continue
    const px = x + i * 0.03, pz = z + j * 0.03, h = heightAt(px, pz)
    if (h > by) { bx = px; bz = pz; by = h }
  }
  return [bx, bz, by]
}

// 아직 안 오른 오름 = 귤 윤곽 자리: 땅에 놓인 주황 고리(+ 아주 옅은 속) — 귤이 올라갈 빈 자리. 한 번에(InstancedMesh) 그려 돌릴 때 가볍고, 지형 위에서 튀지 않으면서 '비어 있음'이 보임
const BASE_H = 0.035   // 마우스를 올렸을 때 이름표 높이 기준
const LIFT = 0.012     // 땅 위로 살짝 띄움(지형과 겹쳐 깜빡이지 않게)
function Dots({ pts, onHover }) {
  const rings = useRef(), fills = useRef()
  useLayoutEffect(() => {
    const d = new THREE.Object3D()
    d.rotation.set(-Math.PI / 2, 0, 0)   // 땅에 눕힘
    pts.forEach((p, i) => {
      d.position.set(p.x, p.y + LIFT, p.z); d.updateMatrix()
      rings.current?.setMatrixAt(i, d.matrix); fills.current?.setMatrixAt(i, d.matrix)
    })
    for (const m of [rings.current, fills.current]) if (m) { m.count = pts.length; m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere() }
  }, [pts])
  if (!pts.length) return null
  const flat = { transparent: true, depthWrite: false, side: THREE.DoubleSide }
  return (
    <>
      <instancedMesh ref={rings} args={[undefined, undefined, pts.length]} raycast={() => null}>
        <ringGeometry args={[0.052, 0.092, 28]} />
        <meshBasicMaterial color="#e8892b" opacity={0.78} {...flat} />
      </instancedMesh>
      <instancedMesh ref={fills} args={[undefined, undefined, pts.length]}
        onPointerMove={(e) => { e.stopPropagation(); onHover(pts[e.instanceId] ?? null); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { onHover(null); document.body.style.cursor = '' }}>
        <circleGeometry args={[0.092, 24]} />
        <meshBasicMaterial color="#e8892b" opacity={0.14} {...flat} />
      </instancedMesh>
    </>
  )
}

// 오른 오름: 정상에 현무암 돌탑을 쌓고 그 위에 감귤 한 알(잎 포함)을 올림. 처음엔 위에서 통통 떨어져 앉고, 귤은 살짝 둥실거리며 발밑에 금빛 고리가 퍼짐
function Summit({ p, delay, onHover }) {
  const g = useRef(), fruit = useRef(), ring = useRef(), born = useRef(null)
  useFrame(({ clock }) => {
    if (born.current === null) born.current = clock.elapsedTime
    const t = Math.min(1, Math.max(0, clock.elapsedTime - born.current - delay) / 0.7)
    const ease = t === 0 ? 0 : 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.18
    g.current.scale.setScalar(ease * 1.5)   // 단순한 지도에서도 귤이 눈에 띄게 크게
    g.current.position.y = p.y + (1 - t) * 0.8
    if (fruit.current) fruit.current.position.y = 0.2 + Math.sin(clock.elapsedTime * 2 + p.x * 3) * 0.012   // 귤이 둥실
    if (ring.current) { const k = (clock.elapsedTime * 0.5 + p.z) % 1; ring.current.scale.setScalar(0.6 + k); ring.current.material.opacity = 0.6 * (1 - k) * (t >= 1 ? 1 : 0) }
  })
  const over = (e) => { e.stopPropagation(); onHover(p); document.body.style.cursor = 'pointer' }
  const out = () => { onHover(null); document.body.style.cursor = '' }
  return (
    <group position={[p.x, p.y + 0.8, p.z]} scale={0} ref={g} onPointerOver={over} onPointerOut={out}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.1, 0.13, 24]} /><meshBasicMaterial color="#ffd36a" transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* 현무암 돌탑 */}
      <mesh position={[0, 0.025, 0]}><dodecahedronGeometry args={[0.07, 0]} /><meshStandardMaterial color="#3f4147" flatShading /></mesh>
      <mesh position={[0.06, 0.02, 0.03]}><dodecahedronGeometry args={[0.045, 0]} /><meshStandardMaterial color="#55585f" flatShading /></mesh>
      <mesh position={[-0.05, 0.02, -0.03]}><dodecahedronGeometry args={[0.04, 0]} /><meshStandardMaterial color="#4a4d54" flatShading /></mesh>
      <mesh position={[0, 0.085, 0]}><dodecahedronGeometry args={[0.045, 0]} /><meshStandardMaterial color="#3f4147" flatShading /></mesh>
      {/* 감귤 한 알 + 잎 */}
      <group ref={fruit} position={[0, 0.2, 0]}>
        <mesh><sphereGeometry args={[0.095, 16, 14]} /><meshStandardMaterial color="#f08a24" emissive="#f08a24" emissiveIntensity={0.45} roughness={0.6} /></mesh>
        <mesh position={[-0.03, 0.035, 0.07]}><sphereGeometry args={[0.03, 8, 8]} /><meshBasicMaterial color="#ffd9a0" transparent opacity={0.55} /></mesh>
        <mesh position={[0.025, 0.1, 0]} rotation={[0, 0, -0.6]} scale={[1.6, 0.5, 1]}><sphereGeometry args={[0.04, 8, 8]} /><meshStandardMaterial color="#6fbf4a" /></mesh>
      </group>
    </group>
  )
}

// 섬 둘레의 방향 글자 (북·동·남·서)
const DIRS = [['북', 0, -4.4], ['남', 0, 4.4], ['동', 8.8, 0], ['서', -8.8, 0]]
// 글자 스프라이트(캔버스 그림): 지도를 돌려도 항상 정면으로 보이고, 지형 위에도 가려지지 않음
function DirSprite({ text, north, position }) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128
    const g = c.getContext('2d')
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fillStyle = north ? '#e8892b' : 'rgba(255,255,255,0.88)'; g.fill()
    g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.25)'; g.stroke()
    g.font = '700 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = north ? '#fff' : '#3f4147'; g.fillText(text, 64, 68)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [text, north])
  return <sprite position={position} scale={[0.9, 0.9, 1]} renderOrder={5}><spriteMaterial map={tex} transparent depthTest={false} /></sprite>
}
function DirectionLabels() {
  return DIRS.map(([t, x, z]) => <DirSprite key={t} text={t} north={t === '북'} position={[x, 0.5, z]} />)
}

// 6지역 이름표(처음 온 사람이 '어디가 어디인지' 알 수 있게) + 지역 달성률. 이름표를 누르면 그 지역으로 확대. 성산일출봉도 표기 (한라산처럼 누구나 아는 곳은 뺌)
const ILCHUL = { lat: 33.458, lng: 126.9425 }   // 성산일출봉

function NameSprite({ text, sub, position, kind = 'spot', gold = false, onClick }) {   // kind: city 큰 도시 · town 동네 · spot 명소 · gold 지역 완주 · sub 위에 얹는 작은 방위 글씨
  const { tex, ratio, ch } = useMemo(() => {
    const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 44, sfs = 34, H = sub ? 116 : 76
    g.font = `700 ${fs}px sans-serif`
    const w = Math.ceil(Math.max(g.measureText(text).width, 0)) + 44
    c.width = w; c.height = H
    g.beginPath(); g.roundRect(2, 2, w - 4, H - 4, sub ? 40 : 36); g.fillStyle = gold ? '#fff2bf' : 'rgba(255,255,255,0.92)'; g.fill()
    g.lineWidth = gold ? 6 : 4; g.strokeStyle = gold ? '#e0a800' : kind === 'town' ? '#2f6b52' : '#e8892b'; g.stroke()
    g.textAlign = 'center'; g.textBaseline = 'middle'
    if (sub) {
      g.font = `700 ${sfs}px sans-serif`; g.fillStyle = gold ? '#a77a00' : '#7b7f86'; g.fillText(sub, w / 2, 34)
      g.font = `700 ${fs}px sans-serif`; g.fillStyle = '#3f4147'; g.fillText(text, w / 2, 80)
    } else { g.fillStyle = '#3f4147'; g.fillText(text, w / 2, 40) }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    return { tex: t, ratio: w / H, ch: H }
  }, [text, sub, kind, gold])
  const h = (kind === 'town' ? 0.42 : kind === 'city' ? 0.56 : 0.46) * (ch / 76) * (sub ? 0.9 : 1)
  return (
    <sprite position={position} scale={[h * ratio, h, 1]} renderOrder={6}
      onClick={onClick ? (e) => { e.stopPropagation(); onClick() } : undefined}
      onPointerOver={onClick ? (e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' } : undefined}
      onPointerOut={onClick ? () => { document.body.style.cursor = '' } : undefined}>
      <spriteMaterial map={tex} transparent depthTest={false} />
    </sprite>
  )
}

// 떠오르는 해: 주황 원 + 은은한 빛무리 (항상 정면)
const SunSprite = forwardRef(function SunSprite({ position }, ref) {
  const tex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = c.height = 128
    const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 8, 64, 64, 62)
    grad.addColorStop(0, 'rgba(255,200,90,1)'); grad.addColorStop(0.45, 'rgba(255,170,60,1)'); grad.addColorStop(0.5, 'rgba(255,190,90,0.55)'); grad.addColorStop(1, 'rgba(255,200,120,0)')
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
  }, [])
  return <sprite ref={ref} position={position} scale={[0.5, 0.5, 1]} renderOrder={4}><spriteMaterial map={tex} transparent depthTest={false} /></sprite>
})

// 성산일출봉: 제주 지형 위에 얹힌 '지형 덩어리' — 지형 높이에 그대로 솟아올라 바다·땅과 이어지고(떠 보이지 않게), 지형과 같은 색 체계(초록 기슭·회색 절벽·움푹한 분화구)를 씀
//   바다 쪽(동쪽)은 가파른 절벽, 육지 쪽(서쪽)은 완만한 기슭으로 섬에 붙고, 바다 위로 해가 떠오름
const ILCHUL_R = 0.46, ILCHUL_H = 0.4
const GRASS = new THREE.Color('#8fcf73'), GRASS_HI = new THREE.Color('#a8dc86'), CLIFF = new THREE.Color('#a39d92'), CLIFF_DK = new THREE.Color('#9b958a'), CRATER = new THREE.Color('#bfe39a')
function ilchulBump(dx, dz) {
  const east = dx > 0
  const u = Math.hypot(dx / (east ? 0.8 : 1.3), dz) / ILCHUL_R            // 동쪽은 좁게(가파르게), 서쪽은 넓게(완만하게)
  if (u >= 1) return { bump: 0, u }
  const cone = Math.pow(1 - Math.pow(u, 1.7), 1.25)
  const crater = 0.2 * Math.exp(-Math.pow(u / 0.3, 2))                      // 가운데 분화구
  return { bump: Math.max(0, ILCHUL_H * (cone - crater)), u }
}
function IlchulbongMound({ x, z }) {
  const geo = useMemo(() => {
    const size = ILCHUL_R * 3.2, N = 64
    const g = new THREE.PlaneGeometry(size, size, N, N)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color()
    for (let k = 0; k < pos.count; k++) {
      const dx = pos.getX(k), dz = pos.getZ(k), px = x + dx, pz = z + dz
      const { bump, u } = ilchulBump(dx, dz)
      const base = heightAt(px, pz)
      pos.setX(k, px); pos.setZ(k, pz)
      // 덩어리 밖(bump 0)은 지형과 똑같은 높이(바다 밑이면 바다 밑 지형 아래로 숨김), 안은 지형 위에 솟아오름
      pos.setY(k, bump <= 0.0005 ? (base <= 0 ? SEA_FLOOR - 0.01 : base - 0.004) : Math.max(base, 0) + bump + 0.002)
      // 색: 낮은 기슭 초록 → 동쪽 중턱 회색 절벽 → 정상 둘레 초록 → 분화구 바닥 연초록
      const f = bump / ILCHUL_H, east = dx > 0
      if (f < 0.16) c.copy(GRASS)
      else if (u < 0.2) c.copy(CRATER)
      else if (east && f < 0.78) c.lerpColors(GRASS, f > 0.45 ? CLIFF_DK : CLIFF, Math.min(1, (f - 0.16) / 0.3))
      else c.lerpColors(GRASS, GRASS_HI, f)
      col.set([c.r, c.g, c.b], k * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [x, z])
  return <mesh geometry={geo}><meshLambertMaterial vertexColors /></mesh>
}
function Ilchulbong({ pos }) {
  const sun = useRef()
  useFrame(({ clock }) => { if (sun.current) sun.current.scale.setScalar(0.5 * (1 + Math.sin(clock.elapsedTime * 1.5) * 0.07)) })
  const [x, y, z] = pos
  const top = y + ILCHUL_H
  return (
    <group>
      <IlchulbongMound x={x} z={z} />
      <SunSprite ref={sun} position={[x + 0.62, top + 0.12, z - 0.04]} />
      <NameSprite text="성산일출봉" position={[x, top + 0.38, z]} />
    </group>
  )
}

function Landmarks({ regions, onFocus }) {
  const spots = useMemo(() => regions.map((r) => {
    const [x, z] = toXZ(r.lat, r.lng)
    const y = Math.max(0, heightAt(x, z))
    return { r, x, y, z, pos: [x, y + (r.key === 'n' || r.key === 's' ? 0.3 : 0.28), z] }
  }), [regions])
  const [ix, iz] = toXZ(ILCHUL.lat, ILCHUL.lng)
  return (
    <>
      {spots.map(({ r, x, y, z, pos }) => (
        <NameSprite key={r.key} sub={r.area} text={`${r.done ? '★ ' : ''}${r.label} ${r.count}/${r.total}`} position={pos} kind={r.key === 'n' || r.key === 's' ? 'city' : 'town'} gold={r.done}
          onClick={() => onFocus({ x, y, z })} />
      ))}
      <Ilchulbong pos={[ix, Math.max(0, heightAt(ix, iz)), iz]} />
    </>
  )
}

// 지역 이름표를 누르면 카메라가 부드럽게 그 지역으로 날아가 확대 / 전체 보기로 되돌아감. 사용자가 직접 돌리거나 확대하면 멈춤
function FlyTo({ focus }) {
  const controls = useThree((st) => st.controls)
  const anim = useRef(null)
  useEffect(() => {
    if (!controls) return
    const stop = () => { if (anim.current) anim.current.done = true }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controls])
  useFrame(({ camera, clock }) => {
    if (!controls || !focus) return
    if (anim.current?.id !== focus.id) {
      const toT = focus.reset ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(focus.x, focus.y * 0.5, focus.z)
      const toC = focus.reset ? new THREE.Vector3(0, 6.8, 8.6) : new THREE.Vector3(focus.x, toT.y + 3.3, focus.z + 4.4)
      anim.current = { id: focus.id, t0: clock.elapsedTime, fromT: controls.target.clone(), fromC: camera.position.clone(), toT, toC, done: false }
    }
    const a = anim.current
    if (a.done) return
    const k = Math.min(1, (clock.elapsedTime - a.t0) / 1.3)
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
    controls.target.lerpVectors(a.fromT, a.toT, e)
    camera.position.lerpVectors(a.fromC, a.toC, e)
    controls.update()
    if (k >= 1) a.done = true
  })
  return null
}

// 가까이 확대하면 보이는 오름 이야기: 카메라가 보는 곳 둘레의 오른 오름(이름·오른 날짜·내 인증사진)과, 더 가까이서는 안 오른 오름의 이름 — 가까운 몇 곳만 그려 렉이 없음
function NearLabels({ visited, todo, dates }) {
  const photos = usePhotoStore((st) => st.photos)
  const load = usePhotoStore((st) => st.load)
  useEffect(() => { if (FEATURES.visitPhoto) load() }, [load])
  const [view, setView] = useState({ v: [], t: [] })
  const last = useRef(0)
  useFrame(({ camera, controls, clock }) => {
    if (!controls || clock.elapsedTime - last.current < 0.2) return
    last.current = clock.elapsedTime
    const tg = controls.target, dist = camera.position.distanceTo(tg)
    const pick = (list, R, n) => list.map((q) => ({ q, d: Math.hypot(q.x - tg.x, q.z - tg.z) })).filter((x) => x.d < R).sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.q)
    const v = dist < 8.2 ? pick(visited, 3.2, 8) : []   // 기본 시점(거리 약 11)에서는 안 보이고, 확대해야 나타남
    const t = dist < 5.6 ? pick(todo, 2.2, 6) : []
    const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
    setView((prev) => (same(prev.v, v) && same(prev.t, t) ? prev : { v, t }))
  })
  return (
    <>
      {view.v.map((q) => {
        const ph = photos[String(q.o.id)]
        return (
          <Html key={`v${q.o.id}`} position={[q.x, q.y + 0.62, q.z]} center distanceFactor={4.4} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="near-label is-done" data-testid="near-label">
              {ph && <img src={ph.url} alt="" />}
              <strong>🍊 {q.o.title}</strong>
              <span>{[dates.get(String(q.o.id)) ? fmtDate(dates.get(String(q.o.id))) : '', q.o.elev ? `${q.o.elev}m` : ''].filter(Boolean).join(' · ')}</span>
            </div>
          </Html>
        )
      })}
      {view.t.map((q) => (
        <Html key={`t${q.o.id}`} position={[q.x, q.y + 0.2, q.z]} center distanceFactor={4} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className="near-label is-todo" data-testid="near-label-todo"><strong>{q.o.title}</strong><span>{q.o.elev ? `${q.o.elev}m` : ''}</span></div>
        </Html>
      ))}
    </>
  )
}

// 화면 모서리 나침반: 지도를 돌리면 북쪽 표시가 따라 돎 (카메라 방위각을 읽어 DOM 만 직접 돌려 렌더링 비용이 없음)
function CompassSync({ roseRef }) {
  useFrame(({ camera, controls }) => {
    if (!roseRef.current) return
    const t = controls?.target ?? { x: 0, z: 0 }
    const az = Math.atan2(camera.position.x - t.x, camera.position.z - t.z)   // 남쪽에서 북쪽을 볼 때 0
    roseRef.current.style.transform = `rotate(${(az * 180) / Math.PI}deg)`
  })
  return null
}

// 3D 제주 전도 + 오름 마크: oreums 는 오름 목록, visitedIds 는 가본 오름 id 집합 (문자열)
export default function OreumJeju3D({ oreums = [], visitedIds = new Set(), height = 420, percent = 0, dates = new Map() }) {
  const terrain = useHeightField()
  const [hover, setHover] = useState(null)
  const roseRef = useRef(null)
  const [focus, setFocus] = useState(null)   // 지역 이름표를 눌러 확대 중이면 { id, x, y, z }, 전체 보기로 돌아가면 { id, reset: true }
  const atm = useMemo(() => atmosphereAt(percent), [percent])   // 등반률에 따른 하늘·바다 색
  const list = useMemo(() => oreums.filter((o) => isJejuCoord(o.lat, o.lng)), [oreums])
  // 오름마다 정상 위치를 한 번만 계산 (지형 높이맵이 준비된 뒤)
  const pts = useMemo(() => {
    if (terrain === 'loading') return []
    return list.map((o) => { const [x, z] = toXZ(o.lat, o.lng); const [px, pz, py] = peakOf(x, z); return { o, x: px, y: py, z: pz } })
  }, [list, terrain])
  const visited = useMemo(() => pts.filter((p) => visitedIds.has(String(p.o.id))), [pts, visitedIds])
  const todo = useMemo(() => pts.filter((p) => !visitedIds.has(String(p.o.id))), [pts, visitedIds])
  // 가본 오름은 서쪽부터 차례로 꽂히게 지연을 줌
  const order = useMemo(() => {
    const m = new Map()
    ;[...visited].sort((a, b) => Number(a.o.lng) - Number(b.o.lng)).forEach((p, i) => m.set(p.o.id, i * 0.07))
    return m
  }, [visited])
  const isVisited = hover && visitedIds.has(String(hover.o.id))
  const regions = useMemo(() => regionProgress(list, visitedIds), [list, visitedIds])
  const flyTo = (f) => setFocus({ ...f, id: Date.now() })

  return (
    <div style={{ position: 'relative', height, background: `linear-gradient(180deg, ${atm.skyTop} 0%, ${atm.skyHorizon} 46%, ${atm.seaDeep} 100%)` }} data-testid="oreum-sky">
      <Canvas camera={{ position: [0, 6.8, 8.6], fov: 50 }} style={{ height, background: 'transparent' }} gl={{ alpha: true }} data-testid="oreum-canvas" dpr={[1, 1.5]}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[-8, 6, 4]} intensity={1.4} color={atm.light} />
        <Sea shallow={atm.seaShallow} deep={atm.seaDeep} />
        {terrain === 'ready' && <Terrain />}
        {terrain === 'failed' && <FallbackIsland />}
        <DirectionLabels />
        {terrain !== 'loading' && <Landmarks regions={regions} onFocus={flyTo} />}
        <Dots pts={todo} onHover={setHover} />
        {visited.map((p) => <Summit key={p.o.id} p={p} delay={order.get(p.o.id) ?? 0} onHover={setHover} />)}
        {hover && (
          <Html position={[hover.x, hover.y + (isVisited ? 0.62 : BASE_H + 0.12), hover.z]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
            <div className={`badge ${isVisited ? 'text-bg-warning' : 'text-bg-dark'}`}>
              {isVisited ? '🍊 정상 도착 · ' : ''}{hover.o.title}{hover.o.elev ? ` · ${hover.o.elev}m` : ''}
            </div>
          </Html>
        )}
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={24} />
        <CompassSync roseRef={roseRef} />
        <FlyTo focus={focus} />
        {terrain !== 'loading' && <NearLabels visited={visited} todo={todo} dates={dates} />}
      </Canvas>
      <div className="map-hud" data-testid="map-hud">🍊 <strong>{visited.length}</strong> / {pts.length}<span> · 빈 자리 {todo.length}</span></div>
      {focus && !focus.reset && (
        <button type="button" className="map-reset" data-testid="map-reset" onClick={() => setFocus({ reset: true, id: Date.now() })}>↩ 전체 보기</button>
      )}
      <div className="map-compass" aria-label="나침반: 북쪽 표시" data-testid="map-compass">
        <div className="map-compass-rose" ref={roseRef}>
          <span className="mc-n">북</span><span className="mc-e">동</span><span className="mc-s">남</span><span className="mc-w">서</span>
          <i className="mc-needle" />
        </div>
      </div>
    </div>
  )
}
