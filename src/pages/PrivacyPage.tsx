import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Recess
        </Link>
        <Wordmark size="sm" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 7 September 2026</p>

        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-foreground/90">
          <p>
            This policy explains what Recess stores so games can work, and what we try hard not to
            collect. Recess is built for quick sessions — not for building a profile on you.
          </p>

          <h2 className="text-base font-semibold">1. Data we use to run games</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Device token.</strong> A random ID stored on your device so we can tell which
              player is which in a room. It is not your name, phone number, or email.
            </li>
            <li>
              <strong>Room and game state.</strong> Board positions, scores, prompts, and similar
              fields needed to sync a match. Rooms are set to expire after a limited time.
            </li>
            <li>
              <strong>Optional feedback.</strong> If you submit feedback text, we store what you
              send so we can improve the product.
            </li>
          </ul>

          <h2 className="text-base font-semibold">2. Data on your device</h2>
          <p>
            Local storage may hold preferences such as theme, sound mute, streak counters, and
            install-prompt dismissal. You can clear site data in your browser to remove it.
          </p>

          <h2 className="text-base font-semibold">3. What we do not ask for by default</h2>
          <p>
            Standard play does not require your real name, phone number, government ID, or precise
            GPS location. Do not put sensitive personal information into game prompts or shared
            rooms.
          </p>

          <h2 className="text-base font-semibold">4. Service providers</h2>
          <p>
            Hosting, database, and edge functions run on infrastructure providers (for example Vercel
            and Supabase). They process technical data such as IP addresses and request logs under
            their own policies, as needed to deliver the service.
          </p>

          <h2 className="text-base font-semibold">5. Advertising</h2>
          <p>
            If ads are shown, ad partners may use cookies or device identifiers according to their
            policies. We aim to keep ads away from the middle of active moves. You can use browser
            controls to limit third-party cookies where available.
          </p>

          <h2 className="text-base font-semibold">6. Children</h2>
          <p>
            Recess is aimed at a general audience. If you are a parent or guardian and believe a
            child has submitted personal data through a prompt, contact us and we will delete what we
            can reasonably find in active systems.
          </p>

          <h2 className="text-base font-semibold">7. Retention</h2>
          <p>
            Game rooms are temporary. Expired rooms and old state are removed on a schedule tied to
            our free-tier operations. Local preferences remain until you clear them.
          </p>

          <h2 className="text-base font-semibold">8. Your choices</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Stop using a room by leaving the page; links can be discarded.</li>
            <li>Clear browser storage to reset device token and local preferences.</li>
            <li>Avoid sharing room links publicly if you want a private match.</li>
          </ul>

          <h2 className="text-base font-semibold">9. Changes</h2>
          <p>
            We may update this policy as the product changes. The date above reflects the latest
            revision.
          </p>

          <h2 className="text-base font-semibold">10. Contact</h2>
          <p>
            Privacy questions: contact the operators through the project channel listed on the Recess
            site or repository when available.
          </p>
        </div>
      </div>
    </div>
  );
}
