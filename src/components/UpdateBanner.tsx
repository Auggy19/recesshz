import { applyClientUpdate, APP_BUILD, hasNewBuild } from "@/lib/appVersion";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UpdateBanner() {
  const [open, setOpen] = useState(() =>
    typeof window === "undefined" ? false : hasNewBuild(),
  );
  if (!open) return null;
  return (
    <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-lg rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <p className="text-sm font-semibold">New Recess build ({APP_BUILD})</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Tap update to pull the latest rooms, icons, and fixes on this phone.
      </p>
      <div className="mt-3 flex gap-2">
        <Button className="rounded-full" onClick={() => applyClientUpdate()}>
          Update now
        </Button>
        <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
          Later
        </Button>
      </div>
    </div>
  );
}
