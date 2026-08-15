import { add } from "./math.js";

export function formatSum(a: number, b: number): string {
  return `Sum: ${add(a, b)}`;
}
