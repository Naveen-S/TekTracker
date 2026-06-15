import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names with clsx and resolve Tailwind conflicts with tailwind-merge.
 * @param {...import("clsx").ClassValue} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
