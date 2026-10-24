import Link from "next/link";

export default function StationNotFound() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">Station not found</h1>
      <p className="text-muted">This link points to a station that is no longer available.</p>
      <Link
        href="/"
        className="min-h-11 px-4 inline-flex items-center rounded-lg border border-muted hover:border-foreground transition-colors"
      >
        Back to REIZDIO
      </Link>
    </main>
  );
}
