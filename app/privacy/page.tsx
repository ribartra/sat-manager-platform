import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { AUDIT_RETENTION_DAYS } from "@/lib/audit-retention";

export const metadata: Metadata = { title: "Privacy Policy · SAT Practice Platform" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 1, 2026">
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
          <li>Parent consent for minors: the parent&apos;s name, email and the date and IP address of the consent.</li>
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
        </ul>
      </section>

      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>The student sees their own data.</li>
          <li>Teachers see students enrolled in the programs they teach.</li>
          <li>Parents see the students linked to their account.</li>
          <li>Academy administrators can see all accounts to operate the platform.</li>
        </ul>
        <p className="mt-2">
          Service providers that process data for us: Google Cloud (hosting, database backups and file
          storage) and Brevo (email delivery). Mistral AI is only used to digitize study material; no
          student data is sent to it. We do not sell or share data for marketing.
        </p>
      </section>

      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>Accounts and study history are kept while the student takes part in a program, so progress can be compared over time. Deactivated accounts keep their history unless deletion is requested.</li>
          <li>Audit log entries are deleted after {Math.round(AUDIT_RETENTION_DAYS / 30)} months.</li>
          <li>Database backups are kept for a limited period and then deleted automatically.</li>
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
        <h2>Minors and parent consent</h2>
        <p>
          When a student is a minor, the account is only activated after a parent or guardian gives
          consent through a personal link. The parent can then follow the student&apos;s progress.
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
