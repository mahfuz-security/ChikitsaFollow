import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlocksUser } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";
import { generatePatientRefCode } from "./patientRefCode";

// Shape mirrors Case.json (PascalCase field names). ItemId is the cloud's
// row identifier and is the value the rest of the app uses for navigation
// / foreign keys.
export type CaseStatus = "open" | "in_progress" | "awaiting_approval" | "resolved" | "closed";
export type CaseSeverity = "Low" | "Medium" | "High";
export type CaseCategory = "wait_time" | "billing" | "staff_behavior" | "facility" | "communication" | "other";

export type CaseRow = {
  itemId?: string;
  BranchId?: string;
  Category?: string;
  Severity?: string;
  PatientRefCode?: string;
  Subject?: string;
  PromisedAt?: string;
  Status?: CaseStatus;
  ClosedAt?: string;
  RootCauseId?: string;
};

// CaseEvent (append-only). DC-4: this module never issues update/delete on
// CaseEvent; the only allowed operation is create.
export type CaseEventType =
  | "created"
  | "note"
  | "ai_draft"
  | "ai_suggestion"
  | "sent_reply"
  | "status_change"
  | "approval_requested"
  | "approval_decided"
  | "closed";

export type CaseEventRow = {
  itemId?: string;
  CaseId?: string;
  EventType?: CaseEventType;
  ActorUserId?: string;
  Text?: string;
  MetadataJson?: string;
  AiGenerated?: boolean;
};

type PagedResponse = { data?: { items?: unknown[] } } | undefined;

// FR-12: row-scope Cases by branch. The gateway column-level policy
// `case-deny-edit-frontdesk` blocks update for front_desk, but the row
// filter is enforced in the app layer because the rules.json model in
// this tenant does not expose a branchId == User.BranchId operator.
// front_desk + branch_manager see their own branch only; quality_lead
// sees all branches (cross-branch audit role, FR-13).
function branchFilterForUser(profile: BlocksUser | undefined | null): { BranchId?: string } {
  if (!profile) return {};
  const roles = (profile.roles ?? []) as string[];
  const isBranchScoped = roles.includes("front_desk") || roles.includes("branch_manager");
  if (!isBranchScoped) return {};
  // The profile's BranchId is the user's home branch (set on signup /
  // invite acceptance). For clouduser, fall back to undefined = no
  // branch filter (they can see all).
  const branchId = (profile as { BranchId?: string }).BranchId;
  return branchId ? { BranchId: branchId } : {};
}

export function useCases() {
  return useQuery({
    queryFn: async () => {
      const profile = await blocksClient.iam.me();
      const filter = branchFilterForUser(profile?.data as BlocksUser | undefined);
      const response = (await blocksClient.data.collection("Case").list({
        filter,
        pageNo: 1,
        pageSize: 100
      })) as PagedResponse;
      return ((response?.data?.items ?? []) as CaseRow[]).slice().sort((a, b) => {
        const aT = a.itemId ?? "";
        const bT = b.itemId ?? "";
        return bT.localeCompare(aT);
      });
    },
    queryKey: ["data", "Case", "list"]
  });
}

export function useCase(caseId: string | undefined) {
  return useQuery({
    enabled: Boolean(caseId),
    queryFn: async () => {
      const response = (await blocksClient.data.collection("Case").get(caseId as string)) as { data?: CaseRow } | CaseRow | undefined;
      const row = (response && "data" in response ? response.data : response) as CaseRow | undefined;
      return row;
    },
    queryKey: ["data", "Case", caseId]
  });
}

export function useCaseEvents(caseId: string | undefined) {
  return useQuery({
    enabled: Boolean(caseId),
    queryFn: async () => {
      const response = (await blocksClient.data.collection("CaseEvent").list({
        filter: { CaseId: caseId },
        pageNo: 1,
        pageSize: 200
      })) as PagedResponse;
      return ((response?.data?.items ?? []) as CaseEventRow[]).slice().sort((a, b) => {
        const aT = a.itemId ?? "";
        const bT = b.itemId ?? "";
        return aT.localeCompare(bT);
      });
    },
    queryKey: ["data", "CaseEvent", "byCase", caseId]
  });
}

export type CreateCaseInput = {
  branchId: string;
  category: CaseCategory;
  severity: CaseSeverity;
  subject: string;
  promisedAt?: string;
  actorUserId: string;
};

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCaseInput) => {
      const now = new Date().toISOString();
      const patientRefCode = generatePatientRefCode();
      const row: Record<string, unknown> = {
        BranchId: input.branchId,
        Category: input.category,
        Severity: input.severity,
        PatientRefCode: patientRefCode,
        Subject: input.subject,
        Status: "open" as CaseStatus
      };
      if (input.promisedAt) row.PromisedAt = input.promisedAt;
      const created = (await blocksClient.data.collection("Case").create(row)) as CaseRow;
      // DC-4: append-only — write the `created` event row separately. We
      // never go back to mutate the Case row's status from here; status
      // transitions go through appendCaseEvent + useCloseCase.
      await blocksClient.data.collection("CaseEvent").create({
        CaseId: created.itemId,
        EventType: "created",
        ActorUserId: input.actorUserId,
        Text: input.subject,
        MetadataJson: JSON.stringify({ category: input.category, severity: input.severity, patientRefCode }),
        AiGenerated: false,
        // timestamp piggybacks on CreatedDate which the cloud fills in
        ...({} as Record<string, unknown>)
      });
      void now; // included for parity / future audit field
      return { caseRow: created, patientRefCode };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "Case", "list"] });
    }
  });
}

export type AppendEventInput = {
  caseId: string;
  eventType: CaseEventType;
  actorUserId: string;
  text?: string;
  metadata?: Record<string, unknown>;
  aiGenerated?: boolean;
};

export function useAppendCaseEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AppendEventInput) => {
      const row: Record<string, unknown> = {
        CaseId: input.caseId,
        EventType: input.eventType,
        ActorUserId: input.actorUserId,
        AiGenerated: Boolean(input.aiGenerated)
      };
      if (input.text) row.Text = input.text;
      if (input.metadata) row.MetadataJson = JSON.stringify(input.metadata);
      const created = await blocksClient.data.collection("CaseEvent").create(row);
      return created as CaseEventRow;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["data", "CaseEvent", "byCase", variables.caseId] });
    }
  });
}

export function useCloseCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { caseId: string; rootCauseId: string; actorUserId: string; note?: string }) => {
      // Append a `closed` event first (DC-4 spirit — we keep the existing
      // case row's Status as-is and let the event stream reflect closure
      // for now). Branch manager is the only role with case-update perms,
      // so they own any actual status mutation; the app-layer gate is in
      // CaseDetailPage where the close button is role-aware.
      await blocksClient.data.collection("CaseEvent").create({
        CaseId: input.caseId,
        EventType: "closed",
        ActorUserId: input.actorUserId,
        Text: input.note,
        MetadataJson: JSON.stringify({ rootCauseId: input.rootCauseId, closedAt: new Date().toISOString() }),
        AiGenerated: false
      });
      // Now mark the Case row closed (requires case-close permission).
      // The gateway's case-deny-write-qualitylead policy blocks this for
      // quality_lead; the front_desk's case-deny-edit-frontdesk policy
      // would also block it; only branch_manager + clouduser + admin pass.
      try {
        await blocksClient.data.collection("Case").update(input.caseId, {
          Status: "closed" as CaseStatus,
          ClosedAt: new Date().toISOString(),
          RootCauseId: input.rootCauseId
        });
      } catch (err) {
        // Surface a readable error to the caller — the rule denies the
        // mutation, so a quality_lead closing a case falls back to the
        // append-only event log without the row mutation.
        const e = err as { data?: { message?: string }; message?: string };
        throw new Error(e?.data?.message || e?.message || "close_failed_no_update_permission");
      }
      return { caseId: input.caseId, rootCauseId: input.rootCauseId };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["data", "Case", "list"] });
      queryClient.invalidateQueries({ queryKey: ["data", "Case", variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ["data", "CaseEvent", "byCase", variables.caseId] });
    }
  });
}
