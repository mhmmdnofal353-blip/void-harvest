// A small seeded random generator (mulberry32). The live game seeds it from the clock;
// the screenshot scenes seed it with a fixed number so every render of a scene is identical.

export function makeRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random float in [min, max). */
export function range(next, min, max) {
  return min + next() * (max - min);
}

/** Random point on the arena's edge, kept a little away from the corners. */
export function edgePoint(next, width, height) {
  const side = Math.floor(next() * 4);
  const m = 46;
  if (side === 0) return { x: range(next, m, width - m), y: -24 };
  if (side === 1) return { x: range(next, m, width - m), y: height + 24 };
  if (side === 2) return { x: -24, y: range(next, m, height - m) };
  return { x: width + 24, y: range(next, m, height - m) };
}
