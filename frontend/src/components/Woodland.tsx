// A mountain woodland along the bottom of the screen, behind everything:
// snow-capped peaks, pine-covered hills, a cliff with a waterfall into a pool,
// oaks and pines, a squirrel holding an acorn, and fallen leaves. Night forest
// with fireflies in dark mode. Colours are the --wood-* and --water tokens in
// index.css; each layer is one solid colour, so nearer shapes hide farther ones.
//
// Drawn on a 1440×640 canvas, anchored to the bottom. Wide screens show only the
// bottom ~320 units, so everything that matters sits below y≈330.

const W = 1440
const H = 640

type Tree = [x: number, base: number, size: number, kind: 'oak' | 'pine']

// The mountain range, left to right. Peaks marked true get snow.
const RANGE: [x: number, y: number, snow?: boolean][] = [
  [0, 430], [60, 400], [110, 415], [190, 362, true], [250, 395], [300, 382], [380, 420], [450, 372],
  [520, 340, true], [590, 385], [640, 372], [700, 410], [780, 366], [850, 335, true], [930, 390],
  [990, 376], [1060, 410], [1130, 362], [1190, 346], [1250, 330, true], [1320, 376], [1380, 360],
  [1440, 392],
]

const FAR_HILL = 'M0 470 C180 440 320 448 460 462 C600 476 700 436 880 442 C1040 448 1150 470 1280 458 C1360 452 1410 454 1440 456 V640 H0Z'
const BACK_HILL = 'M0 520 C140 495 260 495 400 510 C540 525 640 495 780 498 C940 500 1040 522 1200 515 C1320 508 1400 505 1440 508 V640 H0Z'
const MID_HILL = 'M0 560 C160 540 300 545 440 555 C600 570 720 545 880 548 C1040 550 1160 560 1300 556 C1380 553 1420 550 1440 552 V640 H0Z'
const NEAR_HILL = 'M0 612 C200 600 360 603 520 610 C700 618 860 598 1040 603 C1200 608 1320 618 1440 608 V640 H0Z'
// The cliff the waterfall pours off, in front of the back hills.
const CLIFF = 'M1140 522 L1150 472 L1164 442 L1184 420 L1210 409 L1262 407 L1286 415 L1301 432 L1313 462 L1326 522Z'

/** Roughly where the far hill's top is at x, so its pines stand on it. */
function farHillY(x: number) {
  const pts: [number, number][] = [[0, 470], [200, 446], [460, 462], [560, 468], [700, 446], [880, 442], [1050, 450], [1280, 458], [1440, 456]]
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
  }
  return pts[pts.length - 1][1]
}

// A pine forest on the far hills, in slightly varied sizes.
const FAR: Tree[] = [
  40, 85, 130, 175, 240, 285, 350, 395, 520, 562, 604, 680, 722, 764, 940, 985, 1030, 1095, 1340, 1388, 1432,
].map((x, i): Tree => [x, farHillY(x) + 8, 0.85 + ((i * 7) % 5) * 0.08, 'pine'])

const BACK: Tree[] = [
  [60, 520, 1.9, 'oak'],
  [140, 512, 1.5, 'pine'],
  [190, 508, 1.3, 'pine'],
  [250, 508, 1.6, 'pine'],
  [330, 512, 2.2, 'oak'],
  [420, 520, 1.4, 'pine'],
  [470, 524, 1.5, 'pine'],
  [520, 526, 1.7, 'pine'],
  [600, 516, 1.3, 'pine'],
  [700, 508, 2, 'oak'],
  [800, 506, 1.5, 'pine'],
  [850, 506, 1.6, 'pine'],
  [905, 508, 1.4, 'pine'],
  [960, 512, 1.6, 'pine'],
  [1020, 518, 1.4, 'pine'],
  [1090, 524, 2.1, 'oak'],
  [1380, 514, 1.6, 'pine'],
  [1425, 514, 1.4, 'pine'],
]
// Two pines on top of the cliff.
const CLIFF_TOP: Tree[] = [
  [1178, 432, 1.2, 'pine'],
  [1292, 426, 1.1, 'pine'],
]
const MID: Tree[] = [
  [90, 556, 2.4, 'pine'],
  [200, 552, 3.25, 'oak'],
  [330, 554, 2.6, 'pine'],
  [470, 566, 2.2, 'pine'],
  [600, 572, 2.75, 'pine'],
  [760, 558, 2.6, 'pine'],
  [900, 556, 2.4, 'pine'],
  [1060, 560, 3.5, 'oak'],
  [1360, 562, 2.5, 'pine'],
]
const NEAR: Tree[] = [
  [70, 622, 5.5, 'oak'],
  [300, 614, 3.5, 'pine'],
  [860, 612, 3.2, 'pine'],
  [1410, 622, 5.5, 'oak'],
]

// [x, y, rotation]
const LEAVES: [number, number, number][] = [
  [380, 620, 20], [398, 626, -35], [520, 628, 60], [760, 618, -15], [775, 624, 40],
  [940, 626, 10], [1140, 622, -50], [1162, 628, 25], [1300, 630, -20],
]
const ACORNS: [number, number][] = [[420, 624], [790, 620], [1175, 626]]
const TUFTS = [150, 230, 420, 560, 690, 960, 1080, 1230, 1320]

// [x, y, seconds, delay]
const FIREFLIES: [number, number, number, number][] = [
  [180, 470, 6, 0], [310, 420, 7, 2.5], [450, 500, 5.5, 1], [620, 450, 8, 3.5],
  [760, 520, 6.5, 0.5], [880, 410, 7.5, 4], [1010, 480, 6, 2], [1150, 440, 8.5, 1.5],
  [1290, 500, 5, 3], [540, 560, 7, 5], [1060, 575, 6, 4.5], [250, 540, 8, 6],
]

// The waterfall: pours off the cliff and lands in a pool on the middle hill.
const FALL_TOP = 410
const FALL_FOOT = 566
const POOL_Y = 560
// [x, seconds]: each streak runs at its own speed so the water doesn't move in step.
const STREAKS: [number, number][] = [[1223, 0.8], [1230, 0.65], [1237, 0.9], [1243, 0.72], [1250, 0.85]]

/** A snow cap following the mountain's slopes down from a peak, with a ragged lower edge. */
function snowCap(i: number) {
  const [px, py] = RANGE[i]
  const [lx, ly] = RANGE[i - 1]
  const [rx, ry] = RANGE[i + 1]
  const depth = 22
  const left = px - ((px - lx) * depth) / (ly - py)
  const right = px + ((rx - px) * depth) / (ry - py)
  return `M${px} ${py} L${right} ${py + depth} L${px + (right - px) * 0.45} ${py + depth - 7} L${px} ${py + depth + 3} L${px - (px - left) * 0.45} ${py + depth - 8} L${left} ${py + depth}Z`
}

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

const trees = (list: Tree[]) => list.map((t) => <TreeShape key={`${t[0]}-${t[1]}`} tree={t} />)

/** Places a small drawing (made around 0,0) at x, y, 2.5 times bigger. */
const at = (x: number, y: number, extra = '') => `translate(${x} ${y}) scale(2.5)${extra}`

export function Woodland() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 -z-1 h-[40vh]">
      <svg className="size-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice">
        <path className="wood-mtn" d={`M${RANGE.map(([x, y]) => `${x} ${y}`).join(' L')} V${H} H0Z`} />
        <g className="wood-snow">
          {RANGE.map(([x, , snow], i) => (snow ? <path key={x} d={snowCap(i)} /> : null))}
        </g>

        <g className="wood-far">
          <path d={FAR_HILL} />
          {trees(FAR)}
        </g>

        <g className="wood-back">
          {trees(BACK)}
          <path d={BACK_HILL} />
        </g>

        <path className="wood-rock" d={CLIFF} />
        <g className="wood-back">{trees(CLIFF_TOP)}</g>

        <g className="wood-water">
          <path d={`M1218 ${FALL_TOP} L1254 ${FALL_TOP} L1262 ${FALL_FOOT} L1210 ${FALL_FOOT}Z`} />
          <ellipse cx={1236} cy={FALL_TOP} rx={20} ry={4} />
        </g>
        <g className="wood-streaks">
          {STREAKS.map(([x, dur], i) => (
            <line
              key={x}
              x1={x}
              y1={FALL_TOP}
              x2={x + (x - 1236) * 0.25}
              y2={FALL_FOOT}
              style={{ animationDuration: `${dur}s`, animationDelay: `${-i * 0.2}s` }}
            />
          ))}
        </g>

        <g className="wood-mid">
          {trees(MID)}
          <path d={MID_HILL} />
        </g>

        {/* The pool at the foot of the waterfall, with mist and spreading ripples. */}
        <g className="wood-water">
          <ellipse cx={1236} cy={POOL_Y + 6} rx={52} ry={9} />
          <g className="wood-mist">
            {[1220, 1236, 1252].map((x, i) => (
              <circle key={x} cx={x} cy={POOL_Y - 2} r={11} style={{ animationDelay: `${-i * 0.7}s` }} />
            ))}
          </g>
        </g>
        <g className="wood-ripples">
          {[0, 1.2].map((delay) => (
            <ellipse key={delay} cx={1236} cy={POOL_Y + 6} rx={46} ry={7} style={{ animationDelay: `${delay}s` }} />
          ))}
        </g>

        {/* Fireflies (dark mode only) drift among the trees, in front of the far layers. */}
        <g className="wood-fireflies">
          {FIREFLIES.map(([x, y, dur, delay]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={4} style={{ animationDuration: `${dur}s`, animationDelay: `${delay}s` }} />
          ))}
        </g>

        <g className="wood-near">
          {trees(NEAR)}
          <path d={NEAR_HILL} />
          {TUFTS.map((x) => (
            <path key={x} transform={at(x, 610)} d="M0 0 l3 -9 l2 9 l3 -7 l2 7 l3 -11 l2 11Z" />
          ))}
          {/* A squirrel on the near hill, holding an acorn. */}
          <g transform={at(1000, 606)}>
            <path d="M7 -2 C26 -4 31 -22 23 -34 C17 -44 25 -52 33 -48 C29 -60 10 -58 8 -42 C6 -30 14 -20 3 -9 Z" />
            <ellipse cx="0" cy="-9" rx="9" ry="11" />
            <circle cx="-4" cy="-23" r="7" />
            <path d="M-8 -28 L-6 -36 L-2 -29Z" />
            <ellipse cx="-2" cy="0" rx="7" ry="3" />
          </g>
        </g>

        <g className="wood-leaf">
          {LEAVES.map(([x, y, r]) => (
            <ellipse key={`${x}-${y}`} transform={at(x, y, ` rotate(${r})`)} rx={5} ry={2.2} />
          ))}
          {ACORNS.map(([x, y]) => (
            <g key={x} transform={at(x, y)}>
              <ellipse rx={3} ry={3.8} />
              <path d="M-4 -2.5 Q0 -7 4 -2.5Z M-0.6 -6 h1.2 v-2 h-1.2Z" />
            </g>
          ))}
          {/* The squirrel's acorn. */}
          <ellipse transform={at(1000, 606)} cx={-9} cy={-12} rx={2.6} ry={3.2} />
        </g>
      </svg>
    </div>
  )
}
