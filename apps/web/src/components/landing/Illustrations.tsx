/**
 * Small, friendly spot illustrations for "How it works". Pure SVG, drawn on
 * a 200×150 canvas, decorative (the step text carries the meaning).
 */

const HAND =
  'M92 118c-14 0-24-7-31-15L44 84a8 8 0 0 1 12-11l10 9V38a8 8 0 0 1 16 0v30V28a8 8 0 0 1 16 0v40V32a8 8 0 0 1 16 0v38V44a8 8 0 0 1 16 0v40c0 19-14 34-34 34z';

function SproutFace({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0-44v-10" stroke="#1E8C63" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="-9" cy="-56" rx="10" ry="4.5" transform="rotate(-28 -9 -56)" fill="#7FF2E1" />
      <ellipse cx="9" cy="-56" rx="10" ry="4.5" transform="rotate(28 9 -56)" fill="#3DBE8B" />
      <path d="M-34 60c0-26 15-40 34-40s34 14 34 40z" fill="#8FD9B9" />
      <ellipse cx="0" cy="-8" rx="31" ry="37" fill="#EAF7EC" />
      <ellipse cx="-11" cy="-10" rx="4" ry="5.2" fill="#1C2B33" />
      <ellipse cx="11" cy="-10" rx="4" ry="5.2" fill="#1C2B33" />
      <ellipse cx="-19" cy="2" rx="5" ry="3" fill="#FFB4A2" />
      <ellipse cx="19" cy="2" rx="5" ry="3" fill="#FFB4A2" />
      <path d="M-7 6a8 7 0 0 0 14 0" stroke="#1C2B33" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Ghost({ transform, opacity = 1 }: { transform?: string; opacity?: number }) {
  return (
    <g transform={transform} opacity={opacity}>
      <path
        d={HAND}
        fill="rgba(127,242,225,0.22)"
        stroke="#7FF2E1"
        strokeWidth="4"
        strokeLinejoin="round"
        filter="url(#ill-glow)"
      />
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <filter id="ill-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

export function WatchIllustration() {
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true" className="ill">
      <Defs />
      <SproutFace x={86} y={82} s={0.95} />
      <Ghost transform="translate(118 30) scale(0.52) rotate(-10 90 70)" />
      <g fill="#7FF2E1">
        <circle cx="160" cy="26" r="2.5" />
        <circle cx="172" cy="44" r="1.8" />
        <circle cx="150" cy="16" r="1.4" />
      </g>
    </svg>
  );
}

export function StepInsideIllustration() {
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true" className="ill">
      <Defs />
      <g transform="translate(40 12) scale(0.95)">
        <path d={HAND} fill="#F6D2BD" stroke="#16232B" strokeWidth="3.5" strokeLinejoin="round" />
      </g>
      <Ghost transform="translate(46 6) scale(0.95)" />
      <path
        d="M150 36c10 8 14 20 10 34"
        stroke="#FFC857"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="2 7"
      />
      <path
        d="M156 70l4 6 5-7"
        stroke="#FFC857"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FeedbackIllustration() {
  const tips: [number, number, string][] = [
    [67, 80, '#3DBE8B'],
    [90, 38, '#3DBE8B'],
    [105, 28, '#3DBE8B'],
    [121, 32, '#FFC857'],
    [136, 43, '#FF7A59'],
  ];
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true" className="ill">
      <g transform="translate(20 8) scale(0.95)">
        <path d={HAND} fill="#F6D2BD" stroke="#16232B" strokeWidth="3.5" strokeLinejoin="round" />
      </g>
      {tips.map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="10" fill={c} opacity="0.28" />
          <circle cx={x} cy={y} r="5" fill={c} stroke="#FFF8EE" strokeWidth="1.5" />
        </g>
      ))}
      <g transform="translate(120 104)">
        <rect x="0" y="0" width="74" height="30" rx="15" fill="#16232B" />
        <circle cx="15" cy="15" r="5" fill="#FF7A59" />
        <rect x="26" y="11" width="38" height="3.5" rx="1.75" fill="#FFF8EE" opacity="0.9" />
        <rect x="26" y="17.5" width="26" height="3.5" rx="1.75" fill="#FFF8EE" opacity="0.5" />
      </g>
    </svg>
  );
}

export function GardenIllustration() {
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true" className="ill">
      <ellipse cx="100" cy="128" rx="86" ry="12" fill="#E3CFB2" />
      {/* sprout */}
      <g transform="translate(40 126)">
        <path d="M0 0v-22" stroke="#1E8C63" strokeWidth="3.5" strokeLinecap="round" />
        <ellipse cx="-7" cy="-24" rx="8" ry="4" transform="rotate(-30 -7 -24)" fill="#7FF2E1" />
        <ellipse cx="7" cy="-25" rx="8" ry="4" transform="rotate(30 7 -25)" fill="#3DBE8B" />
      </g>
      {/* bud */}
      <g transform="translate(96 126)">
        <path d="M0 0c0-18 2-32 0-50" stroke="#1E8C63" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <ellipse cx="-10" cy="-24" rx="11" ry="5" transform="rotate(-25 -10 -24)" fill="#3DBE8B" />
        <ellipse cx="10" cy="-34" rx="11" ry="5" transform="rotate(25 10 -34)" fill="#3DBE8B" />
        <ellipse cx="0" cy="-58" rx="8" ry="11" fill="#8E7DFF" />
        <path d="M-7-52q7 8 14 0" fill="#3DBE8B" />
      </g>
      {/* bloom */}
      <g transform="translate(156 126)">
        <path d="M0 0c0-22-3-40 0-66" stroke="#1E8C63" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <ellipse cx="-11" cy="-26" rx="12" ry="5.5" transform="rotate(-25 -11 -26)" fill="#3DBE8B" />
        <ellipse cx="11" cy="-40" rx="12" ry="5.5" transform="rotate(25 11 -40)" fill="#3DBE8B" />
        <g transform="translate(0 -76)">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx="0" cy="-12" rx="8" ry="12" fill="#FF7A59" transform={`rotate(${a})`} />
          ))}
          <circle r="7" fill="#FFC857" />
        </g>
      </g>
      <g fill="#FFC857">
        <path d="M128 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
      </g>
    </svg>
  );
}
