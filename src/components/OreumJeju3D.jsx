import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, Sky, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { TERRAIN, getHeightField, heightAt, isJejuCoord, setHeightField, toXZ } from '../lib/geo'
import { buildNormalMap } from '../lib/terrainNormal'

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

// 실제 지형: DEM 높이로 정점을 올리고, 위성사진(색)과 법선 지도(입체 음영)를 입힘
function Terrain() {
  const gl = useThree((s) => s.gl)
  const maxAniso = Math.min(16, gl.capabilities.getMaxAnisotropy())   // 비스듬히 볼 때도 텍스처가 덜 흐려지게

  const map = useTexture('/terrain/satellite.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace })
  useEffect(() => { map.anisotropy = maxAniso; map.needsUpdate = true }, [map, maxAniso])

  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(TERRAIN.width, TERRAIN.depth, 480, 288)
    g.rotateX(-Math.PI / 2)
    g.translate(TERRAIN.x0, 0, TERRAIN.z0)            // 지형 이미지 범위의 중심으로 옮김
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const h = heightAt(pos.getX(i), pos.getZ(i))
      pos.setY(i, h <= 0 ? SEA_FLOOR : h)
    }
    // 정점 법선은 모두 위쪽으로 두고, 경사는 법선 지도가 전부 담당 (둘 다 쓰면 같은 경사가 두 번 반영되어 과하게 어두워짐)
    const n = g.attributes.normal
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0)
    return g
  }, [])

  const normalMap = useMemo(() => {
    const field = getHeightField()
    if (!field) return null
    const { data, w, h } = buildNormalMap(field, { ...TERRAIN, strength: 1.6 })
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat)
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter
    t.generateMipmaps = true; t.anisotropy = maxAniso; t.needsUpdate = true
    return t
  }, [maxAniso])

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial map={map} normalMap={normalMap ?? undefined} roughness={1} />
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
      <planeGeometry args={[400, 400]} />
      <meshPhysicalMaterial color="#6cc0cf" transparent opacity={0.96} roughness={0.15} metalness={0.1} />
    </mesh>
  )
}

// 오름 마크 하나. 가본 오름은 감귤색 깃발(꽂히는 애니메이션), 아직 안 간 오름은 작은 흰 점.
//   delay: 처음 열릴 때 하나씩 순서대로 꽂히도록 주는 지연(초)
function Mark({ oreum, visited, delay, hovered, onHover }) {
  const [x, z] = toXZ(oreum.lat, oreum.lng)
  const y = Math.max(0, heightAt(x, z))
  const ref = useRef()
  const born = useRef(null)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g || !visited) return
    if (born.current === null) born.current = clock.elapsedTime
    const t = Math.min(1, Math.max(0, clock.elapsedTime - born.current - delay) / 0.7)   // 0 → 1 (0.7초)
    const ease = t === 0 ? 0 : 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.18       // 살짝 튀어 오르며 꽂힘
    g.scale.setScalar(ease)
    g.position.y = y + 0.05 + (1 - Math.min(t, 1)) * 0.8                                    // 위에서 떨어짐
  })
  const active = hovered === oreum.id

  return (
    <group ref={ref} position={[x, visited ? y + 0.85 : y + 0.03, z]} scale={visited ? 0 : 1}>
      {visited ? (
        <group
          onPointerOver={(e) => { e.stopPropagation(); onHover(oreum.id); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { onHover(null); document.body.style.cursor = '' }}
        >
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.6, 6]} />
            <meshStandardMaterial color="#5b4a2f" />
          </mesh>
          <mesh position={[0.11, 0.52, 0]}>
            <coneGeometry args={[0.09, 0.22, 3]} />
            <meshStandardMaterial color="#e8892b" emissive="#e8892b" emissiveIntensity={0.55} />
          </mesh>
          <mesh position={[0, 0.62, 0]}><sphereGeometry args={[0.035, 10, 10]} /><meshStandardMaterial color="#fff3d6" emissive="#ffd9a0" emissiveIntensity={0.8} /></mesh>
        </group>
      ) : (
        <mesh
          onPointerOver={(e) => { e.stopPropagation(); onHover(oreum.id); document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { onHover(null); document.body.style.cursor = '' }}
        >
          <sphereGeometry args={[0.04, 10, 10]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.35} transparent opacity={0.85} />
        </mesh>
      )}
      {active && (
        <Html distanceFactor={9} position={[0, visited ? 0.85 : 0.2, 0]} center style={{ pointerEvents: 'none' }}>
          <div className={`badge ${visited ? 'text-bg-warning' : 'text-bg-dark'}`}>{visited ? '✓ ' : ''}{oreum.title}</div>
        </Html>
      )}
    </group>
  )
}

// 3D 제주 전도 + 오름 마크: oreums 는 오름 목록, visitedIds 는 가본 오름 id 집합 (문자열)
export default function OreumJeju3D({ oreums = [], visitedIds = new Set(), height = 420 }) {
  const terrain = useHeightField()
  const [hovered, setHovered] = useState(null)
  const list = useMemo(() => oreums.filter((o) => isJejuCoord(o.lat, o.lng)), [oreums])
  // 가본 오름은 서쪽부터 차례로 꽂히게 지연을 줌
  const order = useMemo(() => {
    const m = new Map()
    list.filter((o) => visitedIds.has(String(o.id))).sort((a, b) => Number(a.lng) - Number(b.lng)).forEach((o, i) => m.set(o.id, i * 0.07))
    return m
  }, [list, visitedIds])

  return (
    <Canvas camera={{ position: [0, 6.8, 8.6], fov: 50 }} style={{ height }} data-testid="oreum-canvas">
      <Sky sunPosition={[100, 30, 60]} turbidity={6} rayleigh={1.5} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[-8, 6, 4]} intensity={1.4} />
      <Sea />
      {terrain === 'ready' && <Suspense fallback={null}><Terrain /></Suspense>}
      {terrain === 'failed' && <FallbackIsland />}
      {terrain !== 'loading' && list.map((o) => (
        <Mark key={`${o.id}-${visitedIds.has(String(o.id))}`} oreum={o} visited={visitedIds.has(String(o.id))} delay={order.get(o.id) ?? 0}
          hovered={hovered} onHover={setHovered} />
      ))}
      <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={24} />
    </Canvas>
  )
}
