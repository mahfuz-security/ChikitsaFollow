import { useQuery } from "@tanstack/react-query";
import { Banknote } from "lucide-react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { privateApi } from "./privateApi";
export function CaseRefundStatus({ caseId }: { caseId: string }) {
  const { t } = useT();
  const refund = useQuery({ queryKey: ["private", "refundFlag", caseId], queryFn: async () => {
    try { return await privateApi<{ requested: boolean; paid?: boolean }>(`/refunds/${encodeURIComponent(caseId)}`); }
    catch (error) { if (error instanceof Error && error.message === "refund_not_found") return null; throw error; }
  }, retry: false, gcTime: 0 });
  if (refund.isError) return <p className="muted">{t("refund.checkFailed")}</p>;
  if (!refund.data?.requested) return null;
  return <p className="refund-case-flag"><Banknote size={18} />{t(refund.data.paid ? "refund.recorded" : "refund.requested")}</p>;
}
