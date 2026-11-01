# Data retention policy — SAT Practice Platform

> **Draft — pending legal review.** Same status as the in-app Privacy Policy (`/privacy`).
> Version 2026-10-02.

## Principles

1. **Study history is never hard-deleted by the application.** Deactivating an account,
   invalidating an attempt or archiving content are logical states; the rows stay.
2. **The database refuses to cascade-delete history.** Answers, pauses, program enrollments,
   parent–student links and unlock requests are `ON DELETE RESTRICT` (migration
   `20261002_history_restrict_consent_fpt_snapshot`): deleting a user or an attempt by hand fails
   while history exists. Attempts already blocked user deletion.
3. **Results are immutable.** Practice attempts and exam (FPT) attempts keep a snapshot of the
   questions, answer keys and structure they were taken with; later edits never change past
   results.
4. **Deletion on request = anonymization**, not row deletion, so aggregate statistics stay
   consistent (see "Requests").

## Retention periods

| Data | Kept | Where enforced |
|---|---|---|
| Accounts, enrollments, attempts, answers, scores | While the student is active in a program and afterwards, until a deletion request | No automatic deletion |
| Deactivated accounts | Same as above (history retained) | — |
| Audit log | 365 days, then deleted | `lib/audit-retention.ts` (hourly job) |
| Notifications | Until the user's account is anonymized | `lib/privacy.ts` |
| Password-reset / invite tokens | Expire in 1 h / 7 days; consumed tokens kept for audit | token expiry checks |
| Parent consent | Date, IP and consent-text version, for the life of the invite | `InviteToken.parentConsent*` |
| On-site DB backups (every 6 h) | Kept (versioned bucket; superseded versions deleted after 30 days) | `gs://sat-sol-gsc-sat-data/backups/` |
| Off-site DB backups (daily) | 190 days (≥ 6 months) | lifecycle rule on `gs://sat-sol-gsc-backups-offsite/db/` |
| Off-site copies of question images and staging files | Kept | `gs://sat-sol-gsc-backups-offsite/files/` |
| Local VM backup copies | 3 days | `deploy/vm/sat-db-backup.sh` |
| Pre-deploy DB copies on the VM | The 2 most recent | `deploy/vm/deploy.sh` |

## Requests

- **Export:** an administrator downloads the user's data as JSON
  (`GET /api/admin/users/{id}/export`).
- **Deletion:** an administrator anonymizes the account (`POST /api/admin/users/{id}/anonymize`,
  typed confirmation). Name, email, phone, birth date, avatar and notes are removed, the account
  is disabled and sessions end. Anonymous scores remain for statistics.
- Backups taken before an anonymization still contain the original data until they expire
  (190 days at most off-site). A restore after an anonymization must re-apply it.

## Owners

Academy administrator (requests) and the platform operator (backups, retention jobs).
Review this policy whenever a new data category is added.
