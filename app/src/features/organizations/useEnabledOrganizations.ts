import { useQuery } from "@tanstack/react-query";
import { blocksClient } from "../../lib/blocks/client";

// Public-facing: lists organizations a patient can pick at signup.
//
// IMPORTANT — diagnosed 2026-09-14: `iam.organizations.list` is admin-scoped
// (returns 401 for unauthenticated callers). `iam.organizations.my` is
// user-scoped, also not public. The ONLY public IAM surface today is
// `iam.signupSettings.get`, which carries no org allowlist field. So the
// signup page is fundamentally dependent on the tenant enabling some
// future public-clinic-list endpoint OR shipping a static org list in
// the app bundle. Until then, anonymous visitors see an empty dropdown
// accompanied by the empty-state hint that tells them to contact the
// clinic for an invite link.
//
// This hook intentionally still tries the admin endpoint every render --
// admin sessions in the same tab (e.g., "Sign up another patient" link
// from the org switcher) get a populated list; anonymous sessions get an
// empty `[]` and the SignupPage shows the empty-state hint.
export type EnabledOrganization = {
  itemId: string;
  name: string;
  description?: string;
  isDisabled?: boolean;
};

export function useEnabledOrganizations() {
  return useQuery({
    queryFn: async () => {
      try {
        const response = await blocksClient.iam.organizations.list({
          pageNo: 1,
          pageSize: 100
        });
        // BlocksGetOrganizationsResponse = BlocksQueryListResponse<BlocksOrganization>
        // ({ data: BlocksOrganization[], totalCount, ... }). Filter defensively
        // because server-side IsDisabled is not yet honored.
        const items = (response?.data ?? []) as EnabledOrganization[];
        return items.filter((org) => org && org.itemId && !org.isDisabled);
      } catch {
        // Anonymous visitors get 401 here; swallow and return [] so the
        // dropdown renders the empty-state hint instead of an error banner.
        return [] as EnabledOrganization[];
      }
    },
    queryKey: ["iam", "organizations", "enabled"],
    staleTime: 60_000
  });
}
