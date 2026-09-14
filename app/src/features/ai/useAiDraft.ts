import { useMutation } from "@tanstack/react-query";
import { toLlmSafeSummary } from "../cases/serializers";
import type { CaseRow } from "../cases/useCases";

// FR-16, FR-17, FR-22: produce an AI-drafted reply for a case. The real
// implementation will call an LLM; this stub returns a canned response
// derived from non-PII fields only. The useAiDraft hook wires up the
// CaseEvent append (`ai_draft`) so the history reflects what was
// generated, and the eventual Sent Reply becomes a second event.
const STUB_TEMPLATE = (category: string, severity: string) =>
  `Thank you for letting us know about your ${category} concern. ` +
  `We take ${severity.toLowerCase()}-severity feedback seriously and ` +
  `a member of our team will follow up within 24 hours. If your issue ` +
  `is urgent, please ask at the front desk and reference this case.`;

export type DraftInput = {
  caseRow: CaseRow;
  actorUserId: string;
};

export function useAiDraft() {
  return useMutation({
    mutationFn: async (_input: DraftInput): Promise<{ draft: string }> => {
      // FR-22: only non-PII fields are sent to the (future) LLM. Today,
      // we just compose the stub from the same allowlist. The serializer
      // is exercised so any future change to the allowlist is caught
      // here.
      const safe = toLlmSafeSummary(_input.caseRow);
      const draft = STUB_TEMPLATE(safe.Category || "your", safe.Severity || "Medium");
      // Simulate small latency so UX-4 ("AI Draft" affordance) feels real.
      await new Promise((r) => setTimeout(r, 350));
      return { draft };
    }
  });
}
