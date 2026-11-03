// 오롬이 버튼을 끌어 옮길 때의 위치 계산 (순수 함수 — 화면 안에 머물게 하고, 대화창을 버튼 가까이에 붙임)
export const FAB_SIZE = 56
export const MARGIN = 8

// 버튼의 왼쪽 위 좌표 p({x,y})를 화면(vw×vh) 안으로 가둠
export function clampPos(p, vw, vh, size = FAB_SIZE, margin = MARGIN) {
  return {
    x: Math.min(Math.max(p.x, margin), Math.max(margin, vw - size - margin)),
    y: Math.min(Math.max(p.y, margin), Math.max(margin, vh - size - margin)),
  }
}

// 버튼 위치 기준 대화창 자리: 위쪽에 자리가 있으면 버튼 위에, 없으면 아래에. 가로는 버튼 오른쪽 끝에 맞추되 화면 안으로
export function panelPlace(p, vw, vh, size = FAB_SIZE, w = 380, h = 560, gap = 12) {
  const width = Math.min(w, vw - 32)
  const height = Math.min(h, vh - 130)
  const above = p.y - gap - height >= MARGIN
  const top = above ? p.y - gap - height : Math.min(p.y + size + gap, vh - height - MARGIN)
  const left = Math.min(Math.max(p.x + size - width, 16), Math.max(16, vw - width - 16))
  return { left, top: Math.max(MARGIN, top), right: 'auto', bottom: 'auto', width, height }
}

// 저장된 위치 읽기: 잘못된 값이면 null (기본 자리인 오른쪽 아래)
export function parsePos(text) {
  try {
    const p = JSON.parse(text)
    return Number.isFinite(p?.x) && Number.isFinite(p?.y) ? { x: p.x, y: p.y } : null
  } catch { return null }
}

// 끌기 시작 판정: 이 거리(px)를 넘게 움직여야 '끌기'로 보고 클릭(열기·닫기)으로 치지 않음
export const DRAG_THRESHOLD = 5
export const movedEnough = (dx, dy) => Math.hypot(dx, dy) > DRAG_THRESHOLD
