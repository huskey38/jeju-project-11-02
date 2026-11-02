// 오름 등급 엠블럼: 현무암(검은 돌)과 감귤로 그린 그림. 등급이 오를수록 돌이 쌓여 돌담이 되고, 감귤나무에 열매가 늘며, 마지막 등급은 금빛으로 빛남
// level: 0(준비 중) ~ 5(오름 달인)
const STONE = '#3f4147', STONE_HI = '#5a5d65', PORE = '#8b8e96'
const ORANGE = '#f08a24', ORANGE_HI = '#ffc27a', LEAF = '#4f9a4f', LEAF_DK = '#3b7a3b'

const Stone = ({ x, y, w = 22, h = 14 }) => (
  <g transform={`translate(${x} ${y})`}>
    <path d={`M0 ${h * .7}Q${w * .05} ${h * .2} ${w * .3} ${h * .1}Q${w * .55} 0 ${w * .8} ${h * .15}Q${w} ${h * .35} ${w} ${h * .75}Q${w * .8} ${h} ${w * .5} ${h}Q${w * .15} ${h} 0 ${h * .7}Z`} fill={STONE} />
    <path d={`M${w * .12} ${h * .5}Q${w * .2} ${h * .22} ${w * .45} ${h * .2}`} stroke={STONE_HI} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <circle cx={w * .62} cy={h * .45} r="1.1" fill={PORE} /><circle cx={w * .74} cy={h * .66} r=".8" fill={PORE} /><circle cx={w * .35} cy={h * .72} r=".9" fill={PORE} />
  </g>
)
const Tangerine = ({ x, y, r = 5.5 }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill={ORANGE} />
    <circle cx={x - r * .35} cy={y - r * .35} r={r * .3} fill={ORANGE_HI} opacity=".85" />
    <path d={`M${x} ${y - r}q${r * .6} ${-r * .9} ${r * 1.1} ${-r * .5}q${-r * .3} ${r * .8} ${-r * 1.1} ${r * .5}Z`} fill={LEAF} />
  </g>
)
const Sprout = ({ x, y, s = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 0V-9" stroke={LEAF_DK} strokeWidth="1.8" strokeLinecap="round" />
    <path d="M0 -7Q-8 -9 -9 -15Q-1 -14 0 -7Z" fill={LEAF} /><path d="M0 -9Q8 -11 9 -17Q1 -16 0 -9Z" fill={LEAF_DK} />
  </g>
)
// 감귤나무: 줄기 + 잎 덩어리 위에 열매
const Tree = ({ cx, base, fruits }) => (
  <g>
    <path d={`M${cx} ${base}V${base - 12}`} stroke="#6b4a2b" strokeWidth="3" strokeLinecap="round" />
    <ellipse cx={cx} cy={base - 20} rx="15" ry="11" fill={LEAF} /><ellipse cx={cx - 5} cy={base - 23} rx="9" ry="7" fill={LEAF_DK} opacity=".55" />
    {fruits.map(([dx, dy], i) => <Tangerine key={i} x={cx + dx} y={base - 20 + dy} r={4.2} />)}
  </g>
)

export default function TierEmblem({ level = 0, size = 56, className = '', title }) {
  const gold = level >= 5
  return (
    <svg className={`tier-emblem tier-emblem-${level} ${className}`} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title ?? `등급 ${level}`} data-testid="tier-emblem">
      {gold && (
        <g>
          <circle cx="32" cy="30" r="29" fill="#fff4c8" /><circle cx="32" cy="30" r="29" fill="none" stroke="#e6b422" strokeWidth="2" />
          {[[8, 12], [56, 10], [54, 40], [9, 38]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 4}L${x + 1.2} ${y - 1.2}L${x + 4} ${y}L${x + 1.2} ${y + 1.2}L${x} ${y + 4}L${x - 1.2} ${y + 1.2}L${x - 4} ${y}L${x - 1.2} ${y - 1.2}Z`} fill="#f2c230" />)}
        </g>
      )}
      {level === 0 && <Stone x={21} y={36} w={22} h={14} />}
      {level === 1 && <><Stone x={20} y={38} w={24} h={15} /><Sprout x={32} y={39} /></>}
      {level === 2 && <><Stone x={10} y={40} w={24} h={14} /><Stone x={30} y={42} w={24} h={13} /><Stone x={20} y={31} w={22} h={13} /><Sprout x={44} y={43} s={.9} /><Tangerine x={31} y={26} r={5.5} /></>}
      {level >= 3 && (
        <>
          {level >= 4 && <g transform="translate(50 15) scale(.55)"><Tree cx={0} base={36} fruits={[[-4, 2], [4, 0]]} /></g>}
          {level >= 5 && <g transform="translate(14 15) scale(.55)"><Tree cx={0} base={36} fruits={[[-4, 0], [4, 2]]} /></g>}
          <Tree cx={32} base={36} fruits={level === 3 ? [[-6, 2], [6, -1]] : level === 4 ? [[-8, 3], [0, -2], [8, 2], [3, 6]] : [[-9, 3], [-3, -3], [5, -2], [10, 3], [-2, 5], [4, 6]]} />
          <Stone x={4} y={40} w={26} h={15} /><Stone x={28} y={42} w={26} h={14} /><Stone x={42} y={38} w={19} h={13} /><Stone x={16} y={50} w={26} h={11} /><Stone x={40} y={52} w={20} h={10} />
        </>
      )}
    </svg>
  )
}
