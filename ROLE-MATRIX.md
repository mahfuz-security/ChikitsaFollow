# Role Specification And Implementation

The latest four-role specification supersedes the earlier manager
review/comment-only restriction. The combined "Front-Desk Staff & Patient"
heading is interpreted using the explicit Patient/Family section and final
role summary: patients do not inherit staff permissions.

## Current Role Boundaries

| Role | Case responsibilities | Scope |
| --- | --- | --- |
| Front desk | Create, record initial commitments, review reply drafts, log action notes/final communications, update status, close where granted | Assigned branch; no compensation amounts |
| Branch manager | Review history, comment, verify resolved/closed outcomes, decide refunds/waivers, review performance | Assigned branch; management amounts; no complaint creation |
| Quality lead | Compare branches, inspect root causes and volume alerts, record corrective actions | Cross-branch; no case creation/closure or compensation amounts |
| Patient/family | Report a service complaint and receive an acknowledged reference | No staff case screens, analytics, internal history, or financial fields |

Admin/cloud roles remain separate operational roles, not a fifth patient-facing
role. A user with a separate administrator role retains its explicitly granted
capabilities.

## Deployed IAM Changes

Applied with approval and verified by reading the grants back:

- `front_desk`: added `blocks-data::case::update`.
- `branch_manager`: removed case creation, closure, AI drafting, patient replies,
  and approval-request creation. Retained case read/update, event read/create,
  approval decisions, and management amounts.

The application's `case-verify` action uses the existing Case update endpoint.
This is not a new deployed IAM permission. Manager general-edit controls remain
disabled. **An update grant alone does not enforce verification-only updates at
the Data Gateway.** Cloud policy/validation must constrain transitions, actors,
and fields independently; direct-API negative tests remain required.

## Dashboard Implementation

- Front desk opens on its complaint work queue; managers open on branch
  performance and quality leads on cross-branch performance. The home link is
  available to all signed-in roles. Profile shows staff roles and branch scope,
  supports self-service name updates, and reports rejected IAM saves.
- Case queues: all, active, completed, open cases logged by me, new, waiting,
  overdue, and updated in the last seven days; reference/summary search.
- Counts distinguish resolved/verified outcomes from closed-but-unverified
  complaints. Resolution averages use only resolved/verified records with valid
  creation and closure timestamps. Missing dates are excluded, never invented.
- Performance view: scoped branch totals, outcome/rate/duration comparison,
  category/severity/root-cause counts, and zero-volume branches when the branch
  directory is available.
- Spike alerts compare the last seven days with the preceding seven, requiring
  at least three complaints and double a baseline of at least one. These are
  deterministic volume alerts, not AI-detected clusters.
- Existing 30-day root-cause groups and corrective-action records are available
  to quality leads; managers see only their branch's groups without action edits.

## Not Yet Implemented

- Assignment ownership and "assigned to me" queues. CreatedBy is not an assignee;
  assignment fields, history, authorization, and cloud schema changes are needed.
- Staff-performance attribution distinct from patient-created cases.
- Anonymous patient reference lookup. Authenticated ownership-based ticket
  lists and safe shared conversations are implemented locally; see
  `PATIENT-TICKETS.md` for remaining live service setup.
- Updated commitment workflow, actual delivery acknowledgements/receipts,
  automated complaint summaries, semantic AI clusters/process recommendations,
  scheduled scans, and corrective-action recurrence measurement.
- Server-enforced immutable/atomic history, complete clinical-data exclusion,
  and independently tested branch/field isolation. Client screening is not DLP.

New English/Bangla strings are available through local fallbacks (388 keys).
The previously published Blocks common module has 358 keys; new strings have
not been published by this role-change approval.

## Live Access Audit, September 15, 2026

Read-only IAM inspection confirmed the front-desk case-create/update grants,
manager review/verification grants, and quality trend/audit grants. No role
definitions or user assignments were changed by this audit.

All three inspected staff accounts return `permissions: []` in their user
details: these are direct grants, not the role grant list. Application gates
now include the approved role mapping as well as direct permissions. Gateway
authorization remains authoritative. Server and frontend both normalize the
organization-grouped role shape returned by the user directory.

The Evercare front-desk and branch-manager records have no `BranchId`. Their
hospital membership does not establish a Branch schema foreign key. These
accounts still need a verified, administrator-controlled branch assignment;
the app must not guess a branch or allow a user to self-assign their scope.
Quality leads intentionally have cross-branch access and do not need a branch.

Patient-linked staff creation also requires the still-missing server machine
client described in `PATIENT-TICKETS.md`. Therefore the local fixes are not a
claim that all live workflows are operational or deployed. Read-only cloud
inspection and synthetic browser tests do not verify real-user write access.
