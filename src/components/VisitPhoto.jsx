import { useEffect, useRef } from 'react'
import { Button, Spinner } from 'react-bootstrap'
import { usePhotoStore } from '../store/usePhotoStore'

// [오름 인증사진 — 1단계: 본인만 보기] 가본 오름에 내 사진 한 장 올리기·바꾸기·지우기. features.js 의 visitPhoto
//   기본: 정보 카드용(사진 미리보기 + 버튼) / compact: 도감 칸 모서리의 작은 카메라 버튼
export default function VisitPhoto({ oreumId, compact = false }) {
  const id = String(oreumId)
  const photo = usePhotoStore((s) => s.photos[id])
  const busy = usePhotoStore((s) => s.busy[id])
  const load = usePhotoStore((s) => s.load)
  const upload = usePhotoStore((s) => s.upload)
  const remove = usePhotoStore((s) => s.remove)
  const input = useRef(null)
  useEffect(() => { load() }, [load])

  const pick = (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(id, f) }
  const file = <input ref={input} type="file" accept="image/*" hidden onChange={pick} data-testid="photo-input" />

  if (compact) {
    return (
      <>
        <button type="button" className="stamp-cam" onClick={(e) => { e.stopPropagation(); input.current?.click() }} disabled={busy}
          aria-label={photo ? '인증사진 바꾸기' : '인증사진 올리기'} data-testid="photo-cam">
          {busy ? <Spinner size="sm" /> : <i className={`bi ${photo ? 'bi-arrow-repeat' : 'bi-camera-fill'}`} />}
        </button>
        {file}
      </>
    )
  }
  return (
    <div className="visit-photo mb-3" data-testid="visit-photo">
      <div className="d-flex align-items-center gap-2 mb-2">
        <strong className="small"><i className="bi bi-camera-fill me-1 text-warning" />내 인증사진</strong>
        <span className="small text-muted"><i className="bi bi-lock-fill me-1" />나만 볼 수 있어요</span>
      </div>
      {photo && <img src={photo.url} alt="내 인증사진" className="visit-photo-img" data-testid="visit-photo-img" />}
      <div className="d-flex gap-2 mt-2">
        <Button size="sm" variant={photo ? 'outline-success' : 'success'} className="rounded-pill px-3" disabled={busy} onClick={() => input.current?.click()} data-testid="photo-upload">
          {busy ? <><Spinner size="sm" className="me-1" />처리 중...</> : photo ? '사진 바꾸기' : '인증사진 올리기'}
        </Button>
        {photo && <Button size="sm" variant="outline-danger" className="rounded-pill px-3" disabled={busy} onClick={() => remove(id)}>지우기</Button>}
      </div>
      {!photo && <div className="small text-muted mt-1">정상에서 찍은 사진을 한 장 붙여 보세요. 올리기 전에 크기를 줄이고 사진 속 위치 정보는 지워요.</div>}
      {file}
    </div>
  )
}
