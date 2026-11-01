import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Use · SAT Practice Platform" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="October 28, 2026">
      <section>
        <h2>Who may use the platform</h2>
        <p>
          Accounts are personal and created by invitation from the academy for its students, their
          parents or guardians, and its teachers. Do not share your password or let someone else use
          your account.
        </p>
      </section>

      <section>
        <h2>Invitations and activation</h2>
        <p>
          Each student receives one invitation by email from their teacher. The link in it works for 7 days
          and lets the student choose a password; while it is valid, no second invitation is sent to the same
          email. Teachers are invited the same way by the program&apos;s lead teacher. An account is created
          when the invited person accepts these Terms and the Privacy Policy.
        </p>
      </section>

      <section>
        <h2>Teachers</h2>
        <ul>
          <li>A teacher joins the academy program of the lead teacher who invited them.</li>
          <li>The program&apos;s questions, practice sets, practice tests and study materials are shared by all its teachers. Content a teacher creates or edits belongs to the program.</li>
          <li>Each teacher sees and manages only the students they invited.</li>
        </ul>
      </section>

      <section>
        <h2>Students under 18</h2>
        <p>
          A student under 18 may activate their account only with the knowledge and agreement of a parent
          or legal guardian. By accepting these Terms when activating, the student confirms that their
          parent or guardian knows about and agrees to the use of the platform and the handling of personal
          data described in the Privacy Policy. The date and version of the Terms accepted are recorded.
        </p>
        <p className="mt-2">
          No separate approval from the parent is needed. The teacher may add the parent&apos;s email to
          link a parent account, so the parent can follow the student&apos;s progress and receive reports.
          A parent or guardian may ask the academy at any time to see, copy or delete the student&apos;s
          data, or to close the account.
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
