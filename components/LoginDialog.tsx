"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { attachAuth, useAuth } from "@/store/auth";

const field =
  "w-full bg-transparent border border-muted px-3 h-11 text-foreground placeholder:text-muted focus:outline-none focus:border-accent";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setError(null);
    setBusy(true);
    try {
      if (isSignUp) {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        setError("Check your email for the confirmation link.");
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // The SIGNED_IN handler in the auth store closes the dialog and completes any pending save.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          aria-label="Email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={field}
        />
        <input
          type="password"
          aria-label="Password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={field}
        />
        <button type="submit" disabled={busy} className="h-11 bg-accent text-foreground disabled:opacity-60">
          {busy ? "Processing..." : isSignUp ? "Sign up" : "Sign in"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-center text-base text-muted">
          {error}
        </p>
      )}
      <p className="mt-4 text-center text-base text-muted">
        {isSignUp ? "Already have an account?" : "No account yet?"}
        <button
          type="button"
          onClick={() => setIsSignUp((v) => !v)}
          className="ml-2 min-h-11 text-foreground underline"
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </button>
      </p>
    </>
  );
}

export function LoginDialog() {
  const open = useAuth((s) => s.loginOpen);
  const closeLogin = useAuth((s) => s.closeLogin);
  const user = useAuth((s) => s.user);
  const error = useAuth((s) => s.error);
  const available = getSupabase() !== null;

  useEffect(() => attachAuth(getSupabase()), []);

  return (
    <>
      {error && (
        <p role="status" className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 bg-background px-4 py-2 text-base text-accent">
          {error}
        </p>
      )}
      <Dialog.Root open={open} onOpenChange={(o) => !o && closeLogin()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 border border-muted bg-background p-6 text-foreground">
            <Dialog.Title className="text-2xl font-light">{user ? "Signed in" : "Sign in to save"}</Dialog.Title>
            <Dialog.Description className="mb-4 text-base text-muted">
              Saved stations follow your account.
            </Dialog.Description>
            {available ? (
              <LoginForm />
            ) : (
              <p className="text-base text-muted">Login is unavailable right now</p>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
