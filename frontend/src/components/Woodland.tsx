// A soft woodland along the bottom of the screen, behind everything: far hills,
// a row of oaks and pines, a near hill with a squirrel holding an acorn, and
// fallen leaves. Night forest with fireflies in dark mode. Colours and layer
// opacities are the --wood-* tokens in index.css.

type Tree = [x: number, base: number, size: number, kind: 'oak' | 'pine']

const FAR: Tree[] = [
  [100, 152, 0.45, 'pine'],
  [390, 146, 0.4, 'pine'],
  [560, 162, 0.45, 'pine'],
  [845, 122, 0.4, 'pine'],
  [885, 120, 0.5, 'pine'],
  [1180, 148, 0.45, 'pine'],
  [1300, 136, 0.4, 'pine'],
]
const BACK: Tree[] = [
  [60, 180, 0.8, 'oak'],
  [150, 166, 0.6, 'pine'],
  [240, 164, 0.7, 'pine'],
  [330, 170, 0.9, 'oak'],
  [520, 180, 0.7, 'pine'],
  [700, 168, 0.8, 'oak'],
  [820, 160, 0.6, 'pine'],
  [930, 172, 0.75, 'pine'],
  [1110, 180, 0.9, 'oak'],
  [1250, 174, 0.65, 'pine'],
  [1380, 170, 0.8, 'oak'],
]
const MID: Tree[] = [
  [200, 202, 1.3, 'oak'],
  [600, 212, 1.1, 'pine'],
  [1200, 208, 1.4, 'oak'],
]
const NEAR: Tree[] = [
  [70, 234, 2.4, 'oak'],
  [1380, 234, 2.2, 'oak'],
]

// [x, y, rotation]
const LEAVES: [number, number, number][] = [
  [300, 226, 20], [318, 229, -35], [470, 230, 60], [760, 224, -15], [775, 228, 40],
  [905, 229, 10], [1140, 227, -50], [1162, 230, 25], [1290, 231, -20],
]
const ACORNS: [number, number][] = [[340, 228], [790, 226], [1175, 229]]
const TUFTS = [150, 260, 420, 560, 690, 860, 960, 1080, 1230, 1320]

// [x, y, seconds, delay]
const FIREFLIES: [number, number, number, number][] = [
  [180, 130, 6, 0], [310, 95, 7, 2.5], [450, 150, 5.5, 1], [620, 120, 8, 3.5],
  [760, 160, 6.5, 0.5], [880, 90, 7.5, 4], [1010, 140, 6, 2], [1150, 110, 8.5, 1.5],
  [1290, 150, 5, 3], [540, 180, 7, 5], [1060, 185, 6, 4.5], [250, 175, 8, 6],
]

function TreeShape({ tree: [x, base, s, kind] }: { tree: Tree }) {
  if (kind === 'pine') {
    const w = 14 * s
    const tier = (top: number, half: number, bottom: number) =>
      `M${x} ${base - top * s} L${x + half} ${base - bottom * s} L${x - half} ${base - bottom * s}Z`
    return (
      <g>
        <rect x={x - 2 * s} y={base - 10 * s} width={4 * s} height={12 * s} />
        <path d={tier(56, w * 0.55, 30) + tier(42, w * 0.8, 16) + tier(28, w, 4)} />
      </g>
    )
  }
  return (
    <g>
      <path d={`M${x - 3 * s} ${base} L${x - 2 * s} ${base - 26 * s} L${x + 2 * s} ${base - 26 * s} L${x + 3 * s} ${base}Z`} />
      <circle cx={x} cy={base - 30 * s} r={16 * s} />
      <circle cx={x - 13 * s} cy={base - 22 * s} r={11 * s} />
      <circle cx={x + 13 * s} cy={base - 23 * s} r={12 * s} />
      <circle cx={x - 5 * s} cy={base - 40 * s} r={11 * s} />
      <circle cx={x + 8 * s} cy={base - 39 * s} r={10 * s} />
    </g>
  )
}

export function Woodland() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 -z-1 h-[clamp(160px,22vw,300px)]">
      <svg className="size-full" viewBox="0 0 1440 240" preserveAspectRatio="xMidYMax slice">
        <g className="wood-fireflies">
          {FIREFLIES.map(([x, y, dur, delay]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={3.6} style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
          ))}
        </g>

        <g className="wood-far">
          <path d="M0 150 C180 110 320 120 460 140 C600 160 700 105 880 112 C1040 118 1150 150 1280 132 C1360 122 1410 126 1440 130 V240 H0Z" />
          {FAR.map((t) => <TreeShape key={t[0]} tree={t} />)}
        </g>

        <g className="wood-back">
          {BACK.map((t) => <TreeShape key={t[0]} tree={t} />)}
          <path d="M0 176 C140 150 260 150 400 165 C540 180 640 150 780 152 C940 155 1040 178 1200 168 C1320 160 1400 158 1440 162 V240 H0Z" />
        </g>

        <g className="wood-mid">
          {MID.map((t) => <TreeShape key={t[0]} tree={t} />)}
          <path d="M0 200 C160 182 300 186 440 196 C600 208 720 186 880 188 C1040 190 1160 206 1300 198 C1380 194 1420 192 1440 194 V240 H0Z" />
        </g>

        <g className="wood-near">
          {NEAR.map((t) => <TreeShape key={t[0]} tree={t} />)}
          <path d="M0 222 C200 212 360 214 520 220 C700 226 860 210 1040 214 C1200 218 1320 226 1440 218 V240 H0Z" />
          {TUFTS.map((x) => (
            <path key={x} d={`M${x} 222 l3 -9 l2 9 l3 -7 l2 7 l3 -11 l2 11Z`} />
          ))}
          {/* A squirrel on the near hill, holding an acorn. */}
          <g transform="translate(1000 216)">
            <path d="M7 -2 C26 -4 31 -22 23 -34 C17 -44 25 -52 33 -48 C29 -60 10 -58 8 -42 C6 -30 14 -20 3 -9 Z" />
            <ellipse cx="0" cy="-9" rx="9" ry="11" />
            <circle cx="-4" cy="-23" r="7" />
            <path d="M-8 -28 L-6 -36 L-2 -29Z" />
            <ellipse cx="-2" cy="0" rx="7" ry="3" />
          </g>
        </g>

        <g className="wood-leaf">
          {LEAVES.map(([x, y, r]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={5} ry={2.2} transform={`rotate(${r} ${x} ${y})`} />
          ))}
          {ACORNS.map(([x, y]) => (
            <g key={x}>
              <ellipse cx={x} cy={y} rx={3} ry={3.8} />
              <path d={`M${x - 4} ${y - 2.5} Q${x} ${y - 7} ${x + 4} ${y - 2.5}Z M${x - 0.6} ${y - 6} h1.2 v-2 h-1.2Z`} />
            </g>
          ))}
          {/* The squirrel's acorn. */}
          <ellipse cx={991} cy={204} rx={2.6} ry={3.2} />
        </g>
      </svg>
    </div>
  )
}
