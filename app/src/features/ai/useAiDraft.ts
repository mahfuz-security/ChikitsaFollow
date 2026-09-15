import { useMutation } from "@tanstack/react-query";
import type { CaseRow } from "../cases/useCases";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { DRAFT_CATEGORIES, draftTemplate } from "./draftTemplate";

export type DraftInput = { caseRow: CaseRow; actorUserId: string };
export function useAiDraft() {
  const { language } = useT();
  return useMutation({
    mutationFn: async ({ caseRow }: DraftInput): Promise<{ draft: string; source: "template" | "ai" }> => {
      // The API receives enums only. Never send the summary, patient reference,
      // user identity, or case identifier to an external model.
      const category = DRAFT_CATEGORIES.find(value => value === caseRow.Category) ?? "other";
      const severity = ["Low", "Medium", "High"].includes(caseRow.Severity ?? "") ? caseRow.Severity : "Medium";
      try {
        const response = await fetch("/api/assistant/draft", {
          method: "POST", headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(18_000), body: JSON.stringify({ category, severity, language })
        });
        if (!response.ok) throw new Error("Draft service unavailable");
        const result = await response.json();
        if (typeof result.draft === "string" && result.draft.trim() && ["template", "ai"].includes(result.source)) return result;
      } catch { /* A reviewed template remains available without a provider. */ }
      return { draft: draftTemplate(language), source: "template" };
    }
  });
}
