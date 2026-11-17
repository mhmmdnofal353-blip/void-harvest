// The simulation: one run of Void Harvest. Everything moves in fixed steps of
// config.STEP seconds and collides as circles. The world knows nothing about the
// canvas; render.js draws what it finds here, and main.js feeds it input and sound.

import {
  FIELD, PLAYER, BULLET, ENEMY_BULLET, HUNTERS, BOSS, WAVES, PICKUPS, COMBO,
} from './config.js';
import { makeRandom, range, edgePoint } from './random.js';

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d * t;
}

export class World {
  constructor() {
    this.rng = makeRandom((Math.random() * 0xffffffff) >>> 0);
    this.mode = 'title'; // 'title' | 'playing' | 'over'
    this.time = 0;
    this.reset();
  }

  reset() {
    this.player = {
      x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0,
      hp: PLAYER.hp, angle: -Math.PI / 2, fireT: 0, dashT: 0, dashCd: 0,
      invulnT: 0, overdriveT: 0, scatterT: 0, alive: true, thrust: 0,
    };
    this.bullets = [];
    this.ebullets = [];
    this.enemies = [];
    this.particles = [];
    this.pickups = [];
    this.texts = [];
    this.score = 0;
    this.comboLinks = 0;
    this.comboT = 0;
    this.wave = 0;
    this.toSpawn = 0;
    this.spawnT = 0;
    this.restT = 1.2;
    this.boss = null;
    this.shake = 0;
    this.flash = 0;
    this.hurtFlash = 0;
    this.waveBanner = '';
    this.waveBannerT = 0;
    this.kills = 0;
  }

  startRun() {
    this.reset();
    this.mode = 'playing';
  }

  multiplier() {
    return 1 + Math.min(COMBO.maxMultiplier - 1, Math.floor(this.comboLinks / 6));
  }

  // ---- spawning -----------------------------------------------------------

  _spawnEnemy(kind, x, y) {
    const spec = HUNTERS[kind];
    const e = {
      kind, x, y, vx: 0, vy: 0, hp: spec.hp, maxHp: spec.hp,
      radius: spec.radius, angle: this.rng() * TAU, fireT: range(this.rng, 0.8, 1.6),
      weavePhase: this.rng() * TAU, hitT: 0, age: 0,
      // Lancer charge state machine: stalk -> telegraph -> charge -> recover.
      state: 'stalk', stateT: range(this.rng, 0.5, 1.4), chargeDx: 0, chargeDy: 0, aimAngle: 0,
    };
    this.enemies.push(e);
    return e;
  }

  _spawnBoss() {
    const e = {
      kind: 'boss', x: FIELD.width / 2, y: -BOSS.radius - 10, vx: 0, vy: 0,
      hp: BOSS.hp, maxHp: BOSS.hp, radius: BOSS.radius, angle: 0,
      fireT: 1.2, aimedT: 1.8, summonT: 4, spiralT: 0, spiralAngle: 0,
      hitT: 0, age: 0, entered: false,
    };
    this.enemies.push(e);
    this.boss = e;
    return e;
  }

  _beginWave(sound) {
    this.wave++;
    if (this.wave % BOSS.everyWaves === 0) {
      this._spawnBoss();
      this.toSpawn = 4; // a light escort trickle beside the boss
      this.waveBanner = `WAVE ${this.wave} — ${BOSS.name}`;
      if (sound) sound.bossAlarm();
    } else {
      this.toSpawn = WAVES.base + WAVES.perWave * (this.wave - 1);
      this.waveBanner = `WAVE ${this.wave}`;
      if (sound) sound.waveClear();
    }
    this.waveBannerT = 2.2;
    this.spawnT = 0.4;
  }

  _pickKind() {
    const r = this.rng();
    const weaverShare = this.wave >= 2 ? Math.min(0.32, 0.12 + this.wave * 0.02) : 0;
    const bulwarkShare = this.wave >= 3 ? Math.min(0.2, 0.05 + this.wave * 0.012) : 0;
    const lancerShare = this.wave >= 4 ? Math.min(0.16, 0.04 + this.wave * 0.01) : 0;
    if (r < bulwarkShare) return 'bulwark';
    if (r < bulwarkShare + lancerShare) return 'lancer';
    if (r < bulwarkShare + lancerShare + weaverShare) return 'weaver';
    return 'mite';
  }

  // ---- effects --------------------------------------------------------------

  _burst(x, y, color, n, speed, life = 0.5, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * TAU;
      const s = range(this.rng, speed * 0.25, speed);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: range(this.rng, life * 0.4, life), maxLife: life,
        size: range(this.rng, size * 0.5, size * 1.4), color, drag: 3.2,
      });
    }
  }

  _text(x, y, str, color) {
    this.texts.push({ x, y, str, color, life: 0.9, maxLife: 0.9 });
  }

  _dropPickups(x, y) {
    this.pickups.push({ kind: 'core', x, y, vx: range(this.rng, -40, 40), vy: range(this.rng, -40, 40), age: 0 });
    const roll = this.rng();
    if (roll < PICKUPS.repair.chance) {
      this.pickups.push({ kind: 'repair', x, y, vx: range(this.rng, -30, 30), vy: range(this.rng, -30, 30), age: 0 });
    } else if (roll < PICKUPS.repair.chance + PICKUPS.overdrive.chance) {
      this.pickups.push({ kind: 'overdrive', x, y, vx: range(this.rng, -30, 30), vy: range(this.rng, -30, 30), age: 0 });
    } else if (roll < PICKUPS.repair.chance + PICKUPS.overdrive.chance + PICKUPS.scatter.chance) {
      this.pickups.push({ kind: 'scatter', x, y, vx: range(this.rng, -30, 30), vy: range(this.rng, -30, 30), age: 0 });
    }
  }

  // ---- combat -----------------------------------------------------------------

  _killEnemy(e, sound) {
    const spec = e.kind === 'boss' ? BOSS : HUNTERS[e.kind];
    this.kills++;
    this.comboLinks++;
    this.comboT = COMBO.window;
    const gained = spec.score * this.multiplier() + this.comboLinks * COMBO.perLink;
    this.score += gained;
    this._text(e.x, e.y - e.radius, `+${gained}`, '#ffe066');
    this._burst(e.x, e.y, e.kind === 'mite' ? '#ffb454' : e.kind === 'weaver' ? '#c792ff' : e.kind === 'lancer' ? '#b6ff5e' : e.kind === 'boss' ? '#ffd75c' : '#ff5c7a',
      e.kind === 'boss' ? 90 : e.kind === 'bulwark' ? 34 : 16, e.kind === 'boss' ? 460 : 320, 0.7, 4);
    this.shake = Math.min(14, this.shake + (e.kind === 'boss' ? 14 : e.kind === 'bulwark' ? 7 : 3));
    if (sound) sound.explosion(e.kind === 'boss' || e.kind === 'bulwark');
    if (e.kind === 'bulwark') {
      for (let i = 0; i < HUNTERS.bulwark.mitesOnDeath; i++) {
        const m = this._spawnEnemy('mite', e.x + range(this.rng, -18, 18), e.y + range(this.rng, -18, 18));
        const a = this.rng() * TAU;
        m.vx = Math.cos(a) * 190;
        m.vy = Math.sin(a) * 190;
      }
    }
    if (e.kind === 'boss') {
      this.boss = null;
      this.flash = 0.55;
      for (let i = 0; i < 6; i++) this._dropPickups(e.x + range(this.rng, -50, 50), e.y + range(this.rng, -50, 50));
    } else {
      this._dropPickups(e.x, e.y);
    }
    e.hp = 0;
    e.dead = true;
  }

  _hurtPlayer(damage, sound) {
    const p = this.player;
    if (p.invulnT > 0 || p.dashT > 0 || !p.alive) return;
    p.hp -= damage;
    p.invulnT = PLAYER.invulnerableAfterHit;
    this.comboLinks = 0;
    this.comboT = 0;
    this.shake = Math.min(16, this.shake + 8);
    this.hurtFlash = 0.55;
    this._burst(p.x, p.y, '#ff5c7a', 18, 300, 0.5, 3.5);
    if (sound) sound.playerHurt();
    if (p.hp <= 0) {
      p.hp = 0;
      p.alive = false;
      this.mode = 'over';
      this._burst(p.x, p.y, '#57f7d6', 70, 430, 1.0, 4.5);
      if (sound) { sound.explosion(true); sound.gameOver(); }
    }
  }

  // ---- the step -----------------------------------------------------------------

  update(dt, input, sound) {
    this.time += dt;
    if (this.waveBannerT > 0) this.waveBannerT -= dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.8);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.5);
    this.shake = Math.max(0, this.shake - dt * 30);

    this._updateParticles(dt);
    this._updateTexts(dt);
    if (this.mode !== 'playing') return;

    const p = this.player;

    // Waves: rest between waves, then trickle the hunters in.
    const huntersAlive = this.enemies.length;
    if (this.toSpawn <= 0 && huntersAlive === 0 && !this.boss) {
      this.restT -= dt;
      if (this.restT <= 0) {
        this._beginWave(sound);
        this.restT = WAVES.restTime;
      }
    } else if (this.toSpawn > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && huntersAlive < WAVES.maxAlive) {
        const pt = edgePoint(this.rng, FIELD.width, FIELD.height);
        this._spawnEnemy(this._pickKind(), pt.x, pt.y);
        this.toSpawn--;
        this.spawnT = WAVES.spawnInterval * range(this.rng, 0.6, 1.3);
      }
    }

    this._updatePlayer(dt, input, sound);
    this._updateEnemies(dt, sound);
    this._updateBullets(dt, sound);
    this._updatePickups(dt, sound);

    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.comboLinks = 0;
    }

    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  _updatePlayer(dt, input, sound) {
    const p = this.player;
    if (!p.alive) return;
    const axes = input.axes();
    p.thrust = Math.min(1, Math.hypot(axes.x, axes.y));

    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.invulnT > 0) p.invulnT -= dt;
    if (p.overdriveT > 0) p.overdriveT -= dt;
    if (p.scatterT > 0) p.scatterT -= dt;

    // Dash: a short burst in the movement direction (or the aim, standing still).
    if ((input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight') || input.wasPressed('Space')) && p.dashCd <= 0 && p.dashT <= 0) {
      let dx = axes.x;
      let dy = axes.y;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(p.angle);
        dy = Math.sin(p.angle);
      }
      const len = Math.hypot(dx, dy) || 1;
      p.dashDx = dx / len;
      p.dashDy = dy / len;
      p.dashT = PLAYER.dashTime;
      p.dashCd = PLAYER.dashCooldown;
      if (sound) sound.dash();
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDx * PLAYER.dashSpeed;
      p.vy = p.dashDy * PLAYER.dashSpeed;
      this.particles.push({
        x: p.x, y: p.y, vx: -p.dashDx * 60, vy: -p.dashDy * 60,
        life: 0.3, maxLife: 0.3, size: 5, color: '#57f7d6', drag: 2,
      });
    } else {
      const accel = 2600;
      p.vx += axes.x * accel * dt;
      p.vy += axes.y * accel * dt;
      const damp = Math.exp(-6.5 * dt);
      if (axes.x === 0) p.vx *= damp;
      if (axes.y === 0) p.vy *= damp;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > PLAYER.speed) {
        p.vx = (p.vx / sp) * PLAYER.speed;
        p.vy = (p.vy / sp) * PLAYER.speed;
      }
    }

    p.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, p.x + p.vx * dt));
    p.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, p.y + p.vy * dt));
    p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);

    // Engine trail.
    if (p.thrust > 0.1 && this.rng() < 0.7) {
      this.particles.push({
        x: p.x - Math.cos(p.angle) * 12, y: p.y - Math.sin(p.angle) * 12,
        vx: -p.vx * 0.25 + range(this.rng, -24, 24), vy: -p.vy * 0.25 + range(this.rng, -24, 24),
        life: 0.34, maxLife: 0.34, size: 3.4, color: '#2ea8ff', drag: 2,
      });
    }

    // Fire toward the mouse while it is held. With SCATTER live, each shot is a
    // three-bolt fan; with OVERDRIVE, the fan (or the single bolt) comes faster.
    p.fireT -= dt;
    const interval = p.overdriveT > 0 ? PICKUPS.overdrive.fireInterval : PLAYER.fireInterval;
    if (input.mouse.down && p.fireT <= 0) {
      p.fireT = interval;
      const fan = p.scatterT > 0 ? [-PICKUPS.scatter.spread, 0, PICKUPS.scatter.spread] : [0];
      for (const off of fan) {
        const a = p.angle + off + range(this.rng, -0.03, 0.03);
        this.bullets.push({
          x: p.x + Math.cos(p.angle) * 18, y: p.y + Math.sin(p.angle) * 18,
          vx: Math.cos(a) * PLAYER.bulletSpeed, vy: Math.sin(a) * PLAYER.bulletSpeed,
          life: BULLET.life, radius: BULLET.radius,
        });
      }
      this._burst(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, '#a8fff0', 1, 60, 0.12, 2.4);
      if (sound) sound.shoot();
    }
  }

  _updateEnemies(dt, sound) {
    const p = this.player;
    for (const e of this.enemies) {
      e.age += dt;
      if (e.hitT > 0) e.hitT -= dt;
      const toPlayer = Math.atan2(p.y - e.y, p.x - e.x);

      if (e.kind === 'boss') this._updateBoss(e, dt, toPlayer);
      else if (e.kind === 'lancer') this._updateLancer(e, dt, toPlayer, sound);
      else {
        const spec = HUNTERS[e.kind];
        e.angle = angleLerp(e.angle, toPlayer, Math.min(1, spec.turn * dt));
        let mx = Math.cos(e.angle);
        let my = Math.sin(e.angle);
        if (e.kind === 'weaver') {
          const w = Math.sin(e.age * spec.weaveFreq + e.weavePhase) * spec.weaveAmp;
          mx += -Math.sin(e.angle) * (w / 160);
          my += Math.cos(e.angle) * (w / 160);
        }
        const sp = Math.hypot(e.vx, e.vy);
        const target = spec.speed;
        e.vx += (mx * target - e.vx) * Math.min(1, 2.4 * dt);
        e.vy += (my * target - e.vy) * Math.min(1, 2.4 * dt);
        if (e.kind === 'mite' && sp > target * 1.6) {
          e.vx *= 0.92;
          e.vy *= 0.92;
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        if (e.kind === 'weaver' && p.alive) {
          e.fireT -= dt;
          if (e.fireT <= 0 && dist2(e.x, e.y, p.x, p.y) < 560 * 560) {
            e.fireT = spec.fireInterval * range(this.rng, 0.85, 1.2);
            this.ebullets.push({
              x: e.x, y: e.y,
              vx: Math.cos(toPlayer) * ENEMY_BULLET.speed,
              vy: Math.sin(toPlayer) * ENEMY_BULLET.speed,
              life: ENEMY_BULLET.life, radius: ENEMY_BULLET.radius,
            });
          }
        }
      }

      // Contact with the player.
      if (p.alive && dist2(e.x, e.y, p.x, p.y) < (e.radius + PLAYER.radius) ** 2) {
        const dmg = e.kind === 'boss' ? 18 : HUNTERS[e.kind].damage;
        this._hurtPlayer(dmg, sound);
        if (e.kind === 'mite') this._killEnemy(e, sound);
        if (e.kind === 'lancer' && e.state === 'charge') {
          e.state = 'recover';
          e.stateT = HUNTERS.lancer.recoverTime;
        }
      }
    }
  }

  // The lancer's charge, in four beats. It stalks at mid-range until its timer runs
  // out, telegraphs — drifting slow while its aim settles on the player, so a quick
  // sideways dash beats it — then charges in a dead straight line, and drifts spent
  // while it recovers. Contact hurts like any hunter; a charge that misses is a gift.
  _updateLancer(e, dt, toPlayer, sound) {
    const spec = HUNTERS.lancer;
    const p = this.player;
    e.stateT -= dt;

    if (e.state === 'stalk') {
      e.angle = angleLerp(e.angle, toPlayer, Math.min(1, spec.turn * dt));
      const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
      // Close in until it holds its preferred range, then circle slowly.
      const radial = d > spec.stalkRange * 0.55 ? 1 : d < 170 ? -0.4 : 0.15;
      const mx = Math.cos(e.angle) * radial + -Math.sin(e.angle) * 0.35;
      const my = Math.sin(e.angle) * radial + Math.cos(e.angle) * 0.35;
      e.vx += (mx * spec.speed - e.vx) * Math.min(1, 2.6 * dt);
      e.vy += (my * spec.speed - e.vy) * Math.min(1, 2.6 * dt);
      if (e.stateT <= 0 && p.alive && d < spec.stalkRange) {
        e.state = 'telegraph';
        e.stateT = spec.telegraphTime;
        e.aimAngle = toPlayer;
        if (sound) sound.lancerWarn();
      }
    } else if (e.state === 'telegraph') {
      // Aim tracks the player early, then locks: the last stretch is committed.
      if (e.stateT > 0.22) e.aimAngle = angleLerp(e.aimAngle, toPlayer, Math.min(1, 5 * dt));
      e.angle = e.aimAngle;
      e.vx *= Math.exp(-6 * dt);
      e.vy *= Math.exp(-6 * dt);
      if (e.stateT <= 0) {
        e.state = 'charge';
        e.stateT = spec.chargeTime;
        e.chargeDx = Math.cos(e.aimAngle);
        e.chargeDy = Math.sin(e.aimAngle);
        if (sound) sound.lancerCharge();
      }
    } else if (e.state === 'charge') {
      e.vx = e.chargeDx * spec.chargeSpeed;
      e.vy = e.chargeDy * spec.chargeSpeed;
      e.angle = e.aimAngle;
      this.particles.push({
        x: e.x - e.chargeDx * 14, y: e.y - e.chargeDy * 14,
        vx: -e.chargeDx * 90 + range(this.rng, -30, 30), vy: -e.chargeDy * 90 + range(this.rng, -30, 30),
        life: 0.28, maxLife: 0.28, size: 4, color: '#b6ff5e', drag: 2,
      });
      if (e.stateT <= 0) {
        e.state = 'recover';
        e.stateT = spec.recoverTime;
      }
    } else { // recover
      e.vx *= Math.exp(-3.2 * dt);
      e.vy *= Math.exp(-3.2 * dt);
      e.angle = angleLerp(e.angle, toPlayer, Math.min(1, 1.6 * dt));
      if (e.stateT <= 0) {
        e.state = 'stalk';
        e.stateT = range(this.rng, 0.7, 1.6);
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    // A charge that hits the arena wall ends spent against it.
    if (e.state === 'charge' && (e.x < e.radius || e.x > FIELD.width - e.radius || e.y < e.radius || e.y > FIELD.height - e.radius)) {
      e.state = 'recover';
      e.stateT = spec.recoverTime;
      this._burst(e.x, e.y, '#b6ff5e', 8, 200, 0.35, 3);
    }
    e.x = Math.max(e.radius, Math.min(FIELD.width - e.radius, e.x));
    e.y = Math.max(e.radius, Math.min(FIELD.height - e.radius, e.y));
  }

  _updateBoss(e, dt, toPlayer) {
    if (!e.entered) {
      e.y += 65 * dt;
      if (e.y >= 132) e.entered = true;
      return;
    }
    // Hold a slow orbit at mid-range from the player.
    const want = Math.atan2(e.y - this.player.y, e.x - this.player.x) + 0.22 * dt;
    const dist = 300;
    const tx = this.player.x + Math.cos(want) * dist;
    const ty = Math.max(110, Math.min(FIELD.height - 110, this.player.y + Math.sin(want) * dist));
    e.x += Math.max(-BOSS.speed * dt, Math.min(BOSS.speed * dt, tx - e.x));
    e.y += Math.max(-BOSS.speed * dt, Math.min(BOSS.speed * dt, ty - e.y));
    e.angle += dt * 0.5;

    const enraged = e.hp < e.maxHp * 0.3;
    const rate = enraged ? 0.68 : 1;
    const spiralling = e.hp < e.maxHp * BOSS.spiralBelow;

    // Second pattern: twin spiral arms sweeping out of the Sun. While they turn, the
    // radial bursts slow to half time, so the arena stays survivable — the gaps in
    // the spiral are the way through.
    if (spiralling) {
      e.spiralT -= dt;
      if (e.spiralT <= 0) {
        e.spiralT = BOSS.spiralTick;
        e.spiralAngle += BOSS.spiralStep;
        for (const arm of [0, Math.PI]) {
          const a = e.spiralAngle + arm;
          this.ebullets.push({
            x: e.x + Math.cos(a) * e.radius * 0.7, y: e.y + Math.sin(a) * e.radius * 0.7,
            vx: Math.cos(a) * ENEMY_BULLET.speed * 0.92, vy: Math.sin(a) * ENEMY_BULLET.speed * 0.92,
            life: ENEMY_BULLET.life, radius: ENEMY_BULLET.radius,
          });
        }
      }
    }

    e.fireT -= dt;
    if (e.fireT <= 0) {
      e.fireT = BOSS.radialInterval * rate * (spiralling ? 1.9 : 1);
      const off = this.rng() * TAU;
      for (let i = 0; i < BOSS.radialCount; i++) {
        const a = off + (i / BOSS.radialCount) * TAU;
        this.ebullets.push({
          x: e.x, y: e.y, vx: Math.cos(a) * ENEMY_BULLET.speed * 0.8, vy: Math.sin(a) * ENEMY_BULLET.speed * 0.8,
          life: ENEMY_BULLET.life, radius: ENEMY_BULLET.radius,
        });
      }
    }
    e.aimedT -= dt;
    if (e.aimedT <= 0 && this.player.alive) {
      e.aimedT = BOSS.aimedInterval * rate;
      for (let i = 0; i < BOSS.aimedBurst; i++) {
        const a = toPlayer + (i - (BOSS.aimedBurst - 1) / 2) * 0.13;
        this.ebullets.push({
          x: e.x, y: e.y, vx: Math.cos(a) * ENEMY_BULLET.speed * 1.15, vy: Math.sin(a) * ENEMY_BULLET.speed * 1.15,
          life: ENEMY_BULLET.life, radius: ENEMY_BULLET.radius,
        });
      }
    }
    e.summonT -= dt;
    if (e.summonT <= 0) {
      e.summonT = BOSS.summonInterval;
      for (let i = 0; i < 2; i++) {
        this._spawnEnemy('mite', e.x + range(this.rng, -70, 70), e.y + range(this.rng, -70, 70));
      }
    }
  }

  _updateBullets(dt, sound) {
    const p = this.player;
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (e.radius + b.radius) ** 2) {
          b.life = 0;
          e.hp -= PLAYER.bulletDamage;
          e.hitT = 0.08;
          this._burst(b.x, b.y, '#ffffff', 3, 170, 0.22, 2.2);
          if (e.hp <= 0) this._killEnemy(e, sound);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -30 && b.x < FIELD.width + 30 && b.y > -30 && b.y < FIELD.height + 30);

    for (const b of this.ebullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (p.alive && dist2(b.x, b.y, p.x, p.y) < (PLAYER.radius + b.radius) ** 2) {
        b.life = 0;
        this._hurtPlayer(ENEMY_BULLET.damage, sound);
      }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0 && b.x > -40 && b.x < FIELD.width + 40 && b.y > -40 && b.y < FIELD.height + 40);
  }

  _updatePickups(dt, sound) {
    const p = this.player;
    for (const pk of this.pickups) {
      pk.age += dt;
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= Math.exp(-3 * dt);
      pk.vy *= Math.exp(-3 * dt);
      if (!p.alive) continue;
      const d2 = dist2(pk.x, pk.y, p.x, p.y);
      if (d2 < 110 * 110) {
        const d = Math.sqrt(d2) || 1;
        const pull = 620 * dt;
        pk.x += ((p.x - pk.x) / d) * pull;
        pk.y += ((p.y - pk.y) / d) * pull;
      }
      const spec = PICKUPS[pk.kind];
      if (d2 < (PLAYER.radius + spec.radius + 6) ** 2) {
        pk.taken = true;
        if (pk.kind === 'core') {
          this.score += PICKUPS.core.score * this.multiplier();
          if (sound) sound.pickup();
        } else if (pk.kind === 'repair') {
          p.hp = Math.min(PLAYER.hp, p.hp + PICKUPS.repair.heal);
          this._text(p.x, p.y - 26, `+${PICKUPS.repair.heal} HULL`, '#6dffa8');
          if (sound) sound.powerup();
        } else if (pk.kind === 'overdrive') {
          p.overdriveT = PICKUPS.overdrive.duration;
          this._text(p.x, p.y - 26, 'OVERDRIVE', '#6dc4ff');
          if (sound) sound.powerup();
        } else if (pk.kind === 'scatter') {
          p.scatterT = PICKUPS.scatter.duration;
          this._text(p.x, p.y - 26, 'SCATTER GUN', '#ff8ae2');
          if (sound) sound.powerup();
        }
        this._burst(pk.x, pk.y, pk.kind === 'core' ? '#ffe066' : pk.kind === 'repair' ? '#6dffa8' : pk.kind === 'scatter' ? '#ff8ae2' : '#6dc4ff', 8, 190, 0.35, 2.6);
      }
    }
    this.pickups = this.pickups.filter((pk) => !pk.taken && pk.age < PICKUPS[pk.kind].life);
  }

  _updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const damp = Math.exp(-pt.drag * dt);
      pt.vx *= damp;
      pt.vy *= damp;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  _updateTexts(dt) {
    for (const t of this.texts) {
      t.y -= 44 * dt;
      t.life -= dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
  }
}
