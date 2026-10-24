import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { create } from "zustand";
import { useToast } from "@/store/toast";
import { listSaved, saveStation, unsaveStation } from "@/lib/library/saved";
import type { Station } from "@/lib/radio/types";

type AuthState = {
  user: User | null;
  saved: Station[];
  pendingSave: Station | null;
  loginOpen: boolean;
};

type AuthActions = {
  openLogin: (pending?: Station) => void;
  closeLogin: () => void;
  toggleSaved: (s: Station) => Promise<void>;
  isSaved: (id: string) => boolean;
};

let sb: SupabaseClient | null = null;

// Supabase returns plain `{ message }` error objects, not Error instances.
const message = (e: unknown) =>
  typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong";

export const useAuth = create<AuthState & AuthActions>()((set, get) => ({
  user: null,
  saved: [],
  pendingSave: null,
  loginOpen: false,

  openLogin: (pending) => set({ loginOpen: true, pendingSave: pending ?? null }),
  closeLogin: () => set({ loginOpen: false, pendingSave: null }),
  isSaved: (id) => get().saved.some((s) => s.id === id),

  toggleSaved: async (s) => {
    const { user, saved } = get();
    if (!user || !sb) {
      get().openLogin(s);
      return;
    }
    const wasSaved = saved.some((x) => x.id === s.id);
    set({ saved: wasSaved ? saved.filter((x) => x.id !== s.id) : [s, ...saved] });
    try {
      if (wasSaved) await unsaveStation(sb, user.id, s.id);
      else await saveStation(sb, user.id, s);
    } catch (e) {
      // Roll back only this station so concurrent toggles are not clobbered.
      const rest = get().saved.filter((x) => x.id !== s.id);
      set({ saved: wasSaved ? [s, ...rest] : rest });
      useToast.getState().show(`Could not ${wasSaved ? "remove" : "save"} station: ${message(e)}`);
    }
  },
}));

/** Signs out; any failure (no client, `{ error }`, rejection) is surfaced via a toast. */
export async function signOut(): Promise<void> {
  const fail = () => useToast.getState().show("Couldn't log out — try again");
  if (!sb) return fail();
  try {
    const { error } = await sb.auth.signOut();
    if (error) fail();
  } catch {
    fail();
  }
}

let queue: Promise<void> = Promise.resolve();

/** Reacts to a Supabase auth event; events are processed one at a time. Exported for tests. */
export function handleAuthEvent(event: string, session: Session | null): Promise<void> {
  queue = queue.then(() => processAuthEvent(event, session));
  return queue;
}

async function processAuthEvent(event: string, session: Session | null): Promise<void> {
  if (event === "SIGNED_OUT") {
    useAuth.setState({ user: null, saved: [], pendingSave: null });
    return;
  }
  if ((event !== "SIGNED_IN" && event !== "INITIAL_SESSION") || !session || !sb) return;
  // Read before awaiting: the user may dismiss the dialog meanwhile, which is fine.
  // Clear it in the same synchronous step so a re-emitted event cannot save it twice.
  const pending = useAuth.getState().pendingSave;
  useAuth.setState({ user: session.user, pendingSave: null, ...(event === "SIGNED_IN" ? { loginOpen: false } : {}) });
  try {
    useAuth.setState({ saved: await listSaved(sb) });
  } catch (e) {
    useToast.getState().show(`Could not load saved stations: ${message(e)}`);
  }
  if (!pending) return;
  const { isSaved, toggleSaved } = useAuth.getState();
  if (!isSaved(pending.id)) await toggleSaved(pending);
}

/** Subscribes the store to auth changes. Returns an unsubscribe function. */
export function attachAuth(client: SupabaseClient | null): () => void {
  sb = client;
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((event, session) => {
    // Do not await Supabase calls inside this callback (deadlock risk).
    void handleAuthEvent(event, session);
  });
  return () => {
    data.subscription.unsubscribe();
    if (sb === client) sb = null;
  };
}

// E2E-only hook (set at build time by playwright.config.ts) so specs can mock a logged-in user.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_E2E === "1") {
  (window as unknown as { __useAuth?: typeof useAuth }).__useAuth = useAuth;
}
