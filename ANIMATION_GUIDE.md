# KavShare Animation & Motion System Guide

This system provides smooth, performant Framer Motion transitions and scroll reveal utilities that give the platform a premium feel.

All animation configurations and hooks are defined in [`src/lib/animations.ts`](file:///c:/Users/admin/Desktop/K.Vol2/kavshare/src/lib/animations.ts).

---

## 1. Available Animation Configurations

| Variant Name | Target Elements | Visual Behavior |
| :--- | :--- | :--- |
| `pageTransitionVariants` | Pages, top-level routes | Smooth slide-up fade-in on page load. |
| `fadeInVariants` | Content blocks, lists | Fades in opacity based on custom delay properties. |
| `slideUpVariants` | Cards, list elements | Slides upward while fading in. |
| `scaleInVariants` | Modals, dialogue alerts | Scales from `0.95` to `1` with a fade-in. |
| `staggerContainerVariants` | Grid, flex containers | Coordinates staggered visual entry delays for children. |
| `scrollRevealVariants` | Scrollable articles | Reveals content block once user scrolls past target thresholds. |

---

## 2. Performance Optimization Rules

Animating in browser windows can trigger layout reflows if not structured correctly. Follow these best practices to maintain a smooth 60fps render:

1. **Only Animate GPU-Accelerated CSS Properties**:
   - Limit animation properties to `transform` (e.g., `x`, `y`, `scale`, `rotate`) and `opacity`.
   - **Never animate layout parameters** like `width`, `height`, `margin`, `padding`, or `top`/`left` coordinates, as they trigger expensive CPU recalculations.
2. **Utilize `will-change` CSS Rule**:
   - For complex, repeating layout transitions, specify `will-change: transform, opacity` to notify browser graphics engines.
3. **Use the `layout` Attribute Wisely**:
   - Framer Motion's `layout` prop automatically handles layout transitions, but it can be computationally heavy. Avoid wrapping massive lists in layout-animated blocks.

---

## 3. Code Examples

### A. Route/Page Transitions
Place this wrapper around top-level sections in your page routes:
```tsx
"use client";

import { motion } from "framer-motion";
import { pageTransitionVariants } from "@/lib/animations";

export default function MarketplacePage() {
  return (
    <motion.main
      variants={pageTransitionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="flex-1 p-6"
    >
      <h1>Marketplace</h1>
    </motion.main>
  );
}
```

### B. Staggered Grid Listings
Stagger card entries inside list containers:
```tsx
"use client";

import { motion } from "framer-motion";
import { staggerContainerVariants, slideUpVariants } from "@/lib/animations";

export function ProviderGrid({ items }: { items: any[] }) {
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
      className="grid grid-cols-3 gap-6"
    >
      {items.map((item, idx) => (
        <motion.div
          key={item.id}
          variants={slideUpVariants}
          custom={idx * 0.05} // pass custom index offset delay
        >
          <Card data={item} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

### C. Scroll Reveal Entrance
Automatically reveal content cards as the user scrolls them into viewport bounds:
```tsx
"use client";

import { motion } from "framer-motion";
import { scrollRevealVariants, useScrollAnimation } from "@/lib/animations";

export function LandingPromoSection() {
  const { ref, controls } = useScrollAnimation(0.15); // reveals at 15% visibility

  return (
    <motion.section
      ref={ref}
      variants={scrollRevealVariants}
      initial="hidden"
      animate={controls}
      className="p-12 bg-slate-900 border border-slate-800 rounded-2xl"
    >
      <h2>Enterprise Matching</h2>
    </motion.section>
  );
}
```
