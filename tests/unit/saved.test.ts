import { describe, expect, it } from "vitest";
import { listSaved, saveStation, unsaveStation } from "@/lib/library/saved";
import { fakeSb, st } from "../helpers/fake-supabase";

describe("saved", () => {
  it("listSaved maps rows to stations, newest first", async () => {
    const { sb, calls } = fakeSb({ data: [{ station: st("b") }, { station: st("a") }], error: null });
    expect((await listSaved(sb)).map((s) => s.id)).toEqual(["b", "a"]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
  });

  it("saveStation upserts the row", async () => {
    const { sb, calls } = fakeSb();
    await saveStation(sb, "u1", st("a"));
    expect(calls).toContainEqual(["upsert", { user_id: "u1", station_id: "a", station: st("a") }, { onConflict: "user_id,station_id", ignoreDuplicates: true }]);
  });

  it("unsaveStation deletes by user and station", async () => {
    const { sb, calls } = fakeSb();
    await unsaveStation(sb, "u1", "a");
    expect(calls).toContainEqual(["delete"]);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls).toContainEqual(["eq", "station_id", "a"]);
  });

  it("throws on error", async () => {
    const { sb } = fakeSb({ data: null, error: { message: "nope" } });
    await expect(saveStation(sb, "u1", st("a"))).rejects.toEqual({ message: "nope" });
  });
});
