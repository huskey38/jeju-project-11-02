// 3D 지도의 분위기: 오름 등반률이 오를수록 하늘과 바다가 살아남 — 흐린 새벽 회청색 → 맑은 청록 → 노을빛 황금
// 새로 그리는 물체 없이 색만 바꾸므로 렉이 없음. percent(0~100)를 받아 색 문자열을 돌려줌
const STOPS = [
  { at: 0, skyTop: '#a9b5be', skyHorizon: '#d6dcde', seaShallow: '#86a9b5', seaDeep: '#52798a', light: '#f2f4f6' },   // 흐린 새벽
  { at: 5, skyTop: '#9fc3d6', skyHorizon: '#d9e8ee', seaShallow: '#6fb6c6', seaDeep: '#418aa3', light: '#f6f8f8' },
  { at: 15, skyTop: '#8fc7e6', skyHorizon: '#e1f1f4', seaShallow: '#63c1d0', seaDeep: '#3092b2', light: '#fffdf4' },
  { at: 35, skyTop: '#7bbfe8', skyHorizon: '#eaf6f4', seaShallow: '#55cbd3', seaDeep: '#2a99bf', light: '#fff9e6' },
  { at: 60, skyTop: '#f3a96b', skyHorizon: '#ffe3a8', seaShallow: '#62d0cc', seaDeep: '#3a90b0', light: '#ffeec8' },    // 노을빛 황금
]

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const hex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
const mix = (a, b, t) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t))

export function atmosphereAt(percent = 0) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0))
  let k = STOPS.findIndex((s) => p < s.at)
  if (k === -1) return { ...STOPS.at(-1) }
  if (k === 0) return { ...STOPS[0] }
  const a = STOPS[k - 1], b = STOPS[k], t = (p - a.at) / (b.at - a.at)
  return Object.fromEntries(Object.keys(a).filter((key) => key !== 'at').map((key) => [key, mix(a[key], b[key], t)]))
}
