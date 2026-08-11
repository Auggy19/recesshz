import { useState, type ReactNode } from "react";
import { Smartphone, SquarePlus } from "lucide-react";
import { toast } from "sonner";

import { useA2HS } from "@/hooks/use-a2hs";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// ---------------------------------------------------------------------------
// InstallPromptModal — "Add Recess to Home Screen".
//
// Renders a subtle trigger button plus a bottom-sheet modal with the right
// path per platform:
//   - installable : Chromium with a captured beforeinstallprompt → native
//                   "Add to Home Screen" button (the deferred prompt).
//   - guide       : Chromium where the event can't fire (preview iframe, http
//                   origin, inactive service worker) → same banner, with the
//                   browser-menu steps revealed on tap.
//   - ios         : iOS Safari — a 2-step manual guide (Share → Add to Home
//                   Screen). iOS has no install event, so we never try to
//                   auto-trigger anything.
//
// Nothing renders at all when the app is already installed, the browser can't
// install, or the user said "Not now" (hidden for 7 days).
// ---------------------------------------------------------------------------

/** Safari's Share glyph — a square with an up arrow. */
function IosShareGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="9" rx="2.5" />
      <path d="M12 11V3" />
      <path d="m7 7 5-5 5 5" />
    </svg>
  );
}

/** Chrome's ⋮ overflow-menu glyph. */
function MenuGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="5" cy="12" r="2.1" />
      <circle cx="12" cy="12" r="2.1" />
      <circle cx="19" cy="12" r="2.1" />
    </svg>
  );
}

function Step({
  number,
  icon,
  title,
  children,
}: {
  number: number;
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {children}
        </p>
      </div>
    </div>
  );
}

interface InstallPromptModalProps {
  /** Custom trigger button. Receives a callback that opens the sheet. */
  renderTrigger?: (open: () => void) => ReactNode;
}

export default function InstallPromptModal({
  renderTrigger,
}: InstallPromptModalProps) {
  const { canShow, status, open, setOpen, install, dismiss } = useA2HS();
  const [showGuideSteps, setShowGuideSteps] = useState(false);

  // Nothing to offer: already installed, unsupported browser, or dismissed.
  if (!canShow) return null;

  const openSheet = () => setOpen(true);

  // "Not now" — remember the choice for 7 days and hide the trigger.
  const handleClose = () => dismiss();

  const handleInstall = async () => {
    const installed = await install();
    if (installed) {
      toast.success("Recess is on your home screen 🎉");
    } else {
      toast("No worries — try again anytime from the same button.");
    }
  };

  return (
    <>
      {renderTrigger ? (
        renderTrigger(openSheet)
      ) : (
        <button
          type="button"
          onClick={openSheet}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          📲 Add Recess to Home Screen
        </button>
      )}

      {/* Only the explicit "Not now" button hides the prompt for 7 days —
          closing via the X, the backdrop, or Esc just closes the sheet. */}
      <Sheet open={open} onOpenChange={(next) => setOpen(!!next)}>
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-md rounded-t-3xl border-x border-t pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <SheetHeader className="items-center pb-2 text-center">
            <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-primary text-xl font-black text-white">
              R
            </div>
            <SheetTitle className="text-lg font-black tracking-tight">
              Add Recess to your home screen
            </SheetTitle>
            <SheetDescription className="mx-auto max-w-xs leading-relaxed">
              Play faster next time! Add Recess to your home screen for quick
              access to your games and streaks.
            </SheetDescription>
          </SheetHeader>

          {status === "installable" ? (
            <div className="px-4">
              <p className="mb-3 text-center text-sm font-bold leading-snug">
                Keep Recess one tap away.
              </p>
              <Button
                type="button"
                onClick={handleInstall}
                className="h-12 w-full rounded-full text-base font-bold"
              >
                <Smartphone className="size-4" />
                Add to Home Screen
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                One tap — Recess lives on your phone like any other app. No
                account needed.
              </p>
            </div>
          ) : status === "guide" ? (
            <div className="px-4">
              <p className="mb-3 text-center text-sm font-bold leading-snug">
                Keep Recess one tap away.
              </p>
              <Button
                type="button"
                onClick={() => setShowGuideSteps((v) => !v)}
                className="h-12 w-full rounded-full text-base font-bold"
              >
                <Smartphone className="size-4" />
                Add to Home Screen
              </Button>
              {showGuideSteps && (
                <div className="mt-3 flex flex-col gap-3">
                  <Step
                    number={1}
                    icon={<MenuGlyph className="size-5" />}
                    title="Open the browser menu"
                  >
                    Tap the{" "}
                    <span className="font-bold text-foreground">⋮ menu</span>{" "}
                    in the top-right corner of Chrome.
                  </Step>
                  <Step
                    number={2}
                    icon={<Smartphone className="size-5" />}
                    title="Install Recess"
                  >
                    Tap{" "}
                    <span className="font-bold text-foreground">
                      “Install app”
                    </span>{" "}
                    (or “Add to Home screen” on desktop).
                  </Step>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 px-4">
              <p className="rounded-2xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-center text-sm font-semibold leading-snug">
                Add Recess so we don’t get lost in your chats 👋 Tap the Share
                icon below, then “Add to Home Screen.”
              </p>
              <Step
                number={1}
                icon={<IosShareGlyph className="size-5" />}
                title="Tap Share"
              >
                Tap the{" "}
                <span className="font-bold text-foreground">
                  Share button
                </span>{" "}
                at the bottom of Safari.
              </Step>
              <Step
                number={2}
                icon={<SquarePlus className="size-5" />}
                title="Add to Home Screen"
              >
                Scroll down and tap{" "}
                <span className="font-bold text-foreground">
                  “Add to Home Screen”
                </span>
                .
              </Step>
            </div>
          )}

          <SheetFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              className="w-full rounded-full text-sm font-semibold"
            >
              Not now
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
