import type { ReactNode } from "react";

// Page-level header. Title uses Fraunces (display serif) per the type
// scale in §2; subtitle is small body text in --text-secondary. The
// container is intentionally not glass — it's the page itself, with
// glass reserved for focused layers above (§3). `--space-4` internal
// padding matches §5.2's "card internal padding is uniform".
export function PageHeader({ actions, subtitle, title }: { actions?: ReactNode; subtitle: string; title: string }) {
  return (
    <header className="page-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
