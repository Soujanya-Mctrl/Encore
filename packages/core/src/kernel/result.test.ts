import { describe, expect, it } from "vitest";
import { err, ok } from "./result.js";

describe("Result kernel helper", () => {
  it("wraps success values", () => {
    const res = ok(42);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toBe(42);
  });

  it("wraps error values", () => {
    const res = err(new Error("boom"));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toBe("boom");
  });
});
