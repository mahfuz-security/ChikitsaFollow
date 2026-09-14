import { X } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";

// Generic overlay for every create/edit/delete dialog in the app.
// Backdrop is a solid scrim (NOT blurred) per §6.6 so the modal is the
// unambiguous focus. Body uses Level 3 glass. Escape + backdrop-click
// both close; the scale-fade enter animation respects
// `prefers-reduced-motion` via the @media block in styles.css.
export function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div aria-modal="true" className="modal" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
