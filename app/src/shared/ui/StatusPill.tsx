import { AlertCircle, Check, Info, Loader2, Minus } from "lucide-react";
import type { ReactNode } from "react";

// Tones map to the spec's status palette. Each tone carries color + icon
// + label per §6.2. When the caller doesn't supply `icon`, we render a
// tone-keyed glyph so the visual vocabulary is consistent across the
// app. The `progress` tone uses Loader2 — its spin animation is gated
// by the prefers-reduced-motion block in styles.css so it freezes for
// users who opt out of motion. ARIA exposes the tone verbosely.
//
// Legacy aliases (`good` -> `resolved`, `warn` -> `progress`) are kept
// so existing feature pages don't break on the redesign pass. New code
// should use the spec-aligned names.
export type StatusPillTone = "open" | "progress" | "resolved" | "info" | "neutral";
export type StatusPillToneInput = StatusPillTone | "good" | "warn" | "neutral-legacy";

const aliasMap: Record<string, StatusPillTone> = {
  good: "resolved",
  warn: "progress"
};

const toneClass: Record<StatusPillTone, string> = {
  open: "pill pill-open",
  progress: "pill pill-progress",
  resolved: "pill pill-resolved",
  info: "pill pill-info",
  neutral: "pill pill-neutral"
};

const toneIcon: Record<StatusPillTone, ReactNode> = {
  open: <AlertCircle size={14} aria-hidden />,
  progress: <Loader2 size={14} aria-hidden />,
  resolved: <Check size={14} aria-hidden />,
  info: <Info size={14} aria-hidden />,
  neutral: <Minus size={14} aria-hidden />
};

const toneAriaLabel: Record<StatusPillTone, string> = {
  open: "Open",
  progress: "In progress",
  resolved: "Resolved",
  info: "Info",
  neutral: "Neutral"
};

function resolve(tone: StatusPillToneInput): StatusPillTone {
  return aliasMap[tone] ?? (tone as StatusPillTone);
}

export function StatusPill({ tone, children, icon }: { tone: StatusPillToneInput; children: ReactNode; icon?: ReactNode }) {
  const resolved = resolve(tone);
  return (
    <span className={toneClass[resolved]} aria-label={toneAriaLabel[resolved]}>
      {icon ? <span aria-hidden>{icon}</span> : <span className="pill-glyph" aria-hidden>{toneIcon[resolved]}</span>}
      <span>{children}</span>
    </span>
  );
}
