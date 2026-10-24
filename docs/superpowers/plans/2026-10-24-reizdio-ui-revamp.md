# REIZDIO UI Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v3's screen with the tuner-dial, chrome-blob, Frequency-intro interface, keeping v3's data, audio, library and sharing layers.

**Architecture:**
- Pure, unit-tested modules hold the logic that is easy to get wrong:
  - `lib/dial/layout.ts` (dial geometry)
  - `visualizer/analysis.ts` (spectrum, level control, kicks)
  - `lib/intro/progress.ts` (loader curve)
- Thin React components render them:
  - `Tuner`
  - `Readout`
  - `BigName`
  - `Intro`
  - the rewritten `Player`
- A new `store/dial.ts` holds the per-genre bands. A hook loads them lazily around the needle.
- The existing `usePlayer` store and the audio engine stay the source of truth for playback, with two additions: `tuning`, and `engine.setTuning`.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Tailwind 4, three.js 0.186, Zustand, `motion`, Vitest + Testing Library, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-10-24-reizdio-ui-revamp-design.md`

## Global Constraints

- **Node:** prefix commands with `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH" && `.
- **Branch:** `ui-revamp`. Never push without the user's go-ahead.
- **Identity:**
  - black `hsl(0 0% 3.9%)`
  - white `hsl(0 0% 98%)`
  - muted `hsl(0 0% 63.9%)`
  - accent `#ee2647`
  - PP Neue Montreal
  - the original REIZDIO wordmark; no logo changes
- **Layout:** one full-height stage with no page scroll. It works from 360 px wide, with tap targets of at least 44 px.
- **Language:** default is `"any"`.
- **Dial constants:**
  - `DIAL_SLOTS = 12` per band
  - `STATION_GAP = 72` px
  - `BAND_GAP = 60` px
  - frequency range 87.5–108.0, mapped over slots, shown with one decimal
  - at most 3 band requests in flight
  - snap 140 ms after the last wheel event
- **Blob:**
  - pixel ratio capped at 1.5 on coarse pointers, 2 otherwise
  - 64 raymarch steps on coarse pointers, 90 otherwise
  - `tune` eases up at 7/s and down at 3.5/s
  - spectrum ×(1 − 0.7·tune); kick, squash and flash ×(1 − tune)
- **Analysis:** all values in spec §3 are binding:
  - 32 log bands, 30 Hz–16 kHz; treble lift ×(1+0.8·b/32)
  - level control: peak decay e^(−0.4·dt), floor 0.15, `v=((raw/peak−0.18)/0.82)^1.6`, attack 0.6, release 0.16
  - band ranges: bass 0–5, mid 8–19, treb 22–31, snare 18–23 above 0.45
  - kick: Δbass > 0.12 with a 0.18 s refractory gap, amplitude min(1, 1.4·bass)
  - spring: k 90, damping 9, impulse 2.4·amp
  - flash decays at e^(−7·dt)
- **Tuning audio:**
  - noise band-passed at 2.6 kHz, Q 0.4
  - while tuning, the stream ducks to 8% and the static rises to 45%
  - `setTargetAtTime` with time constant 0.05
  - static fades out when `playing` is emitted, or after 3 s
- **Intro:**
  - milestones: fonts 20%, first band 70%, first frame 100%
  - minimum 1.6 s, maximum 6 s
  - hold 350 ms at the end, then the split (0.85 s, `cubic-bezier(.76,0,.24,1)`)
  - the page scales from 1.08 to 1 over 1.1 s
  - the dial glides in from 700 px left of the first station
  - digit roll: 8 values, 38 ms apart; letter stagger 32 ms, 0.7 s each
  - reduced motion: a 0.4 s fade instead
- **Copy:**
  - `MHz · tuning in` / `MHz · signal locked`
  - "Tap to play"
  - "No stations"
  - "Couldn't load"
  - "Couldn't play any station here — tune somewhere else"
  - Header: `LANG · ANY ▾` (just `ANY ▾` below 760 px), `SEARCH`, `SAVED`, `INFO`

## Review Focus

1. **Dragging fast across many stations:** only the settled station loads; passing over a station never calls `select`. Test in Task 6.
2. **Switching language while a band request is in flight:** a stale response never fills a band for the new language. Test in Task 5.
3. **Tuning away and back to the playing station:** `select` is a no-op, so `tuning=false` must restore the stream and silence the static even without a new `playing` event. Test in Task 1.
4. **The radio directory is down at first load:** the intro still finishes by 6 s, and the readout offers Retry. Tests in Tasks 9 and 12.
5. **A dial with zero loaded stations:** arrow keys, wheel and Shuffle don't throw, and the readout shows the empty state. Tests in Tasks 4 and 6.

---

### Task 1: Player store `tuning` + engine `setTuning`

**Files:**
- Modify: `store/player.ts`, `lib/audio/engine.ts`, `hooks/useEngineBridge.ts`
- Test: `tests/unit/player-store.test.ts`, `tests/unit/engine.test.ts`

**Interfaces:**
- **Produces:**
  - `usePlayer` state `tuning: boolean` (default false) and action `setTuning(on: boolean)`.
  - `language` defaults to `"any"`.
  - `AudioEngine.setTuning(on: boolean): void`.
  - The bridge forwards store `tuning` to `engine.setTuning`.

- [ ] **Step 1: Write the failing tests.**
  - **Store:**
    - `setTuning(true)` then `setTuning(false)` toggles `tuning`.
    - The initial `language` is `"any"`.
  - **Engine** (fake context: record `GainNode` targets via a stubbed `setTargetAtTime`):
    - `setTuning(true)` before any `load` creates no static source and doesn't throw.
    - After `load` and `playing`, `setTuning(true)` targets stream gain 0.08 and static gain 0.45, with time constant 0.05.
    - `setTuning(false)` targets stream 1 and static 0. **This is Review Focus 3:** it must hold without any new `load` or `playing` event.
    - `setTuning(false)` followed by a superseding `load` keeps static at 0.45 until `playing`, then fades it to 0. If no `playing` arrives within 3000 ms (fake timers), it fades to 0 anyway.
    - While paused, `setTuning(true)` leaves static at 0.
- [ ] **Step 2:** Run `npx vitest run tests/unit/player-store.test.ts tests/unit/engine.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - **Graph:** the engine creates `streamGain` (between the media source and the analyser) and the static chain on the first `load`: a looping noise `AudioBufferSourceNode` → `BiquadFilter` (bandpass, 2600 Hz, Q 0.4) → `staticGain` → analyser.
  - **Bridge:** subscribe to `tuning` and call `engine.setTuning`.
  - **Failure counter:** `select` keeps resetting `failedInARow`; `tuning` never touches it.
- [ ] **Step 4:** Run the same tests, then `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(audio): tuning static and store tuning flag`.

### Task 2: Spectrum analysis module

**Files:**
- Create: `visualizer/analysis.ts`
- Delete: `visualizer/bands.ts`, `tests/unit/bands.test.ts`
- Test: `tests/unit/analysis.test.ts`

**Interfaces:**
- **Produces:**
  - `type Analysis = { bands: Float32Array /*32*/; bass: number; mid: number; treb: number; snare: number; kickDir: [number, number, number]; kickAge: number; kickAmp: number; squash: number; flash: number }`
  - `createAnalysis(rand?: () => number): Analysis`
  - `stepAnalysis(a: Analysis, freq: Uint8Array | null, sampleRate: number, dt: number, t: number): void`
    - `freq === null` → breathing preview: `k=exp(−6·phase)` at 124 BPM × e^(−9x), plus `0.2·(0.5+0.5 sin(1.3t+0.4b))·e^(−4|x−0.4|)`, all ×0.25.

- [ ] **Step 1: Write failing tests.** Each test builds byte spectra by hand and uses `sampleRate` 48000.
  - **Level control:** feeding the same loud spectrum for 3 s converges `bands[0]` into [0.6, 1.0]. Feeding a spectrum at 1/4 the level after that, for 10 s, recovers above 0.4.
  - **Kick detection:**
    - A bass jump of +0.3 in one frame sets `kickAge` to 0 and `kickAmp` to `min(1, 1.4·bass)`.
    - A second jump 0.1 s later does **not** reset it.
    - A jump 0.2 s later does.
    - `kickDir` has length 1 within 1e-6.
  - **Spring:** after an impulse, `squash` changes sign at least once and stays within |0.01| after 2 s.
  - **Flash:** after 1 s, `flash` is below e^(−7)+1e-3 of its peak.
  - **Band ranges:** energy only in the bins for 30–80 Hz raises `bass` and leaves `treb` at 0.
  - **Breathing preview:** `freq === null` keeps every band ≤ 0.35.
- [ ] **Step 2:** Run `npx vitest run tests/unit/analysis.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement with the Global Constraints values. Allocate nothing per frame.
- [ ] **Step 4:** Run the test, then `npm test`. Expected: PASS. `bands.test.ts` is removed.
- [ ] **Step 5:** Commit: `feat(visualizer): 32-band analysis with level control and kick detection`.

### Task 3: Liquid chrome scene

**Files:**
- Rewrite: `visualizer/shaders.ts`, `visualizer/scene.ts`
- Modify: `components/Visualizer.tsx`

**Interfaces:**
- **Consumes:**
  - Task 2: `createAnalysis` and `stepAnalysis`
  - Task 1: `usePlayer` `tuning` and `status`
  - `getAudioEngine().analyser`
- **Produces:** `createVisualizer(container, getAnalyser, opts: { reducedMotion: boolean }): { setActive(active: boolean): void; setTuning(on: boolean): void; dispose(): void }`. `components/Visualizer.tsx` renders a square container sized `min(70vw, 360px)`.

- [ ] **Step 1:** Read `~/.claude/skills/threejs-fundamentals/SKILL.md`, `threejs-shaders/SKILL.md` and `threejs-performance/SKILL.md`, and follow them. Then read the reference shader in `~/Documents/Projects/reiz-mockups/prototypes/chrome-blob.html`. The tuner and intro prototypes are beside it, as `tuner.html` and `intro-lab.html`.
- [ ] **Step 2:** Port the fragment shader into `visualizer/shaders.ts` as a GLSL `ShaderMaterial` on a full-screen `PlaneGeometry(2, 2)` with an `OrthographicCamera`.
  - **Uniforms:** `res`, `time`, `bass`, `mid`, `treb`, `snare`, `tune`, `kickDir`, `kickAge`, `kickAmp`, `squash`, `flash`, `spec`.
  - **Spectrum:** `spec` is a 32×1 `THREE.DataTexture` with `RedFormat` / `UnsignedByteType`, linear filtering, sampled as `.r`. LuminanceFormat no longer exists in r186.
  - **Steps:** the raymarch step count is a `#define STEPS` set from `opts`.
  - **Background:** where nothing is hit, alpha is 0, so the canvas stays transparent over the page.
- [ ] **Step 3:** Implement `scene.ts`.
  - **Clock:** `THREE.Timer` connected to `document`.
  - **Pixel ratio and steps:** per Global Constraints.
  - **Each frame:**
    - Call `stepAnalysis` with `analyser.getByteFrequencyData`, or `null` when inactive or when the analyser is missing.
    - Upload `bands × (1−0.7·tune)` as bytes.
    - Ease `tune` toward the target.
    - Scale kick, squash and flash by `(1−tune)`.
  - **Reduced motion:** band amplitudes ×0.4 and `kickAmp = 0`.
  - **Other:** pause on `visibilitychange`, and a `ResizeObserver` on the container.
  - **`dispose()`:** frees the geometry, material, texture and renderer, and removes the canvas.
- [ ] **Step 4:** Update `components/Visualizer.tsx`.
  - Subscribe to `usePlayer` and call `setActive(status === "playing")` and `setTuning(tuning)`.
  - If WebGL creation throws, render a `div` with a CSS radial-gradient disc (`#ee2647` → `#2b7bff` → transparent) at the same size.
- [ ] **Step 5:** Verify.
  - Run `npm run typecheck && npm run build`. Expected: success.
  - Then `npm run dev` and open `/` in Playwright with SwiftShader (`--use-gl=angle --use-angle=swiftshader`), taking one screenshot of the blob. Expected: a chrome sphere on transparent black, and no console errors.
- [ ] **Step 6:** Commit: `feat(visualizer): liquid chrome raymarched blob`.

### Task 4: Dial layout model

**Files:**
- Create: `lib/dial/layout.ts`
- Test: `tests/unit/dial-layout.test.ts`

**Interfaces:**
- **Produces:**
  - `type BandState = "idle" | "loading" | "ready" | "empty" | "error"`
  - `type DialBand = { genre: string; label: string; state: BandState; stations: Station[] }`
  - `type DialLayout = { bands: { genre: string; label: string; start: number; end: number; state: BandState }[]; ticks: { x: number; stationId: string | null; band: string }[]; width: number }`
  - `buildLayout(bands: DialBand[], offDial?: { station: Station; label: string }): DialLayout`
    - `offDial` becomes a leading band of 1 slot with the given label.
  - `nearestStation(layout, x): { stationId: string; x: number } | null`
    - Skips null ticks; returns null when no station tick exists.
  - `positionOf(layout, id): number | null`
  - `bandAt(layout, x): string | null`
  - `frequencyOf(layout, id): string | null`
    - Slot index mapped linearly over all slots onto 87.5–108.0, formatted with one decimal.
  - Constants: `DIAL_SLOTS = 12`, `STATION_GAP = 72`, `BAND_GAP = 60`.
  - Band order is the order given.

- [ ] **Step 1: Write failing tests.**
  - Two ready bands with 12 and 3 stations: band 2 starts at `12·72 + 60`, and band 1's ticks are 72 apart.
  - Band 2's 9 unused slots have `stationId: null`.
  - **Frequencies:**
    - The first slot is `"87.5"` and the last slot overall is `"108.0"`.
    - A station's frequency is unchanged when a third band later changes from `idle` to `ready`.
  - `nearestStation` at an x between two station ticks returns the closer one.
  - **Review Focus 5:** `nearestStation` returns null for a layout whose bands are all `idle`, `empty` or `error`.
  - `bandAt` returns the genre for any x within `[start, end]`.
  - `offDial` adds a leading band labelled `"Shared"` and shifts the other bands by `72 + 60`.
- [ ] **Step 2:** Run `npx vitest run tests/unit/dial-layout.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Unloaded bands still reserve `DIAL_SLOTS` slots, so positions never jump.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(dial): pure layout model`.

### Task 5: Dial store and lazy band loading

**Files:**
- Create: `store/dial.ts`, `hooks/useDialBands.ts`
- Moves here: `hooks/useStations.ts`' retry and error behaviour (Task 8 deletes that file).
- Test: `tests/unit/dial-bands.test.ts`

**Interfaces:**
- **Consumes:** Task 4's `DialBand`, `BandState`.
- **Produces:**
  - `useDial` (Zustand), with state:
    - `bands: DialBand[]`, initialised from `lib/catalog.ts` `genres`, all `idle`
    - `needleGenre: string | null`
    - `language: string`
  - and actions:
    - `setNeedleGenre(g: string | null)`
    - `patchBand(genre, patch: Partial<DialBand>)`
    - `resetForLanguage(language: string)`: every band back to `idle`; `needleGenre` kept
    - `retryAll()`: `error` bands → `idle`
  - `useDialBands()`: watches `needleGenre` and `usePlayer.language`.
    - Ensures the needle band and its two neighbours are loaded.
    - At most 3 requests in flight, using `/api/stations?genre=&language=`.
    - Keeps the first 12 stations.
    - Sets `ready`, `empty` (for `[]`) or `error`.
    - An `error` band is retried on the next time the needle enters it.
    - The first band to become `ready` resolves the intro milestone, exposed as `useDial.getState().firstBandReady: boolean`.

- [ ] **Step 1: Write failing tests** with mocked `fetch` and the hook rendered via `renderHook`.
  - With the needle on band index 5, exactly bands 4, 5 and 6 are requested.
  - Moving the needle to 9 requests 8, 9 and 10, never more than 3 at once (count concurrent unresolved promises).
  - A 502 marks the band `error`. Re-entering the needle into it requests it again.
  - `[]` marks it `empty`.
  - **Review Focus 2:** a response for `english` resolving after `resetForLanguage("german")` leaves the band `idle` or `loading`, and never `ready` with the English stations.
  - `firstBandReady` flips true exactly once.
- [ ] **Step 2:** Run `npx vitest run tests/unit/dial-bands.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. Key each request by `genre|language` and drop any response whose key no longer matches the store's language.
- [ ] **Step 4:** Run the tests and `npm test`. Expected: PASS. Leave `hooks/useStations.ts` in place; Task 8 deletes it.
- [ ] **Step 5:** Commit: `feat(dial): lazy per-genre band loading`.

### Task 6: Tuner component

**Files:**
- Create: `components/Tuner.tsx`
- Test: `tests/unit/tuner.test.tsx`

**Interfaces:**
- **Consumes:**
  - Task 4: layout helpers
  - Task 5: `useDial`
  - `usePlayer`: `select`, `setList`, `setTuning`, `current`, `prime`, `primed`
- **Produces:**
  - `<Tuner />`, which tunes to the current station whenever `current` changes from outside (panel picks, `markFailed`, share prime) by gliding to `positionOf(current.id)`, or to the off-dial band.
  - `tunerApi`, exported for Shuffle and Intro:
    - `glideTo(stationId: string, opts?: { fromOffset?: number; prime?: boolean }): void`. With `prime: true` the settle calls `usePlayer.prime(station)` instead of `setList` + `select`. The intro and the share page use it, because autoplay is blocked.
    - `shuffle(): void`

- [ ] **Step 1: Write failing tests** with Testing Library, fake timers and a stubbed `requestAnimationFrame` that advances fake time.
  - The dial has `role="slider"` and `aria-valuetext="<name>, <genre>"`.
  - **ArrowRight:**
    - Calls `setTuning(true)` immediately.
    - After the glide completes, calls `setList` with the loaded stations in dial order and then `select(nextStation)` once.
    - Ends with `setTuning(false)`.
  - **Review Focus 1:** dispatching 10 ArrowRight presses before the glide settles calls `select` once, for the final station.
  - Home and End go to the first and last loaded stations; PageDown jumps to the first station of the next band that has stations.
  - **Review Focus 5:** with no loaded stations, ArrowRight, wheel and `tunerApi.shuffle()` don't throw, and `select` isn't called.
  - When `current` is set externally to a station on the dial, the needle glides there and `select` isn't called again.
- [ ] **Step 2:** Run `npx vitest run tests/unit/tuner.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement from the prototype's behaviour (`~/Documents/Projects/reiz-mockups/prototypes/tuner.html`).
  - **Gestures:**
    - Pointer drag with momentum, then a glide to `nearestStation(offset + vel·220)`.
    - Wheel snaps after 140 ms.
    - Glide: `offset += (target − offset)·0.16` per frame, done when the remaining distance is under 0.5 px.
  - **Dial updates:** the offset is kept in a ref and written straight to the track's `transform`, not through React state per frame.
  - **Needle genre:** call `setNeedleGenre(bandAt(...))` whenever the band under the needle changes.
  - **Visuals:**
    - The nearest tick gets the `near` class (40 px tall, white).
    - The active band's label and rule light up.
    - The needle gets the `lock` class for 0.5 s on settle.
    - `idle` bands show grey placeholder ticks; `empty` shows "No stations"; `error` shows "Couldn't load".
  - **Reduced motion:** glides jump straight to the target.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(dial): tuner component`.

### Task 7: Readout and big name

**Files:**
- Create: `components/Readout.tsx`, `components/BigName.tsx`
- Modify: `components/HeartButton.tsx`, `components/ShareButton.tsx` (size and styling only)
- Test: `tests/unit/readout.test.tsx`

**Interfaces:**
- **Consumes:**
  - `usePlayer`: `current`, `tuning`, `status`
  - Task 4: `frequencyOf`
  - Task 6: `tunerApi.shuffle`
- **Produces:**
  - `<Readout />`:
    - frequency, genre and country line;
    - name line;
    - heart, share and shuffle buttons, each 44 px;
    - error and empty slot props `{ message?: string; onRetry?: () => void }`, used by Task 12.
  - `<BigName />`: `aria-hidden`; outlined name.

- [ ] **Step 1: Write failing tests.**
  - The readout shows `98.3 · HOUSE · NL` for a fixture station at that frequency.
  - When `current` changes, the frequency text cycles through 8 values 38 ms apart before landing on the real one.
  - With reduced motion it lands immediately.
  - The shuffle button calls `tunerApi.shuffle`.
  - `BigName` renders one span per character and switches to the smaller size class for names longer than 14 characters.
  - While `tuning`, `BigName` has the `out` class.
- [ ] **Step 2:** Run `npx vitest run tests/unit/readout.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement with spec §1 sizes:
  - big name `clamp(56px, 13vw, 168px)`, or `clamp(40px, 9vw, 120px)` above 14 characters;
  - stroke 1 px `hsl(0 0% 28%)`;
  - letter rise with a 32 ms stagger, 0.7 s each.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(ui): readout and big now-playing name`.

### Task 8: New Player layout and header

**Files:**
- Rewrite: `components/Player.tsx`, `components/Header.tsx`
- Delete:
  - `components/PlayBar.tsx`
  - `components/CompactPlayBar.tsx`
  - `components/StationMarquee.tsx`
  - `components/LiveClock.tsx`
  - `components/ChipRow.tsx`
  - `components/ScrollSelect.tsx`
  - `components/SurpriseButton.tsx`
  - `components/StationStatus.tsx`
  - `hooks/useStations.ts`
- Create: `components/LanguageSwitch.tsx`
- Rewrite tests: `tests/e2e/smoke.spec.ts`, `tests/e2e/mobile.spec.ts`

**Interfaces:**
- **Consumes:** Tasks 3, 5, 6 and 7.
- **Produces:**
  - The page structure later tasks rely on:
    - `header` holds the wordmark, `LanguageSwitch`, `SEARCH`, `SAVED`, `INFO`;
    - `main` holds `BigName`, then the blob button (`aria-label` "Play" or "Pause", with the "Tap to play" hint), then `Readout`, then `Tuner`.
  - Playwright `use: { reducedMotion: "reduce" }` in `playwright.config.ts` for every project except `intro.spec.ts` (Task 9).

- [ ] **Step 1: Rewrite the e2e specs to the new structure** (they fail first).
  - **Mocks:** keep the existing ones, but `/api/stations*` returns three stations whose names include the `genre` param, e.g. `House One`, so bands are distinguishable.
  - **`smoke.spec.ts`:**
    - Focus the dial and press ArrowRight twice. The readout name becomes the third House station, and the big name shows its letters.
    - Click the blob button. Its aria-label becomes "Pause" within 5 s.
    - Choosing `Deutsch` in `LanguageSwitch` re-requests `/api/stations` with `language=german`.
  - **`mobile.spec.ts`:**
    - At 360 and 390 px, there is no horizontal overflow.
    - The blob, heart, share and shuffle buttons are each at least 44×44.
- [ ] **Step 2:** Run `CI=1 npx playwright test tests/e2e/smoke.spec.ts tests/e2e/mobile.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the layout from spec §1.
  - `useDialBands()` and `useEngineBridge()` are mounted once in `Player`.
  - The blob button toggles playback through `togglePlay` from `useEngineBridge`.
  - `LanguageSwitch` is a popover radiogroup over `languages` with "Any" first. Choosing one calls `usePlayer.setLanguage` and `useDial.resetForLanguage`.
  - Delete the files listed above and fix their imports.
- [ ] **Step 4:** Run `npm run lint && npm run typecheck && npm test && CI=1 npx playwright test`. Expected: all pass. Specs not yet updated (panel, search, share, a11y) are updated in their own tasks. Mark them `test.fixme` here only if they fail purely from removed selectors, and list each one in the report.
- [ ] **Step 5:** Commit: `feat(ui): tuner layout replaces play bar and pickers`.

### Task 9: Frequency intro

**Files:**
- Create: `lib/intro/progress.ts`, `components/Intro.tsx`
- Modify: `components/Player.tsx` (mount the intro)
- Test: `tests/unit/intro-progress.test.ts`, `tests/e2e/intro.spec.ts`

**Interfaces:**
- **Consumes:**
  - `useDial.firstBandReady`
  - `document.fonts.ready`
  - a `visualizer-first-frame` window event dispatched by Task 3's scene. Add the dispatch here if it's missing.
  - `tunerApi.glideTo(firstStationId, { fromOffset: -700, prime: true })`
- **Produces:**
  - `introTarget(m: { fonts: boolean; band: boolean; frame: boolean }): number` → 0, 0.2, 0.7 or 1.
  - `stepIntro(shown: number, target: number, elapsedMs: number, dtMs: number): number`
    - Eases `shown` toward the target.
    - Never exceeds 0.99 before 1600 ms.
    - Is forced to 1 at 6000 ms or later.
    - Is monotonic.

- [ ] **Step 1: Write failing unit tests.**
  - `stepIntro` never decreases.
  - With every milestone done at t=0, it stays at or below 0.99 until 1600 ms and reaches 1 shortly after.
  - **Review Focus 4:** with no milestone ever done, it reaches 1 at 6000 ms.
  - `introTarget` returns 0.2 / 0.7 / 1 for fonts / fonts+band / all.
- [ ] **Step 2: Write the failing e2e** `intro.spec.ts`, which uses full motion (override `reducedMotion: "no-preference"`):
  - The reading starts at `87.5` and ends at `108.0` with `MHz · signal locked`.
  - The intro layer is removed within 8 s.
  - The blob button's hint "Tap to play" is visible afterwards.
  - With `/api/stations*` returning 502, the intro still ends within 8 s.
  - With reduced motion, the intro is gone within 1 s and no `108.0` sweep is rendered.
- [ ] **Step 3:** Run both. Expected: FAIL.
- [ ] **Step 4:** Implement `Intro.tsx` per spec §5.
  - **Sequence:**
    1. Hold 350 ms at 108.0.
    2. Split over 0.85 s using `clip-path`.
    3. The page (`main`) scales from 1.08 to 1 and brightens over 1.1 s.
    4. Call `tunerApi.glideTo(first, { fromOffset: -700, prime: true })`. Autoplay is blocked, so the station is primed, not selected.
  - **When to show it:** only on the initial document load; it's skipped on client navigation (module-level flag).
- [ ] **Step 5:** Run both. Expected: PASS.
- [ ] **Step 6:** Commit: `feat(ui): frequency intro loader`.

### Task 10: Panels

**Files:**
- Modify: `components/StationPanel.tsx`, `components/AboutPanel.tsx`, `components/LoginDialog.tsx` (move the trigger only), `store/player.ts` (`PanelTab = "search" | "recent" | "saved"`)
- Update tests: `tests/e2e/panel.spec.ts`, `tests/e2e/search.spec.ts`

**Interfaces:**
- **Consumes:**
  - Task 8's header buttons call `openPanel("search")` and `openPanel("saved")`; INFO opens About.
  - Task 6's Tuner glides when `current` changes.
- **Produces:** the panel tabs Search, Recent and Saved. The Saved tab footer has Log in or Log out.

- [ ] **Step 1: Update the e2e specs** (failing first).
  - SEARCH opens the panel with the Search tab selected and focuses the search input.
  - SAVED opens the Saved tab, with Recent as a second tab. Log in is in the Saved tab, and Log out when logged in (mocked user via `useAuth.setState` in a test hook).
  - Picking a search result that is also on the dial puts the needle on it, so the slider's `aria-valuetext` changes. Picking one that isn't on the dial shows the off-dial band with an empty label.
  - INFO shows About text that mentions "tuner".
- [ ] **Step 2:** Run `CI=1 npx playwright test tests/e2e/panel.spec.ts tests/e2e/search.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - Remove the genre list from the old Browse tab; it becomes Search with SearchBar and the country filter.
  - Keep v3's focus trap and focus return.
  - Rewrite the About copy so it describes the tuner and the blob (plain sentences, no em-dashes).
- [ ] **Step 4:** Run the specs and `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(ui): search/saved/info panels for the tuner layout`.

### Task 11: Share page on the tuner

**Files:**
- Modify: `components/Player.tsx` (pass `offDial` for a primed `initialStation`), `components/Tuner.tsx` (accept `offDial`)
- Update test: `tests/e2e/share.spec.ts`

**Interfaces:**
- **Consumes:** Task 4's `buildLayout(bands, offDial)` and Task 9's intro.

- [ ] **Step 1: Update `share.spec.ts`** (failing first). `/s/<known-id>` shows the station in the readout after the intro, with the blob hint "Tap to play".
  - If the station's genre band is loaded and contains it, the needle sits on it.
  - Otherwise the band label `Shared` is visible.
  - `/s/unknown` still shows "Station not found".
- [ ] **Step 2:** Run `CI=1 npx playwright test tests/e2e/share.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. After the intro, tune to the shared station rather than the first dial station.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(share): shared station on the dial`.

### Task 12: Error and empty states

**Files:**
- Modify: `components/Readout.tsx`, `components/Player.tsx`
- Test: `tests/e2e/errors.spec.ts`

- [ ] **Step 1: Write the failing e2e.**
  - **Review Focus 4:** with `/api/stations*` returning 502, after the intro every visible band shows "Couldn't load", and the readout shows a Retry button. Clicking Retry calls `retryAll` and re-requests.
  - With every stream failing (the stream route returns 404), after 5 failures the readout shows "Couldn't play any station here — tune somewhere else".
- [ ] **Step 2:** Run `CI=1 npx playwright test tests/e2e/errors.spec.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement, using Readout's `message` and `onRetry` slot from Task 7.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(ui): tuner error and empty states`.

### Task 13: Accessibility pass, README and screenshots

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`, `README.md`, `docs/screenshot.png`

- [ ] **Step 1: Update `a11y.spec.ts`** (failing first).
  - axe passes at 1280 px and 390 px, both with a panel open and closed.
  - Tab order: wordmark is skipped, then the language switch, SEARCH, SAVED, INFO, the blob button, heart, share, shuffle, and the dial.
  - Each stop has the accent focus ring.
  - Remove any `test.fixme` left from Task 8.
- [ ] **Step 2:** Run it. Expected: FAIL. Fix the violations it finds, then run it again. Expected: PASS.
- [ ] **Step 3:** Update the README.
  - Replace the play-bar description with a "How it works" for the dial (lazy bands, decorative frequencies), the chrome blob (analysis and shader), tuning static, and the intro.
  - Regenerate `docs/screenshot.png` at 1440×900 with mocked APIs, after the intro.
- [ ] **Step 4:** Run `npm run lint && npm run typecheck && npm test && CI=1 npx playwright test && npm run build`. Expected: all pass.
- [ ] **Step 5:** Commit: `docs: README and a11y for the tuner layout`.
- [ ] **Step 6:** Report the manual checks for the user: shader frame rate on a real phone, how the tuning static sounds, and the iOS lock-screen check carried over from v3.
