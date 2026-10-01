import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back to Recess
        </Link>
        <Wordmark size="sm" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: 1 October 2026</p>

        <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-foreground/90">
          <p>
            Recess is built for a short game in a chat, not a dossier. This policy says what we store,
            why, and how to get rid of it. It sits alongside the Terms of Use.
          </p>
          <p className="text-sm text-muted-foreground">
            Operators are in Ghana. Processing is meant to follow the Data Protection Act, 2012 (Act
            843), as far as it applies to a small free web app. This page is a plain-language notice,
            not a filing with the Data Protection Commission.
          </p>

          <h2 className="text-base font-semibold">1. Who is responsible</h2>
          <p>
            The operators of Recess (project Auggy19/recesshz) decide why player and room data is
            processed. Hosting and database vendors process some of it for us.
          </p>

          <h2 className="text-base font-semibold">2. Data we need to run a game</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Device token.</strong> A random ID in your browser so a room knows which seat is yours. Not your name, phone, or email.</li>
            <li><strong>Room state.</strong> Slug, game type, board, moves, scores, prompts, turn, status. Needed so both phones see the same match.</li>
            <li><strong>Timestamps.</strong> Created and updated times, used for turns and the roughly 48-hour expiry.</li>
          </ul>

          <h2 className="text-base font-semibold">3. Data you can choose to give</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Account.</strong> If you sign in, an email address and a login session. We do not need a password you invent; email codes are the current method.</li>
            <li><strong>Feedback.</strong> Rating and the note you type.</li>
            <li><strong>Prompts.</strong> Truth or Dare and similar text you or your friend enter. Visible to people in that room.</li>
            <li><strong>Display name.</strong> Only if an account feature asks for one.</li>
          </ul>

          <h2 className="text-base font-semibold">4. Data on your device</h2>
          <p>
            Local storage may hold theme, mute, streak, tutorial dismissal, splash dismissal, guest
            room count, and the device token. We cannot read that store until the app sends something
            to the server. Clear site data in the browser to wipe it.
          </p>

          <h2 className="text-base font-semibold">5. What we do not ask for</h2>
          <p>
            Ordinary play does not ask for your legal name, phone number, government ID, contacts, or
            precise GPS. Do not type those into prompts. We do not sell player lists.
          </p>

          <h2 className="text-base font-semibold">6. Why we process it</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>To create and sync a room you asked for.</li>
            <li>To tell seats apart and reject a third joiner.</li>
            <li>To expire idle rooms and keep the free database usable.</li>
            <li>To fix bugs, count rough daily totals, and read feedback you sent.</li>
            <li>To run optional sign-in and, if you opt in later, keep a score.</li>
          </ul>
          <p>
            Legal bases we rely on: your request to open a room (contract / steps before a contract),
            legitimate interest in operating and securing a free game, and consent where you submit
            feedback or create an account.
          </p>

          <h2 className="text-base font-semibold">7. Processors</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Vercel.</strong> Serves the website. May log IP address, user agent, and request path.</li>
            <li><strong>Supabase.</strong> Database, auth, and edge functions for rooms and moves. Data may sit in a region Supabase assigns to the project.</li>
            <li><strong>GitHub.</strong> Source code and deploy logs, not your match board.</li>
            <li><strong>Ad partners,</strong> only if an ad unit is actually loaded. They may set cookies under their own policy.</li>
          </ul>
          <p>
            A room link you paste into WhatsApp, iMessage, or SMS is handled by that app, not by us.
          </p>

          <h2 className="text-base font-semibold">8. Retention</h2>
          <p>
            Rooms are temporary and are meant to drop after inactivity (about 48 hours). Feedback and
            aggregate daily counts may be kept longer so we can see if the product works. Account
            email is kept while the account exists. Server logs follow the host's normal window.
          </p>

          <h2 className="text-base font-semibold">9. Sharing</h2>
          <p>
            We share room state with the other player who has the link. We share technical data with
            the processors above. We may disclose information if the law requires it. We do not sell
            personal data.
          </p>

          <h2 className="text-base font-semibold">10. Children</h2>
          <p>
            Recess is a general-audience casual game. It is not directed at children under 13. If you
            are a parent and believe a child sent personal data in a prompt or account, contact us and
            we will delete what we can still find in active systems.
          </p>

          <h2 className="text-base font-semibold">11. Your choices</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Discard the link. That ends your practical access to the room.</li>
            <li>Clear site data to reset the device token, streak, and tutorial flag.</li>
            <li>Do not create an account if you do not want an email stored.</li>
            <li>Ask us to delete feedback or an account email tied to you. We may need the room slug or the address you used.</li>
            <li>Use browser controls to limit third-party cookies if ads appear.</li>
          </ul>
          <p>
            Under Act 843 you may have rights to access and correct personal data we hold, subject to
            exemptions. Write to the contact below. We will respond within a reasonable time.
          </p>

          <h2 className="text-base font-semibold">12. Security</h2>
          <p>
            Room writes go through server checks, not an open table. Links are unguessable enough for
            casual play, not a bank vault. Anyone you send the link to can open the room. Use a fresh
            room for a private match.
          </p>

          <h2 className="text-base font-semibold">13. Changes</h2>
          <p>We will change the date at the top when this notice changes. Continued use means you have seen the new date.</p>

          <h2 className="text-base font-semibold">14. Contact</h2>
          <p>
            Privacy requests: the operators via the Recess GitHub repository (Auggy19/recesshz) or the
            contact published on the site. If you are in Ghana and unhappy with our reply, you may
            contact the Data Protection Commission.
          </p>
        </div>
      </div>
    </div>
  );
}
