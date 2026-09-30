import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const KEY = "recess_tutorial_done";
const STEPS = [
  {
    title: "Start a room",
    body: "Tap Play with a friend. Recess makes a link. That link is the room code.",
  },
  {
    title: "Send it",
    body: "WhatsApp, SMS, or copy. Your friend opens it when they have a minute. No signup.",
  },
  {
    title: "Join from the home screen",
    body: "Paste the link or the code in Join a room if they did not tap the link itself.",
  },
];

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
  const s = STEPS[step];

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
          How Recess works {step + 1}/{STEPS.length}
        </p>
        <h2 className="mt-2 font-display text-xl font-black">{s.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" className="rounded-full" onClick={finish}>
            Skip
          </Button>
          {step < STEPS.length - 1 ? (
            <Button className="rounded-full" onClick={() => setStep((n) => n + 1)}>
              Next
            </Button>
          ) : (
            <Button className="rounded-full" onClick={finish}>
              Got it
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
