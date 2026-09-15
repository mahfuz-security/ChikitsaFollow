import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const appRoot = new URL("../", import.meta.url);
const { project } = JSON.parse(readFileSync(new URL("blocks.json", appRoot), "utf8"));
if (!project?.tenantId) throw new Error("Select a project in blocks.json before syncing clinics.");

const clinics = [];
const seen = new Set();
for (let page = 0; ; page += 1) {
  const result = JSON.parse(execFileSync("blocks", [
    "iam", "organizations", "list", "--project", project.tenantId,
    "--page", String(page), "--page-size", "100", "--json"
  ], { encoding: "utf8", env: { ...process.env, BLOCKS_STRICT_FLAGS: "1" } }));
  if (result.isSuccess === false || result.errors?.length || !Array.isArray(result.organizations)) {
    throw new Error("Blocks did not return an organization list. The existing catalog was kept.");
  }
  for (const org of result.organizations) {
    if (typeof org.itemId !== "string" || typeof org.name !== "string" || !org.name.trim() || seen.has(org.itemId)) {
      throw new Error("Blocks returned an invalid or repeated organization. The existing catalog was kept.");
    }
    seen.add(org.itemId);
    if (!org.isDisabled) clinics.push({ itemId: org.itemId, name: org.name });
  }
  if (result.organizations.length < 100 || (typeof result.totalCount === "number" && seen.size >= result.totalCount)) break;
}
clinics.sort((a, b) => a.name.localeCompare(b.name));
const catalog = { tenantId: project.tenantId, clinics };
writeFileSync(new URL("src/features/organizations/signupClinicCatalog.ts", appRoot),
  "// Refreshed with npm run sync:signup-clinics. Public names and IDs only.\n" +
  "export const signupClinicCatalog = " + JSON.stringify(catalog, null, 2) + ";\n");
console.log(`Synced ${clinics.length} active signup clinics for ${project.tenantId}.`);
