import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Spec-named palette (§2, §4)
        mist: "#EAF2F1",
        deepSlate: "#12232B",
        clinicTeal: "#1E7F79",
        clinicTealHover: "#176560",
        clinicTealLift: "#35A69E",
        warmCoral: "#E8735C",
        glassWhite: "rgba(255, 255, 255, 0.55)",
        glassInk: "rgba(12, 26, 31, 0.55)",

        // Legacy aliases — kept so the few pre-existing usages don't break.
        ink: "#0C1A1F",
        surface: "#EAF2F1",

        // Semantic text
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)"
        },

        // Status
        status: {
          open: "var(--status-open)",
          progress: "var(--status-in-progress)",
          resolved: "var(--status-resolved)",
          info: "var(--status-info)"
        }
      },
      spacing: {
        // 8px scale (§5.1)
        "space-1": "4px",
        "space-2": "8px",
        "space-3": "16px",
        "space-4": "24px",
        "space-5": "32px",
        "space-6": "48px",
        "space-7": "64px"
      },
      borderRadius: {
        sm: "8px",
        md: "16px",
        lg: "24px"
      },
      fontFamily: {
        display: ['"Fraunces"', "ui-serif", "Georgia", '"Times New Roman"', "serif"],
        ui: ['"Inter"', "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"]
      },
      fontSize: {
        "display-lg": ["2.5rem", { lineHeight: "1.2" }],
        "heading-lg": ["1.5rem", { lineHeight: "1.25" }],
        "heading-sm": ["1.125rem", { lineHeight: "1.3" }],
        body: ["1rem", { lineHeight: "1.5" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.75rem", { lineHeight: "1.4" }]
      },
      boxShadow: {
        "glass-sm": "0 4px 16px rgba(18, 35, 43, 0.08)",
        "glass-md": "0 8px 32px rgba(18, 35, 43, 0.08)",
        "glass-lg": "0 12px 40px rgba(18, 35, 43, 0.14)"
      },
      backdropBlur: {
        "glass-sm": "12px",
        "glass-md": "16px",
        "glass-lg": "24px"
      }
    }
  },
  plugins: []
} satisfies Config;
