import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEnabledOrganizations } from "./useEnabledOrganizations";

const { list } = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../../lib/blocks/client", () => ({ blocksClient: { iam: { organizations: { list } } } }));

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("Authenticated clinic list", () => {
  it("reads the IAM organizations envelope using zero-based paging and excludes disabled clinics", async () => {
    list.mockResolvedValue({ isSuccess: true, organizations: [
      { itemId: "active", name: "Clinic", isDisabled: false },
      { itemId: "disabled", name: "Closed clinic", isDisabled: true }
    ] });
    const { result } = renderHook(() => useEnabledOrganizations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(org => org.itemId)).toEqual(["active"]);
    expect(list).toHaveBeenCalledWith({ page: 0, pageSize: 100 });
  });

  it("reports authorization failure instead of pretending the clinic list is empty", async () => {
    list.mockRejectedValue(new Error("401 Unauthorized"));
    const { result } = renderHook(() => useEnabledOrganizations(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
