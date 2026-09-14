import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "chikitsa:theme";
type Theme = "light" | "dark";

function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* localStorage may be blocked in private mode — fall through */
  }
  return "light";
}

export function ThemeToggle() {
  // Hydrate from the value set by the FOUC script in index.html so the
  // button reflects the persisted choice on first paint without a flash.
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore — toggle still updates the DOM */
    }
  }, [theme]);

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
