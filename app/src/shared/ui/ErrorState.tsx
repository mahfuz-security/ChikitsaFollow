import { AlertTriangle } from "lucide-react";

// Compact error ribbon — glass surface with a coral left border so it
// reads as "needs attention" without competing with the page chrome.
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={20} aria-hidden />
      <span>{message}</span>
      {onRetry ? (
        <button type="button" className="link-button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
