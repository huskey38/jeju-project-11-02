import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, Sky, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { TERRAIN, heightAt, isJejuCoord, setHeightField, toXZ } from '../lib/geo'

const COLORS = { tour: '#ff6347', heritage: '#ffb300' }
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

// 실제 지형: DEM 높이로 정점을 올리고 위성사진을 입힘
function Terrain() {
  const map = useTexture('/terrain/satellite.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8 })
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(TERRAIN.width, TERRAIN.depth, 320, 220)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const h = heightAt(pos.getX(i), pos.getZ(i))
      pos.setY(i, h <= 0 ? SEA_FLOOR : h)
    }
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial map={map} roughness={1} />
    </mesh>
  )
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

function Sea() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = -0.02 + Math.sin(clock.elapsedTime) * 0.005
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[80, 60]} />
      <meshPhysicalMaterial color="#6cc0cf" transparent opacity={0.96} roughness={0.15} metalness={0.1} />
    </mesh>
  )
}

function Pin({ item, selected, onSelect }) {
  const [hover, setHover] = useState(false)
  const [x, z] = toXZ(item.lat, item.lng)
  const y = Math.max(0, heightAt(x, z)) + 0.35
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = y + (selected ? Math.sin(clock.elapsedTime * 4) * 0.08 : 0)
  })
  const active = hover || selected
  return (
    <mesh
      ref={ref}
      position={[x, y, z]}
      rotation={[Math.PI, 0, 0]}
      scale={active ? 1.5 : 1}
      onClick={(e) => { e.stopPropagation(); onSelect?.(item) }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = '' }}
    >
      <coneGeometry args={[0.14, 0.5, 12]} />
      <meshStandardMaterial color={COLORS[item.source] ?? 'tomato'} emissive={active ? '#ffffff' : '#000000'} emissiveIntensity={0.25} />
      {active && (
        <Html distanceFactor={10} position={[0, -0.6, 0]} center style={{ pointerEvents: 'none' }}>
          <div className="badge text-bg-dark">{item.name}</div>
        </Html>
      )}
    </mesh>
  )
}

// items: [{ name, lat, lng, source }]  /  onSelect(item) 클릭 콜백
export default function Jeju3D({ items = [], selected = null, onSelect, height = 420, autoRotate = false }) {
  const terrain = useHeightField()
  const pins = items.filter((h) => isJejuCoord(h.lat, h.lng))
  return (
    <Canvas camera={{ position: [0, 8, 10], fov: 50 }} style={{ height }} data-testid="jeju-canvas" onPointerMissed={() => onSelect?.(null)}>
      <Sky sunPosition={[100, 30, 60]} turbidity={6} rayleigh={1.5} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 10, 5]} intensity={1.4} />
      <Sea />
      {terrain === 'ready' && <Suspense fallback={null}><Terrain /></Suspense>}
      {terrain === 'failed' && <FallbackIsland />}
      {terrain !== 'loading' && pins.map((h, i) => (
        <Pin key={`${h.source}-${h.name}-${i}`} item={h} selected={selected === h} onSelect={onSelect} />
      ))}
      <OrbitControls autoRotate={autoRotate} autoRotateSpeed={0.6} maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={22} />
    </Canvas>
  )
}
