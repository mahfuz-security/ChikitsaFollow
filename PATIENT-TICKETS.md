# Patient Tickets

## Implemented Locally

- Front desk must enter a patient email when creating a complaint. The private
  API resolves an exact, active Blocks patient account and binds its immutable
  IAM ID to the case. Unknown or ambiguous accounts are rejected. Patients
  must activate their account first; there is no unverified email-claim flow.
- The email is encrypted in the private store, never written into Case fields,
  analytics, notifications or AI prompts. Branch and creation permission are
  checked server-side. Case.CreatedBy remains the submitting staff member.
- Patients see their own submitted cases and verified staff-created cases in
  their dashboard, including status, reference, deadline and shared messages.
- Patients and authorized front desk can add comments, reply to a specific
  message and post current-problem updates. Each side's latest update appears
  separately. Updates do not automatically reopen or change case status.
- Shared messages have server-authenticated actors, immutable encrypted
  storage and idempotency keys. Internal staff notes, employee identities,
  compensation data and draft provenance are excluded from patient responses.
- Managers retain internal review/comments, not patient replies or creation.
- Shared replies enqueue generic Blocks Notifier notifications: staff replies
  target the patient; patient replies target current branch managers/front desk.

## Required Before Live Use

Set server-only `BLOCKS_SERVICE_CLIENT_ID` and `BLOCKS_SERVICE_CLIENT_SECRET`
with appropriate IAM user-list, Case read and Notifier send access. These are
not configured locally yet. New staff creation and patient ticket reads fail
closed without this client; the automatic notification worker remains disabled.
No cloud role or policy changes, deployment, or real patient notifications were
performed for this change.

Use the persistent encrypted store and deployment controls described in
`REFUNDS-NOTIFICATIONS.md`. The database now also contains `ticket_links`,
`ticket_messages` and `ticket_submissions`. Backups and retention must include
these records and their separately protected encryption key.

Mandatory email association is enforced in the app/private API. Existing direct
Data Gateway creation grants need policy review and negative tests to prevent
bypassing that API. Existing staff-created cases are not guessed or linked
retroactively. Legacy CaseEvent replies are not imported into the shared thread
automatically, to avoid exposing internal information.

Creation persists a submission reference before the remote Case write. An
ambiguous remote failure requires operator reconciliation, not blind retry.
There is no cross-service transaction. Patient listing currently reads all
owned cases and individually resolves linked cases; pagination and load tests
are required before high-volume deployment. Text screening is best-effort,
not a guarantee that all clinical or sensitive content can be detected.

## Verification

Automated tests cover email association, owner and branch isolation, rejected
forged actors and reply targets, role restrictions, encrypted email storage,
and duplicate requests. Browser checks use synthetic mocked accounts and
cover patient dashboard, replies, current concerns and mobile/desktop layouts.
These checks do not establish live Blocks permissions or notification delivery.
