/** Intro progress: real milestones mapped to 0..1 (the 87.5-108.0 MHz sweep), eased, bounded in time. */

export const MIN_MS = 1600;
export const MAX_MS = 6000;
/** Held below 1 until MIN_MS so the sweep never finishes instantly on a warm load. */
const CAP_BEFORE_MIN = 0.99;
/** Easing time constant, and the gap under which the shown value snaps onto the target. */
const TAU_MS = 320;
const SNAP = 0.01;
/** With no milestone at all the needle still creeps this far over MAX_MS, so it never looks frozen. */
const CREEP = 0.12;

export function introTarget(m: { fonts: boolean; band: boolean; frame: boolean }): number {
  if (m.fonts && m.band && m.frame) return 1;
  if (m.fonts && m.band) return 0.7;
  if (m.fonts) return 0.2;
  return 0;
}

/** Next shown value: eases toward `target`, never decreases, <= 0.99 before MIN_MS, exactly 1 from MAX_MS. */
export function stepIntro(shown: number, target: number, elapsedMs: number, dtMs: number): number {
  if (elapsedMs >= MAX_MS) return 1;
  const cap = elapsedMs < MIN_MS ? CAP_BEFORE_MIN : 1;
  const goal = Math.min(cap, Math.max(target, CREEP * (elapsedMs / MAX_MS)));
  if (goal <= shown) return shown;
  const eased = shown + (goal - shown) * (1 - Math.exp(-Math.max(0, dtMs) / TAU_MS));
  return goal - eased < SNAP ? goal : eased;
}
