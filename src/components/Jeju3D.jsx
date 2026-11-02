import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { heightAt, isJejuCoord, toXZ } from '../lib/geo'

const COLORS = { tour: '#ff6347', heritage: '#ffb300' }

// 제주섬: 동서로 긴 타원 지형. 정점 높이를 한라산 함수로 올려 입체감을 줍니다.
function Island() {
  const terrain = useMemo(() => {
    const g = new THREE.PlaneGeometry(18, 9, 120, 60)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = []
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const inside = (x / 8.4) ** 2 + (z / 3.7) ** 2 // 1 이하 = 섬 내부
      const h = inside <= 1 ? heightAt(x, z) + (1 - inside) * 0.25 : -0.4
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
  return (
    <mesh geometry={terrain}>
      <meshStandardMaterial vertexColors flatShading />
    </mesh>
  )
}

function Sea() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = -0.3 + Math.sin(clock.elapsedTime) * 0.03
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[60, 40]} />
      <meshStandardMaterial color="#4fc3f7" transparent opacity={0.75} />
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
  const pins = items.filter((h) => isJejuCoord(h.lat, h.lng))
  return (
    <Canvas camera={{ position: [0, 8, 10], fov: 50 }} style={{ height }} data-testid="jeju-canvas" onPointerMissed={() => onSelect?.(null)}>
      <color attach="background" args={['#cfe9f7']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 5]} intensity={1.2} />
      <Sea />
      <Island />
      {pins.map((h, i) => (
        <Pin key={`${h.source}-${h.name}-${i}`} item={h} selected={selected === h} onSelect={onSelect} />
      ))}
      <OrbitControls autoRotate={autoRotate} autoRotateSpeed={0.6} maxPolarAngle={Math.PI / 2.1} minDistance={4} maxDistance={22} />
    </Canvas>
  )
}
