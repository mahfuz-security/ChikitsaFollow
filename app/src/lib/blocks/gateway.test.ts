import { beforeEach, describe, expect, it, vi } from "vitest";
const { list, get, create, update, collection } = vi.hoisted(() => {
  const list = vi.fn(), get = vi.fn(), create = vi.fn(), update = vi.fn();
  return { list, get, create, update, collection: vi.fn((_name: string, _options: { fields: string[] }) => ({ list, get, create, update })) };
});
vi.mock("./client", () => ({ blocksClient: { data: { collection } } }));
import { gatewayCollection } from "./gateway";
beforeEach(() => vi.clearAllMocks());
describe("Blocks Data SDK boundary", () => {
  it("selects actual fields and normalizes GraphQL list envelopes and ItemId", async () => {
    list.mockResolvedValue({ data: { getCases: { items: [{ ItemId: "case-1", Subject: "Delayed report" }], totalCount: 1 } } });
    const result = await gatewayCollection("Case").list();
    expect(result.data.items[0]).toMatchObject({ itemId: "case-1", Subject: "Delayed report" });
    expect(collection).toHaveBeenCalledWith("Case", { fields: expect.arrayContaining(["Subject", "Status", "CreatedDate"]) });
  });
  it("does not request compensation amounts unless explicitly authorized", () => {
    gatewayCollection("Approval");
    expect(collection.mock.calls[0]?.[1].fields).not.toContain("Amount");
  });
  it("normalizes get and create results", async () => {
    get.mockResolvedValue({ data: { getCases: { items: [{ ItemId: "case-1" }] } } });
    create.mockResolvedValue({ data: { insertCase: { acknowledged: true, itemId: "case-1" } } });
    expect(await gatewayCollection("Case").get("case-1")).toMatchObject({ itemId: "case-1" });
    expect(await gatewayCollection("Case").create({ Subject: "Delay" })).toMatchObject({ itemId: "case-1", Subject: "Delay" });
  });
  it("rejects GraphQL errors even with partial records", async () => {
    list.mockResolvedValue({ errors: [{ message: "denied" }], data: { getCases: { items: [] } } });
    await expect(gatewayCollection("Case").list()).rejects.toThrow();
  });
  it("rejects an unacknowledged or zero-row mutation", async () => {
    update.mockResolvedValue({ data: { updateCase: { acknowledged: false } } });
    await expect(gatewayCollection("Case").update("case-1", {})).rejects.toThrow();
    update.mockResolvedValue({ data: { updateCase: { acknowledged: true, totalImpactedData: 0 } } });
    await expect(gatewayCollection("Case").update("case-1", {})).rejects.toThrow();
  });
});
