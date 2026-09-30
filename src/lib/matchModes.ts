export type MatchMode = "pvp" | "coop" | "team_v_team" | "vs_ai";

export const MATCH_MODES: {
  id: MatchMode;
  label: string;
  blurb: string;
  v1: boolean;
}[] = [
  {
    id: "pvp",
    label: "Player vs player",
    blurb: "Share a link. Two phones, one board. The Recess default.",
    v1: true,
  },
  {
    id: "vs_ai",
    label: "You vs AI",
    blurb: "Solo against Mr. R, Kojo, or Bra Kojo.",
    v1: true,
  },
  {
    id: "coop",
    label: "Co-op",
    blurb: "Same side of the table. Beat the AI together (pass-and-play or link).",
    v1: true,
  },
  {
    id: "team_v_team",
    label: "Team vs team",
    blurb: "2v2 rooms. Locked until team_modes is on.",
    v1: false,
  },
];

export function modeIsLive(id: MatchMode): boolean {
  const row = MATCH_MODES.find((m) => m.id === id);
  if (!row) return false;
  if (row.v1) return true;
  return import.meta.env.VITE_RECESS_TEAM_MODES === "true";
}
