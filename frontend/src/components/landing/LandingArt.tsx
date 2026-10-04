// The landing page's drawings, from the Claude Design file "Squirrel Login":
// an acorn, and squirrels with a coffee, pizza, lounge pass, cake, TV and plane.
// Mounted once on the landing page; drawn with <use href="#land-…" />.

export function LandingArt() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <symbol id="land-sq-acorn" viewBox="0 0 40 52">
          <ellipse cx="20" cy="33" rx="14" ry="16" fill="#E0A93B" />
          <ellipse cx="14" cy="35" rx="3" ry="7" fill="#FFF3C4" opacity=".6" />
          <path d="M5 25 C5 9 35 9 35 25 Q20 30 5 25Z" fill="#7A4A22" />
          <rect x="18" y="3" width="4" height="9" rx="2" fill="#5A3416" />
        </symbol>
        <g id="land-sq-head">
          <ellipse
            cx="-19"
            cy="-26"
            rx="9"
            ry="14"
            transform="rotate(-18 -19 -26)"
            fill="#fff"
            stroke="#2b2520"
            strokeWidth="4"
          />
          <ellipse cx="-19" cy="-25" rx="4" ry="8" transform="rotate(-18 -19 -26)" fill="#f4a6a6" />
          <ellipse
            cx="19"
            cy="-26"
            rx="9"
            ry="14"
            transform="rotate(18 19 -26)"
            fill="#fff"
            stroke="#2b2520"
            strokeWidth="4"
          />
          <ellipse cx="19" cy="-25" rx="4" ry="8" transform="rotate(18 19 -26)" fill="#f4a6a6" />
          <circle r="30" fill="#fff" stroke="#2b2520" strokeWidth="4" />
          <circle cx="-18" cy="9" r="6" fill="#f4a6a6" opacity="0.75" />
          <circle cx="18" cy="9" r="6" fill="#f4a6a6" opacity="0.75" />
          <rect x="-3.5" y="12" width="7" height="5" rx="1.5" fill="#fff" stroke="#2b2520" strokeWidth="2" />
          <path
            d="M-6 11 Q-3 15 0 11 Q3 15 6 11"
            fill="none"
            stroke="#2b2520"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="0" cy="5" rx="4.5" ry="3.2" fill="#2b2520" />
        </g>

        <g id="land-eyes-open">
          <circle cx="-11" cy="-4" r="4.5" fill="#2b2520" />
          <circle cx="-9.5" cy="-5.5" r="1.6" fill="#fff" />
          <circle cx="11" cy="-4" r="4.5" fill="#2b2520" />
          <circle cx="12.5" cy="-5.5" r="1.6" fill="#fff" />
        </g>

        <g id="land-eyes-happy" fill="none" stroke="#2b2520" strokeWidth="3.5" strokeLinecap="round">
          <path d="M-16 -2 Q-11 -10 -6 -2" />
          <path d="M6 -2 Q11 -10 16 -2" />
        </g>

        <g id="land-eyes-calm" fill="none" stroke="#2b2520" strokeWidth="3.5" strokeLinecap="round">
          <path d="M-16 -5 Q-11 1 -6 -5" />
          <path d="M6 -5 Q11 1 16 -5" />
        </g>

        <g id="land-sq-tail">
          <path
            d="M0 0 C40 4 62 -30 52 -62 C46 -82 58 -96 72 -92 C70 -116 34 -122 26 -88 C20 -62 36 -42 18 -20 C12 -12 4 -6 0 0 Z"
            fill="#fff"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M36 -70 C40 -58 38 -46 32 -36"
            fill="none"
            stroke="#2b2520"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.3"
          />
        </g>

        <g id="land-sq-body">
          <ellipse rx="27" ry="31" fill="#fff" stroke="#2b2520" strokeWidth="4" />
          <ellipse cy="5" rx="15" ry="21" fill="#f1e9dd" />
        </g>

        <ellipse id="land-sq-foot" rx="11" ry="7" fill="#fff" stroke="#2b2520" strokeWidth="4" />

        <circle id="land-sq-hand" r="7" fill="#fff" stroke="#2b2520" strokeWidth="4" />

        <g id="land-ic-coffee">
          <ellipse cx="100" cy="182" rx="72" ry="5" fill="#2b2520" opacity="0.12" />
          <use href="#land-sq-tail" transform="translate(118 150) scale(0.78)" />
          <use href="#land-sq-foot" transform="translate(84 172)" />
          <use href="#land-sq-foot" transform="translate(116 172)" />
          <use href="#land-sq-body" transform="translate(100 134)" />
          <use href="#land-sq-head" transform="translate(100 80)" />
          <use href="#land-eyes-calm" transform="translate(100 80)" />
          <path d="M80 122 L72 142" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M80 122 L72 142" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <path d="M120 122 L130 142" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M120 122 L130 142" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <path
            d="M120 128 C140 128 140 156 120 156"
            fill="none"
            stroke="#2b2520"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M120 128 C140 128 140 156 120 156"
            fill="none"
            stroke="oklch(0.75 0.15 55)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M74 118 L126 118 L122 162 C121 168 116 172 110 172 L90 172 C84 172 79 168 78 162 Z"
            fill="oklch(0.75 0.15 55)"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <ellipse cx="100" cy="119" rx="25" ry="5" fill="#7A4A22" stroke="#2b2520" strokeWidth="3" />
          <path
            d="M100 156 C90 148 90 140 96 140 C99 140 100 143 100 144 C100 143 101 140 104 140 C110 140 110 148 100 156 Z"
            fill="#fff"
          />
          <path
            d="M64 112 q-6 -8 0 -16 t0 -16"
            fill="none"
            stroke="#2b2520"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.35"
          />
          <path
            d="M140 112 q6 -8 0 -16 t0 -16"
            fill="none"
            stroke="#2b2520"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.35"
          />
          <use href="#land-sq-hand" transform="translate(72 144)" />
          <use href="#land-sq-hand" transform="translate(131 143)" />
        </g>

        <g id="land-ic-pizza">
          <ellipse cx="100" cy="182" rx="72" ry="5" fill="#2b2520" opacity="0.12" />
          <use href="#land-sq-tail" transform="translate(118 150) scale(0.78)" />
          <use href="#land-sq-foot" transform="translate(86 172)" />
          <use href="#land-sq-foot" transform="translate(114 172)" />
          <use href="#land-sq-body" transform="translate(100 134)" />
          <use href="#land-sq-head" transform="translate(100 80)" />
          <use href="#land-eyes-happy" transform="translate(100 80)" />
          <path d="M80 124 L76 140" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M80 124 L76 140" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <path d="M120 124 L126 138" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M120 124 L126 138" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <g transform="rotate(-8 100 140)">
            <path
              d="M58 118 Q100 104 142 118 L100 178 Z"
              fill="oklch(0.88 0.13 90)"
              stroke="#2b2520"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path
              d="M56 116 Q100 100 144 116 L141 126 Q100 112 59 126 Z"
              fill="oklch(0.72 0.12 60)"
              stroke="#2b2520"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path
              d="M78 140 q2 8 -2 14 M118 138 q-2 8 2 12"
              fill="none"
              stroke="oklch(0.8 0.14 85)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="84" cy="134" r="6.5" fill="oklch(0.64 0.17 25)" stroke="#2b2520" strokeWidth="3" />
            <circle cx="112" cy="132" r="6" fill="oklch(0.64 0.17 25)" stroke="#2b2520" strokeWidth="3" />
            <circle cx="99" cy="154" r="5.5" fill="oklch(0.64 0.17 25)" stroke="#2b2520" strokeWidth="3" />
            <circle cx="96" cy="138" r="1.8" fill="oklch(0.55 0.12 145)" />
            <circle cx="104" cy="146" r="1.8" fill="oklch(0.55 0.12 145)" />
          </g>
          <use href="#land-sq-hand" transform="translate(74 142)" />
          <use href="#land-sq-hand" transform="translate(128 140)" />
        </g>

        <g id="land-ic-lounge">
          <ellipse cx="100" cy="178" rx="72" ry="5" fill="#2b2520" opacity="0.12" />
          <use href="#land-sq-tail" transform="translate(114 144) scale(-0.62 0.62)" />
          <g transform="rotate(28 46 166)">
            <path d="M41 106 L41 80 M51 106 L51 80" stroke="#2b2520" strokeWidth="4" strokeLinecap="round" />
            <rect x="36" y="74" width="20" height="8" rx="4" fill="#fff" stroke="#2b2520" strokeWidth="3.5" />
            <rect
              x="18"
              y="104"
              width="56"
              height="60"
              rx="9"
              stroke="#2b2520"
              strokeWidth="4"
              fill="oklch(0.66 0.12 200)"
            />
            <path d="M32 106 L32 162 M60 106 L60 162" stroke="#2b2520" strokeWidth="3" opacity="0.35" />
            <circle cx="46" cy="126" r="8" stroke="#2b2520" strokeWidth="2.5" fill="oklch(0.75 0.15 55)" />
            <rect x="38" y="142" width="16" height="9" rx="2" fill="#fff" stroke="#2b2520" strokeWidth="2.5" />
            <circle cx="28" cy="168" r="5" fill="#2b2520" />
            <circle cx="64" cy="168" r="5" fill="#2b2520" />
          </g>
          <use href="#land-sq-foot" transform="translate(118 164) rotate(-12)" />
          <use href="#land-sq-foot" transform="translate(150 162) rotate(10)" />
          <use href="#land-sq-body" transform="translate(134 128)" />
          <use href="#land-sq-head" transform="translate(136 80)" />
          <use href="#land-eyes-open" transform="translate(140 80)" />
          <path d="M118 114 L92 96" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M118 114 L92 96" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <use href="#land-sq-hand" transform="translate(90 95)" />
          <path d="M152 116 L162 138" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M152 116 L162 138" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <use href="#land-sq-hand" transform="translate(163 140)" />
        </g>

        <g id="land-ic-cake">
          <use href="#land-sq-tail" transform="translate(126 140) scale(0.78)" />
          <use href="#land-sq-body" transform="translate(100 124)" />
          <use href="#land-sq-head" transform="translate(100 72)" />
          <use href="#land-eyes-happy" transform="translate(100 72)" />
          <path
            d="M86 46 L100 10 L114 46 Z"
            fill="oklch(0.7 0.15 350)"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M92 30 L108 30 M89 38 L111 38" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="10" r="6" fill="oklch(0.88 0.13 90)" stroke="#2b2520" strokeWidth="3" />
          <path d="M80 112 L62 138" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M80 112 L62 138" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <path d="M120 112 L138 138" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M120 112 L138 138" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <ellipse
            cx="100"
            cy="178"
            rx="74"
            ry="9"
            fill="#fff"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <rect
            x="40"
            y="138"
            width="120"
            height="38"
            rx="9"
            fill="oklch(0.82 0.09 350)"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M40 150 q10 10 20 0 t20 0 t20 0 t20 0 t20 0 t20 0"
            fill="none"
            stroke="#fff"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <rect
            x="60"
            y="112"
            width="80"
            height="28"
            rx="8"
            fill="#fff"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <circle cx="78" cy="126" r="3.5" fill="oklch(0.64 0.17 25)" />
          <circle cx="100" cy="126" r="3.5" fill="oklch(0.66 0.12 200)" />
          <circle cx="122" cy="126" r="3.5" fill="oklch(0.72 0.12 150)" />
          <rect
            x="96"
            y="92"
            width="8"
            height="20"
            rx="3"
            fill="oklch(0.66 0.12 200)"
            stroke="#2b2520"
            strokeWidth="3"
          />
          <path
            d="M100 76 C106 84 105 90 100 90 C95 90 94 84 100 76 Z"
            fill="oklch(0.88 0.13 90)"
            stroke="#2b2520"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <use href="#land-sq-hand" transform="translate(60 140)" />
          <use href="#land-sq-hand" transform="translate(140 140)" />
        </g>

        <g id="land-ic-tv">
          <ellipse cx="100" cy="182" rx="72" ry="5" fill="#2b2520" opacity="0.12" />
          <path d="M54 96 L38 66 M82 96 L98 66" stroke="#2b2520" strokeWidth="4" strokeLinecap="round" />
          <circle cx="38" cy="64" r="5" fill="oklch(0.64 0.17 25)" stroke="#2b2520" strokeWidth="3" />
          <circle cx="98" cy="64" r="5" fill="oklch(0.64 0.17 25)" stroke="#2b2520" strokeWidth="3" />
          <path d="M36 166 L30 180 M100 166 L106 180" stroke="#2b2520" strokeWidth="4" strokeLinecap="round" />
          <rect
            x="16"
            y="96"
            width="104"
            height="72"
            rx="16"
            fill="oklch(0.86 0.16 92)"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <rect
            x="26"
            y="106"
            width="66"
            height="52"
            rx="10"
            fill="oklch(0.8 0.12 210)"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path d="M52 120 L52 144 L70 132 Z" fill="#fff" stroke="#2b2520" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="106" cy="118" r="5" fill="#2b2520" />
          <circle cx="106" cy="136" r="5" fill="#2b2520" />
          <use href="#land-sq-tail" transform="translate(166 158) scale(0.62)" />
          <use href="#land-sq-foot" transform="translate(140 174)" />
          <use href="#land-sq-foot" transform="translate(168 174)" />
          <use href="#land-sq-body" transform="translate(154 140) scale(0.85)" />
          <use href="#land-sq-head" transform="translate(154 94) scale(0.85)" />
          <use href="#land-eyes-happy" transform="translate(154 94) scale(0.85)" />
          <path d="M140 128 L128 146" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M140 128 L128 146" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <rect x="118" y="134" width="12" height="24" rx="4" fill="#2b2520" />
          <circle cx="124" cy="141" r="2.5" fill="oklch(0.64 0.17 25)" />
          <use href="#land-sq-hand" transform="translate(128 148)" />
        </g>

        <g id="land-ic-plane">
          <ellipse cx="44" cy="44" rx="22" ry="11" fill="#fff" opacity="0.8" />
          <ellipse cx="60" cy="38" rx="14" ry="12" fill="#fff" opacity="0.8" />
          <ellipse cx="160" cy="176" rx="24" ry="10" fill="#fff" opacity="0.8" />
          <path
            d="M36 108 L22 64 L44 64 L68 106 Z"
            fill="oklch(0.66 0.12 200)"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <use href="#land-sq-head" transform="translate(124 88) scale(0.8)" />
          <use href="#land-eyes-open" transform="translate(126 88) scale(0.8)" />
          <rect
            x="104"
            y="72"
            width="40"
            height="11"
            rx="5"
            fill="oklch(0.75 0.15 55)"
            stroke="#2b2520"
            strokeWidth="3"
          />
          <path d="M140 104 L164 80" stroke="#2b2520" strokeWidth="15" strokeLinecap="round" />
          <path d="M140 104 L164 80" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
          <path
            d="M24 120 C24 110 34 104 46 104 L148 104 C172 104 188 116 190 128 C188 142 172 150 148 150 L42 150 C32 150 24 142 24 132 Z"
            fill="#fff"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M166 108 C176 111 184 118 187 126 L166 126 Z"
            fill="oklch(0.8 0.12 210)"
            stroke="#2b2520"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <rect x="30" y="134" width="150" height="5" rx="2.5" fill="oklch(0.66 0.12 200)" />
          <circle cx="50" cy="122" r="5" fill="oklch(0.8 0.12 210)" stroke="#2b2520" strokeWidth="2.5" />
          <circle cx="70" cy="122" r="5" fill="oklch(0.8 0.12 210)" stroke="#2b2520" strokeWidth="2.5" />
          <circle cx="90" cy="122" r="5" fill="oklch(0.8 0.12 210)" stroke="#2b2520" strokeWidth="2.5" />
          <circle cx="110" cy="122" r="5" fill="oklch(0.8 0.12 210)" stroke="#2b2520" strokeWidth="2.5" />
          <circle cx="130" cy="122" r="5" fill="oklch(0.8 0.12 210)" stroke="#2b2520" strokeWidth="2.5" />
          <path
            d="M84 136 L62 180 L86 180 L124 136 Z"
            fill="oklch(0.66 0.12 200)"
            stroke="#2b2520"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <use href="#land-sq-hand" transform="translate(166 78)" />
        </g>
      </defs>
    </svg>
  )
}
