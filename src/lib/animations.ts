import { useEffect, useRef } from "react";
import { useAnimation, useInView } from "framer-motion";
import type { Variants } from "framer-motion";

/**
 * 1. Standard Page Transition Animation
 */
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: {
      duration: 0.25,
      ease: "easeIn",
    },
  },
};

/**
 * 2. Fade In Animation
 */
export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: (delay = 0) => ({
    opacity: 1,
    transition: {
      duration: 0.3,
      delay,
      ease: "easeOut",
    },
  }),
};

/**
 * 3. Slide Up Animation
 */
export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      delay,
      ease: "easeOut",
    },
  }),
};

/**
 * 4. Scale In Animation
 */
export const scaleInVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: (delay = 0) => ({
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      delay,
      ease: "easeOut",
    },
  }),
};

/**
 * 5. Staggered Container Animation
 */
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

/**
 * 6. Scroll Reveal Transition Variants
 */
export const scrollRevealVariants: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

/**
 * 7. Scroll Animation Hook
 * Tracks intersection bounds to kick off animated entry states.
 * 
 * @param threshold Amount of target element visibility required (0 to 1)
 */
export function useScrollAnimation(threshold = 0.1) {
  const ref = useRef<any>(null);
  const isInView = useInView(ref, { once: true, amount: threshold });
  const controls = useAnimation();

  useEffect(() => {
    if (isInView) {
      controls.start("visible");
    }
  }, [isInView, controls]);

  return { ref, controls };
}
