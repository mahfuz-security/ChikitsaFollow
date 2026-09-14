import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { state, client } = vi.hoisted(() => {
  const path = "../../test/mocks.ts";
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(path) as typeof import("../../test/mocks");
  const state = mod.emptyState();
  const built = mod.mockBlocksClient(state);
  return { state: built.state, client: built };
});

vi.mock("../../lib/blocks/client", () => ({ blocksClient: client }));
vi.mock("../../lib/blocks/auth", () => ({
  getValidAccessToken: () => Promise.resolve("mock-token"),
  forceRefreshAccessToken: () => Promise.resolve("mock-token"),
  startLogin: () => Promise.resolve(),
  completeLogin: () => Promise.resolve({ ok: true, returnTo: "/" }),
  logout: () => Promise.resolve(),
  fetchSessionClaims: () => Promise.resolve({}),
  onSessionExpired: () => () => undefined
}));

import { ApprovalsPage } from "./ApprovalsPage";
import { LocalizationProvider } from "../../lib/i18n/LocalizationProvider";
import { AuthProvider } from "../../app/providers/AuthProvider";

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
  state.Approval.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ApprovalsPage (AC-6 client-side mask)", () => {
  it("renders 'Awaiting manager' instead of amount for front_desk viewer", async () => {
    // Note: the gateway column-level deny already strips Amount from the
    // response; the page additionally asks the serializer to strip it
    // before display. With our mock returning the raw row, the serializer
    // is the gate that hides it.
    state.Approval.push({
      itemId: "a-1",
      CaseId: "c-1",
      Amount: "500",
      Currency: "BDT",
      AmountType: "waiver",
      Decision: "pending",
      RequestedBy: "user-fd"
    });

    render(<Wrapper><ApprovalsPage /></Wrapper>);

    // Front-desk role in the mock profile hides the amount via the
    // serializer (which strips Amount/Currency when approval-amount-read
    // is not granted). The page falls back to "Awaiting manager".
    await waitFor(() => {
      expect(screen.getByText(/awaiting manager/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("500")).not.toBeInTheDocument();
  });
});
