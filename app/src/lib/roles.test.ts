import { expect, it } from "vitest";
import type { BlocksUser } from "@seliseblocks/client";
import { rolesForUser, homeView } from "./roles";
import { roles as serverRoles } from "../../server/blocksRuntime";

it("normalizes IAM directory roles identically in the browser and private API", () => {
  const user = { roles: { org: ["front_desk"], other: ["front_desk"] } } as unknown as BlocksUser;
  expect(rolesForUser(user)).toEqual(["front_desk"]);
  expect(serverRoles(user)).toEqual(["front_desk"]);
  expect(rolesForUser({ roles: [null, {}] } as unknown as BlocksUser)).toEqual([]);
});
it("chooses operational homes without showing a patient dashboard for unknown accounts", () => {
  expect(homeView({ roles: ["front_desk"] })).toBe("cases");
  expect(homeView({ roles: ["branch_manager"] })).toBe("performance");
  expect(homeView({ roles: ["quality_lead"] })).toBe("performance");
  expect(homeView({ roles: ["patient"] })).toBe("patient");
  expect(homeView(undefined)).toBe("unknown");
});
