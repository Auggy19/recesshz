import { useId } from "react";

// ---------------------------------------------------------------------------
// Recess flat icon set — rounded soft-body shapes in the brand palette.
//
// Set rules (kept deliberately strict):
//   • Ink-black (#1A1A1A) outlines, single consistent stroke weight (5px)
//   • Warm amber (#F5A623) fills only — no other colors, no gradients
//   • Subtle soft drop shadow under each shape (shared feDropShadow filter)
//   • Chunky rounded shapes, generous negative space, centered on the cream
//     card the caller places them on
// Each icon takes an optional className so callers control sizing.
// ---------------------------------------------------------------------------

const INK = "#1A1A1A";
const AMBER = "#F5A623";
const CREAM = "#FFF9E5";
const WOOD = "#C98A1E";
const STROKE = 5;

export interface ArtProps {
  className?: string;
}

const artBase = {
  fill: "none",
  stroke: INK,
  strokeWidth: 4.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Shared soft drop shadow — subtle depth, no gradients. Unique id per icon. */
function DropShadow({ id }: { id: string }) {
  return (
    <filter id={id} x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="4" stdDeviation="3.5" floodColor={INK} floodOpacity="0.16" />
    </filter>
  );
}

/** A chunky ink question mark — engraved on amber, or solo on cream. */
function InkQuestionMark({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <path
        d={`M ${cx - 14} ${cy - 20} C ${cx - 14} ${cy - 34} ${cx + 14} ${cy - 34} ${cx + 14} ${cy - 20} C ${cx + 14} ${cy - 8} ${cx - 2} ${cy - 5} ${cx - 2} ${cy + 3}`}
        stroke={INK}
        strokeWidth={11}
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={cx} cy={cy + 18} r={7} fill="none" stroke={INK} strokeWidth={11} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Tic Tac Toe — a 3x3 grid of rounded cells with X and O marks
// ---------------------------------------------------------------------------

export function TicTacToeArt({ className }: ArtProps) {
  const shadowId = useId();
  const cells = [26, 92, 158];
  // A game in progress — X, O, X down the diagonal, six cells left open.
  const marks = [
    { x: 54, y: 54, type: "X" },
    { x: 120, y: 120, type: "O" },
    { x: 186, y: 186, type: "X" },
  ] as const;
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
      </defs>
      <g filter={`url(#${shadowId})`}>
        {cells.map((x) =>
          cells.map((y) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={56}
              height={56}
              rx={18}
              fill="none"
              stroke={INK}
              strokeWidth={STROKE}
            />
          )),
        )}
        {marks.map((m, i) =>
          m.type === "X" ? (
            <g key={i}>
              <rect
                x={m.x - 20}
                y={m.y - 8}
                width={40}
                height={16}
                rx={8}
                fill={AMBER}
                stroke={INK}
                strokeWidth={STROKE}
                transform={`rotate(45 ${m.x} ${m.y})`}
              />
              <rect
                x={m.x - 20}
                y={m.y - 8}
                width={40}
                height={16}
                rx={8}
                fill={AMBER}
                stroke={INK}
                strokeWidth={STROKE}
                transform={`rotate(-45 ${m.x} ${m.y})`}
              />
            </g>
          ) : (
            <path
              key={i}
              d={`M ${m.x - 19} ${m.y} A 19 19 0 1 0 ${m.x + 19} ${m.y} A 19 19 0 1 0 ${m.x - 19} ${m.y} Z M ${m.x - 9} ${m.y} A 9 9 0 1 1 ${m.x + 9} ${m.y} A 9 9 0 1 1 ${m.x - 9} ${m.y} Z`}
              fill={AMBER}
              stroke={INK}
              strokeWidth={STROKE}
              fillRule="evenodd"
            />
          ),
        )}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// X / O marks — used on the live Tic Tac Toe board, matching the card art
// ---------------------------------------------------------------------------

export function XMark({ className }: ArtProps) {
  const shadowId = useId();
  return (
    <svg viewBox="0 0 56 56" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
      </defs>
      <g filter={`url(#${shadowId})`}>
        <rect x={8} y={20} width={40} height={16} rx={8} fill={AMBER} stroke={INK} strokeWidth={STROKE} transform="rotate(45 28 28)" />
        <rect x={8} y={20} width={40} height={16} rx={8} fill={AMBER} stroke={INK} strokeWidth={STROKE} transform="rotate(-45 28 28)" />
      </g>
    </svg>
  );
}

export function OMark({ className }: ArtProps) {
  const shadowId = useId();
  return (
    <svg viewBox="0 0 56 56" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
      </defs>
      <g filter={`url(#${shadowId})`}>
        <path
          d="M 9 28 A 19 19 0 1 0 47 28 A 19 19 0 1 0 9 28 Z M 19 28 A 9 9 0 1 1 37 28 A 9 9 0 1 1 19 28 Z"
          fill={AMBER}
          stroke={INK}
          strokeWidth={STROKE}
          fillRule="evenodd"
        />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// RPS hand gestures — rock (fist) and paper (open hand); scissors reuses the
// card art's two-finger hand. Same ink/amber rules, softer 2.5px stroke at the
// 120-unit tile scale (proportional to the 5px stroke on the 240-unit cards).
// ---------------------------------------------------------------------------

const GESTURE_STROKE = 2.5;

export function RockGesture({ className }: ArtProps) {
  const shadowId = useId();
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
      </defs>
      <g filter={`url(#${shadowId})`}>
        {/* knuckles */}
        <rect x={33} y={14} width={15} height={21} rx={7.5} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        <rect x={52} y={10} width={15} height={23} rx={7.5} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        <rect x={71} y={14} width={15} height={21} rx={7.5} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        {/* fist body */}
        <rect x={32} y={34} width={56} height={56} rx={22} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        {/* thumb wrapped across the front */}
        <rect x={18} y={54} width={30} height={15} rx={7.5} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} transform="rotate(-25 33 61.5)" />
        {/* finger-joint creases */}
        <path d="M 36 42 C 39 39 43 39 46 42" stroke={INK} strokeWidth={GESTURE_STROKE} fill="none" strokeLinecap="round" />
        <path d="M 55 40 C 58 37 62 37 65 40" stroke={INK} strokeWidth={GESTURE_STROKE} fill="none" strokeLinecap="round" />
        <path d="M 74 42 C 77 39 81 39 84 42" stroke={INK} strokeWidth={GESTURE_STROKE} fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function PaperGesture({ className }: ArtProps) {
  const shadowId = useId();
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
      </defs>
      <g filter={`url(#${shadowId})`}>
        {/* four fingers, staggered tips */}
        <rect x={46} y={20} width={10} height={36} rx={5} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        <rect x={59} y={14} width={10} height={42} rx={5} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        <rect x={72} y={12} width={10} height={44} rx={5} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        <rect x={85} y={17} width={10} height={39} rx={5} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        {/* palm */}
        <rect x={41} y={50} width={58} height={50} rx={20} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        {/* thumb, angled up-out */}
        <rect x={29} y={64} width={26} height={13} rx={6.5} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} transform="rotate(15 42 70.5)" />
        {/* finger-joint creases */}
        <path d="M 49 38 C 51 35 54 35 56 38" stroke={INK} strokeWidth={GESTURE_STROKE} fill="none" strokeLinecap="round" />
        <path d="M 62 34 C 64 31 67 31 69 34" stroke={INK} strokeWidth={GESTURE_STROKE} fill="none" strokeLinecap="round" />
        <path d="M 75 32 C 77 29 80 29 82 32" stroke={INK} strokeWidth={GESTURE_STROKE} fill="none" strokeLinecap="round" />
        <path d="M 88 36 C 90 33 93 33 95 36" stroke={INK} strokeWidth={GESTURE_STROKE} fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Question mark tile — the hidden-pick placeholder on the RPS board
// ---------------------------------------------------------------------------

export function QuestionMark({ className }: ArtProps) {
  const shadowId = useId();
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
      </defs>
      <g filter={`url(#${shadowId})`}>
        <rect x={16} y={16} width={88} height={88} rx={26} fill={AMBER} stroke={INK} strokeWidth={GESTURE_STROKE} />
        <path
          d="M 60 42 C 60 32 72 30 78 36 C 84 42 82 52 76 56 C 70 60 68 62 68 70"
          stroke={INK}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
        />
        <circle cx={68} cy={84} r={4.5} fill={INK} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Rock Paper Scissors — a chubby rounded hand flashing the scissors sign
// ---------------------------------------------------------------------------

export function RockPaperScissorsArt({ className }: ArtProps) {
  const shadowId = useId();
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
      </defs>
      <g filter={`url(#${shadowId})`}>
        {/* fingers — two rounded pills, slightly splayed */}
        <rect x={86} y={54} width={30} height={86} rx={15} fill={AMBER} stroke={INK} strokeWidth={STROKE} transform="rotate(-5 101 140)" />
        <rect x={124} y={46} width={30} height={94} rx={15} fill={AMBER} stroke={INK} strokeWidth={STROKE} transform="rotate(5 139 140)" />
        {/* palm — drawn over the finger bases, so the seam reads as a fold */}
        <rect x={80} y={116} width={80} height={80} rx={36} fill={AMBER} stroke={INK} strokeWidth={STROKE} />
        {/* thumb — angled down-out to the right, as in a scissors gesture */}
        <rect x={150} y={146} width={48} height={24} rx={12} fill={AMBER} stroke={INK} strokeWidth={STROKE} transform="rotate(20 174 158)" />
        {/* tucked ring + pinky knuckles */}
        <rect x={140} y={184} width={20} height={16} rx={8} fill={AMBER} stroke={INK} strokeWidth={STROKE} />
        <rect x={162} y={190} width={17} height={13} rx={6.5} fill={AMBER} stroke={INK} strokeWidth={STROKE} />
        {/* palm creases */}
        <path d="M 96 138 C 102 134 112 134 118 138" stroke={INK} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        <path d="M 122 146 C 128 142 138 142 144 146" stroke={INK} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Red or Black — a rounded playing card split diagonally, two pips
// ---------------------------------------------------------------------------

export function RedOrBlackArt({ className }: ArtProps) {
  const shadowId = useId();
  const clipId = useId();
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
        <clipPath id={clipId}>
          <rect x={64} y={34} width={112} height={172} rx={22} />
        </clipPath>
      </defs>
      <g filter={`url(#${shadowId})`}>
        <g clipPath={`url(#${clipId})`}>
          <polygon points="64,34 176,34 64,206" fill={AMBER} />
        </g>
        <rect x={64} y={34} width={112} height={172} rx={22} fill="none" stroke={INK} strokeWidth={STROKE} />
        <path d="M 170 34 L 70 206" stroke={INK} strokeWidth={STROKE} strokeLinecap="round" />
        {/* one pip per half — either/or */}
        <circle cx={90} cy={62} r={7} fill={AMBER} stroke={INK} strokeWidth={STROKE} />
        <circle cx={150} cy={178} r={7} fill={AMBER} stroke={INK} strokeWidth={STROKE} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Twenty Questions — a chunky speech bubble with a big question mark
// ---------------------------------------------------------------------------

export function TwentyQuestionsArt({ className }: ArtProps) {
  const shadowId = useId();
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
      </defs>
      <g filter={`url(#${shadowId})`}>
        {/* tail — points down-left, drawn behind the bubble */}
        <path d="M 78 168 L 34 212 L 106 190 Z" fill={AMBER} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
        {/* bubble */}
        <rect x={40} y={36} width={160} height={134} rx={38} fill={AMBER} stroke={INK} strokeWidth={STROKE} />
        {/* engraved question mark */}
        <InkQuestionMark cx={120} cy={136} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Truth or Dare — a "?" bubble (truth) and a star bubble (dare), overlapping.
// No hearts — truth is a question, dare is a star.
// ---------------------------------------------------------------------------

export function TruthOrDareArt({ className }: ArtProps) {
  const shadowId = useId();
  return (
    <svg viewBox="0 0 240 240" className={className} aria-hidden>
      <defs>
        <DropShadow id={shadowId} />
      </defs>
      <g filter={`url(#${shadowId})`}>
        {/* truth bubble — amber, engraved "?" */}
        <rect x={30} y={84} width={122} height={102} rx={28} fill={AMBER} stroke={INK} strokeWidth={STROKE} />
        <InkQuestionMark cx={91} cy={140} />
        {/* dare bubble — cream, with a chunky amber star */}
        <rect x={112} y={36} width={102} height={86} rx={24} fill="none" stroke={INK} strokeWidth={STROKE} />
        <polygon
          points="163,52 170.1,68.3 187.7,70 174.4,81.7 178.3,99 163,90 147.7,99 151.6,81.7 138.3,70 156,68.3"
          fill={AMBER}
          stroke={INK}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
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
// Hero image — two hands holding phones with game marks on screen, a floating
// controller square above, linked by dotted curves, sparkles
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

      {/* left phone — dark, held in a hand, an amber X on the screen */}
      <g transform="rotate(-12 95 185)">
        <rect x={75} y={145} width={40} height={80} rx={10} fill={INK} stroke={INK} strokeWidth={4} />
        <rect x={80} y={152} width={30} height={58} rx={5} fill="#2E2A22" />
        <path d="M 88 161 L 102 175" stroke={AMBER} strokeWidth={4} strokeLinecap="round" />
        <path d="M 102 161 L 88 175" stroke={AMBER} strokeWidth={4} strokeLinecap="round" />
      </g>
      {/* right phone — light, held in a hand, an ink O on the screen */}
      <g transform="rotate(12 225 185)">
        <rect x={205} y={145} width={40} height={80} rx={10} fill="#FFFFFF" stroke={INK} strokeWidth={4} />
        <rect x={210} y={152} width={30} height={58} rx={5} fill={CREAM} />
        <circle cx={225} cy={168} r={9} fill="none" stroke={INK} strokeWidth={4} />
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

      {/* sparkles */}
      {SPARKLE(92, 62)}
      {SPARKLE(232, 48)}
      {SPARKLE(282, 108)}
      {SPARKLE(38, 108)}
      {SPARKLE(268, 150)}
      {SPARKLE(48, 148)}
      <path d="M 122 20 L 130 26" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
      <path d="M 190 18 L 198 24" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
    </svg>
  );
}
