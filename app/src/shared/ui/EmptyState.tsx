import type { ReactNode } from "react";

// Title uses Fraunces display-lg per §2 ("Display/Headings ... Used
// only for page titles and empty-state headlines"). Container is glass
// Level 2 — empty states are focus moments on otherwise busy pages.
export function EmptyState({ action, description, icon, title }: { action?: ReactNode; description: string; icon?: ReactNode; title: string }) {
  return (
    <div className="empty-state">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
