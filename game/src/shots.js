// Deterministic scenes for the entry's screenshots. Each scene builds a world with a
// seeded random generator, places its actors by hand, and steps the simulation a few
// fixed steps so trails and particles settle — the same seed always renders the same
// frame, which is what makes the screenshots reproducible by anyone who serves the game
// with the matching ?shot= query (see shots.json at the repository root).

import { World } from './world.js';
import { makeRandom } from './random.js';
import { FIELD } from './config.js';

const IDLE_INPUT = {
  axes: () => ({ x: 0, y: 0 }),
  mouse: { x: 900, y: 260, down: false },
  wasPressed: () => false,
};

function settle(world, steps, input = IDLE_INPUT) {
  for (let i = 0; i < steps; i++) world.update(1 / 60, input, null);
}

function fighter(world, kind, x, y) {
  const e = world._spawnEnemy(kind, x, y);
  e.age = 1.3;
  return e;
}

export function buildShotWorld(name, seed) {
  const world = new World();
  world.rng = makeRandom(seed * 7919 + 13);

  if (name === 'start') {
    world.mode = 'title';
    world.time = 1.4;
    return world;
  }

  world.mode = 'playing';
  world.wave = 3;
  world.restT = 999;
  const p = world.player;
  p.x = 430;
  p.y = 440;
  p.angle = Math.atan2(300 - p.y, 760 - p.x);

  if (name === 'play') {
    world.score = 1240;
    world.kills = 18;
    world.comboLinks = 14;
    world.comboT = 2.8;
    p.hp = 72;
    fighter(world, 'mite', 830, 250);
    fighter(world, 'mite', 900, 330);
    fighter(world, 'mite', 760, 180);
    fighter(world, 'weaver', 1010, 470);
    fighter(world, 'bulwark', 1080, 210);
    fighter(world, 'mite', 240, 180);
    world.pickups.push({ kind: 'core', x: 560, y: 380, vx: 0, vy: 0, age: 1 });
    world.pickups.push({ kind: 'core', x: 610, y: 420, vx: 0, vy: 0, age: 1 });
    world.pickups.push({ kind: 'repair', x: 300, y: 560, vx: 0, vy: 0, age: 1 });
    for (let i = 0; i < 5; i++) {
      world.bullets.push({ x: 470 + i * 52, y: 428 - i * 17, vx: 780, vy: -260, life: 0.8, radius: 4 });
    }
    world.ebullets.push({ x: 940, y: 440, vx: -190, vy: 60, life: 3, radius: 5 });
    world.ebullets.push({ x: 880, y: 520, vx: -210, vy: -30, life: 3, radius: 5 });
    world._burst(830, 250, '#ffb454', 10, 260, 0.6, 3.6);
    settle(world, 8);
    return world;
  }

  if (name === 'boss') {
    world.wave = 5;
    world.score = 8610;
    world.kills = 57;
    world.comboLinks = 22;
    world.comboT = 3.1;
    p.hp = 46;
    p.x = 520;
    p.y = 520;
    const boss = world._spawnBoss();
    boss.x = 830;
    boss.y = 240;
    boss.entered = true;
    boss.hp = 49;
    world.boss = boss;
    fighter(world, 'mite', 210, 200);
    fighter(world, 'mite', 1120, 560);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.4;
      world.ebullets.push({ x: 830 + Math.cos(a) * 120, y: 240 + Math.sin(a) * 120, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, life: 3.4, radius: 5 });
    }
    for (let i = 0; i < 4; i++) {
      world.bullets.push({ x: 545 + i * 46, y: 500 - i * 34, vx: 690, vy: -560, life: 0.8, radius: 4 });
    }
    world.pickups.push({ kind: 'overdrive', x: 340, y: 600, vx: 0, vy: 0, age: 1 });
    world.pickups.push({ kind: 'core', x: 700, y: 620, vx: 0, vy: 0, age: 1 });
    world._burst(790, 270, '#ffd75c', 14, 300, 0.7, 4);
    settle(world, 8);
    world.waveBanner = '';
    world.waveBannerT = 0;
    return world;
  }

  // 'end': the run is over; the panel tells the story.
  world.mode = 'over';
  world.wave = 7;
  world.score = 9340;
  world.kills = 63;
  world.player.alive = false;
  world._burst(FIELD.width / 2, FIELD.height / 2, '#57f7d6', 40, 380, 1.1, 4.2);
  settle(world, 20);
  world.time = 2.2;
  return world;
}
