# SRS Implementation Status

Reviewed against `ChikitsaFollow-AI-Agent-SRS.md`, September 15, 2026.

This is a working service-recovery application, not a clinical record system.
The SRS is **partially implemented**. This document is not a production,
security, accessibility, or regulatory certification.

See `ROLE-MATRIX.md` for the latest four-role specification, applied IAM grant
changes, dashboard coverage, and outstanding role-specific work.

See `REFUNDS-NOTIFICATIONS.md` for encrypted payout destinations, manual refund
records, the Blocks inbox, and the credential-gated background reminder worker.
Those features are implemented locally; automated delivery is not yet enabled.

See `PATIENT-TICKETS.md` for required patient-email association, the patient
ticket dashboard and shared conversations. Live account resolution and patient
ticket reads require server-side Blocks service credentials, not yet configured.

## Implemented Application Flows

- Patient login and password-free signup request with name, email, and clinic
  selection; account activation remains managed by Blocks IAM.
- Patient-only `/complaints` entry from home, navigation, and chatbot. Patients
  select an active Branch and submit a service summary as one Case insert;
  the receipt is shown only after acknowledgement. No staff case reads or
  financial fields are exposed by this flow. CreatedBy/CreatedDate are supplied
  by Blocks. This entry path does not separately append a CaseEvent.
  Additional English/Bangla strings are available locally; new keys have not
  yet been published to Blocks. Refund requests use the authenticated private
  API to attach an encrypted destination snapshot outside the Case record.
- Responsive glass-style light/dark layouts, dimensional brand icon, local
  fonts, patient home, editable own-account name, and language preferences.
- Blocks Localization runtime integration; 358 English and 358 Bangla keys
  published to the dev project's common module. German has partial local
  coverage and English fallback. Dynamic record content is not translated.
- Role-gated staff screens and fail-closed branch filtering when an operational
  user's BranchId is absent. Explicit Data Gateway projections and response
  normalization replace assumptions about SDK response shapes.
- Case creation, initial commitment, event history, status progression,
  root-cause selection, closure, and authorized verification. Verification is
  distinguished from closure in the UI and metrics. Branch managers review,
  comment, verify outcomes, and approve financial remedies. Creation, general
  editing, closure, drafts, and patient replies remain denied by application
  gates. The revised Blocks role grants were applied with approval and read
  back successfully. Direct gateway enforcement still requires separate tests.
- Approval requests and decisions with event records. Financial fields are
  omitted from ordinary frontend projections and restricted in the UI.
- Encrypted bank/bKash/Nagad destinations, approved manual refund recording,
  front-desk deadline editing, and a live Blocks Notifier inbox. Background
  deadline and patient-update delivery requires dedicated server credentials
  and an always-on deployment; it remains disabled pending that setup.
- Resolution counts, overdue counts, closure duration, verification rate, and
  deterministic 30-day recurring-root-cause groups with corrective actions.
- Reviewed bilingual service guidance, with optional German guidance. Chat
  sends only a topic and language, not the patient's raw question or records.
- Optional server-side Groq guidance and staff draft generation. Staff review
  remains required. Newly sent draft provenance and edits are encrypted with
  shared messages; legacy drafts retain their event metadata.
  Without provider configuration the app clearly uses reviewed templates.

## Release Blockers And Remaining SRS Work

| Area | Remaining work |
| --- | --- |
| Tenant and branch isolation | Prove enforcement in deployed Data Gateway policies with negative cross-branch and role tests. Client filters are not authorization. Inspected Case policy descriptions do not prove enforcement; empty rule groups require review. No cloud data/security policies were changed in this work. |
| Branch assignment | Provision and verify IAM BranchId for each operational user. Organization membership alone is not treated as a branch assignment. |
| Clinical-data exclusion | Current screening is best-effort, not complete DLP. Authoritative server validation and direct-API rejection tests are required. No diagnosis or treatment functionality is implemented. |
| Financial confidentiality | Verify field-level restrictions against direct SDK/API requests, not just hidden columns or omitted projections. |
| History integrity | Enforce immutable append-only events, server-authenticated actor attribution, and protected audit storage. Client-written actor fields are not sufficient. |
| Atomic workflows | Case/event and approval/event writes are separate. Add server-side transactions or idempotent outbox operations, concurrency checks, and retry recovery before production. Approval state is not automatically synchronized with every case status. |
| Patient communication | Shared ticket messages record comments, contextual replies and each side's current concern. Internal staff notes remain separate. Configure the server service client and verify live delivery; recorded messages do not prove email or SMS delivery. Legacy sent-reply events are not automatically imported. |
| AI provider | Groq is configured locally with a server-only ignored credential file; a live guidance request returned an AI response. Rotate the chat-disclosed credential. Installed Blocks CLI/SDK has no verified agent-chat integration; a published Blocks agent configuration is still needed to replace Groq. |
| Other SRS AI capabilities | Live summaries, category suggestions, root-cause suggestions, semantic clustering, and scheduled pattern analysis are not implemented. Current pattern grouping is deterministic, not an AI prediction. |
| Vocabulary administration | Category choices remain application-defined; complete administrative configuration and change governance remain outstanding. |
| Patient status access | A patient dashboard lists owned and verified-linked tickets, status, commitments and conversations. Live reads require server credentials. Legacy staff-created cases need verified association; mandatory email association must also be enforced against direct Data Gateway writes before production. No clinical chart is provided. |
| Deployment | The assistant backend needs its own deployment and same-origin reverse proxy. Configure provider secrets server-side, spending limits, shared rate limits, and monitoring. The existing frontend release alone does not deploy it. |
| Production qualification | Complete integration tests with real role accounts, load testing, accessibility audit, backup/restore, retention, incident response, and applicable legal/privacy review. A medical color palette does not establish healthcare compliance. |

## Verification Scope

Automated unit/integration checks cover SDK envelopes, branch guards, profile
updates, approvals, clinical screening, localization parity, guidance validation,
and operational metrics. Browser checks cover responsive light/dark layouts,
signup selection, login canvas rendering/motion, profile edits, language
persistence, denied patient staff routes, and manager review/comment restrictions.

Authenticated browser workflow checks use mocked SDK responses. They do not
certify live cloud permissions or create real patient accounts. A live Groq
guidance response was verified; actual notification delivery and production
deployment were not verified.

See `app/server/README.md` for assistant setup and deployment requirements.
