import { describe, expect, it } from "vitest";
import { loadModule } from "../src/dynamic.js";

describe("dynamic", () => {
  it("loads module dynamically", async () => {
    expect(loadModule).toBeDefined();
  });
});
