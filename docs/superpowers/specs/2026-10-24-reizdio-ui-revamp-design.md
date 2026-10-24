# REIZDIO UI Revamp — Design

**Date:** 2026-10-24
**Branch:** `ui-revamp` (from `v3`; PR #1 is the v3 rebuild this builds on)
**Goal:** Replace v3's interface with an immersive, "Awwwards-style" single screen, keeping the v3 data, audio, library, sharing and test foundations. It consists of:
- a Frequency intro loader
- a radio tuner dial for finding stations
- a liquid chrome blob that reacts to the music
- the station name set huge behind the blob

## Decisions

These come from the 2026-10-24 brainstorming and prototypes.

| Topic | Decision |
|---|---|
| Logo | Keep the original REIZDIO wordmark (PP Neue Montreal Bold). Three new-logo rounds were rejected; no logo work in this project. |
| Identity | Unchanged: black `hsl(0 0% 3.9%)`, white `hsl(0 0% 98%)`, muted `hsl(0 0% 63.9%)`, accent red `#ee2647`, PP Neue Montreal. |
| Intro | The **Frequency** loader. |
| Browsing | A horizontal **tuner dial**. Genres are labelled bands; each station is a tick; a fixed red needle marks the tuned station. |
| Language | A small header switch, default **Any**. |
| Visualizer | The **liquid chrome blob**, accepted "for now, adjust later". Kinetic type, terrain, vinyl and scope were considered and declined. |
| Rejected | The static-noise intro ("too much"); the needle/drop, serif, condensed and cut logo concepts. |

**Reference prototypes** (private claude.ai artifacts). The look and motion should match these; they are not code to copy as-is.

| Prototype | Artifact | Shows |
|---|---|---|
| Tuner layout and motion | `9CcCGecgvtkWMnveNPNU3w` | Layout, header, readout, dial behaviour. Ignore its static intro. |
| Chrome blob | `DqEhnVQeSRYYLE8PRnmdK3` | Shader, spectrum mapping, kick shockwave, level control. |
| Intro lab | `3sxK3nueELQcHoCSoNWuCx` | The "Frequency" tab. |

## 1. Screen layout

A single full-height stage with no page scroll. Rows, top to bottom:

1. **Header.**
   - Left: the REIZDIO wordmark.
   - Right: `LANG · ANY ▾` (just `ANY ▾` under 760 px), then `SEARCH`, `SAVED`, `INFO`, all as uppercase text buttons.
   - Log in / Log out moves into the Saved panel.
2. **Centre.**
   - The chrome blob, square, `min(70vw, 360px)`, centred.
   - Behind it, the current station name in huge outlined uppercase type: transparent fill, 1 px stroke `hsl(0 0% 28%)`, `clamp(56px, 13vw, 168px)`. Names longer than 14 characters drop to `clamp(40px, 9vw, 120px)`. The name may run off both screen edges.
   - The blob is the play/pause button. A "Tap to play" hint shows whenever the stream is not playing.
3. **Readout.**
   - Line 1: the red frequency, then genre and country code, e.g. `98.3 · HOUSE · NL`.
   - Line 2: the station name, truncated with an ellipsis.
   - Right side: heart (save) and share buttons, 44 px each.
   - A small "Surprise me" shuffle icon button sits beside them. It glides the dial to a random loaded station.
4. **Tuner dial.** Full width, 112 px tall (124 px at ≥ 760 px), with edge fades and the fixed red needle in the centre.

**What happens to existing parts:**

| Part | What happens |
|---|---|
| `PlayBar`, `CompactPlayBar`, `StationMarquee`, `LiveClock`, `ChipRow`, `ScrollSelect`, `SurpriseButton` UI | Removed. Their behaviour moves into the readout and the dial. |
| `StationPanel`, `AboutPanel`, `LoginDialog`, `Toast` | Kept and restyled. |
| Desktop and phone layouts | One layout; it works from 360 px up. |

## 2. Tuner dial

### Model: `lib/dial/layout.ts`

This is pure and unit-tested.

- **Input:** an ordered list of bands, `{ genre, label, stations: Station[] | null }`. `null` means "not loaded yet".
- **Positions:**
  - Each band reserves `DIAL_SLOTS = 12` slots: the top 12 playable stations by votes.
  - An unloaded band draws as a faint labelled stretch with placeholder ticks, so the dial doesn't jump when its stations arrive.
  - Station ticks sit every `STATION_GAP = 72 px`, with `BAND_GAP = 60 px` between bands.
- **Frequency:** decorative. Slots, not stations, are mapped evenly across 87.5–108.0 over the whole dial and shown with one decimal. Because slots are fixed, the number doesn't change when bands load; a station keeps its number for a given language. A band with fewer than 12 stations leaves its spare slots as plain minor ticks.
- **Helpers:**
  - `nearestStation(offset)`
  - `positionOf(stationId)`
  - `bandAt(offset)`
  - `frequencyOf(stationId)`

### Band order and loading

- Band order follows `lib/catalog.ts` `genres`.
- When the needle enters a band, it and its two neighbours are fetched through the existing `/api/stations?genre=&language=` route. The route already caches for an hour and verifies streams.
- At most 3 band requests run at once.
- A band that comes back empty shows "No stations" in place of its ticks, and the dial skips it when snapping.
- A band whose request fails shows "Couldn't load" and retries when the needle next enters it.

### Interaction (`components/Tuner.tsx`)

- **Drag:** pointer drag with momentum. Release → glide to the nearest station.
- **Wheel:** horizontal or vertical wheel scrolls the dial; it snaps 140 ms after the last wheel event.
- **Keyboard:**
  - ← / → move one station; Home / End go to the first / last station.
  - PageUp / PageDown jump to the previous / next band.
  - The dial is `role="slider"` with `aria-valuetext="<station>, <genre>"`.
- **Tuned:** a station is "tuned" when the glide settles. Settling calls the existing `usePlayer.select(station)` and sets the queue to the stations visible on the dial in order, so next/prev and Media Session follow the dial.
- **Visual states:**
  - The nearest tick grows to 40 px and turns white.
  - The active band's label and rule light up.
  - On settle, the needle "locks" with a 0.5 s red glow pulse.

### Store

Add `tuning: boolean` and `setTuning(on)` to `store/player.ts`:
- `true` from drag, wheel or key start until the glide settles;
- `true` during the intro sweep (§5).

**Language switch:** changing language clears loaded bands, keeps the needle in the same band, and reloads that band and its neighbours.

## 3. Chrome blob visualizer

Replace the icosahedron shader in `visualizer/` with the prototype's raymarched liquid chrome:
- still rendered through three.js;
- a full-screen `ShaderMaterial` quad on an alpha-transparent canvas.

### `visualizer/analysis.ts` (pure, unit-tested)

Replaces `bands.ts`:
- **Spectrum:** 32 log-spaced bands, 30 Hz–16 kHz, from the analyser's byte frequency data.
- **Treble lift:** ×(1 + 0.8·b/32).
- **Automatic level control:**
  - `peak = max(frameMax, peak·e^(−0.4·dt), 0.15)`;
  - `v = ((raw/peak − 0.18)/0.82)^1.6`;
  - attack 0.6, release 0.16.
- **Levels:**
  - `bass` = bands 0–5
  - `mid` = 8–19
  - `treb` = 22–31
  - `snare` = an envelope that triggers when bands 18–23 average above 0.45.
- **Kick detection:** bass rises by more than 0.12 in one frame, with at least 0.18 s since the last kick. The result is a random unit direction and an amplitude of `min(1, 1.4·bass)`.
- **Jelly squash spring:** stiffness 90, damping 9, impulse `2.4·amp`.
- **Flash:** decays by e^(−7·dt).

### Shader (`visualizer/shaders.ts`)

Ported from the chrome-blob prototype:
- the spectrum as a 32×1 luminance `DataTexture`, sampled by `n.y²` plus slow noise;
- noise lobes;
- the kick shockwave travelling from `kickDir`;
- the jelly squash;
- an iridescent film driven by mid and snare;
- a studio environment with a red and a blue light, plus a flash highlight;
- a `tune` uniform that greys the chrome and overlays animated grain.

### Behaviour

- **Tuning:** while `tuning` is true, `tune` eases to 1 (rise rate 7/s); afterwards it eases back to 0 (fall rate 3.5/s). The spectrum is scaled by `1 − 0.7·tune`; kicks, squash and flash are multiplied by `1 − tune`.
- **Paused / idle:** a calm breathing spectrum, the same as the prototype's silent preview.
- **No analyser:** for example while waiting for the first play. Same breathing.

### Performance

- Pixel ratio capped at 1.5 on coarse pointers, 2 otherwise.
- 64 raymarch steps on coarse pointers, 90 otherwise.
- Rendering pauses while the tab is hidden.
- Reduced motion: amplitudes ×0.4 and no shockwave.
- If WebGL is unavailable, a static CSS radial-gradient disc is shown instead.

## 4. Tuning audio

`lib/audio/engine.ts` gains `setTuning(on: boolean)`:
- A looping band-passed noise source (2.6 kHz, Q 0.4) feeds a `staticGain` node that goes into the analyser. It is created lazily on the first `load`, inside a user gesture.
- While tuning, the stream ducks to 8% and the static rises to 45%.
- Changes use `setTargetAtTime` with a 0.05 time constant.
- Static only sounds when the engine has been started by the user and isn't paused.
- On settle the new station loads, and the static fades out once the engine emits `playing`, or after 3 s, whichever comes first.

The visualizer reads the same analyser, so the blob's static look and the static sound always match.

## 5. Frequency intro

`components/Intro.tsx` is shown on first load of `/` and `/s/[id]` (not on client-side navigation).

**The loader:**
- A full-screen black layer.
- The reading counts up from `87.5` to `108.0` with the caption `MHz · tuning in`, which becomes `MHz · signal locked` at the end.
- A tick scale runs between labels 87.5, 98 and 108, with a red needle moving across it.

**Progress:**
- Real progress, mapped to the 87.5–108.0 sweep:
  - fonts loaded: 20%
  - first band loaded: 70%
  - the shader's first frame drawn: 100%
- It runs for at least 1.6 s and gives up at most 6 s after start; after that it finishes anyway.
- Between milestones it eases smoothly instead of jumping.

**Exit:**
1. Hold 350 ms at 108.0.
2. The screen splits open along the needle line: the top and bottom halves slide away by `clip-path` over 0.85 s, `cubic-bezier(.76,0,.24,1)`.
3. The page under it scales from 1.08 to 1 and brightens over 1.1 s.
4. The dial then glides from 700 px left of the first station to the first station, with `tuning` on. Settling locks the needle, rolls the frequency digits (8 random values at 38 ms intervals), and raises the big name letter by letter (32 ms stagger, 0.7 s each).

**Autoplay:** browsers block it, so after the intro the first station is primed (the existing `prime`). The blob hint reads "Tap to play" and the first tap starts audio.

**Other cases:**
- `prefers-reduced-motion`: the intro is a 0.4 s fade with no sweep or split.
- `/s/[id]`: the shared station is primed and the dial places its needle on that station's band if it's loaded. Otherwise a temporary "Shared" band is shown at the start of the dial.

## 6. Panels and secondary UI

- **SEARCH** opens the existing `StationPanel` on a Search tab: today's Browse tab with search and country filter, without the genre list, because the dial replaces it.
- **SAVED** opens the panel on Saved, with Recent as a second tab. The Saved tab also holds Log in / Log out.
- Picking from any panel tab primes or plays that station. If the station is on the dial, the needle glides to it; if not, it plays as an off-dial station, the needle shows over a blank stretch, and the band labels stay put.
- **INFO** opens the existing About content, updated to describe the tuner and blob.
- Panels keep v3's accessibility: a focus trap, Escape to close, focus returned to the button that opened them, and tabs.

## Error and empty states

| Situation | What the user sees |
|---|---|
| Radio Browser down | The intro still finishes at 6 s. The dial shows every band as "Couldn't load" with a Retry button in the readout. The blob breathes. |
| A station fails while playing | v3's `reportFailure` / `markFailed` rules apply. The needle glides to whichever station the store moves to, so the dial never shows a station that isn't playing. |
| All stations failed | The readout says "Couldn't play any station here — tune somewhere else". |

## Accessibility

- The dial is fully operable by keyboard, with screen-reader announcements.
- The blob button is labelled "Play" / "Pause".
- The big outlined name is `aria-hidden`; the readout carries the text.
- The `prefers-reduced-motion` rules above apply.
- The axe e2e must stay at zero serious or critical findings.
- The focus-ring rule carries over from v3.

## Testing

**Unit (Vitest):**
- `lib/dial/layout.ts`:
  - positions and frequency mapping;
  - unloaded / empty / error bands;
  - `nearestStation`, `bandAt`;
  - stable frequency per station.
- `visualizer/analysis.ts`:
  - level control converges;
  - kick detection fires once per kick with the refractory gap;
  - the spring settles;
  - band ranges are correct.
- Intro progress curve: minimum 1.6 s, maximum 6 s, monotonic.
- Store: `tuning` transitions.
- Engine `setTuning`: gain targets, and no static before the first user start.

**E2E (Playwright).** These replace the play-bar specs; same mocks, fixture server and tone:
- the intro runs and reveals the page;
- keyboard tuning plays the station and updates the readout and the big name;
- drag tuning settles on a station;
- the language switch reloads bands;
- the Search / Saved / Info panels;
- the share page primes its station;
- 360 px has no horizontal overflow;
- axe passes;
- reduced motion skips the sweep.

**Manual on a real phone:**
- the shader frame rate is acceptable;
- tuning static sounds right;
- the iOS lock-screen check from v3 still applies.

## Phases

Each phase is shippable on its own.

1. **Layout skeleton:** new header, centre, readout and dial frame wired to the current store. Old bars, chips and pickers removed. E2E specs moved to the new structure.
2. **Tuner dial:** layout model, lazy band loading, drag / wheel / keys, the queue follows the dial, and the language switch.
3. **Chrome blob:** analysis module, shader port, tuning look, performance limits and fallback.
4. **Tuning audio:** the engine's `setTuning` static.
5. **Readout and big name motion:** digit roll, letter rise and needle lock.
6. **Frequency intro.**
7. **Panels, share page and polish:** panel and share-page integration, accessibility pass, README and screenshots.

## Out of scope

- A new logo or name.
- Other visualizer modes.
- Changes to the radio API, verification, Supabase or the audio-engine contract beyond `setTuning`.
- Tuning the blob's look; the user accepted it as is and will ask for adjustments later.
