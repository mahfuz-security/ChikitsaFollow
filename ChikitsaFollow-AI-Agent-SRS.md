# Software Requirements Specification (SRS)

## ChikitsaFollow Builder Agent
### An AI Agent for Generating Clinic Follow-up & Service Recovery Software

**Document version:** 1.1
**Date:** September 14, 2026
**Status:** Draft for review — v1.1 adds API contract, security/threat model, and test plan

---

## 1. Introduction

### 1.1 Purpose
This SRS specifies the functional and non-functional requirements for the **ChikitsaFollow Builder Agent** — an AI agent that, given a structured intake describing a diagnostic clinic or hospital chain, generates a deployable, multi-role service-recovery/complaint-management application for that clinic. This document is written to be usable by engineers implementing the agent, QA verifying it, and stakeholders approving scope.

This SRS follows the intent of IEEE 830 structure, adapted for an AI-agent-as-code-generator system rather than a conventional end-user application.

### 1.2 Scope
The system in scope is the **builder agent itself** — the pipeline that takes clinic intake and produces:
- a data model,
- a backend/API,
- role-based UIs (front desk, branch manager, quality lead, admin),
- a configured runtime AI subsystem (drafting, categorization, trend detection),
- a compliance report,
- and a deployment package.

Out of scope: the specific behavior of any one clinic's deployed instance beyond what is generated from intake; integration with clinical systems beyond an optional read-only status feed; legal/regulatory certification for any jurisdiction.

### 1.3 Intended Audience
- Engineers building the agent's generation pipeline
- QA/test engineers validating generated output against acceptance criteria
- Product owners approving the agent's scope per clinic engagement
- Compliance/security reviewers auditing the firewall and access-control guarantees

### 1.4 Definitions, Acronyms, Abbreviations

| Term | Meaning |
|---|---|
| SRS | Software Requirements Specification |
| Agent | The AI system that generates the clinic application (subject of this SRS) |
| Generated App / Instance | The clinic-specific application produced by the agent |
| Firewall | The enforcement layer preventing clinical data from entering complaint records |
| Root cause | A closed-vocabulary tag applied to a case at closure |
| Reference code | A masked, non-clinical identifier used in place of patient identity |
| LIS/LIMS | Laboratory Information (Management) System |
| RBAC | Role-Based Access Control |

### 1.5 References
- Source case document: *"10. ChikitsaFollow: Clinic Follow-up and Service Recovery Desk"*
- Companion document: *ChikitsaFollow-AI-Agent-Spec.md* (architecture/design spec for this agent)

### 1.6 Overview
Section 2 describes the agent at a product level, including the primary-customer priority. Section 3 gives detailed functional, UX, and non-functional requirements. Section 4 specifies external interfaces. Section 5 covers data requirements. Section 6 lists constraints and assumptions. Section 7 defines acceptance criteria. Section 8 specifies the detailed API contract. Section 9 covers security requirements and the threat model. Section 10 defines the test plan and production-readiness exit criteria. Section 11 provides traceability back to the source case.

---

## 2. Overall Description

### 2.1 Product Perspective
The agent is a standalone generation system. It is invoked per clinic engagement, consumes a structured intake, and emits a self-contained application plus supporting documentation. It is not itself the clinic-facing product; it is the factory that produces it. It may be re-invoked to regenerate or update an instance when a clinic's intake changes (e.g., a new branch is added).

### 2.2 Product Functions (Summary)
1. Parse and validate clinic intake; apply safe defaults for missing fields.
2. Generate a data model enforcing structural separation of clinical and complaint data.
3. Generate a backend/API enforcing role-based access and field-level money visibility.
4. Generate role-scoped UIs for front desk, branch manager, quality lead, and admin.
5. Configure a runtime AI subsystem for per-case drafting and cross-branch trend detection.
6. Run a guardrail-injection and compliance-verification pass over all generated layers.
7. Produce a compliance report and deployment package.
8. Self-test the generated instance against a defined acceptance scenario before handoff.

### 2.3 Primary Customer Definition

**The primary customer of the generated app is the root-level (front-desk) user** — not the branch manager, not the quality lead. This is a deliberate priority, not just one persona among several:

- Front-desk staff are the highest-volume users (many times per day, per branch), under time pressure, at a public counter, often with no prior software training and no time to be trained at length.
- If the front-desk experience is not fast and effortless, the entire system fails at its source: cases won't get logged, and everything downstream (dashboards, trend detection, quality fixes) collapses because there's no data to work with.
- Every other role's value (manager visibility, quality-lead trend detection) is a *consequence* of the root-level user actually using the tool willingly. Usability for this persona is therefore treated as a top-level product requirement, not a "nice to have" — see Section 3.7.

Design rule the agent must follow: **when a trade-off arises between admin/analytics sophistication and front-desk simplicity, front-desk simplicity wins.**

### 2.4 User Classes and Characteristics (of the Generated App — since the Agent's "users" are engineers configuring it)

| User class | Technical proficiency | Frequency of use |
|---|---|---|
| Front-desk staff | Low; needs a fast, simple form | Many times/day |
| Branch manager | Medium; reviews dashboards, approves | Daily |
| Quality lead | Medium-high; interprets trends, authors process fixes | Weekly |
| Clinic admin | Medium; configures roles/vocabulary | Occasional |
| Patient/family (optional status view) | Low; reference-code lookup only | Rare, per-case |
| Builder-agent operator (engineer) | High; provides intake, reviews compliance report | Per engagement |

### 2.5 Operating Environment
- Generated backend: containerized service, cloud or on-prem deployable per clinic data-residency needs.
- Generated frontend: responsive web UI, usable on desktop (branch/quality-lead use) and tablet/mobile (front-desk counter use).
- Runtime AI subsystem: calls an LLM API with the guardrails specified in Section 3.4.

### 2.6 Design and Implementation Constraints
- No table in the generated schema may store diagnosis, test-result, or clinical-value fields (Section 5.2).
- All access-control and money-visibility rules must be enforced server-side; UI-only enforcement is non-conforming.
- Root-cause tagging must use a closed, admin-managed vocabulary, not free text.
- All patient identifiers exposed to the complaint system must be masked reference codes.

### 2.7 Assumptions and Dependencies
- The clinic provides accurate branch, role, and category intake; the agent does not infer clinic structure independently.
- An LLM API is available to the generated instance at runtime for AI-assisted drafting and trend detection.
- The clinic's existing patient database (if integrated for masking lookups) exposes no clinical fields to the complaint system's queries.

---

## 3. Specific Requirements

Requirements are numbered `FR-x` (functional) and `NFR-x` (non-functional) for traceability. Priority: **M**ust, **S**hould, **C**ould.

### 3.1 Intake & Configuration

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | The agent shall accept a structured intake (per the schema in the companion design spec) describing clinic name, branches, roles, complaint categories, money-flow rules, language, compliance region, and integration targets. | M |
| FR-2 | The agent shall validate intake and, for any missing optional field, apply a documented safe default (e.g., money flows disabled, patient status view disabled). | M |
| FR-3 | The agent shall record all applied defaults in a generated README so the clinic operator can review and override them. | M |
| FR-4 | The agent shall support re-invocation on updated intake (e.g., new branch added) without requiring a full manual rebuild. | S |

### 3.2 Case Management (Generated App Behavior)

| ID | Requirement | Priority |
|---|---|---|
| FR-5 | The generated app shall allow front-desk users to create a case with branch, category, severity, promised commitment, and a masked patient reference in under 60 seconds of active input. | M |
| FR-6 | The generated app shall permanently and immutably record, for every case: what happened, who took each action, and the exact text communicated to the patient. | M |
| FR-7 | Case records shall be append-only; corrections shall be recorded as new linked entries, never as edits to existing entries. | M |
| FR-8 | The generated app shall require selection of a root cause from a closed, admin-managed vocabulary before a case can be closed. | M |
| FR-9 | The generated app shall support an approval workflow for any case involving a monetary remedy (fee waiver, refund, voucher), routed to the role/tier defined in intake. | M |
| FR-10 | Money amounts shall be excluded from any API response or UI rendering visible to the front-desk role. | M |
| FR-11 | The generated app shall optionally expose a patient-facing status view, keyed only by reference code, containing no clinical content, if enabled in intake. | C |

### 3.3 Access Control

| ID | Requirement | Priority |
|---|---|---|
| FR-12 | The generated app shall scope front-desk and branch-manager data access to their assigned branch at the data-query layer. | M |
| FR-13 | The generated app shall grant the quality-lead role cross-branch read access and process-action-authoring rights, with no case-resolution authority. | M |
| FR-14 | The generated app shall grant the admin role configuration access (roles, vocabulary, categories) with no default access to case content. | M |
| FR-15 | Role permissions shall be enforced server-side; a client-side-only restriction shall be considered a non-conformance. | M |

### 3.4 AI-Assisted Functions

| ID | Requirement | Priority |
|---|---|---|
| FR-16 | Given complaint text (potentially mixed-language), the runtime AI shall produce a summary, a category suggestion, a root-cause hint, and a draft reply, in the patient's language/register. | M |
| FR-17 | AI-drafted replies shall require explicit staff review and edit before sending; both the original draft and the final sent text shall be logged. | M |
| FR-18 | AI root-cause hints shall be presented as editable suggestions only; the agent shall not auto-apply a root cause without staff confirmation. | M |
| FR-19 | The runtime AI shall scan input text for clinical content (diagnoses, test results, drug names, lab values) before generating a case record and shall block submission with a specific, actionable message if such content is detected. | M |
| FR-20 | A scheduled background process shall analyze closed cases across branches, cluster them by root cause, branch, and time window, and flag statistically notable spikes. | S |
| FR-21 | On flagging a spike, the system shall generate a draft process-fix recommendation, visible only to the quality-lead role, without human prompting. | S |
| FR-22 | No prompt sent to the underlying LLM shall include unmasked patient identity or clinical data. | M |

### 3.5 Compliance & Verification

| ID | Requirement | Priority |
|---|---|---|
| FR-23 | The agent shall run an automated guardrail-verification pass over generated schema, API, and UI layers prior to handoff, confirming Section 3.2–3.4 rules are structurally present. | M |
| FR-24 | The agent shall produce a compliance report documenting which rules were verified and how (e.g., "money field absent from front-desk serializer: confirmed by response schema diff"). | M |
| FR-25 | The agent shall run the acceptance scenario in Section 7 against every generated instance and shall not mark generation complete if any check fails. | M |

### 3.7 Root-Level User Experience Requirements

These requirements exist specifically because the front-desk (root-level) user is the primary customer (Section 2.3). They are elevated above general usability polish — the agent must treat them as hard requirements of every generated instance, not stylistic suggestions.

| ID | Requirement | Priority |
|---|---|---|
| UX-1 | The front-desk case-entry screen shall be completable using large, thumb/finger-friendly touch targets (minimum 44×44px), suitable for a busy counter on a tablet or low-spec desktop. | M |
| UX-2 | The front-desk flow shall require **zero training beyond a 5-minute walkthrough** — achieved through visible labels (not icons alone), step-by-step prompts, and no hidden menus for core actions (log case, view status, mark resolved). | M |
| UX-3 | Category, severity, and root-cause-hint selection shall use tap-to-select chips/buttons, not free-text or multi-level dropdowns, wherever the option set is known. | M |
| UX-4 | The AI-drafted reply shall be presented in a single editable text box with the draft pre-filled — the front-desk user's job is to *review and tap Send*, not compose from scratch. | M |
| UX-5 | Every screen shall show a persistent, plain-language indicator of "what happens next" (e.g., "Waiting for manager approval" / "Sent to patient") so the root-level user is never unsure of case state. | M |
| UX-6 | Error messages shall be written in plain, non-technical language in the clinic's configured language(s), and shall always state the corrective action (e.g., "Please choose a reason — this can't be left blank" rather than "Validation failed: category required"). | M |
| UX-7 | The interface shall support the clinic's local language as the default display language for the front-desk role, with English as secondary if configured, matching how staff actually speak with patients. | M |
| UX-8 | The generated app shall tolerate brief network interruptions at the front desk (e.g., local draft retention with retry-on-reconnect) so a counter-side connectivity blip does not lose an in-progress case entry. | S |
| UX-9 | No front-desk screen shall require more than 3 taps/steps to reach case submission from the home screen. | M |
| UX-10 | Visual design shall use clear color-coded status states (e.g., open/in-progress/resolved) understandable at a glance, without relying on color alone (icon/label backup for accessibility). | S |
| UX-11 | The agent shall usability-test (or simulate via heuristic walkthrough) the generated front-desk flow against Section 7's AC-1 timing target (<60 seconds) as part of its self-test pass, not just measure backend latency. | M |

Design rule: **if the agent must choose between a more powerful admin/analytics feature and a simpler front-desk screen, it defaults to the simpler front-desk screen**, consistent with Section 2.3.

### 3.8 Non-Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| NFR-1 | **Performance:** Case creation (front-desk flow) shall complete server-side processing in under 2 seconds under normal load. | M |
| NFR-2 | **Availability:** The generated app's core case-logging function shall target 99.5% uptime during clinic operating hours. | S |
| NFR-3 | **Data integrity:** The audit log (CaseEvent, AuditLog tables) shall be tamper-evident; no direct row deletion shall be possible through the application layer. | M |
| NFR-4 | **Security:** All data in transit shall use TLS; data at rest containing patient reference mappings shall be encrypted. | M |
| NFR-5 | **Data residency:** The agent shall flag, per the intake's `compliance_region`, any known data-residency expectation for the clinic operator's review (informational, not a legal guarantee). | S |
| NFR-6 | **Localization:** The generated UI and AI-drafted communications shall support the language(s) specified in intake, including mixed-language input. | M |
| NFR-7 | **Usability:** The front-desk case-creation form shall require no more than 6 input fields to submit a minimally valid case. See Section 3.7 (UX-1–UX-11) for the full root-level-user experience requirement set, which takes precedence over other UI considerations. | M |
| NFR-8 | **Auditability:** Every AI-generated suggestion (draft reply, root-cause hint, trend flag) shall be distinguishable in storage from human-entered content. | M |
| NFR-9 | **Extensibility:** New complaint categories and root causes shall be addable by an admin without a code deployment. | S |
| NFR-10 | **Portability:** The generated deployment package shall run in both cloud and on-prem container environments without code changes. | C |

---

## 4. External Interface Requirements

### 4.1 User Interfaces
- Front-desk case-entry form (desktop/tablet), optimized for speed.
- Branch-manager dashboard: volume, average resolution time, verified-vs-merely-closed rate, approvals queue.
- Quality-lead dashboard: cross-branch trend view, flagged clusters, process-fix draft review.
- Optional patient status page: reference-code entry, non-clinical status only.

### 4.2 Software Interfaces
- **LLM API**: for summarization, categorization, drafting, and trend-flag narrative generation. Called with masked/non-clinical payloads only (FR-22).
- **Optional LIS/LIMS read-only feed**: report-ready boolean status only; no test values ingested.
- **Notification channel** (SMS/email/call-log, per clinic preference): for sending approved patient communications, configured but not mandated by this SRS.
- **Internal REST API**: see Section 8 for the full endpoint-level contract (routes, roles, request/response shapes, error codes).

### 4.3 Communications Interfaces
- All API traffic over HTTPS.
- Internal service-to-service calls (if the generated app is multi-service) authenticated via signed service tokens.

---

## 5. Data Requirements

### 5.1 Core Entities
See companion design spec Section 7 for full schema (`Branch`, `User`, `Case`, `CaseEvent`, `Approval`, `RootCause`, `CaseRootCause`, `TrendFlag`, `AuditLog`).

### 5.2 Data Constraints
- DC-1: No entity in the generated schema shall include a field typed or named for diagnosis, test result, or clinical measurement.
- DC-2: `Case.patient_ref_code` shall be a generated, non-reversible-by-default reference, distinct from any clinical MRN.
- DC-3: `Approval.amount` shall be excluded from any serializer used by the front-desk role.
- DC-4: `CaseEvent` rows shall be immutable once written (insert-only at the storage layer).

### 5.3 Data Retention
- Retention periods shall be configurable per `compliance_region` in intake; the agent shall apply a conservative default (e.g., retain audit trail indefinitely, archive after a configurable inactive period) and document it in the generated README.

---

## 6. Constraints, Assumptions, and Dependencies

- **Constraint:** The agent must not generate any design permitting clinical data to reach the complaint system, even transitively (e.g., via free-text fields or unmasked identifiers).
- **Constraint:** Money-approval authority must map to the tiers defined in intake; the agent shall not hardcode approval thresholds.
- **Assumption:** The clinic operator reviews and confirms the generated README's list of applied defaults before go-live.
- **Dependency:** Availability of an LLM API for the runtime AI subsystem; if unavailable, the generated app shall degrade to manual-only case entry (no drafting/trend features) rather than fail entirely.

---

## 7. Acceptance Criteria

A generated instance is accepted only if all of the following pass (mirrors the demo scenario in the companion design spec):

1. AC-1: Front desk logs a report-delay case with masked reference in under 60 seconds.
2. AC-2: AI drafts a reply; staff edits a detail; both draft and sent versions are retained in `CaseEvent`.
3. AC-3: Case is closed with a root-cause tag from the closed vocabulary.
4. AC-4: Three similar cases at one branch, same root cause, within a defined window, trigger a `TrendFlag` with a drafted process-fix, visible only to quality lead.
5. AC-5: A test submission containing a diagnosis-like term is rejected by the firewall with a specific, actionable message.
6. AC-6: A front-desk API response for a case with an approved refund contains no `amount` field.
7. AC-7: A branch manager can, for any given case, retrieve resolution status and the exact text sent to the patient in a single view.
8. AC-8: A first-time front-desk user, given only a 5-minute walkthrough, completes case creation end-to-end without assistance.
9. AC-9: Case submission from the front-desk home screen is reachable in 3 taps/steps or fewer.
10. AC-10: All front-desk error states display plain-language, corrective-action messages in the clinic's configured local language.

---

## 8. API Contract

This section specifies the concrete REST API surface engineers implement against. All endpoints are versioned under `/api/v1/`. All responses are JSON. All endpoints require an `Authorization: Bearer <token>` header except `POST /auth/login`.

### 8.1 Conventions
- Standard error envelope:
```json
{ "error": { "code": "STRING_CODE", "message": "human-readable, plain language", "field": "optional_field_name" } }
```
- Standard HTTP codes: `200` success, `201` created, `400` validation error, `401` unauthenticated, `403` role-forbidden, `404` not found, `409` conflict (e.g., case already closed), `422` firewall-blocked content, `500` server error.
- Pagination: `?page=1&page_size=25`, response includes `{ "items": [...], "total": N, "page": N }`.
- All list/detail endpoints apply role-based row filtering server-side (FR-12, FR-13, FR-15) before any other query logic runs — filtering is never optional or client-supplied.

### 8.2 Authentication & Session

| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Body: `{ username, password }` or clinic-configured SSO token exchange. Returns `{ access_token, refresh_token, role, branch_id }`. |
| POST | `/auth/refresh` | Body: `{ refresh_token }`. Returns new `access_token`. |
| POST | `/auth/logout` | Invalidates refresh token server-side. |

### 8.3 Case Endpoints

| Method | Path | Role(s) | Description |
|---|---|---|---|
| POST | `/cases` | front_desk, branch_manager | Create a case. Body validated against DC-1/DC-2; text fields pass through the firewall scan (FR-19) before insert — a block returns `422` with `error.code = "CLINICAL_CONTENT_DETECTED"` and a specific `message`. |
| GET | `/cases` | all (row-filtered by role) | List cases. `front_desk`/`branch_manager` auto-filtered to `branch_id`; `quality_lead` sees all; response **omits `amount` fields entirely for `front_desk`** (not just nulled — key absent from payload, per DC-3/FR-10). |
| GET | `/cases/{id}` | all (row-filtered) | Case detail including `CaseEvent` history. Same amount-field omission rule applies. |
| POST | `/cases/{id}/events` | front_desk, branch_manager | Append an action/note. Firewall-scanned. Append-only — no PUT/PATCH/DELETE exists on this resource (DC-4). |
| POST | `/cases/{id}/ai-draft` | front_desk, branch_manager | Requests AI summary/category/root-cause-hint/reply draft for the case (FR-16). Returns draft text; **does not** write to `CaseEvent` — that only happens on `/send`. |
| POST | `/cases/{id}/send-reply` | front_desk, branch_manager | Sends the (possibly edited) reply. Body: `{ draft_text, final_text }`. Both are persisted to `CaseEvent` (FR-17). |
| POST | `/cases/{id}/close` | front_desk, branch_manager | Body: `{ root_cause_id }`, required (FR-8). Returns `409` if `root_cause_id` missing or case already closed. |

### 8.4 Approval Endpoints

| Method | Path | Role(s) | Description |
|---|---|---|---|
| POST | `/cases/{id}/approvals` | front_desk (request only, no amount visibility on response), branch_manager, quality_lead | Request a monetary remedy. Body: `{ amount, amount_type }`. Response to `front_desk` caller omits `amount` (echo suppressed) — confirmation is by `approval_id` and status only. |
| POST | `/approvals/{id}/decision` | branch_manager (within tier), quality_lead | Body: `{ decision: "approved"|"rejected", note }`. Enforces tier limits from intake — request above a role's configured max returns `403` with `error.code = "APPROVAL_TIER_EXCEEDED"`. |

### 8.5 Root Cause & Trend Endpoints

| Method | Path | Role(s) | Description |
|---|---|---|---|
| GET | `/root-causes` | all | List active closed-vocabulary root causes for the clinic. |
| POST | `/root-causes` | admin | Add a new root cause (NFR-9). |
| GET | `/trends/flags` | quality_lead only | List `TrendFlag` records with drafted process-fix text. `403` for all other roles. |
| POST | `/trends/flags/{id}/action` | quality_lead only | Mark a flag as actioned/dismissed, with note. |

### 8.6 Dashboard Endpoints

| Method | Path | Role(s) | Description |
|---|---|---|---|
| GET | `/dashboard/branch/{branch_id}` | branch_manager (own branch), quality_lead (any) | Volume, avg resolution time, verified-vs-merely-closed rate, open approvals. |
| GET | `/dashboard/cross-branch` | quality_lead only | Aggregate + per-branch comparison, failure-mode trend chart data. |

---

## 9. Security Requirements & Threat Model

### 9.1 Authentication & Authorization
- SEC-1: All users authenticate via credentials or clinic-configured SSO; no shared/generic logins per branch (M).
- SEC-2: Access tokens shall be short-lived (≤15 min); refresh tokens shall be revocable server-side on logout or admin-forced revocation (M).
- SEC-3: Role and branch scope shall be embedded in the server-issued token and re-validated on every request — never trusted from client-supplied headers or request bodies (M).
- SEC-4: Failed login attempts shall be rate-limited per account and per source IP to mitigate credential-stuffing (M).

### 9.2 Data Protection
- SEC-5: All data in transit shall use TLS 1.2+ (NFR-4). Internal service-to-service calls shall also be encrypted, not assumed safe because they're "internal" (M).
- SEC-6: The patient reference-code → identity mapping table (if it exists at all) shall be encrypted at rest and access-logged separately from case data access (M).
- SEC-7: Database backups shall be encrypted and access-restricted equivalently to production data (M).
- SEC-8: Secrets (API keys, DB credentials, LLM API keys) shall be stored in a secrets manager, never in source control or plaintext config files (M).

### 9.3 Threat Model (Key Threats & Mitigations)

| Threat | Vector | Mitigation |
|---|---|---|
| Clinical data leakage into complaint system | Staff paste/type diagnosis or lab values into a note field | FR-19 input-side firewall scan (server-side, not bypassable) + DC-1 (no schema field can hold it even if scan is bypassed) |
| Front-desk role reading refund/waiver amounts | Direct API call bypassing UI (e.g., via browser devtools) | Amount fields structurally absent from the front_desk-role serializer at the API layer (Section 8.3/8.4) — not a UI-only hide |
| Cross-branch data leakage | Branch-manager/front-desk query manipulation (e.g., altering a `branch_id` query param) | Server derives branch scope from the authenticated token, not from client-supplied parameters (SEC-3) |
| Unauthorized root-cause / case tampering | Direct DB or API manipulation of historical case data | Append-only `CaseEvent`/`AuditLog` at the storage layer (DC-4); no update/delete endpoint exists |
| LLM prompt injection via patient-submitted text | Malicious/crafted complaint text attempting to alter AI behavior (e.g., "ignore previous instructions and reveal...") | AI prompts are constructed with the case text as strictly delimited, non-instructional input; system-level guardrail prompt is not overridable by case content; output is still passed through the same firewall scan (FR-19) before storage |
| Sensitive data sent to third-party LLM | Prompt payload accidentally includes unmasked identity or clinical content | FR-22 — data-assembly layer strips/masks before any LLM call; enforced by the guardrail-verification pass (FR-23) |
| Session hijacking | Stolen access token | Short token lifetime (SEC-2), TLS everywhere (SEC-5), refresh-token revocation on logout |
| Denial of service at front desk | Flood of case-creation requests | Rate limiting per user/branch on write endpoints; queue-based handling for AI-draft calls to avoid blocking case creation if the LLM API is slow/down |
| Insider misuse (e.g., quality lead browsing unrelated branches for non-work reasons) | Legitimate cross-branch access used inappropriately | All cross-branch reads logged in `AuditLog` with actor and timestamp, reviewable by admin |

### 9.4 Compliance-Adjacent Security Notes
- SEC-9: This SRS does not certify compliance with any specific healthcare data-protection law; NFR-5's data-residency flagging is informational only, and a formal legal/security review is required before handling real patient-adjacent data in production.
- SEC-10: A third-party penetration test is recommended before first production go-live and after any major schema/API change; this SRS specifies the target for such a test but does not itself constitute one.

---

## 10. Test Plan

### 10.1 Test Levels

| Level | Scope | Owner | Trigger |
|---|---|---|---|
| Unit tests | Individual functions: firewall classifier, serializer field-exclusion, approval-tier logic | Engineers | Every commit (CI) |
| Integration tests | API endpoint behavior end-to-end (DB + API layer), including role-scoping (Section 8) | Engineers/QA | Every PR merge |
| Guardrail-verification pass | Automated check that Section 3/9 structural rules are present in the generated build (FR-23) | Agent (self-test) | Every generation run |
| Acceptance testing | Section 7's AC-1 through AC-10 scenarios, run end-to-end against a deployed instance | QA | Before handoff / before each release |
| Usability testing | UX-1 through UX-11, including AC-8/AC-9 timing and first-use checks | QA + real front-desk staff (or proxy users) | Before first production go-live, then periodically |
| Load/performance testing | NFR-1 (<2s case creation), NFR-2 (99.5% uptime target) under simulated concurrent branch traffic | Engineers/QA | Before go-live; after major architecture change |
| Security testing | SEC-1 through SEC-10, including the threat-model table (9.3) | Security reviewer / third-party pen test | Before go-live; after major change |

### 10.2 Illustrative Test Cases (Non-Exhaustive)

| Test ID | Maps to | Test description | Expected result |
|---|---|---|---|
| T-01 | FR-19, SEC-3 (threat row 1) | Submit a case note containing a diagnosis term | `422 CLINICAL_CONTENT_DETECTED` with actionable message; no case created |
| T-02 | FR-10, DC-3 | `front_desk` role calls `GET /cases/{id}` on a case with an approved refund | Response JSON has no `amount` key anywhere in the payload |
| T-03 | FR-12, SEC-3 | `front_desk` user from Branch A requests `GET /cases?branch_id=B` (Branch B) | Returns only Branch A cases (server ignores/overrides the client-supplied `branch_id`), or `403` |
| T-04 | DC-4 | Attempt `PUT`/`PATCH`/`DELETE` on `/cases/{id}/events/{event_id}` | `404`/`405` — no such endpoint exists |
| T-05 | FR-8 | `POST /cases/{id}/close` with no `root_cause_id` | `409` with message requiring root cause selection |
| T-06 | FR-17 | `POST /cases/{id}/send-reply` with edited `final_text` different from `draft_text` | Both versions persisted and independently retrievable in case history |
| T-07 | UX-9, AC-9 | Manual/scripted walkthrough of front-desk home → case submitted | ≤3 taps/steps counted |
| T-08 | FR-20/21, AC-4 | Seed 3 same-root-cause cases at one branch within the trend window | `TrendFlag` created with a non-empty drafted process-fix; visible only via `quality_lead` token |
| T-09 | SEC-2 | Use an access token after its expiry window | `401`, forced re-auth via refresh token |
| T-10 | SEC-4 | Submit 10+ rapid failed logins for one account | Subsequent attempts rate-limited/locked per policy |
| T-11 | Threat row 6 (prompt injection) | Submit complaint text containing an instruction-like string aimed at the LLM (e.g., attempting to make it reveal system prompt or ignore firewall) | AI output still passes firewall scan; no system-prompt leakage; behavior unchanged from a normal complaint |
| T-12 | NFR-1 | Load-test 100 concurrent case-creation requests across branches | 95th percentile response time remains under 2 seconds |

### 10.3 Exit Criteria for Production Readiness
A build is considered ready for production go-live only when:
1. All Section 7 acceptance criteria (AC-1–AC-10) pass on a staging deployment.
2. All Section 9 security requirements (SEC-1–SEC-10) are verified, with pen-test findings (if any) resolved or formally risk-accepted by the clinic operator.
3. Load testing confirms NFR-1/NFR-2 targets under an agreed concurrent-user estimate for the clinic's actual branch/patient volume.
4. Usability testing (Section 3.7) has been performed with at least one real or representative front-desk user per language configured in intake.
5. A legal/compliance reviewer has signed off per SEC-9 for the clinic's jurisdiction.

---

## 11. Appendix: Traceability to Source Case

| Source case requirement | SRS requirement(s) |
|---|---|
| Log a case in under a minute | FR-5, NFR-7 |
| Show what happened / who acted / what was said, forever | FR-6, FR-7, NFR-3 |
| Approvals where money involved, hidden from front desk | FR-9, FR-10, DC-3 |
| Root-cause tagging on closure | FR-8 |
| Branch and cross-branch performance views | FR-12, FR-13, AC-7 |
| Enforced clinical/complaint firewall | FR-19, FR-22, DC-1, AC-5 |
| AI drafts summary/category/root-cause/reply for approval | FR-16–FR-18 |
| AI proactively surfaces cross-branch root-cause clusters | FR-20, FR-21, AC-4 |
| Root-level (front-desk) user is the primary customer; must be highly user-friendly | Section 2.3, UX-1–UX-11, NFR-7, AC-8, AC-9, AC-10 |
