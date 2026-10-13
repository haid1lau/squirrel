import { useEffect, useId, useRef } from 'react'
import { useReducedMotion } from '../../lib/motion'

// Snowball, a white squirrel on a tree stump spinning an acorn on one finger
// (from "Snowball the Squirrel.html"). Beside "Ready when you are." on the
// landing page. The acorn's stripes and scales slide sideways to fake the spin,
// it wobbles on the fingertip, and Snowball breathes, sways its tail and blinks.
// It only moves while on screen, and stays still with Reduce Motion.

const SPEED = 16 // radians a second, about 150 rpm
const mod = (a: number, n: number) => ((a % n) + n) % n

export function Snowball({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  const uid = useId()
  const nutClip = `${uid}-nut`
  const capClip = `${uid}-cap`
  const nutShade = `${uid}-shade`

  const svgRef = useRef<SVGSVGElement>(null)
  const wobble = useRef<SVGGElement>(null)
  const nutStripes = useRef<SVGGElement>(null)
  const capScales = useRef<SVGGElement>(null)
  const stem = useRef<SVGPathElement>(null)
  const swooshFront = useRef<SVGGElement>(null)
  const swooshBack = useRef<SVGGElement>(null)
  const tail = useRef<SVGGElement>(null)
  const torso = useRef<SVGGElement>(null)
  const eyes = useRef<SVGGElement>(null)
  const arm = useRef<SVGGElement>(null)
  const head = useRef<SVGGElement>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (reduced || !svg) return
    let raf = 0
    let last = performance.now()
    let t = 0
    let nextBlink = 2
    let blinkT = -1
    const set = (el: Element | null | undefined, attr: string, value: string | number) =>
      el?.setAttribute(attr, String(value))

    function frame(now: number) {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      t += dt
      const angle = t * SPEED

      // The spin: surface details slide sideways and the swooshes run round.
      set(nutStripes.current, 'transform', `translate(${mod(angle * 7, 11)} 0)`)
      set(capScales.current, 'transform', `translate(${mod(angle * 7, 10)} 0)`)
      const sx = Math.sin(angle) * 4
      set(stem.current, 'd', `M${sx * 0.4} -62 L ${3 * Math.cos(angle) + sx} -73`)
      set(swooshFront.current?.firstElementChild, 'stroke-dashoffset', -angle * 12)
      set(swooshBack.current?.firstElementChild, 'stroke-dashoffset', angle * 12)

      // The acorn wobbles on the fingertip, and the rest of Snowball moves gently.
      set(wobble.current, 'transform', `rotate(${Math.sin(t * 4.2) * 6.6})`)
      set(arm.current, 'transform', `rotate(${Math.cos(t * 4.2) * 1.2} 252 268)`)
      set(tail.current, 'transform', `rotate(${Math.sin(t * 1.5) * 3} 170 380)`)
      set(torso.current, 'transform', `translate(200 318) scale(${1 + Math.sin(t * 2.2) * 0.012}) translate(-200 -318)`)
      set(head.current, 'transform', `rotate(${4 + Math.sin(t * 1.1) * 1.5} 200 250)`)

      // A blink every 2 to 5 seconds.
      if (t > nextBlink && blinkT < 0) blinkT = 0
      let k = 1
      if (blinkT >= 0) {
        blinkT += dt
        k = Math.max(0.08, blinkT < 0.08 ? 1 - blinkT / 0.08 : Math.min(1, (blinkT - 0.08) / 0.1))
        if (blinkT > 0.18) {
          blinkT = -1
          nextBlink = t + 2 + Math.random() * 3
          k = 1
        }
      }
      set(eyes.current, 'transform', `translate(0 202) scale(1 ${k}) translate(0 -202)`)
    }

    // Only animate while Snowball is on screen.
    const seen = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf)
      if (e.isIntersecting) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    })
    seen.observe(svg)
    return () => {
      seen.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [reduced])

  return (
    <svg
      ref={svgRef}
      viewBox="20 40 380 450"
      role="img"
      aria-label="Snowball, a white squirrel on a tree stump, spinning an acorn on one finger"
      className={className}
    >
      <defs>
        <clipPath id={nutClip}>
          <path d="M0 0 C -15 -8 -23 -24 -23 -38 L 23 -38 C 23 -24 15 -8 0 0 Z" />
        </clipPath>
        <clipPath id={capClip}>
          <path d="M -27 -35 C -29 -52 -15 -63 0 -63 C 15 -63 29 -52 27 -35 Q 0 -29 -27 -35 Z" />
        </clipPath>
        <radialGradient id={nutShade} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#c98a4a" />
          <stop offset="0.6" stopColor="#a5622a" />
          <stop offset="1" stopColor="#6e3d16" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx="205" cy="476" rx="175" ry="12" fill="var(--color-shadow)" opacity="0.5" />

      {/* stump */}
      <g>
        <path d="M58 400 L52 462 Q 120 484 205 484 Q 290 484 358 462 L352 400 Z" fill="#6a4a30" />
        <g stroke="#4f3520" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8">
          <path d="M85 420 Q 82 440 86 466" />
          <path d="M120 425 Q 118 450 121 476" />
          <path d="M165 428 Q 163 455 166 480" />
          <path d="M210 430 Q 212 455 209 482" />
          <path d="M255 428 Q 258 452 254 478" />
          <path d="M298 424 Q 301 448 297 472" />
          <path d="M332 418 Q 334 438 331 462" />
        </g>
        <ellipse cx="205" cy="400" rx="148" ry="28" fill="#6b4a2e" />
        <ellipse cx="205" cy="399" rx="138" ry="24" fill="#d6b183" />
        <g fill="none" stroke="#a87a4a" strokeWidth="1.6" opacity="0.8">
          <ellipse cx="205" cy="399" rx="112" ry="19" />
          <ellipse cx="205" cy="399" rx="86" ry="14.5" />
          <ellipse cx="205" cy="399" rx="60" ry="10" />
          <ellipse cx="205" cy="399" rx="34" ry="6" />
        </g>
      </g>

      {/* spare acorns */}
      <g transform="translate(92 398) rotate(-80)">
        <path d="M0 0 C -11 -6 -17 -18 -17 -28 L 17 -28 C 17 -18 11 -6 0 0 Z" fill={`url(#${nutShade})`} />
        <path d="M -20 -26 C -21 -38 -11 -46 0 -46 C 11 -46 21 -38 20 -26 Q 0 -22 -20 -26 Z" fill="#5e3e22" />
      </g>
      <g transform="translate(318 402) rotate(95)">
        <path d="M0 0 C -11 -6 -17 -18 -17 -28 L 17 -28 C 17 -18 11 -6 0 0 Z" fill={`url(#${nutShade})`} />
        <path d="M -20 -26 C -21 -38 -11 -46 0 -46 C 11 -46 21 -38 20 -26 Q 0 -22 -20 -26 Z" fill="#5e3e22" />
      </g>

      {/* squirrel */}
      <g stroke="#cdc3b6" strokeWidth="3" strokeLinejoin="round">
        {/* tail */}
        <g ref={tail}>
          <path
            fill="#f6f3ee"
            d="M178 388 C 92 398 42 334 58 262 C 68 214 104 194 94 148 C 84 102 110 60 156 62 C 198 64 210 102 188 122 C 172 136 150 126 154 108 C 140 124 134 152 146 182 C 160 222 150 272 166 326 Z"
          />
          <g fill="none" stroke="#e2dbd0" strokeWidth="2.5" strokeLinecap="round">
            <path d="M84 300 Q 100 270 92 240" />
            <path d="M110 330 Q 124 300 116 270" />
            <path d="M104 200 Q 122 170 112 140" />
            <path d="M128 100 Q 146 84 166 92" />
          </g>
        </g>

        {/* haunches and feet */}
        <ellipse cx="150" cy="364" rx="40" ry="34" fill="#f6f3ee" />
        <ellipse cx="250" cy="364" rx="40" ry="34" fill="#f6f3ee" />
        <ellipse cx="166" cy="398" rx="30" ry="12" fill="#f6f3ee" />
        <ellipse cx="234" cy="398" rx="30" ry="12" fill="#f6f3ee" />

        {/* body */}
        <g ref={torso}>
          <ellipse cx="200" cy="318" rx="70" ry="84" fill="#f6f3ee" />
          <ellipse cx="200" cy="334" rx="46" ry="62" fill="#ffffff" stroke="none" />
        </g>

        {/* resting arm */}
        <path d="M150 272 Q 140 306 178 318" fill="none" stroke="#cdc3b6" strokeWidth="27" strokeLinecap="round" />
        <path d="M150 272 Q 140 306 178 318" fill="none" stroke="#f6f3ee" strokeWidth="21" strokeLinecap="round" />
        <circle cx="184" cy="318" r="12" fill="#f6f3ee" />

        {/* spinning arm */}
        <g ref={arm}>
          <path d="M248 268 Q 296 282 300 214" fill="none" stroke="#cdc3b6" strokeWidth="27" strokeLinecap="round" />
          <path d="M248 268 Q 296 282 300 214" fill="none" stroke="#f6f3ee" strokeWidth="21" strokeLinecap="round" />
          <circle cx="300" cy="206" r="14" fill="#f6f3ee" />
          <path d="M300 196 L 300 172" fill="none" stroke="#cdc3b6" strokeWidth="10" strokeLinecap="round" />
          <path d="M300 196 L 300 172" fill="none" stroke="#f6f3ee" strokeWidth="5" strokeLinecap="round" />

          {/* acorn, tip resting on the fingertip */}
          <g transform="translate(300 166)">
            <g ref={wobble} stroke="none">
              <g
                ref={swooshBack}
                fill="none"
                stroke="var(--color-cta)"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.29"
              >
                <path d="M -38 -32 A 38 9 0 0 1 38 -32" strokeDasharray="26 34" />
              </g>
              <path d="M0 0 C -15 -8 -23 -24 -23 -38 L 23 -38 C 23 -24 15 -8 0 0 Z" fill={`url(#${nutShade})`} />
              <g clipPath={`url(#${nutClip})`}>
                <g ref={nutStripes} stroke="#6e3d16" strokeWidth="2.2" opacity="0.35">
                  <line x1="-44" y1="0" x2="-44" y2="-40" />
                  <line x1="-33" y1="0" x2="-33" y2="-40" />
                  <line x1="-22" y1="0" x2="-22" y2="-40" />
                  <line x1="-11" y1="0" x2="-11" y2="-40" />
                  <line x1="0" y1="0" x2="0" y2="-40" />
                  <line x1="11" y1="0" x2="11" y2="-40" />
                  <line x1="22" y1="0" x2="22" y2="-40" />
                  <line x1="33" y1="0" x2="33" y2="-40" />
                </g>
                <ellipse cx="-9" cy="-26" rx="5" ry="9" fill="#ffe2bd" opacity="0.4" />
              </g>
              <path d="M -27 -35 C -29 -52 -15 -63 0 -63 C 15 -63 29 -52 27 -35 Q 0 -29 -27 -35 Z" fill="#5e3e22" />
              <g clipPath={`url(#${capClip})`}>
                <g ref={capScales} fill="none" stroke="#3a2512" strokeWidth="1.6" opacity="0.7">
                  <path d="M -50 -38 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0" />
                  <path d="M -45 -46 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0" />
                  <path d="M -50 -54 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0" />
                  <path d="M -45 -62 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0 q 5 -5 10 0" />
                </g>
              </g>
              <path ref={stem} d="M0 -62 L 3 -73" stroke="#4a3018" strokeWidth="4" strokeLinecap="round" />
              <g
                ref={swooshFront}
                fill="none"
                stroke="var(--color-cta)"
                strokeWidth="2.4"
                strokeLinecap="round"
                opacity="0.45"
              >
                <path d="M -38 -32 A 38 9 0 0 0 38 -32" strokeDasharray="30 30" />
              </g>
            </g>
          </g>
        </g>

        {/* head */}
        <g ref={head}>
          <path d="M152 186 L 146 126 Q 150 118 158 124 L 186 162 Z" fill="#f6f3ee" />
          <path d="M248 186 L 254 126 Q 250 118 242 124 L 214 162 Z" fill="#f6f3ee" />
          <path d="M158 176 L 154 140 L 176 164 Z" fill="#f1a7b4" stroke="none" />
          <path d="M242 176 L 246 140 L 224 164 Z" fill="#f1a7b4" stroke="none" />
          <ellipse cx="200" cy="206" rx="62" ry="56" fill="#f6f3ee" />
          <ellipse cx="170" cy="230" rx="25" ry="19" fill="#ffffff" stroke="none" />
          <ellipse cx="230" cy="230" rx="25" ry="19" fill="#ffffff" stroke="none" />
          <ellipse cx="200" cy="232" rx="20" ry="16" fill="#ffffff" stroke="none" />
          <ellipse cx="160" cy="232" rx="9" ry="5" fill="#f1a7b4" opacity="0.45" stroke="none" />
          <ellipse cx="240" cy="232" rx="9" ry="5" fill="#f1a7b4" opacity="0.45" stroke="none" />
          <g ref={eyes} stroke="none">
            <ellipse cx="179" cy="202" rx="9.5" ry="12" fill="#1a120e" />
            <ellipse cx="221" cy="202" rx="9.5" ry="12" fill="#1a120e" />
            <circle cx="183" cy="197" r="3.6" fill="#fff" />
            <circle cx="225" cy="197" r="3.6" fill="#fff" />
            <circle cx="177" cy="207" r="1.6" fill="#fff" />
            <circle cx="219" cy="207" r="1.6" fill="#fff" />
          </g>
          <path d="M193 222 Q 200 218 207 222 Q 204 229 200 230 Q 196 229 193 222 Z" fill="#e88d9d" stroke="none" />
          <path
            d="M200 230 L 200 236 M 191 236 Q 196 241 200 236 Q 204 241 209 236"
            fill="none"
            stroke="#9c8a7a"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="196" y="238" width="8" height="8" rx="1.5" fill="#fffaf0" stroke="#cdc3b6" strokeWidth="1.2" />
          <line x1="200" y1="238" x2="200" y2="246" stroke="#cdc3b6" strokeWidth="1" />
        </g>
      </g>
    </svg>
  )
}
