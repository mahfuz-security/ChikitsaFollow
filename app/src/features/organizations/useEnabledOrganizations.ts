import { useQuery } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";

// Authenticated organization picker for staff screens. Public signup uses
// the separate project-scoped clinic catalog.
export type EnabledOrganization = {
  itemId: string;
  name: string;
  description?: string;
  isDisabled?: boolean;
};

type OrganizationListResponse = {
  organizations?: EnabledOrganization[];
  data?: EnabledOrganization[];
  isSuccess?: boolean;
  errors?: unknown[];
};

export function useEnabledOrganizations() {
  return useQuery({
    queryFn: async () => {
      // IAM uses zero-based page, not the Data Gateway's pageNo.
      const response = await blocksClient.iam.organizations.list({
        page: 0,
        pageSize: 100
      }) as OrganizationListResponse;
      if (response.isSuccess === false || response.errors?.length) {
        throw new Error("Could not load clinics. Please try again.");
      }
      // Current IAM returns organizations; retain data for SDK versions
      // that normalize the result to their declared response type.
      const items = response.organizations ?? response.data;
      if (!Array.isArray(items)) throw new Error("Could not load clinics. Please try again.");
      return items.filter(org => org && org.itemId && org.name && !org.isDisabled);
    },
    queryKey: ["iam", "organizations", "enabled"],
    staleTime: 60_000
  });
}
