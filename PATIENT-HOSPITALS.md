# Patient Hospital Selection

## Local Implementation

Signup requires a hospital from the project catalog and sends its organization
ID to Blocks IAM. Rejected signup responses no longer show success. Signup no
longer attempts an unauthenticated PatientMembership insert with an email in a
user-ID field.

After authentication, `/api/private/patient-hospitals` initializes hospital
choices from the caller's IAM organization IDs. It stores them in the private
`patient_hospitals` table, keyed by authenticated IAM user ID. The first saved
hospital stays primary. Profile can add more hospitals idempotently without
removing the original. A patient whose IAM record has no recognized hospital
must choose a first hospital before submitting a complaint. Previous signup
selections that IAM did not retain cannot be reconstructed from an email.

These are patient complaint destinations, not staff access grants or clinical
data-sharing consent. No IAM roles, organization membership grants, active
session organization, or cross-patient record access change when adding one.
Actual additional IAM memberships require a separately authorized provisioning
flow; this feature does not call `iam.users.updateAccess`.

## Active Hospital And Patient IDs

Patients add or update a hospital-issued patient ID in Profile for each
hospital. Existing signup selections remain but require an ID before complaint
submission. IDs are encrypted with owner/hospital-bound authenticated data in
`patient_hospital_ids`; Profile responses show only the last four characters.
Entered IDs are UNVERIFIED. They do not prove hospital registration and never
grant access to existing complaints. No hospital registry integration or staff
verification workflow has been configured.

The top bar switches the patient's complaint context on any authenticated page.
The selected hospital is stored under the authenticated user ID in
`patient_active_hospital`. Switching requires confirmation, clears forms/open
threads and their ticket cache, and is disabled during pending writes. This
is not an IAM token/organization switch or an IAM access grant.

All new patient complaints use the private API, including non-refund cases.
The server requires a saved patient ID, resolves the hospital's configured
branch and snapshots owner, organization and encrypted patient ID in
`case_patient_identity`. Front-desk creation also requires the hospital-issued
ID while still binding ownership through exact patient-email account resolution.
Updating Profile never changes historical complaint identity snapshots.

Patient ticket lists, details and replies require the requested hospital scope
and authenticated ownership. Identical hospital IDs never join accounts or
unlock tickets. Snapshot ownership takes precedence over gateway CreatedBy.
Authorized case details show the original hospital-issued ID; lists, AI prompts
and notifications do not contain it. Case references remain separate IDs.
Legacy cases have no hospital-issued-ID snapshot and are not guessed/backfilled.

## Complaint Routing Still Requires Setup

The old form queried active Branch records while signup listed IAM
organizations. The public Branch query returned zero records during this
investigation. An organization ID is not a Branch foreign key.

The new form lists saved hospitals, preselects the primary hospital, and uses
an administrator-controlled `HOSPITAL_BRANCH_MAP` server environment value:

```json
{"<organization-id>": "<existing-active-branch-id>"}
```

No mapping values are invented. The application checks the mapped Branch is
active before inserting a Case with that BranchId, including refund requests.
Unconfigured hospitals remain visible and selected, but submission is disabled
with a specific routing-setup message. The current mapping is not configured;
creating Branch records and agreeing their hospital relationships remains
required before live submissions. This implementation supports one destination
branch per hospital; multiple branches require an explicit branch selector.

The private API must be deployed/proxied for hospital preferences to work.
Unlike the ticket directory/notification worker, this preference API does not
need machine credentials: it authenticates the caller through Blocks IAM.
Back up its persistent private SQLite store. The catalog is the same reviewed
project catalog used by signup and must be refreshed when hospitals change.
Direct Data Gateway policies still need independent negative-access tests.

## Verification

Tests cover signup payloads, absence of anonymous membership writes, immutable
primary selection, repeated additions, account isolation, forged identities,
invalid hospitals and origin restrictions. Browser checks use synthetic SDK/API
responses; no real accounts, cloud memberships, branches or complaints are
created by them. No cloud mutations were performed for this change.
