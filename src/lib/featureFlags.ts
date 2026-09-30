/** Client flags. V2 stays off until VITE_RECESS_V2=true AND SQL flag is flipped. */
export const FLAGS = {
  v2Economy: import.meta.env.VITE_RECESS_V2 === "true",
  teamModes: import.meta.env.VITE_RECESS_TEAM_MODES === "true",
  googleOauth: import.meta.env.VITE_RECESS_GOOGLE_OAUTH === "true",
} as const;

export function isV2EconomyOn(): boolean {
  return FLAGS.v2Economy;
}
