import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to dynamically merge Tailwind CSS class names without styling conflicts.
 * Combines 'clsx' and 'tailwind-merge' utility functions.
 *
 * @param inputs - Array of class values, objects, or arrays to merge.
 * @returns Staged and merged class name string.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
