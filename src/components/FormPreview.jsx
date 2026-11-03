import { OverlayTrigger, Popover } from 'react-bootstrap'
import { FORM_DESC, FORM_GROUPS, pickRep } from '../lib/oreumForms'
import { useOreums } from '../lib/useOreums'
import OreumArt from './OreumArt'

// 형태(원추형·원형·말굽형·복합형) 이름에 마우스를 올리거나 포커스(터치)하면 그 형태의 오름 실루엣을 가볍게 보여 주는 말풍선
// children: 말풍선을 붙일 요소 하나(ref 를 받는 요소) — 메인 소개 카드와 오름 탭의 형태 칩이 함께 씀
const SAMPLE_FORM = { cone: '원추형', round: '원형', horseshoe: '말굽형(북향)', mixed: '복합형' }

export default function FormPreview({ group, children }) {
  const { list } = useOreums()
  const rep = list ? pickRep(list, group) : null
  const label = FORM_GROUPS.find((g) => g.key === group)?.label ?? ''
  const popover = (
    <Popover id={`form-preview-${group}`} className="form-preview" data-testid="form-preview">
      <Popover.Body className="p-2">
        <div className="form-preview-sky">
          <OreumArt form={SAMPLE_FORM[group]} elev={rep?.elev ?? 250} className="form-preview-art" />
        </div>
        <div className="fw-bold mt-2">{label}</div>
        <div className="small text-muted">{FORM_DESC[group]}</div>
        {rep && <div className="small mt-1" data-testid="form-preview-rep">대표 오름 · <strong>{rep.name}</strong>{rep.elev ? ` · ${rep.elev}m` : ''}</div>}
      </Popover.Body>
    </Popover>
  )
  return <OverlayTrigger placement="top" trigger={['hover', 'focus']} delay={{ show: 80, hide: 60 }} overlay={popover}>{children}</OverlayTrigger>
}
