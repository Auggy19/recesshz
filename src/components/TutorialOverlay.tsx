import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FIRST_PLAY_STEPS } from "@/lib/firstPlayTutorial";

const KEY = "recess_tutorial_done";

export function TutorialOverlay() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;
  const s = FIRST_PLAY_STEPS[step];

  const finish = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-background p-5 shadow-lift">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          First play {step + 1}/{FIRST_PLAY_STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-xl font-black">{s.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" className="rounded-full" onClick={finish}>
            Skip
          </Button>
          {step < FIRST_PLAY_STEPS.length - 1 ? (
            <Button className="rounded-full" onClick={() => setStep((n) => n + 1)}>
              Next
            </Button>
          ) : (
            <Button className="rounded-full" onClick={finish}>
              Start a room
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
