import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFailureRecorder } from "@/lib/library/failureRecorder";

const record = vi.fn();
let online = true;
const rec = () => createFailureRecorder({ record, online: () => online });

beforeEach(() => {
  record.mockClear();
  online = true;
});

describe("which failures mark a station dead", () => {
  it("a station that never started playing", () => {
    const r = rec();
    r.loaded("a");
    r.failed("a");
    expect(record).toHaveBeenCalledWith("a");
  });

  it("not one that played and then dropped (the listener's connection, a stall)", () => {
    const r = rec();
    r.loaded("a");
    r.playing("a");
    r.failed("a");
    expect(record).not.toHaveBeenCalled();
  });

  it("not while the device is offline", () => {
    online = false;
    const r = rec();
    r.loaded("a");
    r.failed("a");
    expect(record).not.toHaveBeenCalled();
  });

  it("a new load of the same station starts over", () => {
    const r = rec();
    r.loaded("a");
    r.playing("a");
    r.loaded("b");
    r.loaded("a");
    r.failed("a");
    expect(record).toHaveBeenCalledWith("a");
  });
});
