# Recess growth phase (V1 live, V2 locked)

## Cannot run from git alone

1. Resume the Supabase project.
2. SQL editor: 001 → 002 → 003 → 004.
3. 003 schedules `recess-daily-rollup` at 07:15 UTC. Confirm:

```sql
select jobname, schedule from cron.job;
select public.recess_daily_rollup();
```

Extend the rollup later to fill `pvp_rooms` / `vs_ai_rooms` from `match_sessions`.

## V1 shipped in this commit

- Match mode catalog: pvp, vs_ai, coop (team_v_team flagged off)
- AI roster: Mr. R (beginner), Kojo (intermediate), Bra Kojo (expert)
- Guest play still unlimited; nudge after 5 rooms (`guestPlay.ts`)
- First-run tutorial, feedback dock, click-to-update banner
- Daily streak remains local (`useStreak`)

## V2 locked (`VITE_RECESS_V2` defaults off)

Tables `profiles`, `coin_ledger`, `wagers` exist after 004.
Do **not** enable wagering or checkout until:

- Auth works
- Legal review of virtual items vs gambling rules in Ghana and export markets
- `feature_flags.v2_economy = true` **and** `VITE_RECESS_V2=true` on Vercel

Signup bonus (when unlocked): 100 coins once per profile.
Wagers are virtual coins only. No real-money pot in V1.

## Auth

Email OTP already exists at `/auth`.
Google / YouTube: Supabase Dashboard → Authentication → Providers → Google.
YouTube login is Google OAuth with YouTube scopes — enable only if you need channel identity.
Set `VITE_RECESS_GOOGLE_OAUTH=true` after the provider works.
Browser autofill works on the email field (`autocomplete` is default on email inputs).

## Payments (architecture only, not live)

| Rail | Suggested processor | Note |
|------|---------------------|------|
| Cards / PayPal | PayPal Commerce or Stripe | High fee; international |
| MTN MoMo / Vodafone Cash (GH) | Paystack or Hubtel | Local; verify KYC |

Keep checkout off the game board. Coins are a store item, not a stake in a cash prize, unless counsel signs off.

## Feature flags

```
VITE_RECESS_V2=false
VITE_RECESS_TEAM_MODES=false
VITE_RECESS_GOOGLE_OAUTH=false
VITE_APP_BUILD=2026.09.30
```

Bump `VITE_APP_BUILD` on each production deploy so the update banner appears.
