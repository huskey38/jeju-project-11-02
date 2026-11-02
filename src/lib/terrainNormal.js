// 높이맵(미터) → 접선 공간 법선 지도(RGBA Uint8)
// 지형 메시는 정점 간격이 넓어(약 175m) 작은 오름·능선의 굴곡이 뭉개지는데, 높이맵(약 44m 간격)에서 직접 계산한 법선 지도를 얹으면
// 같은 메시로도 빛에 따른 음영(입체감)이 훨씬 또렷해집니다.
//
// field: { data: Float32Array(미터), w, h }  — 이미지 첫 행 = 북쪽
// 규칙(three.js): 텍스처 R = +u(동쪽), G = +v(북쪽), B = 위쪽. 데이터는 v=0(남쪽)이 첫 행이어야 하므로 행을 뒤집어 씀.
export function buildNormalMap(field, { width, depth, metersToUnit, strength = 1.5 }) {
  const { data, w, h } = field
  const px = width / (w - 1), pz = depth / (h - 1)            // 픽셀 한 칸의 3D 단위 길이
  const at = (i, j) => data[Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))]
  const out = new Uint8Array(w * h * 4)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const dEast = ((at(i + 1, j) - at(i - 1, j)) * metersToUnit) / (2 * px)    // 동쪽으로 갈수록 높아지는 정도
      const dNorth = ((at(i, j - 1) - at(i, j + 1)) * metersToUnit) / (2 * pz)   // 북쪽(위 행)으로 갈수록 높아지는 정도
      const nx = -dEast * strength, ny = -dNorth * strength
      const len = Math.hypot(nx, ny, 1)
      const o = ((h - 1 - j) * w + i) * 4
      out[o] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
      out[o + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255)
      out[o + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
      out[o + 3] = 255
    }
  }
  return { data: out, w, h }
}
