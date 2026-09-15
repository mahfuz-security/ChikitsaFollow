# Refunds and Notifications

## Implemented

- Patients save a bank, bKash or Nagad destination in Profile. Bank routing
  numbers are nine digits; mobile numbers use the local Bangladesh format.
  No PIN, OTP, card data or banking password is accepted by the strict API.
- The API verifies the caller through Blocks IAM. Owner IDs never come from
  form input. Browser requests use the current session, not service credentials.
- Full details are AES-256-GCM encrypted with random nonces and record-bound
  authenticated data in a private SQLite store. Profiles receive only method
  and last four digits. No financial fields are stored in Blocks Case/Event,
  AI prompts, notification payloads, or browser persistent storage.
- Billing complaints can attach an encrypted, immutable destination snapshot.
  The server inserts the Case using the patient's Blocks SDK session, retaining
  their CreatedBy identity. Front desk sees only that a refund was requested.
- A manager in the case's branch needs an approved refund before revealing its
  destination or recording a manual payment. Admin/cloud roles are exceptions
  to branch scoping, not to approval. Reveals and payments are audited. Reveal
  text clears after 60 seconds, when the tab hides, or when the dialog closes.
- Recording a payment does NOT transfer money. A transaction reference and
  confirmation are required. Each case can have one recorded refund; split
  payments, reversals and multiple refund approvals require a separate workflow.
- The bell uses Blocks Notifier for inbox, unread counts, pagination and read
  actions. It polls every 30 seconds; this is not a WebSocket subscription.
- The server worker scans every minute. It targets front-desk and manager
  user IDs in the case's branch 24 hours before the deadline, and once again
  when overdue. Completed cases are excluded. Rescheduled deadlines get new
  reminders. Scope and deadline are rechecked before delivery.
- Front desk can set or reschedule a future follow-up deadline on active cases,
  including patient-submitted cases. Cases without a deadline do not generate
  deadline alerts. Managers retain their review-only case workflow.
- Case or event changes produce a generic patient notification, with reference
  only. Internal notes, employee identities, clinical data and compensation
  amounts are never included. Patient ownership uses the verified private
  patient link for staff-created cases, falling back to Case.CreatedBy for
  patient-created cases. See `PATIENT-TICKETS.md` for account association.

## Required Before Live Use

The automatic worker is NOT enabled until a dedicated Blocks machine client
is configured on the server. Set `BLOCKS_SERVICE_CLIENT_ID` and
`BLOCKS_SERVICE_CLIENT_SECRET` via a server secret manager, with the appropriate
scope if required. Never use CLI impersonation tokens or a frontend secret.
The service needs Case/CaseEvent read, IAM user-list access (including roles,
active status and branch assignment), and Notifier send. Runtime calls use
`@seliseblocks/client` including its client-credentials token helper. No live
role, schema, channel or credential changes were made by this implementation.

Run the API as an always-on service. Production must proxy `/api/private` and
`/api/assistant` to it, use HTTPS, configure exact `APP_ORIGINS`, supply
`PAYOUT_ENCRYPTION_KEY` (base64, 32 random bytes), and mount `PRIVATE_DATA_DIR`
as a persistent private volume. Use one worker/API instance for this SQLite
implementation. A scaled deployment needs a shared database and worker leases.
Do not use an ephemeral container filesystem for refunds or delivery state.
Use Node 24 or later for this server's built-in SQLite runtime; the frontend's
broader Node engine range does not apply to the private API.

Development creates a private local encryption key and database under
`app/server/.private/` (ignored by Git/Docker). Production fails to start
without an explicit encryption key. Back up the key separately from the DB;
losing it makes stored destinations unreadable. Establish key rotation,
access-reviewed encrypted backups and a retention policy before collecting
real financial data. These controls do not certify regulatory compliance.

## Delivery and Recovery

Outbox state survives restarts. Retries back off to one hour. Unique event IDs
prevent ordinary duplicate enqueues; delivery is at-least-once, not exactly
once. A crash after Blocks accepts a message can duplicate it; the inbox
deduplicates IDs within each fetched page. Failed scans log only a generic
warning. Monitor worker logs and unsent outbox rows; no dead-letter dashboard
is implemented. The first successful scan establishes an update baseline and
does not send historical update notifications. Changes between scans may be
coalesced into one generic update.

Refund submission stores its request ID before inserting the remote Case.
An ambiguous insertion failure is never automatically retried as a new case.
An operator must reconcile the private `submissions` reference with Blocks
before resolving a pending request. There is no cross-service transaction.
Destination deletion removes the reusable profile record, not snapshots
already attached to refund cases. Audit and original payment records are
retained until an approved retention process removes them.

## Verification

Automated tests cover encryption/masking, owner isolation, rejected extra
secret fields, role and branch restrictions, approval checks, immutable
snapshots, duplicate submission/payment handling, deadline boundaries,
notification retries, safe payloads and inbox parsing. UI tests use synthetic
accounts and destinations; no real bank transfer or patient notification is
sent by test execution.
