import { gatewayCollection } from "../../lib/blocks/gateway";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BlocksUser } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";
import { branchFilterForUser } from "./access";
import { scanForClinical } from "../ai/firewall";
import { hasPermission, isReviewOnlyManager } from "../../lib/permissions";
import { privateApi } from "../refunds/privateApi";
import { rolesForUser } from "../../lib/roles";

// Shape mirrors Case.json (PascalCase field names). ItemId is the cloud's
// row identifier and is the value the rest of the app uses for navigation
// / foreign keys.
export type CaseStatus = "open" | "in_progress" | "awaiting_approval" | "resolved" | "closed" | "verified";
export type CaseSeverity = "Low" | "Medium" | "High";
export type CaseCategory = "report_delay" | "instructions" | "missed_follow_up" | "wait_time" | "billing" | "staff_behavior" | "facility" | "communication" | "other";

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
  CreatedDate?: string;
  CreatedBy?: string;
  LastUpdatedDate?: string;
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
  | "closed"
  | "commitment"
  | "close_requested"
  | "verified";

export type CaseEventRow = {
  itemId?: string;
  CaseId?: string;
  EventType?: CaseEventType;
  ActorUserId?: string;
  Text?: string;
  MetadataJson?: string;
  AiGenerated?: boolean;
  CreatedDate?: string;
};

type PagedResponse = { data?: { items?: unknown[] } } | undefined;

async function authorizedCase(caseId: string) {
  const profile = await blocksClient.iam.me();
  const scope = branchFilterForUser(profile?.data);
  const response = await gatewayCollection("Case").list({ filter: { ...scope, ItemId: caseId }, pageNo: 1, pageSize: 1 });
  const row = response.data.items[0] as CaseRow | undefined;
  if (!row) throw new Error("This case is unavailable.");
  return row;
}

function requireServiceText(text?: string) {
  const scan = scanForClinical(text);
  if (!scan.ok) throw new Error(scan.message);
}

export function useCases() {
  return useQuery({
    queryFn: async () => {
      const profile = await blocksClient.iam.me();
      const filter = branchFilterForUser(profile?.data as BlocksUser | undefined);
      const response = (await gatewayCollection("Case").listAll({
        filter,
        pageNo: 1,
        pageSize: 100
      })) as PagedResponse;
      return ((response?.data?.items ?? []) as CaseRow[]).slice().sort((a, b) => {
        const aT = a.CreatedDate ?? "";
        const bT = b.CreatedDate ?? "";
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
      return authorizedCase(caseId as string);
    },
    queryKey: ["data", "Case", caseId]
  });
}

export function useCaseEvents(caseId: string | undefined) {
  return useQuery({
    enabled: Boolean(caseId),
    queryFn: async () => {
      await authorizedCase(caseId as string);
      const response = (await gatewayCollection("CaseEvent").listAll({
        filter: { CaseId: caseId },
        pageNo: 1,
        pageSize: 200
      })) as PagedResponse;
      return ((response?.data?.items ?? []) as CaseEventRow[]).slice().sort((a, b) => {
        const aT = a.CreatedDate ?? "";
        const bT = b.CreatedDate ?? "";
        return aT.localeCompare(bT);
      });
    },
    queryKey: ["data", "CaseEvent", "byCase", caseId]
  });
}

export type CreateCaseInput = {
  patientEmail: string;
  patientId: string;
  requestId: string;
  branchId: string;
  category: CaseCategory;
  severity: CaseSeverity;
  subject: string;
  promisedAt?: string;
  commitment?: string;
  actorUserId: string;
};

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCaseInput) => {
      requireServiceText(input.subject);
      requireServiceText(input.commitment);
      if (!input.subject.trim() || input.subject.length > 120) throw new Error("Enter a service summary of up to 120 characters.");
      const profile = (await blocksClient.iam.me()).data;
      if (!hasPermission(profile, "case-create")) throw new Error("Creating cases is not permitted.");
      const scope = branchFilterForUser(profile);
      if (!input.branchId || (scope.BranchId && scope.BranchId !== input.branchId)) throw new Error("Select your assigned branch.");
      return privateApi<{ caseRow: CaseRow; patientRefCode: string }>("/tickets", "POST", {
        requestId: input.requestId, patientEmail: input.patientEmail.trim(), patientId: input.patientId.trim(), branchId: input.branchId,
        category: input.category, severity: input.severity, subject: input.subject.trim(),
        commitment: input.commitment ?? "", ...(input.promisedAt ? { promisedAt: input.promisedAt } : {})
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "Case", "list"] });
    }
  });
}

export type AppendEventInput = {
  requestId?: string;
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
      await authorizedCase(input.caseId);
      requireServiceText(input.text);
      if (input.metadata) requireServiceText(JSON.stringify(input.metadata));
      const profile = (await blocksClient.iam.me()).data;
      if (isReviewOnlyManager(profile) && input.eventType !== "note") throw new Error("Managers may only add review comments.");
      if (isReviewOnlyManager(profile) && (!input.text?.trim() || input.text.length > 500 || input.metadata || input.aiGenerated)) throw new Error("Enter a review comment of up to 500 characters.");
      if (!hasPermission(profile, input.eventType === "sent_reply" ? "case-send-reply" : "case-event-create")) throw new Error("Recording this action is not permitted.");
      if (input.eventType === "sent_reply") {
        const message = await privateApi<{ id: string }>(`/tickets/${encodeURIComponent(input.caseId)}/messages`, "POST", { requestId: input.requestId ?? crypto.randomUUID(), text: input.text, kind: "reply", ...(input.metadata ? { provenance: input.metadata } : {}) });
        return { itemId: message.id, CaseId: input.caseId, EventType: "sent_reply" as const };
      }
      const row: Record<string, unknown> = {
        CaseId: input.caseId,
        EventType: input.eventType,
        ActorUserId: profile?.itemId,
        AiGenerated: Boolean(input.aiGenerated)
      };
      if (input.text) row.Text = input.text;
      if (input.metadata) row.MetadataJson = JSON.stringify(input.metadata);
      const created = await gatewayCollection("CaseEvent").create(row);
      return created as CaseEventRow;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["data", "CaseEvent", "byCase", variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
    }
  });
}

export function useCloseCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { caseId: string; rootCauseId: string; actorUserId: string; note?: string }) => {
      const existing = await authorizedCase(input.caseId);
      const actor = (await blocksClient.iam.me()).data;
      if (!hasPermission(actor, "case-close")) throw new Error("Closing cases is not permitted.");
      requireServiceText(input.note);
      if (!input.rootCauseId) throw new Error("Choose a root cause before closing.");
      if (["closed", "verified"].includes(existing.Status ?? "")) throw new Error("This case is already completed.");
      // Record intent separately so a failed update never records a completed closure.
      await gatewayCollection("CaseEvent").create({
        CaseId: input.caseId,
        EventType: "close_requested",
        ActorUserId: actor?.itemId,
        Text: input.note,
        MetadataJson: JSON.stringify({ rootCauseId: input.rootCauseId, closedAt: new Date().toISOString() }),
        AiGenerated: false
      });
      // Cloud policies must independently authorize this update.
      try {
        await gatewayCollection("Case").update(input.caseId, {
          Status: "closed" as CaseStatus,
          ClosedAt: new Date().toISOString(),
          RootCauseId: input.rootCauseId
        });
      } catch (err) {
        const e = err as { data?: { message?: string }; message?: string };
        throw new Error(e?.data?.message || e?.message || "close_failed_no_update_permission");
      }
      await gatewayCollection("CaseEvent").create({
        CaseId: input.caseId, EventType: "closed", ActorUserId: actor?.itemId,
        Text: input.note, AiGenerated: false,
        MetadataJson: JSON.stringify({ previousStatus: existing.Status, rootCauseId: input.rootCauseId, closedAt: new Date().toISOString() })
      });
      return { caseId: input.caseId, rootCauseId: input.rootCauseId };
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["data", "Case", "list"] });
      queryClient.invalidateQueries({ queryKey: ["data", "Case", variables.caseId] });
      queryClient.invalidateQueries({ queryKey: ["data", "CaseEvent", "byCase", variables.caseId] });
    }
  });
}

export function useVerifyCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { caseId: string; note: string }) => {
      const row = await authorizedCase(input.caseId);
      const profile = (await blocksClient.iam.me()).data;
      if (!rolesForUser(profile).some(role => ["branch_manager", "admin", "clouduser"].includes(role))) throw new Error("A manager must verify the resolution.");
      if (!hasPermission(profile, "case-verify")) throw new Error("Verifying case resolution is not permitted.");
      if (!["resolved", "closed"].includes(row.Status ?? "") || !row.RootCauseId) throw new Error("Resolve the case and tag a root cause first.");
      if (!input.note.trim()) throw new Error("Record how the outcome was confirmed.");
      requireServiceText(input.note);
      await gatewayCollection("Case").update(input.caseId, { Status: "verified" });
      await gatewayCollection("CaseEvent").create({
        CaseId: input.caseId, EventType: "verified", ActorUserId: profile?.itemId,
        Text: input.note.trim(), AiGenerated: false,
        MetadataJson: JSON.stringify({ previousStatus: row.Status, verifiedAt: new Date().toISOString() })
      });
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: ["data", "Case"] });
      queryClient.invalidateQueries({ queryKey: ["data", "CaseEvent", "byCase", input.caseId] });
    }
  });
}

export function useTransitionCase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { caseId: string; status: "in_progress" | "resolved"; rootCauseId?: string }) => {
      const row = await authorizedCase(input.caseId);
      const actor = (await blocksClient.iam.me()).data;
      if (!hasPermission(actor, "case-update")) throw new Error("Updating case status is not permitted.");
      const allowed = input.status === "in_progress" ? ["open", "awaiting_approval"] : ["in_progress"];
      if (!allowed.includes(row.Status ?? "")) throw new Error("The case status changed. Refresh before continuing.");
      if (input.status === "resolved" && !input.rootCauseId) throw new Error("Choose a root cause before resolving.");
      const patch: Record<string, unknown> = { Status: input.status };
      if (input.rootCauseId) patch.RootCauseId = input.rootCauseId;
      await gatewayCollection("Case").update(input.caseId, patch);
      await gatewayCollection("CaseEvent").create({ CaseId: input.caseId, EventType: "status_change", ActorUserId: actor?.itemId,
        AiGenerated: false, MetadataJson: JSON.stringify({ previousStatus: row.Status, status: input.status, rootCauseId: input.rootCauseId }) });
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: ["data", "Case"] });
      queryClient.invalidateQueries({ queryKey: ["data", "CaseEvent", "byCase", input.caseId] });
    }
  });
}

export function useSetCaseDeadline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { caseId: string; promisedAt: string }) => {
      const row = await authorizedCase(input.caseId);
      const actor = (await blocksClient.iam.me()).data;
      if (!hasPermission(actor, "case-update")) throw new Error("Updating the follow-up deadline is not permitted.");
      if (!["open", "in_progress", "awaiting_approval"].includes(row.Status ?? "")) throw new Error("This case is already completed.");
      const due = Date.parse(input.promisedAt);
      if (!Number.isFinite(due) || due <= Date.now()) throw new Error("Choose a future follow-up deadline.");
      const promisedAt = new Date(due).toISOString();
      await gatewayCollection("Case").update(input.caseId, { PromisedAt: promisedAt });
      await gatewayCollection("CaseEvent").create({ CaseId: input.caseId, EventType: "commitment", ActorUserId: actor?.itemId, AiGenerated: false,
        MetadataJson: JSON.stringify({ previousPromisedAt: row.PromisedAt ?? null, promisedAt }) });
    },
    onSettled: (_data, _error, input) => {
      queryClient.invalidateQueries({ queryKey: ["data", "Case"] });
      queryClient.invalidateQueries({ queryKey: ["data", "CaseEvent", "byCase", input.caseId] });
    }
  });
}
