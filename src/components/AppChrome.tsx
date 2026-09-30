import { FeedbackDock } from "@/components/FeedbackDock";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { UpdateBanner } from "@/components/UpdateBanner";

export function AppChrome() {
  return (
    <>
      <TutorialOverlay />
      <FeedbackDock />
      <UpdateBanner />
    </>
  );
}
