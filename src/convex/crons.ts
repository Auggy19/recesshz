// Background cleanup: any game still `waiting` or `in_progress` and untouched
// for 48 hours is auto-updated to `abandoned`. Runs hourly; mutations in
// games.ts also lazily expire stale games on access.
import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "abandon stale games after 48 hours",
  { hours: 1 },
  api.games.cleanupAbandoned,
);

export default crons;
