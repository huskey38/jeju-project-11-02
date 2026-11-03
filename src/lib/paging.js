// 쪽 번호 계산 (오름 목록의 1·2·3… 쪽 넘기기)
export const pageCount = (total, per) => Math.max(1, Math.ceil((Number(total) || 0) / per))

// 보여 줄 쪽 번호: 현재 쪽 둘레로 연속 5개(처음·끝 근처에서도 항상 5개)와 맨 처음·맨 끝. 사이가 한 쪽만 비면 그 번호, 더 비면 '…'
// 예) page 1 / 31 → [1, 2, 3, 4, 5, '…', 31]   page 8 / 31 → [1, '…', 6, 7, 8, 9, 10, '…', 31]
export function pageList(page, pages, size = 5) {
  const start = Math.max(1, Math.min(page - Math.floor(size / 2), pages - size + 1))
  const keep = new Set([1, pages])
  for (let n = start; n < start + size && n <= pages; n++) keep.add(n)
  const nums = [...keep].sort((a, b) => a - b)
  const out = []
  nums.forEach((n, i) => {
    const prev = nums[i - 1]
    if (prev !== undefined && n - prev === 2) out.push(prev + 1)
    else if (prev !== undefined && n - prev > 2) out.push('…')
    out.push(n)
  })
  return out
}
