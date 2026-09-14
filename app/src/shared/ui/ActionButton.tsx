import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive" | "icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: Variant;
};

// Maps the public variant union to the class names defined in styles.css
// (`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-destructive`,
// `.icon-button`). The `btn-base` class adds the shared height/padding/
// radius rules; variants override color + border only.
const variantClass: Record<Variant, string> = {
  primary: "btn-base btn-primary",
  secondary: "btn-base btn-secondary",
  ghost: "btn-base btn-ghost",
  destructive: "btn-base btn-destructive",
  icon: "icon-button"
};

export function ActionButton({ children, icon, variant = "primary", ...props }: Props) {
  return (
    <button className={variantClass[variant]} {...props}>
      {icon}
      {children}
    </button>
  );
}
