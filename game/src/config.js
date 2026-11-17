// Every tuning number and colour for Void Harvest in one place. The arena is a fixed
// 1280x720 logical field; the renderer scales it to the window, so no rule below
// depends on the player's screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 330,
  hp: 100,
  fireInterval: 0.16,
  bulletSpeed: 780,
  bulletDamage: 1,
  dashSpeed: 1150,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnerableAfterHit: 0.9,
};

export const BULLET = { radius: 4, life: 0.9 };
export const ENEMY_BULLET = { radius: 5, speed: 265, life: 4.2, damage: 9 };

/** The four hunter kinds. hp is in player-bullet hits; score is paid on death, before combo.
 *  The lancer is the odd one out: it stalks at range, flashes a telegraph line while it
 *  aims, then charges in a straight line far faster than anything else on the field. */
export const HUNTERS = {
  mite: { radius: 13, hp: 1, speed: 148, damage: 10, score: 10, turn: 3.4 },
  weaver: { radius: 16, hp: 3, speed: 104, damage: 12, score: 25, turn: 2.2, fireInterval: 2.3, weaveAmp: 150, weaveFreq: 2.1 },
  bulwark: { radius: 30, hp: 10, speed: 52, damage: 20, score: 60, turn: 1.1, mitesOnDeath: 3 },
  lancer: {
    radius: 15, hp: 2, speed: 118, damage: 14, score: 35, turn: 2.6,
    stalkRange: 460, telegraphTime: 0.65, chargeSpeed: 660, chargeTime: 0.55, recoverTime: 0.9,
  },
};

export const BOSS = {
  name: 'THE HOLLOW SUN',
  radius: 64,
  hp: 90,
  speed: 34,
  score: 500,
  everyWaves: 5,
  radialInterval: 1.5,
  radialCount: 14,
  aimedInterval: 0.85,
  aimedBurst: 3,
  summonInterval: 6.5,
  /** Below this share of its hull the Sun opens its second pattern: twin spiral arms
   *  that sweep the arena while the radial bursts keep time at a slower beat. */
  spiralBelow: 0.6,
  spiralTick: 0.085,
  spiralStep: 0.42,
};

/** Wave n asks for base + perWave*(n-1) hunters, spawned in a trickle, capped alive at once. */
export const WAVES = { base: 6, perWave: 3, spawnInterval: 0.85, maxAlive: 26, restTime: 2.6 };

export const PICKUPS = {
  core: { radius: 9, score: 15, life: 9 },
  repair: { radius: 11, heal: 26, life: 10, chance: 0.055 },
  overdrive: { radius: 11, duration: 8, fireInterval: 0.07, life: 10, chance: 0.035 },
  /** Scatter: for its duration every shot is a three-bolt fan. */
  scatter: { radius: 11, duration: 8, spread: 0.17, life: 10, chance: 0.03 },
  magnetTime: 0.55,
};

/** Combo: each kill adds one link; a link is worth this much bonus score, and the chain
 *  breaks when the player is hurt or lets the timer run out. */
export const COMBO = { window: 4.0, perLink: 2, maxMultiplier: 8 };

export const PALETTE = {
  space: '#070a14',
  nebulaA: '#131c3a',
  nebulaB: '#241239',
  grid: '#1a2340',
  player: '#57f7d6',
  playerCore: '#eafffb',
  bullet: '#a8fff0',
  enemyBullet: '#ff7a5c',
  mite: '#ffb454',
  weaver: '#c792ff',
  bulwark: '#ff5c7a',
  lancer: '#b6ff5e',
  boss: '#ffd75c',
  bossCore: '#fff3c4',
  core: '#ffe066',
  repair: '#6dffa8',
  overdrive: '#6dc4ff',
  scatter: '#ff8ae2',
  text: '#eef4ff',
  muted: '#8b9bbd',
  danger: '#ff5c7a',
  panel: 'rgba(10, 15, 30, 0.72)',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'void-harvest.best';
