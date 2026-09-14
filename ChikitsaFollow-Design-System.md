# Design System — ChikitsaFollow

### Clinic / Hospital Service Recovery Software — Visual & Interaction Design Spec

**Version:** 1.0
**Companion to:** ChikitsaFollow-AI-Agent-SRS.md, ChikitsaFollow-AI-Agent-Spec.md

---

## 1. Design Principles

This is clinical-adjacent software used at a public counter by a stressed front-desk worker, reviewed by a branch manager between patients, and studied by a quality lead looking for patterns. The design has to earn trust at a glance and disappear into the task — nobody should ever be thinking about the interface.

Four principles govern every decision in this document:

1. **Calm before clever.** Healthcare-adjacent tools should feel steady, not flashy. Glass surfaces are used to create *depth and focus*, not decoration — every blurred panel exists to separate "what needs action now" from "what's background context."
2. **One glance, one meaning.** A user should be able to tell a case's status, severity, and owner without reading a sentence. Color, icon, and label always agree — never color alone.
3. **Everything lines up.** Text baselines, icon centers, card edges, and menu items sit on one shared grid. Misalignment reads as untrustworthy in a tool that's supposed to be the source of truth for disputes.
4. **The root-level user is the design's center of gravity.** Every screen is judged first by whether a first-time front-desk user, mid-shift, under pressure, can complete it without thinking. Manager and quality-lead views can carry more density — front desk never does.

---

## 2. Visual Identity Direction

Avoiding the generic AI-design defaults (warm cream + terracotta, near-black + acid accent, identical rounded SaaS cards, ALL-CAPS eyebrows, arrow-suffixed buttons) — this system instead draws from **clinical glass**: the look of frosted lab-glass partitions and soft daylight through a clinic window. Cool, clean, quietly confident. Not sterile-cold, not corporate-navy.

### Color — Core Palette (named, 6 hex values)

| Name | Hex | Role |
|---|---|---|
| **Mist** | `#EAF2F1` | Light-mode base background (very light teal-grey, not pure white or cream) |
| **Deep Slate** | `#12232B` | Dark-mode base background (deep blue-slate, not near-black) |
| **Clinic Teal** | `#1E7F79` | Primary accent — action, brand, focus states |
| **Warm Coral** | `#E8735C` | Attention accent — alerts, severity, destructive actions (used sparingly) |
| **Glass White** | `#FFFFFF` @ low opacity | Glass surface tint in light mode |
| **Glass Ink** | `#0C1A1F` @ low opacity | Glass surface tint in dark mode |

Clinic Teal was chosen deliberately over blue (too generic-corporate) or green (too "eco/finance"): teal reads as clinical *and* calm without being a cliché medical blue. Warm Coral is used exclusively for things that need attention — never as a general accent — so its appearance always means something.

### Typography

| Role | Typeface | Notes |
|---|---|---|
| **Display / Headings** | **Fraunces** (serif, moderate optical size) | Used only for page titles and empty-state headlines — gives the "lucrative," premium feel without losing legibility. Never for body or UI chrome. |
| **UI / Body / Data** | **Inter** | All labels, form fields, table data, buttons, nav. Chosen for its tall x-height and clarity at small sizes — critical for a front-desk tablet in a bright waiting room. |

Type scale (rem, 16px base):

| Token | Size | Weight | Use |
|---|---|---|---|
| `display-lg` | 2.5rem | 600 | Page-level headline (rare — mostly empty states) |
| `heading-lg` | 1.5rem | 600 | Section headers ("Open Cases", "Branch Performance") |
| `heading-sm` | 1.125rem | 600 | Card titles |
| `body` | 1rem | 400 | Default text, form labels, table cells |
| `body-sm` | 0.875rem | 400 | Secondary metadata, timestamps |
| `caption` | 0.75rem | 500 | Status chips, badges |

Line length capped at ~72 characters for any paragraph text (case summaries, AI-drafted replies). No ALL-CAPS labels anywhere; no single-word accent italics.

---

## 3. The Glass System

Glassmorphism is used **structurally**, not decoratively: a glass surface always means "this is a focused layer above the page" — a card, a modal, a side panel, an active nav item. Flat (non-glass) surfaces mean "this is the page itself."

### 3.1 Glass Surface Tokens

```css
/* Light mode */
--glass-bg: rgba(255, 255, 255, 0.55);
--glass-border: rgba(255, 255, 255, 0.35);
--glass-blur: 16px;
--glass-shadow: 0 8px 32px rgba(18, 35, 43, 0.08);

/* Dark mode */
--glass-bg-dark: rgba(18, 35, 43, 0.55);
--glass-border-dark: rgba(255, 255, 255, 0.08);
--glass-blur-dark: 16px;
--glass-shadow-dark: 0 8px 32px rgba(0, 0, 0, 0.35);
```

Base CSS pattern for any glass surface:

```css
.glass-surface {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md); /* see 5.3 */
  box-shadow: var(--glass-shadow);
}
```

### 3.2 Glass Elevation Levels

Not every glass surface looks the same — depth is meaningful, not uniform (avoiding the "identical card kit" default):

| Level | Blur | Opacity | Used for |
|---|---|---|---|
| **Level 0 — Page** | none | solid | Page background (Mist / Deep Slate) |
| **Level 1 — Panel** | 12px | 0.45 | Dashboard section containers, sidebars |
| **Level 2 — Card** | 16px | 0.55 | Case cards, stat cards, list items |
| **Level 3 — Overlay** | 24px | 0.7 | Modals, the AI-draft review panel, dropdowns |

Higher elevation = more blur + more opacity, so the eye reads "closer to the user."

### 3.3 Accessibility Guardrail for Glass

Glass surfaces are notorious for failing contrast. This system enforces one hard rule: **text on a glass surface is never rendered directly on the blur — it always sits on a solid-enough text-safe zone.**

```css
--text-on-glass: #0C1A1F;       /* light mode text — solid, not glass-tinted */
--text-on-glass-dark: #EAF2F1;  /* dark mode text */
```

All body text on glass surfaces must pass a 4.5:1 contrast check against the *rendered* composite (glass tint over whatever is behind it), verified with a fixed dark scrim layer beneath text-heavy glass regions if the background photo/gradient behind it is busy. Status colors (severity, success/error) are never used as text-on-glass alone — always paired with an icon.

---

## 4. Light & Dark Mode Token Table

Full semantic token set. Every component references these tokens, never raw hex values, so theme-switching is a single variable swap.

```css
:root {
  /* Base */
  --bg-page: #EAF2F1;
  --bg-surface: var(--glass-bg);
  --text-primary: #0C1A1F;
  --text-secondary: #4A5D63;
  --text-muted: #7C8E93;
  --border-hairline: rgba(12, 26, 31, 0.08);

  /* Brand / Action */
  --accent-primary: #1E7F79;
  --accent-primary-hover: #176560;
  --accent-primary-contrast: #FFFFFF;

  /* Semantic status */
  --status-open: #E8735C;        /* Warm Coral — needs attention */
  --status-in-progress: #C98A2C; /* amber */
  --status-resolved: #1E7F79;    /* Clinic Teal — done, verified */
  --status-info: #3E7CB1;

  /* Radius & spacing — see Section 5 */
}

[data-theme="dark"] {
  --bg-page: #12232B;
  --bg-surface: var(--glass-bg-dark);
  --text-primary: #EAF2F1;
  --text-secondary: #A9BEC3;
  --text-muted: #6E8489;
  --border-hairline: rgba(234, 242, 241, 0.08);

  --accent-primary: #35A69E;
  --accent-primary-hover: #4BC2B9;
  --accent-primary-contrast: #0C1A1F;

  --status-open: #F08B76;
  --status-in-progress: #E0A94D;
  --status-resolved: #35A69E;
  --status-info: #6FA8D6;
}
```

**Mode-switch rule:** the background never simply inverts brightness — Deep Slate is a distinct color, not "Mist at 10% lightness," so dark mode still feels like the same clinic, at night, not a different app.

---

## 5. Layout, Grid & Alignment

This is the section that guarantees "everything must align."

### 5.1 Base Grid
- **8px base unit.** All spacing, padding, and gaps are multiples of 8 (4px permitted only for icon-to-label micro-gaps).
- **12-column grid** on desktop (≥1024px), max content width **1280px**, centered.
- **4-column grid** on mobile/tablet (front-desk devices), full-bleed with 16px side margins.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 16px;
--space-4: 24px;
--space-5: 32px;
--space-6: 48px;
--space-7: 64px;
```

### 5.2 Alignment Rules
- **Left-align by default.** All body text, form labels, table columns (except numeric columns, which right-align for scanability), and nav items are left-aligned — center-alignment is reserved only for empty states and single-focus modals (e.g., login).
- **Shared baseline grid:** every text element's line-height is a multiple of 4px so that adjacent columns/cards align on the same horizontal rhythm even when font sizes differ.
- **Icon-label pairs** always use `--space-2` (8px) gap, vertically centered on the label's cap-height, never the full line-height — misaligned icons are one of the fastest ways a UI reads as sloppy.
- **Card internal padding** is uniform: `--space-4` (24px) on all four sides, no exceptions, across every card type (case card, stat card, approval card).
- **Table cells:** vertical padding `--space-3` (16px), horizontal `--space-3` (16px), text vertically centered, first column always left-padded to match the page's left content edge — never indented differently per row.

### 5.3 Radius Scale

```css
--radius-sm: 8px;   /* chips, badges, small buttons */
--radius-md: 16px;  /* cards, inputs */
--radius-lg: 24px;  /* modals, large panels */
```

One radius per surface *type*, applied consistently — not the generic "same radius on literally everything" pattern, but a deliberate 3-step scale tied to hierarchy (bigger surface → bigger radius).

### 5.4 ASCII Wireframe — Core App Shell

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]   Cases   Approvals   Trends        🔍  🌙  👤    │  ← Level 1 glass topbar
├───────────┬──────────────────────────────────────────────┤
│           │  Open Cases                    [+ New Case]  │
│  Sidebar  │  ┌────────────────────────────────────────┐  │
│  (Level 1 │  │ ● Dhanmondi · Report Delay · 2h ago     │  │ ← Level 2 glass cards
│   glass,  │  │   "Promised 2pm, still waiting at 5pm"  │  │
│  role nav)│  └────────────────────────────────────────┘  │
│           │  ┌────────────────────────────────────────┐  │
│  Cases    │  │ ● Uttara · Billing · 1d ago              │  │
│  Trends   │  └────────────────────────────────────────┘  │
│  Team     │                                              │
└───────────┴──────────────────────────────────────────────┘
```

Sidebar and topbar are Level 1 glass; content cards are Level 2; any modal (AI draft review, approval decision) is Level 3, centered, with the background dimmed by a solid scrim (not more blur) so focus is unambiguous.

---

## 6. Components

### 6.1 Buttons

| Variant | Surface | Use |
|---|---|---|
| **Primary** | Solid `--accent-primary`, white text | One per screen/section — the main action ("Send Reply", "Save Case") |
| **Secondary** | Glass Level 2, teal border, teal text | Supporting actions ("Cancel", "View Details") |
| **Destructive** | Solid `--status-open` (coral) | Rare — reject/deny actions only |
| **Ghost** | No border, no fill, teal text | Tertiary/inline actions |

- Height: 48px on front-desk/touch surfaces, 40px on manager/desktop-dense surfaces.
- Label = the action in active voice: **"Send reply"**, not "Submit". No trailing arrows.
- Border radius: `--radius-sm`.

### 6.2 Status Chips (color + icon + label, always all three)

```
🔴 Open           (Warm Coral bg tint, coral text+dot)
🟡 In Progress    (Amber bg tint)
🟢 Resolved       (Clinic Teal bg tint)
```
Chips use `--radius-sm`, `caption` type, `--space-1`–`--space-2` padding, and always pair color with a distinct icon shape (circle/triangle/check) — never color-only, per the accessibility rule in Section 3.3 and SRS UX-10.

### 6.3 Case Card (Level 2 glass)

```
┌──────────────────────────────────────────┐
│ 🔴 Open              Dhanmondi · 2h ago   │
│                                            │
│ Report Delay                              │
│ "CBC + HbA1c promised 2pm, not ready 5pm" │
│                                            │
│ Rumana (Front Desk)          [View →]     │
└──────────────────────────────────────────┘
```
Fixed internal padding `--space-4`, status chip top-left, timestamp/branch top-right (right-aligned, `body-sm`, `--text-muted`), title in `heading-sm`, summary truncated to 2 lines, footer row with actor left / action right.

### 6.4 Front-Desk Case Entry Form (root-level user — see Section 7)

Large tap-target chip groups instead of dropdowns for Category and Severity, per SRS UX-1/UX-3:

```
Category
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Delay    │ │ Billing  │ │ Behaviour│  ← 56px min-height chips, radius-sm,
└──────────┘ └──────────┘ └──────────┘     selected state = solid teal fill
```

### 6.5 Data Tables (Manager / Quality Lead views)

- Header row: `body-sm`, 600 weight, `--text-secondary`, bottom hairline border — never a filled header background (avoids visual heaviness at high density).
- Row hover: subtle glass lift (`--glass-bg` at Level 2 opacity), no color change to text.
- Numeric columns right-aligned; text columns left-aligned; status columns center the chip.
- Zebra striping is **not** used — hairline row dividers only, to keep the glass aesthetic light.

### 6.6 Modals / AI-Draft Review Panel (Level 3 glass)

- Centered, max-width 560px, `--radius-lg`.
- Background scrim: `rgba(12,26,31,0.4)` light mode / `rgba(0,0,0,0.6)` dark mode — solid dim, not blurred, so the modal is the unambiguous focus.
- AI-drafted content appears in an editable text area with a small **"AI draft"** label (caption, muted, icon — never hidden, per SRS NFR-8 auditability) so staff always know what's machine-suggested vs. their own edit.

### 6.7 Navigation

- Sidebar items: 48px height, icon + label pair (`--space-2` gap), left-aligned, active item gets a solid `--accent-primary` left-border (4px) + soft teal glass fill — not a full color inversion, keeping the glass language consistent even in the active state.
- Topbar: logo left, primary nav center-left, search + theme toggle + profile right — all vertically centered on the same 64px topbar height.

### 6.8 Light/Dark Mode Toggle
- A simple sun/moon icon toggle in the topbar, not a settings-buried option — theme switching should be one tap, since front-desk counters may face bright daylight (light mode) or evening shifts (dark mode).

---

## 7. Root-Level (Front-Desk) Screen Guidance

Directly implementing SRS Section 3.7 and 2.3 — this is the highest-priority surface in the whole system.

- **Home screen = one primary action:** a single, large "+ New Case" glass card/button, front and center. Everything else (recent cases, status lookup) is secondary and visually quieter.
- **3-tap rule (UX-9):** Home → Category chip → Severity chip → Submit. No intermediate screens, no required scrolling on a standard tablet viewport.
- **No jargon:** field labels are "What happened?", "How urgent?", "What did you promise them?" — plain language matching SRS's writing-content requirement (Section 2, "words as design content").
- **Persistent state indicator (UX-5):** every submitted case shows a plain-language state line under the chip — "Waiting for manager approval," "Sent to patient" — never a raw status code.
- **Large type, high contrast:** front-desk screens use `body` (16px) as the *minimum* text size anywhere, with `heading-sm` for card titles — no `caption`-sized interactive text on this surface, even though caption exists in the system for manager/quality-lead density.

---

## 8. Motion

One deliberate motion moment per interaction, not decoration on everything:

- **Case submission:** the "+ New Case" card briefly lifts and the new case card fades/slides into the top of the list — confirms the action landed, doesn't repeat elsewhere.
- **Modal open/close:** scale-fade (0.98 → 1, 150ms), respecting `prefers-reduced-motion` (skip to instant fade).
- **No hover animation on every card** — hover states are a subtle glass-opacity shift only (state change, not performance).
- **Status chip change (e.g., Open → Resolved):** a single color-cross-fade, 200ms — the one place where "did something just change?" matters enough to animate.

---

## 9. Accessibility Checklist

- [ ] Text-on-glass contrast verified at ≥4.5:1 against rendered composite (Section 3.3), not just against the flat token.
- [ ] All status communication uses color **+ icon + text label** — never color alone (SRS UX-10).
- [ ] Visible keyboard focus ring on every interactive element: `2px solid var(--accent-primary)`, offset 2px, on both themes.
- [ ] `prefers-reduced-motion` respected — all transitions degrade to instant/opacity-only.
- [ ] Minimum touch target 44×44px on all front-desk/tablet surfaces (SRS UX-1).
- [ ] Dark mode is a true distinct palette, not an inverted filter — checked for legibility independently.
- [ ] Error states (Section 6.6-adjacent forms) use plain-language, corrective-action copy per SRS UX-6 — never a raw error code shown to front desk.

---

## 10. Do / Don't Summary

| Do | Don't |
|---|---|
| Use glass to mean "focused layer above the page" | Apply glass/blur to every element uniformly as decoration |
| Pair every status color with an icon and label | Rely on color alone for meaning |
| Keep front-desk screens to one primary action | Add secondary/tertiary options to the root-level home screen |
| Use the 8px grid for all spacing | Eyeball spacing per component |
| Use Fraunces only for rare display headlines | Use the display serif for body or UI chrome |
| Let dark mode be its own considered palette | Simply invert or dim the light-mode colors |
| One motion moment per interaction | Animate every hover/card/section entrance |
