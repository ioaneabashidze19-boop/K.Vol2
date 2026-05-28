# KavShare Tailwind CSS Typography System Guide

This document outlines the typographic scales, letter spacing settings, and semantic color rules defined in our Tailwind CSS v4 design system.

---

## 1. Typographic Scales & Properties

All sizes and proportions are optimized for readability across mobile, tablet, and desktop viewports.

### Font Size Scale
| Utility Class | Size (Rem) | Size (Px) | Intended Use Case |
| :--- | :--- | :--- | :--- |
| `text-xs` | `0.75rem` | `12px` | Captions, metadata, array tags, small helper labels |
| `text-sm` | `0.875rem` | `14px` | Standard body descriptions, table headers, form inputs |
| `text-base` | `1rem` | `16px` | Core body content, message inputs, paragraph texts |
| `text-lg` | `1.125rem` | `18px` | Sub-section headers, navigation links, alert titles |
| `text-xl` | `1.25rem` | `20px` | Mid-sized card titles, primary dialog headers |
| `text-2xl` | `1.5rem` | `24px` | Main page titles, modal titles, dashboard headings |
| `text-3xl` | `1.875rem` | `30px` | Big landing page hero features |
| `text-4xl` | `2.25rem` | `36px` | Massive marketing header titles |

### Font Weight Scale
- `font-light` (300): Subtle descriptions or sub-headings.
- `font-normal` (400): Standard body copy text.
- `font-medium` (500): Focus fields, key navigation links.
- `font-semibold` (600): Form labels, card sub-headers.
- `font-bold` (700): Core headings, button labels.

### Line Height Scale
- `leading-none` (1): Display headlines.
- `leading-tight` (1.25): Card headings and page title subtitles.
- `leading-normal` (1.5): Standard paragraph text blocks.
- `leading-relaxed` (1.625): Multi-line descriptive logs or audit log detail bodies.

### Letter Spacing Scale
- `tracking-tighter` (-0.05em): High-impact landing headers.
- `tracking-tight` (-0.025em): Card titles, display font headers.
- `tracking-normal` (0em): Standard body text.
- `tracking-wider` (0.05em): Upper-case category headers.

---

## 2. Semantic Color System

Rather than using generic colors directly, developers must use the following semantic styling system:

| Color Variable | CSS Class | Output Hex Color | Meaning / Intent |
| :--- | :--- | :--- | :--- |
| `--color-text-primary` | `text-text-primary` | `#f8fafc` | Primary text copy color |
| `--color-text-secondary` | `text-text-secondary` | `#94a3b8` | Secondary sub-titles and cards text |
| `--color-text-muted` | `text-text-muted` | `#64748b` | Disabled labels, placeholder tags |
| `--color-text-accent` | `text-text-accent` | `#10b981` | Highlights, badges, verified tags |
| `--color-text-error` | `text-text-error` | `#ef4444` | Danger states, failed logs, cancellation penalty alerts |
| `--color-text-warning` | `text-text-warning` | `#f59e0b` | Cautionary warnings, pending status codes |
| `--color-text-success` | `text-text-success` | `#10b981` | Positive outcomes, completed checks, successful alerts |

---

## 3. Usage Examples

### Example A: Tech-Forward Display Header (Space Mono)
```tsx
import React from "react";

export function SectionTitle() {
  return (
    <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary">
      PROCURMENT OFFERINGS
    </h2>
  );
}
```

### Example B: Technical Monospaced Detail Card (JetBrains Mono)
```tsx
import React from "react";

export function CodeMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <p className="font-technical text-lg font-medium text-text-accent mt-2">
        {value}
      </p>
    </div>
  );
}
```

### Example C: Standard Clean Input Form (Inter)
```tsx
import React from "react";

export function TextInput({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-text-secondary">
        {label}
      </label>
      <input
        type="text"
        placeholder={placeholder}
        className="bg-slate-950 border border-slate-800 rounded px-4 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-text-accent focus:outline-none transition-colors"
      />
    </div>
  );
}
```
