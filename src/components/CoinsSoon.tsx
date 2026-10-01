/** Locked V2 surface. No balance, no voucher field, no stake. */
export function CoinsSoon() {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Coming soon
      </p>
      <p className="mt-1 font-display text-lg font-bold">Coins and stakes</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Not open. Recess matches are free. No voucher, no wallet, no bet.
      </p>
      <button
        type="button"
        disabled
        className="mt-3 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
      >
        Coming soon
      </button>
    </div>
  );
}
