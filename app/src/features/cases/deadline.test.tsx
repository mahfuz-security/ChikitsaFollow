import { afterEach, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
const { user, update, create } = vi.hoisted(() => ({ user: { itemId: "staff-1", roles: ["front_desk"], BranchId: "branch-1" }, update: vi.fn(), create: vi.fn() }));
vi.mock("../../lib/blocks/client", () => ({ blocksClient: { iam: { me: async () => ({ data: user }) } } }));
vi.mock("../../lib/blocks/gateway", () => ({ gatewayCollection: () => ({ list: async () => ({ data: { items: [{ itemId: "case-1", BranchId: "branch-1", Status: "open" }] } }), update, create }) }));
import { useSetCaseDeadline } from "./useCases";
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>;
afterEach(() => { vi.clearAllMocks(); user.roles = ["front_desk"]; });
it("records a future deadline and its history", async () => {
  const { result } = renderHook(useSetCaseDeadline, { wrapper });
  await act(() => result.current.mutateAsync({ caseId: "case-1", promisedAt: "2099-01-01T12:00:00Z" }));
  expect(update).toHaveBeenCalledWith("case-1", { PromisedAt: "2099-01-01T12:00:00.000Z" });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ CaseId: "case-1", EventType: "commitment", ActorUserId: "staff-1" }));
});
it("rejects past deadlines and review-only manager changes", async () => {
  const { result } = renderHook(useSetCaseDeadline, { wrapper });
  await act(async () => { await expect(result.current.mutateAsync({ caseId: "case-1", promisedAt: "2000-01-01" })).rejects.toThrow("future"); });
  user.roles = ["branch_manager"];
  await act(async () => { await expect(result.current.mutateAsync({ caseId: "case-1", promisedAt: "2099-01-01" })).rejects.toThrow("not permitted"); });
  expect(update).not.toHaveBeenCalled();
});
