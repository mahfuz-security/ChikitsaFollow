import { gatewayCollection } from "../../lib/blocks/gateway";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";

export type RootCauseRow = {
  itemId?: string;
  Slug?: string;
  DisplayName?: string;
  Description?: string;
  IsActive?: boolean;
};

type PagedResponse = { data?: { items?: unknown[] } } | undefined;

export function useActiveRootCauses() {
  return useQuery({
    queryFn: async () => {
      const response = (await gatewayCollection("RootCause").list({
        pageNo: 1,
        pageSize: 100
      })) as PagedResponse;
      const items = ((response?.data?.items ?? []) as RootCauseRow[]).filter((r) => r.IsActive !== false);
      return items;
    },
    queryKey: ["data", "RootCause", "active"]
  });
}

export function useAllRootCauses() {
  return useQuery({
    queryFn: async () => {
      const response = (await gatewayCollection("RootCause").list({
        pageNo: 1,
        pageSize: 200
      })) as PagedResponse;
      return (response?.data?.items ?? []) as RootCauseRow[];
    },
    queryKey: ["data", "RootCause", "all"]
  });
}

export type RootCauseInput = {
  slug: string;
  displayName: string;
  description?: string;
};

export function useCreateRootCause() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RootCauseInput) => {
      const row: Record<string, unknown> = {
        Slug: input.slug,
        DisplayName: input.displayName,
        IsActive: true
      };
      if (input.description) row.Description = input.description;
      const created = await gatewayCollection("RootCause").create(row);
      return created as RootCauseRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "RootCause"] });
    }
  });
}

export function useSetRootCauseActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; isActive: boolean }) => {
      const updated = await gatewayCollection("RootCause").update(input.itemId, { IsActive: input.isActive });
      return updated as RootCauseRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "RootCause"] });
    }
  });
}
