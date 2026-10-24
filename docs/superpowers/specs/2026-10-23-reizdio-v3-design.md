# REIZDIO v3 — Design

**Date:** 2026-10-23
**Branch:** `v3`
**Goal:** Turn REIZDIO (reiz.live) into a portfolio showcase: a modern stack, clean code, finished features and a polished UX, while keeping the existing identity (the 3D blob, PP Neue Montreal, the current palette).

## Context

The current app (in `client/`) is a Next.js 13.4 / React 18 project last touched in early 2025. The 3D blob visualizer reacts to live radio, stations come from Radio Browser, and Supabase handles email/password auth and saved stations.

Problems found:

- Dependencies from 2023–24; `ytdl-core` is abandoned and broken.
- Dead code: socket.io sync server (`server/`), YouTube audio route and player, `/darkside` page, unused `.glb`/`.hdr` assets.
- The RECENT / SAVED / ABOUT nav items have no handlers.
- Recents are held in memory only and are lost on reload.
- `useAudioSetup` creates a new `AudioContext` on every station change and never closes the old one.
- `threeSetup.ts` loads a `/cubemap/*.jpg` env map (the files are `.png`), but nothing uses it: the commented-out outer glass blob was its only consumer. `blobGeometry.ts` (CPU displacement) is also unused; the shader does the displacement.
- `/api/stations` returns 201 for a successful GET.
- Many stations fail under `crossOrigin="anonymous"`: no CORS header, or plain-HTTP streams on an HTTPS page.
- No tests, and the README is still the template.

## Decisions

| Topic | Decision |
|---|---|
| Approach | Fresh scaffold at repo root; port only what's kept. Git history preserved. |
| Leftovers | Cut socket.io server, YouTube player/route, `/darkside`, unused assets. |
| Visuals | Keep the blob and look; refine, don't redesign. |
| Non-visualizable stations | Hide them (HTTPS + CORS required). |
| Auth | Keep Supabase email/password. |
| Data source | Keep Radio Browser. |
| Hosting | Keep Vercel at reiz.live. |

## 1. Foundation & architecture

**Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4, three.js (latest), Zustand, `@supabase/ssr` (latest), npm. The app lives at the repo root; `client/` and `server/` are removed.

**Units:**

- **`lib/radio/`**: server-only typed Radio Browser client. Supports `byTag(genre, language)`, `search(name, country?)`, `byId(stationuuid)` and `random(genre)`. It normalizes responses into a `Station` type keyed by `stationuuid`.
- **`lib/radio/verify.ts`**: stream verification. A station passes if `url_resolved` is `https:` and a request sent with `Origin: https://reiz.live` returns an `Access-Control-Allow-Origin` header. It checks headers only (range request, body aborted) with a 3 s timeout, run in parallel. Verdicts are cached per URL for 24 h. List endpoints over-fetch (~150) and return the stations that pass, up to 50.
- **`app/api/stations/*`**: route handlers for list, search, random and by-id. They return 200, with short cache headers on lists.
- **`lib/audio/engine.ts`**: singleton audio engine. It owns one `HTMLAudioElement` and one `AudioContext` + `AnalyserNode` for the app's lifetime. API: `load(station)`, `play()`, `pause()`, `setVolume()`, `setMuted()`, `analyser`, and events (`playing`, `paused`, `error`). On a playback error it reports the station as bad: it is removed from the current list and playback advances to the next station.
- **`lib/audio/mediaSession.ts`**: Media Session integration. Metadata is station name, country/genre, and favicon as artwork. Handles play, pause, previous track and next track (moving through the current list).
- **`visualizer/`**: framework-agnostic three.js scene, `createVisualizer(container, getAnalyser)` → `{ setState, dispose }`. React mounts it once.
- **`lib/library/recents.ts`**: localStorage; last 20 stations; de-duplicated by id.
- **`lib/library/saved.ts`**: Supabase `saved_stations` CRUD keyed by `station_id`.
- **`store/player.ts`**: Zustand store holding the current station, list, genre, language, play state, mute and volume. It replaces `StationContext`.

**Supabase schema** (`supabase/migrations/…_saved_stations.sql`): existing saved data is not preserved. The migration drops and recreates `saved_stations` as `(user_id uuid references auth.users, station_id text, station jsonb, created_at timestamptz default now(), primary key (user_id, station_id))`, where `station` is a snapshot of the normalized `Station`. Row-level security lets users select, insert and delete only their own rows. The user applies the migration manually.

## 2. Features

**Station panel.** One panel with tabs Browse / Recent / Saved. It is a side drawer on desktop and a bottom sheet on phones. Header RECENT and SAVED open the panel on that tab.

**About.** A small panel: what REIZDIO is, credit to Radio Browser, and a link to the GitHub repo.

**Recents.** Persisted in localStorage (see `lib/library/recents.ts`). No account needed.

**Saved.** Heart toggle, starting from an empty table. When logged out, the heart opens the login dialog and the pending save completes after login.

**Search & discovery.**
- The Browse tab has name search across all of Radio Browser, with an optional country filter.
- "Surprise me" plays a random verified station from the current genre.
- All results go through stream verification.

**Empty and error states.** If a genre/language combination yields no verified stations, the UI says so and offers "Any language".

**Phones.**
- The side scroll-pickers become two horizontal chip rows (genre, language).
- The play bar becomes compact: name, play/pause, heart, open panel.
- Media Session gives lock-screen and media-key controls.
- **Risk:** iOS may suspend Web Audio–routed playback when the screen locks. This is verified on a real device in phase 4. If it reproduces, stop and bring options to the user; do not silently work around it.

**Sharing.**
- Route `/s/[stationId]` server-fetches the station and renders the app with that station loaded and a "tap to play" state, because of autoplay restrictions.
- An OG image is generated via `next/og`: station name and favicon in REIZDIO styling.
- The share button uses `navigator.share` where available and falls back to copying the link.

## 3. Visual polish & wrap-up

**Visualizer:**
- Split the analyser into bass, mid and treble bands with smoothing, so the blob moves with the beat.
- Crossfade between idle and playing, and on station change.
- No React re-render per audio frame; adaptive pixel ratio on mobile; pause rendering while the tab is hidden.
- Remove the dead env map, the outer blob, `blobGeometry.ts`, the cubemap/texture folders and the unused `.glb`/`.hdr` files.
- Honour `prefers-reduced-motion` with calmer motion.

**UI:**
- skeleton states while stations verify
- error and empty states
- keyboard navigation and visible focus
- ARIA labels

**Shipping:**
- Work happens on `v3`, with a Vercel preview per phase.
- Production changes only on merge to `main`.
- Before merging, the user changes the Vercel project's Root Directory from `client/` to the repo root.

**Wrap-up:**
- new README (GIF, features, architecture, setup)
- `.env.example`
- GitHub Actions running lint, typecheck and tests

## Testing

- **Vitest unit tests:**
  - Radio Browser normalization
  - stream verification (mocked fetch: https/cors/timeout cases)
  - recents (dedupe, cap)
  - saved (row ↔ `Station` mapping)
  - player store transitions
- **Playwright smoke test:** load `/`, verify stations appear, select one, assert the engine reaches `playing`. Uses a mocked stations API and a local test audio file, so CI doesn't depend on live streams.
- **Manual on a real phone:** lock-screen controls and background playback (iOS risk above).

## Phases

Each phase leaves the app deployable.

1. **Foundation:** scaffold, port visualizer, audio engine, stations API with verification, store, dead code removed.
2. **Nav:** station panel, Recent, Saved (+ fresh table), About.
3. **Search & discovery:** search, country filter, Surprise me.
4. **Phones:** responsive layout, Media Session, iOS check.
5. **Sharing:** `/s/[stationId]`, OG image, share button.
6. **Wrap-up:** visual polish pass, README, CI.

## Out of scope

- Listen-together / rooms
- Additional visualizer modes
- A redesign
- A stream proxy
- OAuth or magic-link login
- A PWA install prompt
