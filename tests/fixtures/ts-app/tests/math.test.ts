import { describe, expect, it } from "vitest";
import { add } from "../src/math.js";

describe("math", () => {
  it("adds numbers", () => {
    expect(add(1, 2)).toBe(3);
  });
});
