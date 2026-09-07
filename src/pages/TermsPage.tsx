import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";

export default function TermsPage() {
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
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Terms of Use</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 7 September 2026</p>

        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-foreground/90">
          <p>
            Recess is a casual game launcher. You can start a room, share a link, and play without
            creating an account. By using the app, you agree to these terms.
          </p>

          <h2 className="text-base font-semibold">1. What Recess is</h2>
          <p>
            Recess provides browser-based games and room links for short sessions with friends. Some
            modes are single-player; others sync moves through our servers so both people see the same
            board.
          </p>

          <h2 className="text-base font-semibold">2. Your responsibilities</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Use Recess for lawful, respectful play. Do not harass, threaten, or exploit others.</li>
            <li>
              Do not attempt to break rooms, scrape the service, overload servers, or bypass limits.
            </li>
            <li>
              You are responsible for what you share in prompts and chat-style games. Keep it
              appropriate for the people you invite.
            </li>
            <li>If you install Recess as an app on your home screen, you can remove it at any time.</li>
          </ul>

          <h2 className="text-base font-semibold">3. Rooms and links</h2>
          <p>
            Room links are access keys. Anyone with the link may join according to the rules of that
            game (usually two players). Do not post private room links in public places if you only
            want a specific person to join. Rooms may expire after a period of inactivity.
          </p>

          <h2 className="text-base font-semibold">4. No accounts (by default)</h2>
          <p>
            Most play works with a device token stored on your device. We do not require a password
            signup for standard games. If optional sign-in features are added later, those will carry
            their own notices.
          </p>

          <h2 className="text-base font-semibold">5. Availability</h2>
          <p>
            We run Recess on third-party infrastructure (hosting and database providers). Service may
            be interrupted for maintenance, free-tier limits, or outages outside our control. We do
            not guarantee uninterrupted uptime.
          </p>

          <h2 className="text-base font-semibold">6. Ads and optional installs</h2>
          <p>
            The app may show non-intrusive advertisements. You can dismiss install prompts. Ads are
            not part of game outcomes and do not change rules or scores.
          </p>

          <h2 className="text-base font-semibold">7. Intellectual property</h2>
          <p>
            Recess branding, layout, and original game presentation belong to the project operators.
            Classic game concepts (for example tic-tac-toe) are offered as ordinary implementations
            for casual play.
          </p>

          <h2 className="text-base font-semibold">8. Disclaimers</h2>
          <p>
            Recess is provided as-is for entertainment. We are not liable for indirect damages, lost
            data in expired rooms, or disputes between players. To the extent allowed by law, our
            total liability relating to your use of Recess is limited to zero for free use of the
            service.
          </p>

          <h2 className="text-base font-semibold">9. Changes</h2>
          <p>
            We may update these terms. Continued use after a posted update means you accept the
            revised terms. The date at the top will change when we do.
          </p>

          <h2 className="text-base font-semibold">10. Contact</h2>
          <p>
            Questions about these terms: reach the operators via the project repository or the
            contact channel listed on the Recess site when available.
          </p>
        </div>
      </div>
    </div>
  );
}
