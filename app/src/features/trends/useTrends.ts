import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";

export type TrendFlagRow = {
  itemId?: string;
  BranchId?: string;
  RootCauseId?: string;
  WindowStart?: string;
  WindowEnd?: string;
  CaseCount?: string; // Numeric stored as string (cloud FieldType workaround)
  DraftedFix?: string;
  Status?: "new" | "actioned" | "dismissed";
  QualityLeadUserId?: string;
};

type PagedResponse = { data?: { items?: unknown[] } } | undefined;

export function useTrendFlags() {
  return useQuery({
    queryFn: async () => {
      const response = (await blocksClient.data.collection("TrendFlag").list({
        pageNo: 1,
        pageSize: 100
      })) as PagedResponse;
      return (response?.data?.items ?? []) as TrendFlagRow[];
    },
    queryKey: ["data", "TrendFlag", "list"]
  });
}

export function useMarkTrendActioned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; qualityLeadUserId: string; draftedFix?: string }) => {
      const patch: Record<string, unknown> = {
        Status: "actioned",
        QualityLeadUserId: input.qualityLeadUserId
      };
      if (input.draftedFix) patch.DraftedFix = input.draftedFix;
      const updated = await blocksClient.data.collection("TrendFlag").update(input.itemId, patch);
      return updated as TrendFlagRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "TrendFlag"] });
    }
  });
}

export function useDismissTrend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { itemId: string; qualityLeadUserId: string }) => {
      const updated = await blocksClient.data.collection("TrendFlag").update(input.itemId, {
        Status: "dismissed",
        QualityLeadUserId: input.qualityLeadUserId
      });
      return updated as TrendFlagRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "TrendFlag"] });
    }
  });
}
