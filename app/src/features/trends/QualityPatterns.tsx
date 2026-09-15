import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { gatewayCollection } from "../../lib/blocks/gateway";
import { hasPermission } from "../../lib/permissions";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { useCases } from "../cases/useCases";
import { useCurrentUser } from "../profile/useCurrentUser";
import { useActiveRootCauses } from "../vocab/useRootCauses";
import { useCaseBranches } from "../organizations/useCaseBranches";
import { scanForClinical } from "../ai/firewall";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { Modal } from "../../shared/ui/Modal";
import { rootCausePatterns } from "./patterns";

export function QualityPatterns() {
  const { t } = useT();
  const cases = useCases(), roots = useActiveRootCauses(), orgs = useCaseBranches(), me = useCurrentUser();
  const queryClient = useQueryClient();
  const patterns = rootCausePatterns(cases.data ?? []);
  const [selected, setSelected] = useState<typeof patterns[number]>();
  const [action, setAction] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      if (!selected || !hasPermission(me.data?.data, "trend-action")) throw new Error(t("common.accessDenied"));
      const scan = scanForClinical(action);
      if (!scan.ok) throw new Error(scan.message);
      const end = new Date();
      return gatewayCollection("TrendFlag").create({ BranchId: selected.branchId, RootCauseId: selected.rootCauseId,
        CaseCount: String(selected.count), WindowStart: new Date(end.getTime() - 30 * 86400000).toISOString(), WindowEnd: end.toISOString(),
        DraftedFix: action.trim(), Status: "new", QualityLeadUserId: me.data?.data?.itemId });
    },
    onSuccess: () => { setSelected(undefined); setAction(""); queryClient.invalidateQueries({ queryKey: ["data", "TrendFlag"] }); }
  });
  return <section className="quality-patterns"><h2>{t("trends.patterns")}</h2><p className="muted">{t("trends.patternsHint")}</p>
    {cases.isError ? <Alert tone="error">{t("cases.loadFailed")}</Alert> : patterns.length ? <div className="pattern-list">{patterns.map(pattern => <article key={`${pattern.branchId}:${pattern.rootCauseId}`}>
      <div><h3>{roots.data?.find(row => row.itemId === pattern.rootCauseId)?.DisplayName ?? pattern.rootCauseId}</h3><p>{orgs.data?.find(row => row.itemId === pattern.branchId)?.name ?? pattern.branchId}</p><strong>{t("trends.patternCount", undefined, { count: String(pattern.count) })}</strong></div>
      {hasPermission(me.data?.data, "trend-action") ? <ActionButton variant="secondary" onClick={() => { setSelected(pattern); save.reset(); }} icon={<ClipboardCheck size={18} />}>{t("trends.recordFix")}</ActionButton> : null}
    </article>)}</div> : <p className="profile-note">{t(cases.isLoading ? "common.loading" : "trends.noPatterns")}</p>}
    {selected ? <Modal title={t("trends.recordFix")} onClose={() => setSelected(undefined)}><form onSubmit={event => { event.preventDefault(); if (action.trim()) save.mutate(); }}><label className="form-field"><span>{t("trends.fixLabel")}</span><textarea rows={4} maxLength={1000} required value={action} onChange={event => setAction(event.target.value)} disabled={save.isPending} /></label><p className="profile-note">{t("trends.fixOwner")}</p>{save.isError ? <Alert tone="error">{save.error.message}</Alert> : null}<ActionButton type="submit" disabled={!action.trim() || save.isPending}>{t(save.isPending ? "common.saving" : "common.save")}</ActionButton></form></Modal> : null}
  </section>;
}
