import { useQuery } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";

export type AuditLogRow = {
  itemId?: string;
  ActorUserId?: string;
  Action?: string;
  ResourceType?: string;
  ResourceId?: string;
  BranchId?: string;
  MetadataJson?: string;
};

type PagedResponse = { data?: { items?: unknown[] } } | undefined;

export function useAuditLog() {
  return useQuery({
    queryFn: async () => {
      const response = (await blocksClient.data.collection("AuditLog").list({
        pageNo: 1,
        pageSize: 200
      })) as PagedResponse;
      const items = ((response?.data?.items ?? []) as AuditLogRow[]).slice();
      // Newest first.
      items.sort((a, b) => (b.itemId ?? "").localeCompare(a.itemId ?? ""));
      return items;
    },
    queryKey: ["data", "AuditLog", "list"]
  });
}
