import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Recess
        </Link>
        <Wordmark size="sm" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Terms of Use</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 1 October 2026</p>

        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-foreground/90">
          <p>
            These terms are between you and the operators of Recess ("we", "us"). Recess is a
            browser game you open from a link. By using the site or the installed web app, you agree
            to these terms and the Privacy Policy. If you do not agree, do not use Recess.
          </p>
          <p className="text-sm text-muted-foreground">
            This page is the product rulebook, not a law-firm opinion. Have a lawyer review it before
            you take money, run ads at scale, or expand outside Ghana.
          </p>

          <h2 className="text-base font-semibold">1. What Recess is</h2>
          <p>
            Recess lets you start a private room, share a link, and play short games with someone you
            already talk to. Play can be single-player, or shared: you move, they open the same link
            later, the board stays in sync. Recess is entertainment. It is not a betting shop, a
            social network, or a place to meet strangers.
          </p>

          <h2 className="text-base font-semibold">2. Who can use it</h2>
          <p>
            You must be able to form a contract where you live, or use Recess with a parent or
            guardian. Do not use Recess if the law where you are forbids this kind of service. We may
            refuse or end access if you break these terms.
          </p>

          <h2 className="text-base font-semibold">3. Rooms and links</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>A room link is the key. Anyone who has it can try to join, up to the game's player limit (usually two).</li>
            <li>Do not post a private link in a public place if you only want one person in the room.</li>
            <li>A third person is rejected once the room is full.</li>
            <li>Rooms expire after a period of inactivity (about 48 hours unless a game says otherwise). Expired boards are not a backup of your match.</li>
            <li>We may close a room that is abusive, broken, or idle.</li>
          </ul>

          <h2 className="text-base font-semibold">4. Accounts and guests</h2>
          <p>
            You can play without an account. A random device token on your phone tells rooms which
            seat is yours. It is not your name or phone number. After several guest rooms we may ask
            you to create an account if you want scores kept. Optional sign-in (email code, and later
            Google if we turn it on) is separate. You are responsible for the inbox or account you use.
          </p>

          <h2 className="text-base font-semibold">5. How you must behave</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>No harassment, threats, hate, sexual content involving minors, or attempts to identify someone who did not share that information.</li>
            <li>Truth or Dare and similar prompts are between the people in the room. Do not put secrets, passwords, or private data in a prompt.</li>
            <li>Do not scrape, flood, reverse-engineer, or bypass room limits, device checks, or feature flags.</li>
            <li>Do not use Recess to run real-money gambling, pyramid schemes, or unsolicited marketing.</li>
          </ul>

          <h2 className="text-base font-semibold">6. Virtual items and money</h2>
          <p>
            Standard play is free. Streaks are a local or account counter, not cash. Any future coin,
            wager, or checkout feature stays off until we say it is on, and will have its own rules.
            Virtual coins, if ever offered, are not money, not a bank balance, and not redeemable for
            cash unless a later notice says so in writing. We do not take bets on match outcomes today.
          </p>

          <h2 className="text-base font-semibold">7. Your content</h2>
          <p>
            You keep what you type (prompts, feedback, display name). You give us a limited licence to
            store and show that content to the other player in the room, and to operate, secure, and
            debug the service. Feedback you send may be read by operators. Do not upload anything you
            do not have the right to share.
          </p>

          <h2 className="text-base font-semibold">8. Our content</h2>
          <p>
            The Recess name, mark, layout, and original presentation belong to the operators. Classic
            game ideas (tic-tac-toe, rock-paper-scissors, and similar) are ordinary rules we
            implemented for casual play. Do not copy the product branding and present it as yours.
          </p>

          <h2 className="text-base font-semibold">9. Ads and install prompts</h2>
          <p>
            We may show ads that do not change scores or rules. You can dismiss an install prompt. An
            ad partner is not a party to your match.
          </p>

          <h2 className="text-base font-semibold">10. Availability</h2>
          <p>
            Recess runs on third-party hosting and database providers. Free-tier projects can pause.
            Matches can fail, delay, or disappear. We do not promise uptime, delivery of a link, or
            that a friend will see your move on time.
          </p>

          <h2 className="text-base font-semibold">11. Disclaimers and liability</h2>
          <p>
            Recess is provided "as is" and "as available". We disclaim warranties of merchantability,
            fitness for a particular purpose, and non-infringement, to the extent the law allows. We
            are not liable for indirect or consequential loss, lost rooms, disputes between players,
            or outages. For free use, our total liability related to the service is limited to zero,
            except where a statute (including Ghana's consumer rules, if they apply and cannot be
            waived) says otherwise.
          </p>

          <h2 className="text-base font-semibold">12. Ending use</h2>
          <p>
            You can stop any time: close the tab, discard the link, clear site data, or remove the
            home-screen icon. We may suspend rooms or accounts that break these terms.
          </p>

          <h2 className="text-base font-semibold">13. Law</h2>
          <p>
            These terms are governed by the laws of the Republic of Ghana, without regard to conflict
            rules. Courts in Ghana have jurisdiction, except where a mandatory consumer law in your
            country says you may sue at home.
          </p>

          <h2 className="text-base font-semibold">14. Changes</h2>
          <p>
            We may update these terms. The date at the top changes when we do. Continued use after an
            update means you accept the new terms. If a change is material, we will show it in the app
            when we can.
          </p>

          <h2 className="text-base font-semibold">15. Contact</h2>
          <p>
            Questions: the operators via the Recess GitHub repository (Auggy19/recesshz) or the
            contact shown on the site when one is published.
          </p>
        </div>
      </div>
    </div>
  );
}
