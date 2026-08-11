import { useId } from "react";

// ---------------------------------------------------------------------------
// Recess illustration set — hand-drawn SVG components in the brand palette.
// Each takes an optional className so callers control sizing.
// ---------------------------------------------------------------------------

const INK = "#1A1A1A";
const AMBER = "#F5A623";
const AMBER_SOFT = "#F9C877";
const AMBER_DEEP = "#E8900C";
const WOOD = "#C98A1E";
const CREAM = "#FFF9E5";

interface ArtProps {
  className?: string;
}

const artBase = {
  fill: "none",
  stroke: INK,
  strokeWidth: 4.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

// ---------------------------------------------------------------------------
// Tic Tac Toe — 3x3 grid of rounded cells, amber X's and ink O's
// ---------------------------------------------------------------------------

export function TicTacToeArt({ className }: ArtProps) {
  const marks = [
    { x: 48, y: 48, type: "X" },
    { x: 120, y: 48, type: "O" },
    { x: 192, y: 48, type: "X" },
    { x: 48, y: 120, type: "O" },
    { x: 120, y: 120, type: "X" },
    { x: 192, y: 120, type: "O" },
    { x: 48, y: 192, type: "X" },
    { x: 120, y: 192, type: "O" },
    { x: 192, y: 192, type: "X" },
  ];
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <rect x={20} y={20} width={200} height={200} rx={28} fill="#FFFFFF" stroke={INK} strokeWidth={5} />
      {/* cells */}
      {[20, 92, 164].map((x) =>
        [20, 92, 164].map((y) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={56} height={56} rx={14} fill="#FFFFFF" stroke={INK} strokeWidth={3.5} />
        )),
      )}
      {/* marks */}
      {marks.map((m, i) =>
        m.type === "X" ? (
          <g key={i} stroke={AMBER} strokeWidth={12} strokeLinecap="round">
            <path d={`M${m.x - 16} ${m.y - 16} C${m.x - 12} ${m.y - 12}, ${m.x + 12} ${m.y + 12}, ${m.x + 16} ${m.y + 16}`} />
            <path d={`M${m.x + 16} ${m.y - 16} C${m.x + 12} ${m.y - 12}, ${m.x - 12} ${m.y + 12}, ${m.x - 16} ${m.y + 16}`} />
          </g>
        ) : (
          <circle key={i} cx={m.x} cy={m.y} r={17} fill="#FFFFFF" stroke={INK} strokeWidth={11} />
        ),
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Rock Paper Scissors — a simplified rounded hand flashing scissors,
// drawn as one continuous ink outline, flat with only an amber accent
// ---------------------------------------------------------------------------

export function RockPaperScissorsArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      {/* the hand — a single continuous ink outline: two spread fingers (scissors),
          a thumb on one side, ring + pinky folded on the other. No shading, no fill. */}
      <path
        d="M 98 200
           C 92 182, 88 164, 84 148
           C 76 140, 64 138, 58 130
           C 54 124, 58 116, 66 116
           C 78 116, 88 120, 98 122
           C 96 106, 94 88, 94 70
           C 94 52, 110 42, 118 52
           C 120 62, 120 80, 120 96
           C 122 112, 126 126, 135 126
           C 139 126, 141 110, 141 96
           C 141 74, 141 58, 141 48
           C 141 36, 162 34, 166 48
           C 168 60, 166 84, 164 100
           C 164 116, 172 126, 178 138
           C 184 150, 182 164, 180 178
           C 178 188, 174 196, 170 200
           C 146 204, 122 204, 98 200
           Z"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* motion dashes near the fingertips, matching the sibling icons */}
      <g {...artBase} strokeWidth={5}>
        <path d="M 72 40 L 60 32" />
        <path d="M 100 22 L 102 12" />
        <path d="M 172 22 L 182 16" />
      </g>
      {/* amber sparkle accent */}
      <path
        d="M 196 80 C 197.5 85.5, 199.5 87.5, 205 89 C 199.5 90.5, 197.5 92.5, 196 98 C 194.5 92.5, 192.5 90.5, 187 89 C 192.5 87.5, 194.5 85.5, 196 80 Z"
        fill={AMBER}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Red or Black — a card split amber/ink on the diagonal
// ---------------------------------------------------------------------------

export function RedOrBlackArt({ className }: ArtProps) {
  const clipId = useId();
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <rect x={70} y={30} width={100} height={180} rx={18} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <polygon points="70,30 170,30 70,210" fill={AMBER} />
        <polygon points="170,30 170,210 70,210" fill={INK} />
        <path d="M 66 214 L 174 26" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      </g>
      <rect x={70} y={30} width={100} height={180} rx={18} fill="none" stroke={INK} strokeWidth={5} />
      {/* dash marks radiating from the top-right corner */}
      <g {...artBase} strokeWidth={5}>
        <path d="M 176 20 L 188 10" />
        <path d="M 184 30 L 200 30" />
        <path d="M 172 12 L 172 0" />
        <path d="M 196 16 L 208 22" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Twenty Questions — a big speech bubble pointing down-left with a "?"
// ---------------------------------------------------------------------------

export function TwentyQuestionsArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      {/* tail pointing down-left */}
      <path d="M 64 158 L 30 198 L 98 176 Z" fill="#FFFFFF" stroke={AMBER} strokeWidth={6} strokeLinejoin="round" />
      {/* bubble */}
      <rect x={40} y={36} width={160} height={130} rx={28} fill="#FFFFFF" stroke={AMBER} strokeWidth={6} />
      {/* question mark */}
      <path
        d="M 106 82 C 106 62 136 62 136 82 C 136 96 120 100 120 114"
        stroke={AMBER}
        strokeWidth={15}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={120} cy={140} r={9} fill={AMBER} />
      {/* dash marks from the bottom right */}
      <g {...artBase} strokeWidth={5}>
        <path d="M 192 150 L 206 142" />
        <path d="M 200 162 L 216 160" />
        <path d="M 184 166 L 182 180" />
        <path d="M 210 172 L 224 170" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Truth or Dare — a heart bubble and a star bubble, overlapping
// ---------------------------------------------------------------------------

const STAR_PATH =
  "M170 58 L175.9 73.9 L192.8 74.6 L179.5 85.1 L184.1 101.4 L170 92 L155.9 101.4 L160.5 85.1 L147.2 74.6 L164.1 73.9 Z";

const HEART_PATH =
  "M 95 142 C 78 128 58 120 64 102 C 68 90 80 88 88 97 C 92 101 94 105 95 107 C 96 105 98 101 102 97 C 110 88 122 90 126 102 C 132 120 112 128 95 142 Z";

export function TruthOrDareArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      {/* left (heart) bubble — offset yellow-orange echo outline */}
      <rect x={36} y={76} width={130} height={110} rx={24} fill="none" stroke={AMBER_SOFT} strokeWidth={6} />
      <rect x={30} y={70} width={130} height={110} rx={24} fill="#FFFFFF" stroke={AMBER} strokeWidth={6} />
      <path d={HEART_PATH} fill={AMBER} />
      {/* right (star) bubble */}
      <rect x={118} y={38} width={102} height={88} rx={20} fill="#FFFFFF" stroke={INK} strokeWidth={5} />
      <path d={STAR_PATH} fill={INK} />
      {/* dashes above the star bubble */}
      <g {...artBase} strokeWidth={5}>
        <path d="M 140 22 L 148 16" />
        <path d="M 164 18 L 172 12" />
        <path d="M 190 24 L 200 18" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Brand mood — a wooden swing set in a pale landscape with an amber sun
// ---------------------------------------------------------------------------

export function SwingSetArt({ className }: ArtProps) {
  const leg = (d: string) => (
    <>
      <path d={d} stroke={INK} strokeWidth={14} strokeLinecap="round" />
      <path d={d} stroke={WOOD} strokeWidth={9} strokeLinecap="round" />
    </>
  );
  return (
    <svg viewBox="0 0 240 200" className={className} aria-hidden>
      {/* clouds */}
      <path
        d="M 44 52 C 38 42 52 34 62 40 C 68 32 84 34 86 44 C 96 44 100 56 90 60 L 48 62 C 38 60 38 56 44 52 Z"
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d="M 164 78 C 158 70 168 64 176 68 C 181 62 193 64 195 72 C 203 72 206 80 198 83 L 168 84 C 160 82 160 80 164 78 Z"
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      {/* sun */}
      <circle cx={196} cy={56} r={22} fill={AMBER} stroke={INK} strokeWidth={4} />
      <g {...artBase} strokeWidth={4}>
        <path d="M 196 24 L 196 16" />
        <path d="M 220 40 L 228 34" />
        <path d="M 226 56 L 234 56" />
      </g>
      {/* ground */}
      <path d="M 0 148 C 60 136 120 158 240 144 L 240 200 L 0 200 Z" fill={CREAM} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      {/* swing set */}
      {leg("M 76 56 L 44 152")}
      {leg("M 76 56 L 108 152")}
      {leg("M 164 56 L 132 152")}
      {leg("M 164 56 L 196 152")}
      <rect x={62} y={42} width={116} height={16} rx={8} fill={WOOD} stroke={INK} strokeWidth={4} />
      {/* ropes + seat */}
      <path d="M 92 58 L 92 118" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M 148 58 L 148 118" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <rect x={82} y={116} width={76} height={13} rx={6.5} fill={WOOD} stroke={INK} strokeWidth={4} />
      {/* grass tufts */}
      <g {...artBase} strokeWidth={4}>
        <path d="M 30 170 L 34 160" />
        <path d="M 38 172 L 40 164" />
        <path d="M 200 162 L 206 154" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Hero image — two hands holding phones with hearts, a floating controller
// square above, linked by dotted curves, sparkles and hearts
// ---------------------------------------------------------------------------

const SPARKLE = (x: number, y: number) => (
  <path
    d={`M ${x} ${y - 9} C ${x + 1.5} ${y - 3.5}, ${x + 3.5} ${y - 1.5}, ${x + 9} ${y} C ${x + 3.5} ${y + 1.5}, ${x + 1.5} ${y + 3.5}, ${x} ${y + 9} C ${x - 1.5} ${y + 3.5}, ${x - 3.5} ${y + 1.5}, ${x - 9} ${y} C ${x - 3.5} ${y - 1.5}, ${x - 1.5} ${y - 3.5}, ${x} ${y - 9} Z`}
    fill={AMBER}
    stroke={INK}
    strokeWidth={2.5}
    strokeLinejoin="round"
  />
);

const MINI_HEART = (x: number, y: number, fill: string) => (
  <path
    d={`M ${x} ${y + 7} C ${x - 4} ${y + 3}, ${x - 6.5} ${y + 0.5}, ${x - 6.5} ${y - 2.5} C ${x - 6.5} ${y - 5}, ${x - 4.5} ${y - 6}, ${x - 3} ${y - 4.5} C ${x - 1.8} ${y - 3.3}, ${x - 1} ${y - 1.8}, ${x} ${y - 0.5} C ${x + 1} ${y - 1.8}, ${x + 1.8} ${y - 3.3}, ${x + 3} ${y - 4.5} C ${x + 4.5} ${y - 6}, ${x + 6.5} ${y - 5}, ${x + 6.5} ${y - 2.5} C ${x + 6.5} ${y + 0.5}, ${x + 4} ${y + 3}, ${x} ${y + 7} Z`}
    fill={fill}
    stroke={INK}
    strokeWidth={2.5}
    strokeLinejoin="round"
  />
);

export function HeroArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 320 240" className={className} aria-hidden>
      {/* dotted link lines from the controller to each phone */}
      <g {...artBase} strokeWidth={4} strokeDasharray="2 10">
        <path d="M 160 84 C 140 118 122 128 106 146" />
        <path d="M 160 84 C 180 118 198 128 214 146" />
      </g>

      {/* controller square — glowing amber with a little gamepad */}
      <rect x={124} y={19} width={72} height={72} rx={20} fill={AMBER} opacity={0.25} />
      <rect x={132} y={27} width={56} height={56} rx={16} fill={AMBER} stroke={INK} strokeWidth={5} />
      <rect x={146} y={43} width={28} height={18} rx={7} fill="#FFFFFF" stroke={INK} strokeWidth={4} />
      <path d="M 152 52 L 168 52" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M 160 44 L 160 60" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <circle cx={172} cy={49} r={2.5} fill={INK} />
      <circle cx={176} cy={55} r={2.5} fill={INK} />

      {/* left phone — dark, held in a hand, heart on the screen */}
      <g transform="rotate(-12 95 185)">
        <rect x={75} y={145} width={40} height={80} rx={10} fill={INK} stroke={INK} strokeWidth={4} />
        <rect x={80} y={152} width={30} height={58} rx={5} fill="#2E2A22" />
        {MINI_HEART(95, 168, "#FFFFFF")}
      </g>
      {/* right phone — light, held in a hand, heart on the screen */}
      <g transform="rotate(12 225 185)">
        <rect x={205} y={145} width={40} height={80} rx={10} fill="#FFFFFF" stroke={INK} strokeWidth={4} />
        <rect x={210} y={152} width={30} height={58} rx={5} fill={CREAM} />
        {MINI_HEART(225, 168, AMBER)}
      </g>

      {/* left hand — fingers wrap the dark phone */}
      <path d="M 62 236 C 64 206 74 192 94 186" stroke={AMBER} strokeWidth={26} strokeLinecap="round" />
      <path d="M 62 236 C 64 206 74 192 94 186" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M 76 198 L 66 208" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M 86 192 L 80 200" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M 96 190 L 94 198" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      {/* right hand — fingers wrap the light phone */}
      <path d="M 258 236 C 256 206 246 192 226 186" stroke={AMBER} strokeWidth={26} strokeLinecap="round" />
      <path d="M 258 236 C 256 206 246 192 226 186" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M 244 198 L 254 208" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M 234 192 L 240 200" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M 224 190 L 226 198" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />

      {/* sparkles + floating hearts */}
      {SPARKLE(92, 62)}
      {SPARKLE(232, 48)}
      {SPARKLE(282, 108)}
      {SPARKLE(38, 108)}
      {MINI_HEART(268, 150, AMBER)}
      {MINI_HEART(48, 148, "#FFFFFF")}
      <path d="M 122 20 L 130 26" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M 190 18 L 198 24" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
    </svg>
  );
}
