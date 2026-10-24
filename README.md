<h1 align="center">REIZDIO</h1>

<p align="center"><img src="public/reizdio_blob_2.gif" alt="The REIZDIO blob reacting to live radio" width="360"></p>

<p align="center">Live web radio with a 3D visualizer that moves to whatever you're listening to.<br>
<a href="https://www.reiz.live">www.reiz.live</a></p>

![REIZDIO tuned to a station](docs/screenshot.png)

## Features

- **A radio dial, not a list.** Drag, scroll or use the arrow keys to tune across genre bands. The station name sits huge behind the blob, and a readout shows the frequency, genre, country and name.
- **Liquid chrome blob.** A raymarched three.js blob reacts to the stream in real time: bass drives its lobes, kicks send a shockwave through it, snares and mids shift its colours. It is also the play and pause button. Under `prefers-reduced-motion` it moves less and drops the shockwave.
- **Tuning static.** While the needle moves, the stream ducks and band-passed noise rises, and the blob greys out and grains to match. It settles when the new station plays.
- **Frequency intro.** A short loader sweeps 87.5 to 108.0 MHz while the app loads, then splits open along the needle. It is a quick fade under reduced motion.
- **Genre bands and language.** Each band holds the top stations for that genre, and a language switch in the header re-tunes the dial.
- **Search, Recent and Saved.** Name search across all of Radio Browser with an optional country filter, the last 20 stations (kept in localStorage, no account needed), and hearted stations, kept in this browser too. There are no accounts.
- **Surprise me.** A shuffle button glides the dial to a random loaded station.
- **Sharing.** `/s/[stationId]` opens the app on that station with a tap-to-play state (browsers block autoplay), and renders a generated OG image. The share button uses the native share sheet or copies the link.
- **One layout, phone-ready.** The same layout works from 360 px up, with Media Session support for lock-screen and media-key controls.
- **Honest empty and error states.** A band that fails to load says so with a Retry button, an empty band says it is empty, and the blob keeps breathing if Radio Browser is down.

## How it works

### The tuner dial

`lib/dial/layout.ts` is a pure layout model. Each genre band reserves 12 slots, filled with that band's top stations by votes. Station ticks sit a fixed distance apart and bands are separated by a gap, so the dial does not jump when stations arrive. An unloaded band draws as a faint labelled stretch with placeholder ticks. The frequencies are decorative: slots, not stations, are spread evenly across 87.5 to 108.0 over the whole dial, so a station keeps its number for a given language.

Bands load lazily. `hooks/useDialBands.ts` waits for the needle to rest on a band, then loads that band and its two neighbours, with at most three requests in flight. Changing the language aborts pending requests and resets the dial. Band state lives in `store/dial.ts`. The dial is a `slider` for assistive tech, with keyboard support for arrows, Home, End and Page keys, and the playback queue follows the band under the needle.

### The chrome blob

`visualizer/analysis.ts` is pure and unit-tested. It turns the analyser's frequency data into 32 log-spaced bands from 30 Hz to 16 kHz, applies an automatic level control so quiet and loud streams both fill the range, and derives bass, mid, treble and snare levels. It also detects kicks, which feed a jelly squash spring and a flash.

`visualizer/shaders.ts` raymarches the blob on a full-screen quad, and `visualizer/scene.ts` runs it through three.js on a transparent canvas. The spectrum goes in as a small data texture, so nothing about the audio passes through React state and there is no re-render per frame. Pixel ratio and raymarch steps are lower on coarse pointers, rendering pauses while the tab is hidden, and a CSS gradient disc replaces the blob if WebGL is unavailable.

### Tuning static

`lib/audio/engine.ts` has `setTuning(on)`. While tuning, the stream ducks and a looping band-passed noise source rises. The noise feeds the same analyser as the stream, so the blob's grainy look and the sound always match. The noise is created on the first user-started load, so nothing sounds before the user has started the audio. It fades out when the new station plays, or after 3 seconds.

### The intro

`components/Intro.tsx` shows on a first load of `/` and `/s/[id]`. The frequency reading follows real progress (fonts loaded, first band loaded, first blob frame drawn) through `lib/intro/progress.ts`, which guarantees a minimum of 1.6 s, a maximum of 6 s and a monotonic count. After the intro the first station is primed, and the first tap on the blob starts audio.

### Only streams the visualizer can read are listed

The visualizer needs the audio samples, which means the stream has to be fetched with `crossOrigin="anonymous"` and the server has to allow it. Many stations in Radio Browser don't: they omit CORS headers, or serve plain HTTP on an HTTPS page. Those would either fail to play or play without moving the blob, so they are filtered out up front.

`lib/radio/verify.ts` checks each candidate stream:

1. `url_resolved` must be `https:`.
2. A range request sent with `Origin: https://reiz.live` must return an `Access-Control-Allow-Origin` header. Only headers are inspected; the body is aborted immediately.
3. Each probe has a 3 s timeout, probes run in parallel, and verdicts are cached per URL for 24 hours.

List endpoints over-fetch about 150 candidates from Radio Browser and return the first 50 that pass. The typed Radio Browser client (`lib/radio/client.ts`) is server-only, and `app/api/stations/*` exposes list, search, random and by-id routes. If a stream still fails at playback time (an error, a stream that ends, or no audio within 15 s, either at start or while stuck buffering), the engine reports it, the station is dropped from the current list, and playback advances to the next one. After 5 failures in a row it stops and says so instead of cycling through a dead list.

### Audio engine to visualizer

`lib/audio/engine.ts` is a singleton that owns one `HTMLAudioElement` and one `AudioContext` + `AnalyserNode` for the lifetime of the app (the old version created a new context on every station change). It exposes `load`, `play`, `pause`, `setTuning`, volume, the analyser, and `playing` / `paused` / `blocked` / `failed` events (`blocked` means the browser wants a tap before audio may start; it never marks a station bad). `lib/audio/mediaSession.ts` mirrors it into the Media Session API.

`visualizer/` is a framework-agnostic three.js scene: `createVisualizer` takes a container and an analyser getter and returns a handle to activate and dispose it. Each frame it reads the analyser, `analysis.ts` reduces the spectrum to levels, and they go straight into shader uniforms (see "The chrome blob" above).

React only holds the UI: `store/player.ts` (station, list, language, play state, volume), `store/dial.ts` (bands, needle) and `store/ambient.ts` are Zustand stores; `lib/library/recents.ts` and `lib/library/saved.ts` keep recents and saved stations in the browser's localStorage (there are no accounts).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · three.js 0.186 · Zustand · Vitest + Testing Library · Playwright + axe

## Local setup

Requires Node 24.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

- **No database or accounts.** Saved stations and recents live in the browser.
- **`RADIO_BROWSER_BASE`** (optional) pins one Radio Browser server. Unset, the server falls back across the de1, de2 and fi1 mirrors.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run e2e` | Playwright end-to-end and accessibility tests. Builds the app and uses a local Radio Browser fixture server and a test audio file, so it never touches live streams. |

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and e2e on every push and pull request.

## Credits

- Station data from [Radio Browser](https://www.radio-browser.info/), a community-maintained directory.
- Typeface: PP Neue Montreal by [Pangram Pangram](https://pangrampangram.com). It is a commercial font, included in this repository for this project only and not licensed for reuse.
