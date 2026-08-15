import { describe, expect, it } from "vitest";
import { formatSum } from "../src/utils.js";

describe("utils", () => {
  it("formats sum", () => {
    expect(formatSum(2, 3)).toBe("Sum: 5");
  });
});
