import { FeedbackDock } from "@/components/FeedbackDock";
import { SplashSequence } from "@/components/SplashSequence";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { UpdateBanner } from "@/components/UpdateBanner";

export function AppChrome() {
  return (
    <>
      <SplashSequence />
      <TutorialOverlay />
      <FeedbackDock />
      <UpdateBanner />
    </>
  );
}
