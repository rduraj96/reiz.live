"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { attachAuth, useAuth } from "@/store/auth";
import { Takeover, stagger, staggerClass } from "./Takeover";

const field =
  "w-full min-h-14 border-b border-[hsl(0_0%_15%)] bg-transparent text-[clamp(22px,4vw,32px)] font-light tracking-[-0.02em] " +
  "text-foreground placeholder:text-[hsl(0_0%_29%)] outline-none focus-visible:outline-none focus:border-accent";

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
      <form onSubmit={submit} className={`flex max-w-[420px] flex-col gap-4 ${staggerClass}`} style={stagger(1)}>
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
        <button type="submit" disabled={busy} className="mt-3 min-h-13 rounded-full bg-accent-strong text-sm font-bold uppercase tracking-[0.08em] text-foreground transition-opacity disabled:opacity-60">
          {busy ? "Processing..." : isSignUp ? "Sign up" : "Sign in"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-4 max-w-[420px] text-base text-muted">
          {error}
        </p>
      )}
      <p className={`mt-4 text-base text-muted ${staggerClass}`} style={stagger(2)}>
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
  const available = getSupabase() !== null;

  useEffect(() => attachAuth(getSupabase()), []);

  return (
    <Takeover
      open={open}
      onOpenChange={(o) => !o && closeLogin()}
      title={user ? "Signed in" : "Log in"}
      description={
        <p className={`mb-6 text-base text-muted ${staggerClass}`} style={stagger(0)}>
          Saved stations follow your account.
        </p>
      }
    >
      {available ? <LoginForm /> : <p className="text-base text-muted">Login is unavailable right now</p>}
    </Takeover>
  );
}
