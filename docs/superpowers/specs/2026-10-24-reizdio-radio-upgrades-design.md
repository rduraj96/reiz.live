# REIZDIO radio upgrades — design

Date: 2026-10-24 · Branch: `ui-revamp` (PR #2) · Builds on the UI revamp spec.

Six upgrades chosen by the owner: Safari in the test suite, a tighter genre dial, the current song, ambient mode,
device memory for dead stations, and a directory fallback.

## 1. Safari in the e2e suite

The last three phone bugs were Safari-only (analyser silence, frame-unaligned decode, gradient ticks). Playwright gains a
second project, `webkit-iphone` (`devices["iPhone 13"]`, WebKit), next to `chromium`. The whole suite runs on both.
Tests that cannot run on WebKit (e.g. Chromium-only launch flags) are skipped there with a one-line reason; none are
skipped silently. Any real Safari bug the new project finds is fixed, not skipped.

## 2. Sixteen genres, ordered by mood

`lib/catalog.ts` `genres` becomes, in this order:

Ambient, Lofi, Chillout, Classical, Jazz, Soul, RnB, Hip-Hop, Reggae, Indie, Rock, Metal, Pop, 80s, House, Techno

Values are the Radio Browser tags: `ambient, lofi, chillout, classical, jazz, soul, rnb, hip-hop, reggae, indie, rock,
metal, pop, 80s, house, techno`.

The dial still opens on **House** (`START_GENRE = "house"`): the first visit's needle starts at the House band and
House loads first. Shared links and the current station keep taking precedence, as today.

## 3. Now playing (artist — title)

Most Icecast/Shoutcast streams carry ICY metadata (`StreamTitle='Artist - Title';`). Browsers can't read it
(the stream must be requested with `Icy-MetaData: 1`, and the response header `icy-metaint` isn't CORS-exposed), so a
server route reads it.

- `GET /api/now-playing?id=<station uuid>` → `{ "title": string | null }`.
  - Looks the station up by id (existing cached lookup); **never takes a URL from the client** (no open proxy).
  - Fetches the stream with `Icy-MetaData: 1`, reads `icy-metaint` bytes plus the metadata block, parses
    `StreamTitle`, aborts. Limits: 6 s timeout, 256 kB read cap, http/https only, refuses IP-literal private, loopback
    and link-local hosts.
  - `title` is trimmed; empty, `-`, or the station name repeated count as null.
  - `Cache-Control: public, s-maxage=15, stale-while-revalidate=30`. Unknown id → 404; upstream trouble → `{title:null}`.
- Client `useNowPlaying()`: polls every 20 s while a station is playing and the page is visible; clears on station change.
- Shown: a muted line under the station name in the readout (hidden when null); appended to the big name (ticker on
  desktop, orbit on phones) as one more item; in ambient mode; and as the lock-screen title (artist line = station).

## 4. Ambient mode

For leaving the radio on.

- Entered by an icon button in the readout actions ("Ambient mode", expand icon) or the **F** key (not while typing or
  a panel is open). The button also requests browser fullscreen where available (desktop); iPhone just uses the page.
- The Player root gets `data-ambient`: header, readout, genre strip and dial fade out and collapse; the stage takes the
  full height so the visualizer grows (the blob cap rises from 360 px to `min(80cqw, 80cqh)`); the big name stays.
- A small bottom bar shows station · song and an exit button. It and the cursor fade after 3 s without pointer or key
  activity; any move/tap brings them back.
- Exit: the exit button, Esc, F again, or leaving browser fullscreen.
- Keeps the screen awake with the Screen Wake Lock API while active (re-acquired when the page becomes visible again);
  silently skipped where unsupported.
- Tapping the visualizer still plays/pauses. Reduced motion: no fades, instant switch.

## 5. Dead stations remembered on this device

- `lib/library/deadStations.ts` keeps `{ [stationId]: failedAt }` in localStorage (`reizdio:dead`), entries expire
  after 24 h, at most 200 kept.
- A station is recorded when the engine reports it failed (the existing `reportFailure` path).
- Dial bands drop recorded stations when a band's stations arrive (so Shuffle and tuning skip them too). Search,
  Recent and Saved still show them, because the listener asked for them by name.
- Storage failures (private mode) are ignored: nothing is remembered.

## 6. Directory fallback

`lib/radio/client.ts` talks to one Radio Browser server (de1), which errored during testing.

- Mirrors in order: `de1`, `de2`, `fi1` (`https://<name>.api.radio-browser.info`). A request that times out (8 s),
  can't connect, or gets a 5xx moves to the next mirror; the mirror that last worked is tried first next time.
  A 4xx is final (no retry).
- `RADIO_BROWSER_BASE` (tests) still pins a single server.

## Out of scope

Server-side shared dead-station reports, a sleep timer, analytics, keyboard shortcuts beyond F.
