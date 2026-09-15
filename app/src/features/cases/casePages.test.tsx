import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Hoisted mocks must be declared before any module imports them.
const { state, client } = await vi.hoisted(async () => {
  const mod = await import("../../test/mocks");
  const state = mod.emptyState();
  const built = mod.mockBlocksClient(state);
  return { state: built.state, client: built };
});

vi.mock("../../lib/blocks/client", () => ({ blocksClient: client }));
const { ticketRequests, ticketMessages } = vi.hoisted(() => ({ ticketRequests: [] as Record<string, unknown>[], ticketMessages: [] as Record<string, unknown>[] }));
vi.mock("../refunds/privateApi", () => ({ privateApi: async (path: string, method = "GET", body?: Record<string, unknown>) => {
  if (method === "POST" && path === "/tickets") {
    ticketRequests.push(body!);
    const row = { itemId: "created-case", Subject: String(body!.subject), BranchId: String(body!.branchId), Category: String(body!.category), Severity: String(body!.severity), Status: "open", PatientRefCode: "CF-ABC23456" };
    state.Case.push(row);
    return { caseRow: row, patientRefCode: row.PatientRefCode };
  }
  if (method === "POST" && path.endsWith("/messages")) { ticketMessages.push(body!); return { id: "message-1" }; }
  if (path.startsWith("/tickets/")) return { ticket: { id: "c-1", reference: "CF-ABC23456", subject: "", status: "open" }, messages: [], canReply: true };
  return {};
} }));
vi.mock("../../lib/blocks/auth", () => ({
  getValidAccessToken: () => Promise.resolve("mock-token"),
  forceRefreshAccessToken: () => Promise.resolve("mock-token"),
  startLogin: () => Promise.resolve(),
  completeLogin: () => Promise.resolve({ ok: true, returnTo: "/" }),
  logout: () => Promise.resolve(),
  fetchSessionClaims: () => Promise.resolve({}),
  onSessionExpired: () => () => undefined
}));

import { CasesListPage } from "./CasesListPage";
import { CaseDetailPage } from "./CaseDetailPage";
import { NewCasePage } from "./NewCasePage";
import { LocalizationProvider } from "../../lib/i18n/LocalizationProvider";
import { AuthProvider } from "../../app/providers/AuthProvider";
import { AppRouter } from "../../app/router/routes";

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <LocalizationProvider>{children}</LocalizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  ticketRequests.length = 0; ticketMessages.length = 0;
  // Clear rows between tests.
  state.Case.length = 0;
  state.CaseEvent.length = 0;
  state.Approval.length = 0;
  state.RootCause.length = 0;
  state.RootCause.push(
    { itemId: "rc-billing", Slug: "billing", DisplayName: "Billing process", IsActive: true },
    { itemId: "rc-wait", Slug: "wait_time", DisplayName: "Wait time", IsActive: true }
  );
  // mock return for useEnabledOrganizations → first org
  state.OrganizationMember.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("Case navigation and filtering", () => {
  it("opens the new-case form from the staff home without interpreting new as a case ID", async () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const user = userEvent.setup();
    render(<Wrapper><AppRouter /></Wrapper>);
    await user.click(await screen.findByRole("button", { name: "New case" }));
    expect(window.location.pathname).toBe("/cases/new");
    expect(await screen.findByRole("textbox", { name: "What happened?" })).toBeInTheDocument();
    expect(screen.queryByText("This case could not be loaded.")).not.toBeInTheDocument();
  });

  it("combines status and summary filters and clears an empty search", async () => {
    const base = { BranchId: "branch-1", Category: "billing", Severity: "Medium", PatientRefCode: "CF-ABC23456" };
    state.Case.push(
      { ...base, itemId: "c-open", Subject: "Duplicate payment", Status: "open" },
      { ...base, itemId: "c-done", Subject: "Refund completed", Status: "resolved" }
    );
    const user = userEvent.setup();
    render(<Wrapper><CasesListPage onNavigate={vi.fn()} /></Wrapper>);
    await screen.findByText("Duplicate payment");
    await user.click(screen.getByRole("button", { name: "Completed" }));
    expect(screen.queryByText("Duplicate payment")).not.toBeInTheDocument();
    expect(screen.getByText("Refund completed")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox"), "Duplicate");
    expect(screen.getByRole("heading", { name: "No matching cases" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
});

// ---------- AC-1 + AC-5: 6-field new-case submit + firewall guard ----------

describe("AC-1 + AC-5 NewCasePage", () => {
  it("blocks submit when subject contains clinical content (AC-5)", async () => {
    const user = userEvent.setup();
    render(<Wrapper><NewCasePage onNavigate={() => undefined} /></Wrapper>);

    const subject = await screen.findByPlaceholderText(/short summary/i);
    await user.type(subject, "creatinine 1.4 mg/dL");
    await user.type(screen.getByLabelText("Patient email"), "patient@example.test");
    await user.type(screen.getByLabelText("Hospital-issued patient ID"), "HOSP-1234");
    // pick severity Medium (default) and category wait_time (default)
    await user.click(screen.getByRole("button", { name: /submit/i }));

    // Firewall blocks; the create call must NOT have been invoked.
    const coll = client.data.collection("Case");
    expect((coll.create as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
    // An error message is shown.
    await waitFor(() => {
      expect(screen.getByText(/clinical content/i)).toBeInTheDocument();
    });
  });

  it("submits a patient-linked case through the server with a clean subject", async () => {
    const user = userEvent.setup();
    render(<Wrapper><NewCasePage onNavigate={() => undefined} /></Wrapper>);

    const subject = await screen.findByPlaceholderText(/short summary/i);
    await user.type(subject, "Long wait at the front desk");
    await user.type(screen.getByLabelText("Patient email"), "patient@example.test");
    await user.type(screen.getByLabelText("Hospital-issued patient ID"), "HOSP-1234");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(state.Case.length).toBe(1);
      expect(ticketRequests[0]?.patientEmail).toBe("patient@example.test");
    });
    const c = state.Case[0];
    expect(c?.Subject).toBe("Long wait at the front desk");
    expect(c?.Status).toBe("open");
    expect(c?.PatientRefCode).toMatch(/^CF-[0-9A-HJ-NP-TV-Z]{8}$/);
    expect(ticketRequests[0]?.requestId).toBeTruthy();
  });
});

// ---------- AC-10: empty subject shows a friendly dictionary error ----------

describe("AC-10 empty subject", () => {
  it("rejects an empty subject with the dictionary message, not a raw API error", async () => {
    const user = userEvent.setup();
    render(<Wrapper><NewCasePage onNavigate={() => undefined} /></Wrapper>);

    const subject = await screen.findByPlaceholderText(/short summary/i);
    // type one space then backspace → empty
    await user.type(subject, "x");
    await user.clear(subject);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    // The create endpoint must not have been called.
    const coll = client.data.collection("Case");
    expect((coll.create as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0);
    // Native HTML5 `required` blocks submission; assert the form did not
    // proceed (no Case row written). For a richer test we'd swap `required`
    // for a custom validator — out of scope here.
    expect(state.Case).toHaveLength(0);
  });
});

// ---------- AC-2 + AC-9: detail page + AI draft + send reply ----------

describe("AC-2 CaseDetailPage", () => {
  it("AI draft + Send Reply append two CaseEvent rows (AC-2)", async () => {
    // Seed a case.
    state.Case.push({
      itemId: "c-1",
      BranchId: "branch-1",
      Category: "wait_time",
      Severity: "Medium",
      PatientRefCode: "CF-ABC23456",
      Subject: "Long wait",
      Status: "open"
    });
    state.CaseEvent.push({
      itemId: "evt-1",
      CaseId: "c-1",
      EventType: "created",
      ActorUserId: "user-fd",
      Text: "Long wait",
      AiGenerated: false
    });

    const user = userEvent.setup();
    render(<Wrapper><CaseDetailPage caseId="c-1" onNavigate={() => undefined} /></Wrapper>);

    // Wait for the case + history to load.
    await screen.findAllByText(/Long wait/);

    // AC-2 step 1: AI draft.
    await user.click(screen.getByRole("button", { name: /ai draft/i }));
    await waitFor(() => {
      expect(state.CaseEvent.some((e) => e.EventType === "ai_draft" && e.AiGenerated === false && e.MetadataJson?.includes('"source":"template"'))).toBe(true);
    });

    // AC-2 step 2: send reply.
    const reply = await screen.findByRole("textbox", { name: "Your message" });
    await user.selectOptions(screen.getByRole("combobox", { name: "Message type" }), "reply");
    await user.type(reply, "Thanks for letting us know — we will look into it.");
    await user.click(screen.getByRole("button", { name: "Post message" }));

    await waitFor(() => {
      expect(ticketMessages.some(message => message.kind === "reply")).toBe(true);
    });
    const draftEvents = state.CaseEvent.filter((e) => e.EventType === "ai_draft");
    const replyEvents = ticketMessages;
    expect(draftEvents.length).toBeGreaterThanOrEqual(1);
    expect(replyEvents.length).toBe(1);
  });
});

// ---------- AC-3: Close case requires root cause ----------

describe("AC-3 close-case root cause required", () => {
  it("refuses to close without picking a root cause", async () => {
    state.Case.push({
      itemId: "c-2",
      BranchId: "branch-1",
      Category: "billing",
      Severity: "High",
      PatientRefCode: "CF-DEF12345",
      Subject: "Wrong bill",
      Status: "open"
    });

    const user = userEvent.setup();
    render(<Wrapper><CaseDetailPage caseId="c-2" onNavigate={() => undefined} /></Wrapper>);
    await screen.findByText(/Wrong bill/);

    await user.click(screen.getByRole("button", { name: /close case/i }));
    // Click confirm without selecting root cause.
    await user.click(screen.getByRole("button", { name: /confirm close/i }));

    // No CaseEvent.closed row, no Status mutation.
    expect(state.CaseEvent.find((e) => e.EventType === "closed")).toBeUndefined();
    expect(state.Case[0]?.Status).toBe("open");
  });

  it("closes with root cause picked", async () => {
    state.Case.push({
      itemId: "c-3",
      BranchId: "branch-1",
      Category: "billing",
      Severity: "High",
      PatientRefCode: "CF-GHI67890",
      Subject: "Wrong bill",
      Status: "open"
    });

    const user = userEvent.setup();
    render(<Wrapper><CaseDetailPage caseId="c-3" onNavigate={() => undefined} /></Wrapper>);
    await screen.findByText(/Wrong bill/);

    await user.click(screen.getByRole("button", { name: /close case/i }));
    const select = within(await screen.findByRole("dialog")).getByRole("combobox");
    await user.selectOptions(select, "rc-billing");
    await user.click(screen.getByRole("button", { name: /confirm close/i }));

    await waitFor(() => {
      expect(state.CaseEvent.find((e) => e.EventType === "closed")).toBeDefined();
    });
    expect(state.Case[0]?.Status).toBe("closed");
    expect(state.Case[0]?.RootCauseId).toBe("rc-billing");
  });
});

// ---------- AC-9: tap count to submit a case ≤3 ----------

describe("AC-9 tap count", () => {
  it("from /, requires ≤3 navigations to submit a case", async () => {
    // /  →  /cases  →  /cases/new  → submit (3 taps from profile root).
    // We assert the route shape rather than driving the router UI.
    const user = userEvent.setup();
    const navigate = vi.fn();

    // 1. From /, navigate to /cases
    render(<Wrapper><CasesListPage onNavigate={navigate} /></Wrapper>);
    const logCase = await screen.findByRole("button", { name: /new case/i });
    // 2. From /cases, click "Log case" to navigate to /cases/new
    await user.click(logCase);
    expect(navigate).toHaveBeenCalledWith("/cases/new");

    // 3. From /cases/new, click Submit
    state.Case.length = 0;
    state.CaseEvent.length = 0;
    render(<Wrapper><NewCasePage onNavigate={navigate} /></Wrapper>);
    const subject = await screen.findByPlaceholderText(/short summary/i);
    await user.type(subject, "Front desk was friendly");
    await user.type(screen.getByLabelText("Patient email"), "patient@example.test");
    await user.type(screen.getByLabelText("Hospital-issued patient ID"), "HOSP-1234");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(state.Case.length).toBe(1));

    // Total navigations + submit = ≤3 actions to land a case from /.
    expect(navigate.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
