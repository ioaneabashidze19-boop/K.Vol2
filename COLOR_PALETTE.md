# KavShare Brand Color System & Palette Guide

This guide documents the sophisticated color values, hex/rgb ratios, semantic use cases, and accessibility standards for the KavShare platform.

---

## 1. Color Palette Matrix

### Primary / Accent Colors (Teal-Forward Tech System)
| Variable / Token | Tailwind Class | Hex Code | RGB Ratio | Description / Usage |
| :--- | :--- | :--- | :--- | :--- |
| `brand-accent` | `bg-brand-accent` | `#06b6d4` | `rgb(6, 182, 212)` | Primary interactive accent, verified badges, active states |
| `brand-accent-hover` | `bg-brand-accent-hover` | `#0891b2` | `rgb(8, 145, 178)` | Hover states for primary buttons and active link indicators |
| `brand-accent-light` | `bg-brand-accent-light` | `#22d3ee` | `rgb(34, 211, 238)` | Light cyan tint for borders, tags, and low-opacity fills |

### Semantic Colors
| Variable / Token | Tailwind Class | Hex Code | RGB Ratio | Description / Usage |
| :--- | :--- | :--- | :--- | :--- |
| `brand-success` | `text-brand-success` | `#10b981` | `rgb(16, 185, 129)` | Confirmed payments, active postings, positive rating values |
| `brand-warning` | `text-brand-warning` | `#f59e0b` | `rgb(245, 158, 11)` | Pending review flags, warning alerts, low-rated reviews |
| `brand-error` | `text-brand-error` | `#ef4444` | `rgb(239, 68, 68)` | Cancellation penalties, form validation errors, dangerous actions |
| `brand-info` | `text-brand-info` | `#3b82f6` | `rgb(59, 130, 246)` | System instructions, telemetry metrics, helpful tooltips |

### Neutrals (Dark Mode Ecosystem)
| Variable / Token | Tailwind Class | Hex Code | RGB Ratio | Description / Usage |
| :--- | :--- | :--- | :--- | :--- |
| `neutral-bg` | `bg-neutral-bg` | `#020617` | `rgb(2, 6, 23)` | Root viewport body background (Slate 950) |
| `neutral-surface` | `bg-neutral-surface` | `#0b1329` | `rgb(11, 19, 41)` | Secondary containers, cards, and modal bodies (Slate 900 glass) |
| `neutral-border` | `border-neutral-border` | `#1e293b` | `rgb(30, 41, 59)` | Separator lines, inputs, table borders (Slate 800) |
| `neutral-text` | `text-neutral-text` | `#f8fafc` | `rgb(248, 250, 252)` | Primary high-contrast typography content (Slate 50) |
| `neutral-text-secondary`| `text-neutral-text-secondary`| `#94a3b8` | `rgb(148, 163, 184)`| Secondary descriptions, labels, user roles (Slate 400) |
| `neutral-text-muted` | `text-neutral-text-muted` | `#64748b` | `rgb(100, 116, 139)`| Placeholders, metadata, small timestamps (Slate 500) |

---

## 2. Accessibility Notes (WCAG AA & AAA Standards)

To guarantee that KavShare is fully accessible to all users, keep in mind the following requirements:

1. **Text Contrast (Slate 50 on Slate 950)**:
   - Primary text (`#f8fafc` on `#020617`) has a contrast ratio of **18.7:1**, easily exceeding the WCAG AAA requirement (7:1) for small text.
2. **Interactive Elements (Cyan `#06b6d4` on Slate 950)**:
   - Cyan text on dark backgrounds has a contrast ratio of **6.2:1**, exceeding the WCAG AA requirement (4.5:1) for standard text.
   - For smaller labels on cyan buttons, use deep background text (`#020617`) rather than light text to maximize readability (**6.2:1** ratio).
3. **Form Error Mappings (`#ef4444` on Slate 950)**:
   - Red error warnings have a contrast ratio of **4.6:1**, satisfying the WCAG AA standard (4.5:1). Make sure warning messages use bold text weights to assist legibility.
4. **Non-Color Indicators**:
   - Never rely *solely* on color to convey meaning. Always pair semantic colors with icon labels or readable text descriptions (e.g. including an asterisk `*` for error states, adding `(Active)` or `(Warning)` to status badges).
