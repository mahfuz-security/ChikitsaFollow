import type { StatusPillTone } from "../../shared/ui/StatusPill";
import type { CaseStatus } from "./useCases";

export function caseStatusTone(status: CaseStatus | undefined): StatusPillTone {
  if (status === "open") return "open";
  if (status === "in_progress" || status === "awaiting_approval") return "progress";
  if (status === "resolved" || status === "closed" || status === "verified") return "resolved";
  return "neutral";
}
