import { useQuery } from "@tanstack/react-query";
import { gatewayCollection } from "../../lib/blocks/gateway";
import { branchFilterForUser } from "../cases/access";
import { useCurrentUser } from "../profile/useCurrentUser";

export function useCaseBranches() {
  const me = useCurrentUser();
  return useQuery({
    queryKey: ["data", "Branch", "caseScope", me.data?.data?.itemId],
    enabled: Boolean(me.data?.data?.itemId),
    queryFn: async () => {
      const scope = branchFilterForUser(me.data?.data);
      const result = await gatewayCollection("Branch").listAll({ filter: scope.BranchId ? { ItemId: scope.BranchId } : {} });
      return result.data.items.map(row => ({ itemId: String(row.itemId), name: String(row.Name ?? row.itemId) }));
    }
  });
}
