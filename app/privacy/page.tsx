import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit-retention";

export const metadata: Metadata = { title: "Privacy Policy · SAT Practice Platform" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 28, 2026">
      <section>
        <p>
          This platform is used by the academy to prepare students for the SAT. It is not open to the
          public: accounts are created by invitation from the academy. This page explains what data we
          keep, why, who can see it and how to ask for a copy or for its deletion.
        </p>
      </section>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Account data: name, email, optional phone, role (student, parent, teacher, admin) and program.</li>
          <li>For students: birth date or whether the student is a minor, start date and an optional profile picture.</li>
          <li>Study activity: answers, time per question, questions marked for review, eliminated options, personal notes, scores and attempt history.</li>
          <li>Parent or guardian: name, email and optional phone, when the teacher or the invitation adds them.</li>
          <li>Acceptance of the Terms: the date and the version accepted at activation.</li>
          <li>Problem reports: when you use &quot;Report a problem&quot;, your comment, the page address, the selected element and a screenshot of the page.</li>
          <li>Security records: sign-ins, failed sign-ins and administrative actions (the audit log).</li>
        </ul>
        <p className="mt-2">We do not collect payment data, precise location, or data from other websites, and we do not use advertising or tracking cookies. The only cookie is the session cookie that keeps you signed in.</p>
      </section>

      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To run practice sets and full practice tests and to save progress automatically.</li>
          <li>To show progress reports to the student, their teacher and linked parents.</li>
          <li>To send account emails (invitations, password resets, parent consent) and reports a teacher chooses to send to parents.</li>
          <li>To keep the platform secure and to investigate misuse.</li>
          <li>To fix the problems users report.</li>
        </ul>
      </section>

      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>The student sees their own data.</li>
          <li>Teachers see the students they invited. The program&apos;s study content is shared by its teachers, but student data is not.</li>
          <li>Parents see the students linked to their account.</li>
          <li>Academy administrators can see all accounts to operate the platform.</li>
        </ul>
        <p className="mt-2">
          Service providers that process data for us: Google Cloud (hosting, database backups and file
          storage) and Brevo (email delivery, including problem reports sent to the academy administrator). Mistral AI is only used to digitize study material; no
          student data is sent to it. We do not sell or share data for marketing.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>Accounts and study history are kept while the student takes part in a program, so progress can be compared over time. Deactivated accounts keep their history unless deletion is requested.</li>
          <li>Problem reports and their screenshots are kept so the academy can follow up on them; you can ask the administrator to delete a report.</li>
          <li>Audit log entries are deleted after {Math.round(AUDIT_RETENTION_DAYS / 30)} months.</li>
          <li>Study history is never deleted automatically: deactivating an account or invalidating an attempt keeps the record, and past results do not change if a question is edited later.</li>
          <li>Database backups are kept for up to 6 months in a separate location and then deleted automatically. A deletion request is applied to the live data at once; older backups expire on that schedule.</li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          The site is only served over HTTPS. Passwords are stored as one-way hashes, sessions expire
          after 7 days and end when the password is changed or the account is disabled. Question
          images and profile pictures are only available to signed-in users.
        </p>
      </section>

      <section>
        <h2>Minors and parents</h2>
        <p>
          A student under 18 activates the account by accepting the Terms of Use, confirming that a parent
          or guardian knows about and agrees to the use of the platform and this policy. No separate consent
          link is sent. When the teacher adds the parent&apos;s email (or it was given in the invitation), a
          parent account is linked so the parent can follow the student&apos;s progress.
        </p>
      </section>

      <section>
        <h2>Your rights</h2>
        <p>
          A student, or the parent of a minor, can ask the academy for a copy of the data (delivered
          as a file), for corrections, or for deletion. On deletion we remove the name, email, phone,
          birth date, profile picture and personal notes and disable the account; anonymous scores
          may be kept for the academy&apos;s statistics. Contact your teacher or the academy
          administrator to make a request.
        </p>
      </section>
    </LegalPage>
  );
}
