import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

// Status comms always carry color + icon + text label (§6.2, §9).
// The icon is resolved internally from `tone` so callers never forget it.
const toneIcon: Record<AlertTone, ReactNode> = {
  info: <Info size={16} aria-hidden />,
  warn: <AlertTriangle size={16} aria-hidden />,
  error: <AlertCircle size={16} aria-hidden />,
  success: <CheckCircle2 size={16} aria-hidden />
};

export type AlertTone = "error" | "info" | "warn" | "success";

export function Alert({ children, tone = "warn", icon }: { children: ReactNode; tone?: AlertTone; icon?: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === "error" || tone === "warn" ? "alert" : "status"}>
      <span aria-hidden>{icon ?? toneIcon[tone]}</span>
      <span>{children}</span>
    </div>
  );
}
