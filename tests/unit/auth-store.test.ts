import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it } from "vitest";
import { useToast } from "@/store/toast";
import { attachAuth, handleAuthEvent, signOut, useAuth } from "@/store/auth";
import { fakeSb, st } from "../helpers/fake-supabase";

const user = { id: "u1" } as User;
const session = { user } as Session;

function setup(result?: Parameters<typeof fakeSb>[0]) {
  const f = fakeSb(result);
  const sb = { ...f.sb, auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
  attachAuth(sb as unknown as SupabaseClient);
  return f;
}

beforeEach(() => {
  attachAuth(null);
  useAuth.setState({ user: null, saved: [], pendingSave: null, loginOpen: false });
  useToast.setState({ message: null });
});

describe("auth store", () => {
  it("toggleSaved while logged out opens login with a pending save and calls nothing", async () => {
    const { calls } = setup();
    await useAuth.getState().toggleSaved(st("a"));
    expect(useAuth.getState().loginOpen).toBe(true);
    expect(useAuth.getState().pendingSave).toEqual(st("a"));
    expect(calls).toEqual([]);
  });

  it("SIGNED_IN loads saved, completes the pending save, then clears it", async () => {
    const { calls } = setup({ data: [{ station: st("x") }], error: null });
    useAuth.getState().openLogin(st("a"));
    await handleAuthEvent("SIGNED_IN", session);
    const s = useAuth.getState();
    expect(s.pendingSave).toBeNull();
    expect(s.loginOpen).toBe(false);
    expect(s.saved.map((x) => x.id)).toEqual(["a", "x"]);
    expect(calls).toContainEqual(["upsert", { user_id: "u1", station_id: "a", station: st("a") }, { onConflict: "user_id,station_id", ignoreDuplicates: true }]);
  });

  it("a re-emitted sign-in event saves the pending station only once", async () => {
    // Like a real table: rows read after the upsert include the saved station.
    const result = {
      get data() {
        return calls.some((c) => c[0] === "upsert") ? [{ station: st("a") }] : [];
      },
      error: null,
    };
    const { calls } = setup(result);
    useAuth.getState().openLogin(st("a"));
    await Promise.all([handleAuthEvent("INITIAL_SESSION", session), handleAuthEvent("SIGNED_IN", session)]);
    expect(calls.filter((c) => c[0] === "upsert")).toHaveLength(1);
    expect(useAuth.getState().saved.map((x) => x.id)).toEqual(["a"]);
  });

  it("SIGNED_OUT clears saved", async () => {
    setup();
    useAuth.setState({ user, saved: [st("a")] });
    await handleAuthEvent("SIGNED_OUT", null);
    expect(useAuth.getState().saved).toEqual([]);
    expect(useAuth.getState().user).toBeNull();
  });

  it("toggleSaved on a saved station unsaves it", async () => {
    const { calls } = setup();
    useAuth.setState({ user, saved: [st("a")] });
    await useAuth.getState().toggleSaved(st("a"));
    expect(useAuth.getState().isSaved("a")).toBe(false);
    expect(calls).toContainEqual(["delete"]);
    expect(calls).toContainEqual(["eq", "station_id", "a"]);
  });

  it("a failed save rolls back and toasts the error", async () => {
    setup({ data: null, error: { message: "denied" } as never });
    useAuth.setState({ user, saved: [st("x")] });
    await useAuth.getState().toggleSaved(st("a"));
    expect(useAuth.getState().saved.map((s) => s.id)).toEqual(["x"]);
    expect(useToast.getState().message).toBe("Could not save station: denied");
  });

  it("a failed saved-list load on sign-in toasts the error", async () => {
    setup({ data: null, error: { message: "offline" } as never });
    await handleAuthEvent("SIGNED_IN", session);
    expect(useAuth.getState().user).toBe(user);
    expect(useToast.getState().message).toBe("Could not load saved stations: offline");
  });
});

describe("signOut", () => {
  const attach = (signOutFn: () => Promise<{ error: unknown }>) =>
    attachAuth({ auth: { signOut: signOutFn, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } as unknown as SupabaseClient);

  beforeEach(() => useToast.setState({ message: null }));

  it("shows no toast on success", async () => {
    attach(async () => ({ error: null }));
    await signOut();
    expect(useToast.getState().message).toBeNull();
  });

  it.each([
    ["an { error } result", () => Promise.resolve({ error: { message: "nope" } })],
    ["a rejection", () => Promise.reject(new Error("net"))],
  ])("toasts on %s", async (_n, fn) => {
    attach(fn);
    await signOut();
    expect(useToast.getState().message).toBe("Couldn't log out — try again");
  });

  it("toasts when there is no client", async () => {
    attachAuth(null);
    await signOut();
    expect(useToast.getState().message).toBe("Couldn't log out — try again");
  });
});
