import type { InputHTMLAttributes, ReactNode } from "react";

// Standard text input. Min-height 48px meets the front-desk touch
// target rule (§9). Focus state is the spec accent ring: 1px border
// switch to teal + 3px outer halo via box-shadow. Label sits above
// in --text-body-sm / 600 per §5.2's icon-label alignment.
export function FormField({ children, hint, label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children ?? <input {...props} />}
      {hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}
