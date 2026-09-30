import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Use · SAT Practice Platform" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="October 1, 2026">
      <section>
        <h2>Who may use the platform</h2>
        <p>
          Accounts are personal and created by invitation from the academy for its students, their
          parents or guardians, and its teachers. Do not share your password or let someone else use
          your account.
        </p>
      </section>

      <section>
        <h2>Study content</h2>
        <p>
          Questions, explanations, practice sets and practice tests are provided for your personal
          preparation while you are enrolled. Do not copy, publish, sell or share them outside the
          platform, including screenshots of questions or answer keys.
        </p>
      </section>

      <section>
        <h2>Fair use</h2>
        <ul>
          <li>Complete practice tests yourself; results are used by your teacher to plan your preparation.</li>
          <li>Do not try to access other users&apos; data or parts of the platform your role does not include.</li>
          <li>Do not disrupt the service (for example, with automated requests).</li>
        </ul>
        <p className="mt-2">The academy may disable an account that breaks these rules.</p>
      </section>

      <section>
        <h2>Scores</h2>
        <p>
          Scores are estimates to guide practice. They are not official SAT scores and do not predict
          a specific result on test day.
        </p>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          We work to keep the platform available during classes, but it may be briefly unavailable for
          maintenance or updates. Answers are saved automatically, including on the device if the
          connection drops.
        </p>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>
          How we handle personal data is described in the <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
        </p>
      </section>
    </LegalPage>
  );
}
