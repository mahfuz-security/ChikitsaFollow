import { blocksClient } from "./client";

const FIELDS = {
  Case: ["BranchId", "Category", "Severity", "PatientRefCode", "Subject", "PromisedAt", "Status", "ClosedAt", "RootCauseId"],
  CaseEvent: ["CaseId", "EventType", "ActorUserId", "Text", "MetadataJson", "AiGenerated"],
  Approval: ["CaseId", "AmountType", "RequestedBy", "DecidedBy", "Decision", "Tier", "Note"],
  RootCause: ["Slug", "DisplayName", "Description", "IsActive"],
  TrendFlag: ["BranchId", "RootCauseId", "WindowStart", "WindowEnd", "CaseCount", "DraftedFix", "Status", "QualityLeadUserId"],
  AuditLog: ["ActorUserId", "Action", "ResourceType", "ResourceId", "BranchId", "MetadataJson"],
  Branch: ["Name", "Code", "Address", "Phone", "Timezone", "IsActive"],
  User: ["Email", "FirstName", "LastName", "Phone", "BranchId", "ClinicRole"],
  Invite: ["InviteId", "Email", "RoleSlug", "OrgId", "InvitedByUserId", "Status", "CreatedAt", "ExpiresAt", "AcceptedAt", "CancelledAt", "Note"],
  OrganizationMember: ["UserId", "OrgId", "RoleSlug", "Status", "JoinedAt", "LeftAt", "InvitedByUserId", "Source"],
  PatientMembership: ["PatientUserId", "GranteeOrgId", "Scope", "HomeOrgId", "CrossOrgShare", "DataAccessMode", "Status", "GrantMethod", "GrantedAt", "ExpiresAt", "RevokedAt", "Notes"]
} as const;
type RecordData = Record<string, unknown>;
function object(value: unknown): RecordData {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordData : {};
}
export function unwrapGateway(response: unknown, operation: string): RecordData {
  const raw = object(response);
  if ((Array.isArray(raw.errors) && raw.errors.length) || raw.isSuccess === false) throw new Error("Data request failed. Please try again.");
  const data = object(raw.data ?? raw);
  return object(data[operation] ?? data);
}
function normalizeRow(value: unknown): RecordData {
  const row = object(value);
  return { ...row, itemId: row.itemId ?? row.ItemId };
}
export function gatewayCollection(schema: keyof typeof FIELDS, extraFields: string[] = []) {
  const collection = blocksClient.data.collection(schema, { fields: [...FIELDS[schema], "CreatedDate", "CreatedBy", "LastUpdatedDate", ...extraFields] });
  const api = {
    async list(options?: Parameters<typeof collection.list>[0]) {
      const payload = unwrapGateway(await collection.list(options), `get${schema}s`);
      if (!Array.isArray(payload.items)) throw new Error("Data response is missing records.");
      return { data: { items: payload.items.map(normalizeRow), totalCount: Number(payload.totalCount ?? payload.items.length) } };
    },
    async listAll(options?: Parameters<typeof collection.list>[0]) {
      const items: RecordData[] = [];
      for (let pageNo = 1; pageNo <= 1000; pageNo++) {
        const page = await api.list({ ...options, pageNo, pageSize: 100 });
        items.push(...page.data.items);
        if (items.length >= page.data.totalCount) return { data: { items, totalCount: items.length } };
        if (!page.data.items.length) throw new Error("The case list changed while loading. Please refresh.");
      }
      throw new Error("Too many records for this view. Contact your administrator for an export.");
    },
    async get(id: string) {
      const payload = unwrapGateway(await collection.get(id), `get${schema}s`);
      if (Array.isArray(payload.items)) return payload.items[0] ? normalizeRow(payload.items[0]) : undefined;
      return payload.itemId || payload.ItemId ? normalizeRow(payload) : undefined;
    },
    async create(input: RecordData) {
      const result = unwrapGateway(await collection.create(input), `insert${schema}`);
      if (result.acknowledged === false || !(result.itemId || result.ItemId)) throw new Error("The record was not created.");
      return { ...input, ...normalizeRow(result) };
    },
    async update(id: string, input: RecordData) {
      const result = unwrapGateway(await collection.update(id, input), `update${schema}`);
      if (result.acknowledged === false || result.totalImpactedData === 0) throw new Error("The record was not updated.");
      return { ...input, ...normalizeRow(result), itemId: id };
    }
  };
  return api;
}
