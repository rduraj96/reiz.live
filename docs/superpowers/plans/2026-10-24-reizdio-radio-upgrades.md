# REIZDIO Radio Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safari e2e coverage, a 16-genre mood-ordered dial, the current song, ambient mode, per-device dead-station memory and a Radio Browser mirror fallback.

**Architecture:** Each upgrade is a self-contained slice on `ui-revamp`. Server work lives in `lib/radio` and `app/api`; client state in small modules beside the existing stores; UI changes extend `Readout`, `BigName`, `Player`.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, Zustand, Tailwind 4, Vitest, Playwright (Chromium + WebKit).

**Spec:** `docs/superpowers/specs/2026-10-24-reizdio-radio-upgrades-design.md`

## Global Constraints

- Node from nvm: `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"`.
- Every task ends green: `npx tsc --noEmit -p .`, `npm run lint`, `npx vitest run`, `npx playwright test` (both projects from Task 1 on), `npm run build`.
- Copy and code style match the surrounding code (comment density, naming, Tailwind arbitrary values as already used).
- Touch targets ≥ 44 px; respect `prefers-reduced-motion`; no new runtime dependencies.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push (the controller pushes).

## Review Focus

1. A station with no ICY metadata, an HLS station, or a dead stream: the now-playing line stays hidden, no errors, no hanging requests (6 s timeout, 256 kB cap).
2. `/api/now-playing` must not fetch arbitrary URLs: only the stream URL of a station looked up by id, and not private/loopback IP literals.
3. Ambient mode with a panel open, while typing in search (F must not trigger), on exit via browser fullscreen Esc, and with reduced motion.
4. Dead-station memory must never empty a band entirely without the band showing its normal "No stations" state; expired entries come back.
5. Mirror fallback: a 4xx is final; tests' `RADIO_BROWSER_BASE` still pins one server.

---

### Task 1: WebKit (iPhone) project in the e2e suite

**Files:** Modify `playwright.config.ts`; any spec that needs a WebKit skip; any app code a real Safari failure points at.

- [ ] Add project `{ name: "webkit-iphone", use: { ...devices["iPhone 13"] } }` (WebKit is already installed in the Playwright cache).
- [ ] Run `npx playwright test --project=webkit-iphone`. For each failure decide: real Safari bug → fix the app; test relies on Chromium-only behaviour (e.g. the autoplay launch flag, desktop viewport) → `test.skip(({ browserName }) => browserName === "webkit", "<one-line reason>")`, or give the spec its own `test.use` viewport if it already sets one.
- [ ] Full suite green on both projects. Commit `test(e2e): run the suite on WebKit (iPhone 13) as well`.

### Task 2: Sixteen genres by mood, dial opens on House

**Files:** Modify `lib/catalog.ts`, `components/Tuner.tsx` (initial offset), `hooks/useDialBands.ts` or `store/dial.ts` (initial needle genre); tests in `tests/unit/` and e2e as needed.

**Interfaces:** Produces `START_GENRE = "house"` exported from `lib/catalog.ts`.

- [ ] `genres` = exactly (value/label): ambient/Ambient, lofi/Lofi, chillout/Chillout, classical/Classical, jazz/Jazz, soul/Soul, rnb/RnB, hip-hop/Hip-Hop, reggae/Reggae, indie/Indie, rock/Rock, metal/Metal, pop/Pop, 80s/80s, house/House, techno/Techno.
- [ ] Test: `genres.map(g => g.value)` equals that list in order; `START_GENRE` is one of them.
- [ ] With no current station, the Tuner's first offset is the House band's start (not `bands[0]`), and the House band is the first one requested. Test (unit or e2e): fresh load requests `genre=house` first and the slider reads a House station.
- [ ] Existing e2e that assumed House is the first band still pass (update helpers that pressed Home / assumed index 0 if needed).
- [ ] Commit `feat(dial): sixteen genres ordered by mood; the dial opens on House`.

### Task 3: Radio Browser mirror fallback

**Files:** Modify `lib/radio/client.ts`; test `tests/unit/radio-client.test.ts` (create or extend).

**Interfaces:** `get<T>(path)` keeps its signature.

- [ ] `MIRRORS = ["https://de1.api.radio-browser.info", "https://de2.api.radio-browser.info", "https://fi1.api.radio-browser.info"]`; when `RADIO_BROWSER_BASE` is set, the list is just that.
- [ ] Try the preferred mirror (last one that worked, else the first), then the others in order. Network error, timeout or 5xx → next; 4xx → throw `RadioBrowserError` at once. All fail → `RadioBrowserError` with the last cause.
- [ ] Tests (stub `fetch`): 5xx on de1 → result from de2 and the next call starts at de2; timeout/network error → next mirror; 404 → one call only, throws; env override → single base only.
- [ ] Commit `feat(radio): fall back across Radio Browser mirrors`.

### Task 4: Dead stations remembered on this device

**Files:** Create `lib/library/deadStations.ts`; modify `hooks/useEngineBridge.ts` (record on failure) and `hooks/useDialBands.ts` (filter on arrival); tests `tests/unit/dead-stations.test.ts`.

**Interfaces:** Produces `recordDead(id: string, now?: number): void`, `isDead(id: string, now?: number): boolean`, `dropDead<T extends { id: string }>(list: T[], now?: number): T[]`. Key `reizdio:dead`, TTL 24 h, max 200 entries (oldest dropped). All storage access in try/catch.

- [ ] Tests: recorded id is dead; after 24 h it isn't; the 201st record drops the oldest; `dropDead` filters; throwing `localStorage` → no throw, nothing dead.
- [ ] Record on the engine's `failed` event (same place `reportFailure` is wired).
- [ ] `useDialBands` applies `dropDead` to a band's stations before storing them; a band left empty takes the existing `empty` state.
- [ ] Commit `feat(dial): skip stations that failed on this device in the last 24 h`.

### Task 5: `/api/now-playing` route

**Files:** Create `lib/radio/icy.ts` (parsing + reading), `app/api/now-playing/route.ts`; tests `tests/unit/icy.test.ts`; an e2e fixture route if the fixture server needs an ICY stream.

**Interfaces:** Produces `parseStreamTitle(meta: string): string | null`, `readIcyTitle(url: string, opts?: { timeoutMs?: number; maxBytes?: number; fetchImpl?: typeof fetch }): Promise<string | null>`, `isPublicStreamUrl(url: string): boolean`. Route `GET /api/now-playing?id=<uuid>` → `{ title: string | null }`.

- [ ] `parseStreamTitle`: `StreamTitle='Daft Punk - Digital Love';StreamUrl='';` → `Daft Punk - Digital Love`; handles `'` inside titles up to `';`, trims, null for empty or `-`.
- [ ] `readIcyTitle`: fetch with `Icy-MetaData: 1`; no `icy-metaint` → null; read `metaint` bytes, then length byte × 16 metadata bytes; decode UTF-8 (fall back to latin1 if it has replacement chars); abort the body after; 6 s / 256 kB limits → null.
- [ ] `isPublicStreamUrl`: http/https only; false for `localhost`, `*.local`, IPv4 literals in 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 0/8 and IPv6 `::1`, `fc00::/7`, `fe80::/10`.
- [ ] Route: invalid id → 400; station not found → 404; not public → `{title:null}`; title equal to the station name (case-insensitive) → null; `Cache-Control: public, s-maxage=15, stale-while-revalidate=30`; directory errors → 502 like the other routes.
- [ ] Unit tests for all three helpers with a stubbed fetch returning a crafted ICY body (metaint 16).
- [ ] Commit `feat(api): now-playing title from the stream's ICY metadata`.

### Task 6: Show the current song

**Files:** Create `hooks/useNowPlaying.ts` (+ a tiny store or state in `store/player.ts`: `nowPlaying: string | null`); modify `components/Readout.tsx`, `components/BigName.tsx`, `lib/audio/mediaSession.ts` / `hooks/useEngineBridge.ts`, `components/Player.tsx`; tests.

**Interfaces:** Consumes Task 5's route. Produces `usePlayer` field `nowPlaying: string | null` and `setNowPlaying(title: string | null)`.

- [ ] `useNowPlaying` (mounted once in `Player`): while `status === "playing"` and the page is visible, fetch `/api/now-playing?id=` now and every 20 s; station change clears `nowPlaying` immediately and aborts the in-flight request; hidden/paused stops polling.
- [ ] Readout: a muted, truncated line under the station name when `nowPlaying` is set (phone and desktop layouts).
- [ ] BigName: the title is one more item in the ticker and the orbit ring when set.
- [ ] Media session: `title` = song when known, else station name; `artist` = station name when a song is shown.
- [ ] Tests: hook polls only while playing+visible and clears on change (fake timers); e2e with a mocked `/api/now-playing` shows the line in the readout.
- [ ] Commit `feat(player): show the current song`.

### Task 7: Ambient mode

**Files:** Create `components/AmbientControls.tsx` (bottom bar + exit) and `hooks/useAmbient.ts` (state, F key, fullscreen, wake lock, idle timer); modify `components/Readout.tsx` (button), `components/Player.tsx` (`data-ambient`, hiding chrome, blob cap), `components/BigName.module.css` if the orbit needs the larger cap; tests.

**Interfaces:** Produces `useAmbient(): { on: boolean; enter(opts?: { fullscreen?: boolean }): void; exit(): void; toggle(): void }` backed by a store so the button, key handler and Player share it.

- [ ] Button "Ambient mode" (expand icon, `iconBtn` style) in the readout actions; F toggles unless focus is in an input/textarea/select/contenteditable or a dialog is open.
- [ ] On: Player root `data-ambient`; header, readout, genre strip and dial fade out (`opacity-0`, `pointer-events-none`, collapsed height) — instant with reduced motion; stage blob cap becomes `min(80cqw, 80cqh)` instead of `min(70cqw, 360px, …)`.
- [ ] Bottom bar: station name · song, and an "Exit ambient mode" button (≥ 44 px). Bar and cursor hide after 3 s idle; pointer move, touch or key shows them.
- [ ] Button entry requests `document.documentElement.requestFullscreen()` when available (catch rejections); leaving fullscreen exits ambient; Esc and the exit button exit (and leave fullscreen if we entered it).
- [ ] Wake lock: `navigator.wakeLock?.request("screen")` on enter, released on exit, re-requested on `visibilitychange` back to visible while on.
- [ ] Tests: e2e — button enters (dial hidden, exit button visible), Esc exits, F toggles but not while typing in search; the blob grows; a11y axe clean in ambient.
- [ ] Commit `feat(player): ambient mode`.
