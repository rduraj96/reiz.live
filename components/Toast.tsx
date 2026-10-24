"use client";

import { useToast } from "@/store/toast";

export function Toast() {
  const message = useToast((s) => s.message);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4"
    >
      {message && <p className="border border-muted bg-background px-4 py-2 text-foreground">{message}</p>}
    </div>
  );
}
