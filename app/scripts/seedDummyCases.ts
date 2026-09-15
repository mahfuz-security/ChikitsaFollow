// One-off admin seed: ensures a "Dhaka" Branch exists and inserts 50 dummy
// service-recovery Cases into the Data Gateway. Runs with the chikitsa-seed
// service client (BLOCKS_SERVICE_CLIENT_ID/SECRET). Dummy subjects only --
// no patient names or clinical content (FR-19 firewall policy).
//
// Usage: BLOCKS_SERVICE_CLIENT_ID=... BLOCKS_SERVICE_CLIENT_SECRET=... \
//        npx tsx scripts/seedDummyCases.ts
import { serviceClient, records, type Row } from "../server/blocksRuntime";
import { createHash, randomBytes } from "node:crypto";

const client = serviceClient();
if (!client) {
  console.error("Set BLOCKS_SERVICE_CLIENT_ID and BLOCKS_SERVICE_CLIENT_SECRET first.");
  process.exit(1);
}

const categories = ["wait_time", "billing", "staff_behavior", "facility", "communication", "other"] as const;
const severities = ["Low", "Medium", "High"] as const;
const statuses = ["open", "in_progress", "awaiting_approval", "resolved", "closed"] as const;
const subjects = [
  "Long queue at reception desk",
  "Billing counter overcharged receipt",
  "Rude reply from help desk",
  "Waiting area air conditioning broken",
  "No update on complaint status",
  "Pharmacy queue too slow",
  "Wrong appointment time communicated",
  "Car parking assistance missing",
  "Cleanliness issue in ward corridor",
  "Report collection delayed by hours"
];

// 'CF-' + 8 base32 chars, unique (DC-2 masked reference shape).
function refCode(seed: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const digest = createHash("sha256").update(`dummy-case-${seed}`).digest();
  return "CF-" + [...digest.subarray(0, 8)].map(b => alphabet[b % 32]).join("");
}

const cases = client.data.collection("Case", { fields: ["BranchId", "Category", "Severity", "PatientRefCode", "Subject", "PromisedAt", "Status", "ClosedAt", "RootCauseId"] });
const branches = client.data.collection("Branch", { fields: ["Name", "Code", "IsActive"] });

async function main() {
  let dhaka: Row | undefined;
  for (const existing of await records(client, "Branch", ["Name", "Code", "IsActive"])) {
    if (String(existing.Name).toLowerCase().includes("dhaka")) { dhaka = existing; break; }
  }
  if (!dhaka) {
    const created = await branches.create({ Name: "Dhaka Branch", Code: "DHK-01", IsActive: true, Timezone: "Asia/Dhaka" } as Row);
    dhaka = (created as Row).data ?? created;
    console.log("Created Dhaka branch:", dhaka);
  } else {
    console.log("Using existing Dhaka branch:", dhaka.ItemId ?? dhaka.itemId);
  }
  const branchId = String(dhaka.ItemId ?? dhaka.itemId);

  const now = Date.now();
  let inserted = 0;
  for (let i = 1; i <= 50; i++) {
    const status = statuses[i % statuses.length]!;
    const closed = status === "closed" || status === "resolved";
    await cases.create({
      BranchId: branchId,
      Category: categories[i % categories.length]!,
      Severity: severities[i % severities.length]!,
      PatientRefCode: refCode(i),
      Subject: `${subjects[i % subjects.length]!} (demo ${i})`,
      PromisedAt: new Date(now + (i % 7) * 86400000).toISOString(),
      Status: status,
      ClosedAt: closed ? new Date(now + i * 3600000).toISOString() : undefined,
      RootCauseId: undefined
    } as Row);
    inserted++;
    if (inserted % 10 === 0) console.log(`Inserted ${inserted}/50...`);
  }
  console.log(`Done: ${inserted} dummy cases on branch ${branchId}.`);
}

main().catch(error => { console.error(error); process.exit(1); });
