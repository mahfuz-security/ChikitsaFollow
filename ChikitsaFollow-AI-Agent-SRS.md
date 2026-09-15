# Software Requirements Specification (SRS)
## ChikitsaFollow – Clinic Follow-up and Service Recovery Desk

**Document Version:** 1.0  
**Status:** Draft / Implemented Prototype  
**Implementation Approach:** Configured using an existing software solution/platform rather than building the complete system from scratch.

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) defines the functional, non-functional, security, workflow, data, reporting, and AI-assisted requirements for **ChikitsaFollow**, a clinic follow-up and service recovery system for a diagnostic clinic chain.

The system is intended to help clinic staff record, manage, resolve, verify, and analyze service complaints while preventing clinical information from being stored in the complaint-management environment.

### 1.2 Background
The clinic operates multiple branches, including Dhanmondi, Uttara, and Mirpur, serving approximately 1,200 patients per day.

Common service complaints include:

- Delayed reports
- Unclear fasting or urine-collection instructions
- Billing mismatches
- Missed follow-up calls
- Staff behaviour issues
- Repeated operational failures such as sample mix-ups

Currently, front-desk staff often resolve issues verbally without maintaining a reliable record. Branch managers may learn about failures only after patients publish complaints publicly. This creates weak traceability, inconsistent follow-up, poor accountability, and limited ability to identify recurring operational problems.

### 1.3 System Objective
The objective of ChikitsaFollow is to provide a structured case-management process that records:

- What happened
- What the patient was promised
- Who took action
- What was communicated to the patient
- Whether the complaint was actually resolved
- What root cause caused the problem
- Whether the same failure is occurring repeatedly

### 1.4 Implementation Context
The solution has been implemented using an **existing software platform / existing software solution**.

The implementation therefore focuses on:

- Configuring user roles and permissions
- Creating complaint forms
- Creating case workflows
- Creating approval steps
- Configuring dashboards and reports
- Adding automation and AI-assisted features where supported
- Applying privacy and access-control rules

> **Note:** The exact software/product name was not specified in the source requirements. It can be added to this document later under the implementation architecture section.

---

## 2. Scope

### 2.1 In Scope

The system shall support:

- Complaint / service case creation
- Branch-based access
- Complaint categorization
- Severity assignment
- Recording commitments made to patients
- Case history and audit trail
- Staff action tracking
- Resolution workflow
- Refund / fee-waiver approval
- Root-cause tagging
- Verified-resolution tracking
- Branch-level reporting
- Cross-branch quality reporting
- Patient identity masking
- Prevention of clinical information in complaint notes
- AI-assisted summarization
- AI-assisted categorization
- AI-assisted root-cause suggestions
- AI-assisted reply drafting
- Cross-case pattern and trend detection

### 2.2 Out of Scope

The following are outside the core scope unless separately integrated:

- Electronic Medical Record (EMR) functionality
- Clinical diagnosis management
- Laboratory result storage
- Medical test interpretation
- Prescription management
- Full patient clinical history
- Replacement of the existing Laboratory Information System (LIS)

---

## 3. Stakeholders and User Roles

### 3.1 Front-Desk Staff

Responsibilities:

- Receive patient or family complaints
- Create service cases
- Record what happened
- Record what was promised
- Update case progress
- Review AI-generated responses
- Send approved communication
- Close cases where permitted

Restrictions:

- Cannot view management-only compensation values
- Cannot access other branches unless explicitly authorized
- Must not enter clinical data

---

### 3.2 Branch Manager

Responsibilities:

- View all complaints within the branch
- Review unresolved and overdue cases
- Approve fee waivers and refunds
- Review complaint trends
- Review average resolution time
- Review verified vs. merely closed cases
- Monitor staff follow-up performance

---

### 3.3 Quality Lead

Responsibilities:

- View complaints across all branches
- Review cross-branch failure trends
- Identify recurring root causes
- Compare branches
- Initiate process-improvement actions
- Review AI-detected issue clusters

---

### 3.4 Patient / Family Member

The patient or family member may:

- Submit or communicate a complaint through staff-supported channels
- Receive acknowledgement
- Receive a new commitment
- Receive resolution communication
- Check status using a reference code if a patient-facing status view is implemented

The patient-facing view must not expose clinical information.

---

## 4. Functional Requirements

### FR-01: User Authentication

The system shall require authenticated access for internal users.

The system shall support separate access privileges for:

- Front-desk staff
- Branch managers
- Quality lead

---

### FR-02: Role-Based Access Control

The system shall enforce role-based permissions.

Rules:

- Front-desk staff shall see only cases allowed for their branch.
- Branch managers shall see all cases for their own branch.
- The quality lead shall see cases across all branches.
- Management-only information shall not be visible to front-desk staff.

---

### FR-03: Service Case Creation

The system shall allow front-desk staff to create a complaint/service case in under one minute.

The case form shall include:

- Case reference number
- Branch
- Complaint type
- Severity
- Complaint description
- Patient commitment / promise
- Masked patient reference
- Date and time
- Staff member creating the case

---

### FR-04: Complaint Categories

The minimum complaint categories shall include:

- Report delay
- Instructions
- Billing
- Missed follow-up
- Staff behaviour

The system should allow administrators to add additional categories when necessary.

---

### FR-05: Patient Identity Masking

The system shall use a masked patient reference instead of displaying full patient identity in normal complaint lists and analytics.

Examples:

- PT-XXXX31
- CASE-2026-00158

The system shall minimize personally identifiable patient information.

---

### FR-06: Permanent Case History

For each complaint, the system shall permanently record:

1. What happened
2. Who took action
3. What the patient was told

Previous entries should not be silently overwritten.

---

### FR-07: Action Log

Every important action shall be logged with:

- User
- Action
- Timestamp
- Previous value where applicable
- New value where applicable

Examples:

- Case created
- Severity changed
- Commitment changed
- Reply edited
- Refund requested
- Refund approved
- Root cause added
- Case closed
- Resolution verified

---

### FR-08: Patient Communication Log

The system shall record the exact message or commitment communicated to the patient.

If an AI-generated reply is edited by staff, the final approved version shall be stored.

Example:

AI suggests:

> Report will be available at 6:30 PM.

Staff changes it to:

> Report will be available at 6:00 PM.

The system shall permanently record the final message communicated to the patient.

---

### FR-09: Case Status Management

The system shall support case statuses such as:

- New
- Open
- In Progress
- Waiting for Approval
- Resolved
- Closed
- Verified

The exact workflow may be adjusted based on the capabilities of the existing software platform.

---

### FR-10: Financial Remedy Approval

Cases involving financial remedies shall require approval.

Examples:

- Fee waiver
- Partial refund
- Full refund

The workflow shall include:

1. Staff requests compensation.
2. Authorized manager reviews the request.
3. Manager approves or rejects.
4. Decision is recorded.
5. Case workflow continues.

---

### FR-11: Compensation Confidentiality

Compensation amounts shall only be visible to authorized management users.

Front-desk users shall not see compensation amounts unless explicitly permitted by policy.

---

### FR-12: Root-Cause Tagging

The system shall require or support root-cause tagging when a complaint is resolved or closed.

Example root causes:

- Sample mix-up
- Re-run required
- Staff instruction error
- Billing entry error
- Follow-up not scheduled
- Reporting delay

Root-cause tags shall be structured so they can be counted and analyzed.

---

### FR-13: Resolution Verification

The system shall differentiate between:

- A complaint that was simply closed
- A complaint whose resolution was verified

This allows managers to determine whether the patient actually received a satisfactory outcome.

---

### FR-14: Branch Dashboard

The branch manager dashboard shall show:

- Complaint volume
- Open cases
- Overdue cases
- Resolved cases
- Average resolution time
- Verified resolution rate
- Closed-but-not-verified cases
- Complaint categories
- Root-cause trends

---

### FR-15: Cross-Branch Quality Dashboard

The quality lead shall have a cross-branch dashboard showing:

- Complaint volume by branch
- Failure type by branch
- Root-cause frequency
- Average resolution time
- Verified-resolution percentage
- Recurring failure patterns
- Sudden branch-specific spikes

Example:

> Dhanmondi recorded 5 sample-mix-up cases in 30 days while other branches recorded 0.

---

### FR-16: Process-Improvement Action

The quality lead should be able to create or record a process-improvement action based on a recurring root cause.

Example:

- Problem: Sample mix-up
- Branch: Dhanmondi
- Corrective action: Double-labeling at sample collection
- Owner: Branch Operations
- Status: Open / In Progress / Completed

---

## 5. Clinical Data Protection Requirements

### FR-17: Clinical Firewall

The complaint-management system shall prevent clinical information from being entered into complaint notes.

Examples of information that should be prevented:

- Diagnosis
- Test result values
- Medical interpretation
- Detailed medical condition

The system should allow service-related information only.

Allowed example:

> CBC and HbA1c reports were not delivered by the promised time.

Not allowed example:

> The patient has diabetes and the HbA1c result is 8.5.

---

### FR-18: Clinical Data Detection

Where technically supported, the system should automatically detect possible clinical information before a complaint note is saved.

The implementation may use:

- Validation rules
- Restricted fields
- Keyword rules
- AI-assisted detection
- Data-loss-prevention controls
- Review prompts

---

### FR-19: Clinical Data Rejection

If prohibited clinical content is detected, the system shall:

1. Warn the user.
2. Prevent submission where technically possible.
3. Explain that clinical data must not be stored in the complaint record.
4. Allow the user to rewrite the note using service-related wording.

---

## 6. AI-Assisted Requirements

### AI-01: Complaint Summarization

The AI should create a concise summary of complaint text.

The AI must be able to work with complaint descriptions that may contain mixed Bangla and English.

---

### AI-02: Category Suggestion

The AI should suggest the most likely complaint category.

Example:

Input:

> Report was promised at 2 PM but was still unavailable at 5 PM.

Suggested category:

> Report Delay

---

### AI-03: Root-Cause Hint

The AI should suggest a possible root cause based on the complaint and available case context.

The suggestion shall not automatically become the final root cause.

Staff must be able to review or change it.

---

### AI-04: Draft Patient Reply

The AI should generate a respectful draft response.

The response may include:

- Acknowledgement
- Apology where appropriate
- New commitment
- Remedy
- Clear next step

The reply must be reviewed by staff before being sent.

---

### AI-05: Human Approval

AI-generated replies shall not be automatically sent without staff review.

Staff must be able to:

- Edit
- Approve
- Reject
- Rewrite

---

### AI-06: AI Edit Tracking

The system should maintain a record of:

- AI-generated draft
- Staff edits
- Final approved message

This supports accountability and auditability.

---

### AI-07: Cross-Case Pattern Detection

The AI should analyze closed cases across branches and identify recurring failure clusters.

Example:

> Increase in sample-mix-up cases at Dhanmondi branch.

---

### AI-08: Suggested Process Fix

When a recurring operational pattern is detected, the AI should suggest a possible process improvement.

Example:

> Introduce double-label verification at sample collection.

The quality lead must review the recommendation before implementation.

---

## 7. Data Requirements

### 7.1 Case Data

Each case should contain:

| Field | Description |
|---|---|
| Case ID | Unique case reference |
| Branch | Dhanmondi / Uttara / Mirpur |
| Complaint Type | Service complaint category |
| Severity | Priority/severity |
| Masked Patient Reference | Non-clinical reference |
| Complaint Summary | Service-related complaint description |
| Promise / Commitment | What the patient was told |
| Assigned User | Staff responsible |
| Status | Current workflow status |
| Root Cause | Structured cause tag |
| Created Time | Case creation timestamp |
| Updated Time | Last update timestamp |
| Resolution Time | Time taken to resolve |
| Verification Status | Verified / Not Verified |

---

### 7.2 Audit Data

Audit logs should capture:

- Login activity where supported
- Case creation
- Case update
- Assignment change
- Approval
- Rejection
- Compensation request
- Communication edit
- Communication sent
- Root-cause assignment
- Closure
- Verification

---

### 7.3 Financial Data

Financial remedy records may include:

- Remedy type
- Requested amount
- Approved amount
- Approver
- Approval date
- Approval status

Access shall be limited to authorized management users.

---

## 8. Workflow Requirements

### 8.1 Standard Complaint Workflow

```text
Patient / Family Complaint
        |
        v
Front Desk Creates Case
        |
        v
AI Assists with Summary / Category / Reply
        |
        v
Staff Reviews and Edits
        |
        v
Action / Investigation
        |
        v
Resolution
        |
        v
Root Cause Tagged
        |
        v
Patient Informed
        |
        v
Resolution Verified
        |
        v
Case Closed
```

---

### 8.2 Financial Remedy Workflow

```text
Complaint Logged
      |
      v
Refund / Fee Waiver Requested
      |
      v
Manager Approval Required
      |
  +---+---+
  |       |
Approve  Reject
  |       |
  v       v
Record Decision
      |
      v
Continue Resolution
```

---

### 8.3 Clinical Firewall Workflow

```text
Staff Enters Complaint Note
        |
        v
Clinical Content Check
        |
   +----+----+
   |         |
No Clinical  Clinical Data
Data         Detected
   |         |
   v         v
Save      Block / Warn
             |
             v
         Rewrite Note
```

---

## 9. Non-Functional Requirements

### NFR-01: Usability
A trained front-desk user should be able to create a normal service case in under one minute.

### NFR-02: Performance
Common case pages and dashboards should load within an acceptable operational response time under normal use.

### NFR-03: Availability
The complaint-management service should be available during clinic operating hours.

### NFR-04: Scalability
The configured platform should support multiple clinic branches and growing complaint volumes.

### NFR-05: Auditability
Important actions must be traceable to a specific user and timestamp.

### NFR-06: Data Minimization
Only information necessary for service recovery shall be collected.

### NFR-07: Privacy
Patient identity shall be masked in normal operational lists and analytics.

### NFR-08: Security
The system shall enforce authenticated access and role-based permissions.

### NFR-09: Confidentiality
Management-only information such as compensation values shall not be exposed to unauthorized users.

### NFR-10: Data Integrity
Authorized users shall not be able to silently alter the historical record of what was communicated or approved.

### NFR-11: Maintainability
Complaint categories, root-cause tags, users, branches, and workflows should be configurable without rebuilding the whole system.

### NFR-12: Language Support
The solution should support Bangla-English complaint text where possible.

---

## 10. Security Requirements

### SEC-01
All internal users shall authenticate before accessing the system.

### SEC-02
Access shall follow least-privilege principles.

### SEC-03
Users shall only see branch and case data permitted by their role.

### SEC-04
Patient identity shall be masked wherever full identity is not operationally required.

### SEC-05
Clinical information shall not be stored in complaint records.

### SEC-06
Compensation information shall be restricted to management.

### SEC-07
Important administrative and case actions shall be auditable.

### SEC-08
AI outputs shall require human review before external communication.

### SEC-09
The system should protect complaint records from unauthorized deletion or modification.

### SEC-10
Analytics should use masked or non-clinical data.

---

## 11. Reporting Requirements

### 11.1 Branch Reports

The system should generate reports for:

- Total cases
- Cases by complaint type
- Cases by severity
- Average resolution time
- Open / overdue cases
- Verified-resolution rate
- Root-cause frequency

### 11.2 Cross-Branch Reports

The quality lead should be able to compare:

- Branch complaint volume
- Root causes
- Failure modes
- Resolution time
- Verification rate
- Operational spikes

---

## 12. Existing Software Solution Implementation

Because the system was implemented using an existing software solution, the implementation should map the requirements to available platform components.

| Requirement | Existing Platform Implementation |
|---|---|
| User authentication | Existing platform login / identity feature |
| Role-based access | Platform roles and permissions |
| Case creation | Configured form / record type |
| Complaint workflow | Workflow / status configuration |
| Approval | Existing approval workflow |
| Audit history | Platform history / activity log |
| Dashboards | Built-in reporting / dashboard module |
| Root-cause tags | Choice / tag / category field |
| Notifications | Platform automation / notification feature |
| AI summary | AI assistant / integration where supported |
| AI reply | AI generation feature / integration |
| Clinical firewall | Validation / DLP / AI-assisted rule |
| Cross-branch trend view | Reporting / analytics module |

### 12.1 Configuration-First Principle

The implementation should prioritize configuration over custom development.

Custom code should only be introduced when the existing platform cannot meet a mandatory requirement such as:

- Clinical-data prevention
- AI pattern detection
- Specific access restrictions
- Advanced integration
- Custom analytics

---

## 13. Assumptions

- Clinic branches use the same complaint process.
- Staff users have individual accounts.
- Management roles are clearly defined.
- The existing platform supports configurable forms and permissions.
- The existing platform supports a usable audit trail.
- AI features are subject to staff review.
- Clinical information is handled by separate clinical systems.
- Complaint records contain service information only.

---

## 14. Constraints

- Clinical data must not leak into the complaint system.
- Full patient identity should not appear in normal analytics.
- Compensation amounts are restricted.
- AI must not autonomously communicate with patients without human approval.
- Existing software-platform limitations may affect the exact UI or workflow.
- Any implementation gap must be documented rather than silently ignored.

---

## 15. Demo Scenario / Acceptance Scenario

### Scenario
A daughter calls because her father's CBC and HbA1c reports were promised at 2:00 PM but are still not ready at 5:00 PM.

### Expected System Behaviour

1. Front-desk staff creates the case in approximately 30 seconds.
2. The branch is recorded.
3. The complaint is categorized as report delay.
4. The patient is represented by a masked reference.
5. The AI creates a short summary.
6. The AI drafts a respectful reply.
7. Staff reviews the draft.
8. Staff changes the commitment if necessary.
9. The final communication is permanently logged.
10. Investigation identifies the root cause as sample mix-up.
11. Root cause is tagged.
12. Case is resolved and later verified.
13. The cross-branch dashboard identifies if similar sample mix-ups are increasing at Dhanmondi.
14. The quality lead creates a corrective process action such as double-labeling at collection.
15. If a user attempts to enter a diagnosis into the complaint note, the clinical firewall blocks or warns against it.

---

## 16. Acceptance Criteria

The solution shall be considered successful when:

- Staff can create a complaint quickly.
- Every complaint has an identifiable owner and status.
- The exact patient commitment is recorded.
- Complaint history is traceable.
- Financial remedies require authorization.
- Management-only financial information is protected.
- Root causes can be counted and analyzed.
- Branch managers can measure actual resolution performance.
- The quality lead can identify recurring cross-branch failures.
- Clinical information is prevented from entering complaint records.
- AI assists staff without bypassing human approval.
- A complaint can be differentiated as merely closed versus actually verified.
- Operational failure patterns can be identified before the next formal review.

---

## 17. Success Definition

A successful implementation allows a branch manager to answer:

> Was this complaint actually resolved, and what exactly was the patient told?

It also allows the quality lead to identify a recurring operational failure early enough to take corrective action before it becomes a larger patient-safety, reputational, or regulatory issue.

---

## 18. Future Enhancements

Possible future improvements include:

- Patient self-service status page
- SMS / WhatsApp integration
- Email notifications
- SLA timers
- Automatic escalation
- Sentiment detection
- Multilingual AI responses
- Automated trend alerts
- Root-cause recommendation confidence score
- Integration with non-clinical CRM data
- Management notification for high-severity complaints
- Corrective-action tracking
- Branch benchmarking

---

## 19. Requirement Traceability Summary

| Area | Main Requirements |
|---|---|
| Case Management | FR-03 to FR-09 |
| Financial Approval | FR-10 to FR-11 |
| Root Cause & Quality | FR-12 to FR-16 |
| Clinical Data Protection | FR-17 to FR-19 |
| AI Assistance | AI-01 to AI-08 |
| Security | SEC-01 to SEC-10 |
| Reporting | Section 11 |
| Existing Platform Mapping | Section 12 |
| Acceptance | Sections 15–16 |

---

## 20. Source Basis

This SRS was prepared from the supplied **ChikitsaFollow: Clinic Follow-up and Service Recovery Desk** case description.

The source defines the business problem, user roles, complaint-management expectations, access model, AI-assistance requirements, clinical-data separation requirement, reporting expectations, and example demo workflow.

Where the source did not specify exact implementation technology, this SRS describes a configuration-based implementation using an existing software solution without inventing a specific vendor or product.
