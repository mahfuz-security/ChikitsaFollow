import { gatewayCollection } from "../../lib/blocks/gateway";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";
import { hasPermission } from "../../lib/permissions";

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
      const profile = (await blocksClient.iam.me()).data;
      if (!hasPermission(profile, "trend-read")) throw new Error("Trend access is not permitted.");
      const response = (await gatewayCollection("TrendFlag").list({
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
      const profile = (await blocksClient.iam.me()).data;
      if (!profile?.itemId || !hasPermission(profile, "trend-action")) throw new Error("Corrective actions are not permitted.");
      const patch: Record<string, unknown> = {
        Status: "actioned",
        QualityLeadUserId: profile.itemId
      };
      if (input.draftedFix) patch.DraftedFix = input.draftedFix;
      const updated = await gatewayCollection("TrendFlag").update(input.itemId, patch);
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
      const profile = (await blocksClient.iam.me()).data;
      if (!profile?.itemId || !hasPermission(profile, "trend-action")) throw new Error("Corrective actions are not permitted.");
      const updated = await gatewayCollection("TrendFlag").update(input.itemId, {
        Status: "dismissed",
        QualityLeadUserId: profile.itemId
      });
      return updated as TrendFlagRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data", "TrendFlag"] });
    }
  });
}
