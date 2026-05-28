/**
 * KavShare Core Design System Configuration
 * Provides theme constants, semantic mappings, and reusable utility class combinations.
 */

export const colors = {
  background: "#020617", // slate-950
  foreground: "#f8fafc", // slate-50
  card: "#0b1329",       // glass card base
  border: "#1e293b",     // slate-800

  primary: {
    base: "#10b981", // emerald-500
    foreground: "#020617",
    hover: "#059669", // emerald-600
  },
  secondary: {
    base: "#1e293b", // slate-800
    foreground: "#f8fafc",
    hover: "#334155", // slate-700
  },
  accent: {
    base: "#06b6d4", // cyan-500
    foreground: "#020617",
    hover: "#0891b2", // cyan-600
  },
  destructive: {
    base: "#ef4444", // red-500
    foreground: "#f8fafc",
    hover: "#dc2626", // red-600
  },
  muted: {
    base: "#0f172a",
    foreground: "#94a3b8",
  },
} as const;

export const radius = {
  sm: "calc(var(--radius) - 4px)", // 4px
  md: "calc(var(--radius) - 2px)", // 6px
  lg: "var(--radius)", // 8px default
  xl: "12px",
  "2xl": "16px",
} as const;

export const componentVariants = {
  // Glassmorphic panel classes
  glassCard:
    "bg-slate-900/50 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-lg transition-all hover:border-slate-700/80",
  // Emerald glowing status indicators
  glowGreen: "shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] border-emerald-500/30",
  // Cyan glowing status indicators
  glowBlue: "shadow-[0_0_15px_-3px_rgba(6,182,212,0.3)] border-cyan-500/30",
  // Button sizes
  buttonSize: {
    sm: "px-3 py-1.5 text-xs rounded-md",
    md: "px-4 py-2 text-sm rounded-lg",
    lg: "px-6 py-3 text-base rounded-xl",
  },
  // Form input standard styling
  inputField:
    "w-full bg-slate-950/70 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all",
} as const;

/**
 * Typescript representations of the design system components
 */
export type Colors = typeof colors;
export type Radius = typeof radius;
export type ComponentVariants = typeof componentVariants;
