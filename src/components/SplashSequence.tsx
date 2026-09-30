import { useEffect, useState } from "react";

const KEY = "recess_splash_session";
const STEPS = ["pop", "flip", "transform", "blend"] as const;
type Step = (typeof STEPS)[number];

const DURATIONS: Record<Step, number> = {
  pop: 720,
  flip: 680,
  transform: 820,
  blend: 780,
};

export function SplashSequence() {
  const [step, setStep] = useState<Step | "done" | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === "1") {
        setStep("done");
        return;
      }
    } catch {
      /* continue */
    }
    setStep("pop");
  }, []);

  useEffect(() => {
    if (!step || step === "done") return;
    const t = window.setTimeout(() => {
      const i = STEPS.indexOf(step);
      if (i < STEPS.length - 1) {
        setStep(STEPS[i + 1]);
        return;
      }
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* ignore */
      }
      setStep("done");
    }, DURATIONS[step]);
    return () => window.clearTimeout(t);
  }, [step]);

  if (!step || step === "done") return null;

  return (
    <div
      className="recess-splash"
      data-step={step}
      role="dialog"
      aria-label="Recess opening"
    >
      <div className="recess-splash__stage">
  <div className="recess-splash__rings">
    <span />
    <span />
    <span />
    <span />
  </div>
</div>

          <span className="recess-splash__r">R</span>
        </div>
        <p className="recess-splash__word">Recess</p>
      </div>
    </div>
  );
}
