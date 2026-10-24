import { describe, expect, it } from "vitest";
import { genres, languages } from "@/lib/catalog";

describe("catalog", () => {
  it("exposes genres and languages", () => {
    expect(genres.length).toBeGreaterThan(0);
    expect(languages.some((l) => l.value === "english")).toBe(true);
  });
});
