import { vi } from "vitest";

// In-memory mock of the data layer used across page tests. Each test
// seeds the rows it needs; assertions read back the captured calls.

export type MockCase = {
  itemId: string;
  BranchId: string;
  Category: string;
  Severity: string;
  PatientRefCode: string;
  Subject: string;
  Status: string;
  PromisedAt?: string;
  ClosedAt?: string;
  RootCauseId?: string;
};

export type MockEvent = {
  itemId: string;
  CaseId: string;
  EventType: string;
  ActorUserId: string;
  Text?: string;
  MetadataJson?: string;
  AiGenerated?: boolean;
};

export type MockApproval = {
  itemId: string;
  CaseId: string;
  Amount: string;
  Currency: string;
  AmountType: string;
  Decision: string;
  RequestedBy?: string;
};

export type MockRootCause = {
  itemId: string;
  Slug: string;
  DisplayName: string;
  IsActive: boolean;
};

export type MockState = {
  Case: MockCase[];
  CaseEvent: MockEvent[];
  Approval: MockApproval[];
  RootCause: MockRootCause[];
  AuditLog: unknown[];
  TrendFlag: unknown[];
  OrganizationMember: unknown[];
  Invite: unknown[];
  User: unknown[];
  PatientMembership: unknown[];
  Branch: unknown[];
  CaseRootCause: unknown[];
};

export function emptyState(): MockState {
  return {
    Case: [],
    CaseEvent: [],
    Approval: [],
    RootCause: [
      { itemId: "rc-billing", Slug: "billing", DisplayName: "Billing process", IsActive: true },
      { itemId: "rc-wait", Slug: "wait_time", DisplayName: "Wait time", IsActive: true }
    ],
    AuditLog: [],
    TrendFlag: [],
    OrganizationMember: [],
    Invite: [],
    User: [],
    PatientMembership: [],
    Branch: [],
    CaseRootCause: []
  };
}

export function mockBlocksClient(state: MockState) {
  // Map schema → array. We intentionally let callers read whatever
  // collection they need; only the operations below are stubbed.
  const matchesFilter = (row: Record<string, unknown>, filter?: Record<string, unknown>) => {
    if (!filter) return true;
    return Object.entries(filter).every(([k, v]) => row[k] === v);
  };

  const collection = (schemaName: keyof MockState) => {
    return {
      list: vi.fn(async (opts?: { filter?: Record<string, unknown>; pageNo?: number; pageSize?: number }) => {
        const items = (state[schemaName] as unknown as Record<string, unknown>[]).filter((row) => matchesFilter(row, opts?.filter));
        return { data: { items } };
      }),
      get: vi.fn(async (id: string) => {
        const row = (state[schemaName] as unknown as Record<string, unknown>[]).find((r) => r.itemId === id);
        return row ?? null;
      }),
      create: vi.fn(async (input: Record<string, unknown>) => {
        const newRow = { itemId: `${schemaName.toLowerCase()}-${state[schemaName].length + 1}-${Date.now()}`, ...input };
        (state[schemaName] as unknown as Record<string, unknown>[]).push(newRow);
        return newRow;
      }),
      update: vi.fn(async (id: string, patch: Record<string, unknown>) => {
        const rows = state[schemaName] as unknown as Record<string, unknown>[];
        const idx = rows.findIndex((r) => r.itemId === id);
        if (idx < 0) throw new Error("not_found");
        rows[idx] = { ...rows[idx], ...patch };
        return rows[idx];
      }),
      delete: vi.fn(async (id: string) => {
        const rows = state[schemaName] as unknown as Record<string, unknown>[];
        const idx = rows.findIndex((r) => r.itemId === id);
        if (idx >= 0) rows.splice(idx, 1);
        return { acknowledged: true };
      })
    };
  };

  const iam = {
    me: vi.fn(async () => ({
      data: {
        itemId: "user-fd",
        email: "fd@example.com",
        firstName: "Front",
        lastName: "Desk",
        BranchId: "branch-1",
        roles: ["front_desk"],
        permissions: [
          "case-create",
          "case-read",
          "case-event-create",
          "case-event-read",
          "case-ai-draft",
          "case-send-reply",
          "case-close",
          "approval-request"
        ]
      }
    })),
    organizations: {
      list: vi.fn(async () => ({
        data: [
          { itemId: "branch-1", name: "Gulshan Clinic" },
          { itemId: "branch-2", name: "Dhanmondi Clinic" }
        ],
        totalCount: 2
      }))
    }
  };

  const localization = {
    languages: vi.fn(async () => [{ code: "en", name: "English", isDefault: true }]),
    translations: vi.fn(async () => ({}))
  };

  return { state, data: { collection }, iam, localization, auth: {
    userInfo: vi.fn(async () => ({ sub: "user-fd" })),
    idp: { redirectToProvider: vi.fn(async () => undefined), callback: vi.fn(async () => ({})) },
    logout: vi.fn(async () => undefined)
  } };
}

export function mockGetValidAccessToken() {
  return vi.fn(async () => "mock-token");
}
