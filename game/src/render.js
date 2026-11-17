// Everything the player sees, drawn on a 2D canvas in logical field coordinates.
// All art is vector shapes drawn here — the game ships no image files. Enemies are
// drawn as distinct silhouettes (dart, diamond, hexagon, sun) so a kind can be told
// at a glance in the middle of a fight.

import { FIELD, PLAYER, PALETTE, FONT, BOSS } from './config.js';
import { makeRandom } from './random.js';

// A fixed starfield, the same for every player: three depths for parallax drift.
const STARS = (() => {
  const next = makeRandom(20261115);
  const stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({ x: next() * FIELD.width, y: next() * FIELD.height, z: 0.25 + next() * 0.75, r: 0.6 + next() * 1.5 });
  }
  return stars;
})();

function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, frac, color, back = 'rgba(255,255,255,0.14)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
}

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  draw(world, view) {
    const { ctx } = this;
    ctx.save();
    if (world.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    }
    this._background(world.time);
    this._pickups(world);
    this._bullets(world);
    for (const e of world.enemies) this._enemy(e, world.time);
    if (world.player.alive || world.mode === 'title') this._player(world);
    this._particles(world);
    this._texts(world);
    ctx.restore();

    if (world.flash > 0) {
      ctx.fillStyle = `rgba(255, 240, 200, ${world.flash * 0.5})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    if (world.mode === 'playing') this._hud(world, view);
    if (world.mode === 'title') this._title(world, view);
    if (world.mode === 'over') this._gameOver(world, view);
    if (view.paused && world.mode === 'playing') this._paused();
  }

  _background(time) {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, FIELD.width, FIELD.height);
    g.addColorStop(0, PALETTE.nebulaA);
    g.addColorStop(0.55, PALETTE.space);
    g.addColorStop(1, PALETTE.nebulaB);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);

    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 80) { ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); }
    for (let y = 0; y <= FIELD.height; y += 80) { ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); }
    ctx.stroke();
    ctx.globalAlpha = 1;

    for (const s of STARS) {
      const tw = 0.55 + 0.45 * Math.sin(time * (0.6 + s.z) + s.x);
      ctx.globalAlpha = 0.35 + 0.5 * s.z * tw;
      ctx.fillStyle = '#cfe6ff';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  _player(world) {
    const { ctx } = this;
    const p = world.player;
    const x = world.mode === 'title' ? FIELD.width / 2 : p.x;
    const y = world.mode === 'title' ? 408 + Math.sin(world.time * 1.4) * 8 : p.y;
    const angle = world.mode === 'title' ? -Math.PI / 2 : p.angle;
    if (p.invulnT > 0 && world.mode === 'playing' && Math.floor(world.time * 14) % 2 === 0) return; // blink while untouchable

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Engine glow.
    const glow = ctx.createRadialGradient(-12, 0, 1, -12, 0, 20);
    glow.addColorStop(0, 'rgba(46,168,255,0.55)');
    glow.addColorStop(1, 'rgba(46,168,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-32, -20, 40, 40);
    // Hull: a swept dart.
    polygon(ctx, [[20, 0], [-8, -11], [-14, -5], [-11, 0], [-14, 5], [-8, 11]]);
    ctx.fillStyle = PALETTE.player;
    ctx.fill();
    ctx.strokeStyle = '#0b3d33';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3, 0, 4.6, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.playerCore;
    ctx.fill();
    ctx.restore();

    if (p.dashT > 0) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.translate(x - p.dashDx * 26, y - p.dashDy * 26);
      ctx.rotate(angle);
      polygon(ctx, [[20, 0], [-8, -11], [-14, 0], [-8, 11]]);
      ctx.fillStyle = PALETTE.player;
      ctx.fill();
      ctx.restore();
    }
  }

  _enemy(e, time) {
    const { ctx } = this;
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.hitT > 0;
    if (e.kind === 'mite') {
      ctx.rotate(e.angle + Math.PI / 2 + Math.sin(time * 6 + e.weavePhase) * 0.2);
      polygon(ctx, [[0, -14], [11, 10], [0, 5], [-11, 10]]);
      ctx.fillStyle = flash ? '#ffffff' : PALETTE.mite;
      ctx.fill();
    } else if (e.kind === 'weaver') {
      ctx.rotate(time * 1.8 + e.weavePhase);
      polygon(ctx, [[0, -17], [12, 0], [0, 17], [-12, 0]]);
      ctx.fillStyle = flash ? '#ffffff' : PALETTE.weaver;
      ctx.fill();
      ctx.rotate(-(time * 1.8 + e.weavePhase) + e.angle);
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#1d0f33';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ff7a5c';
      ctx.fill();
    } else if (e.kind === 'bulwark') {
      ctx.rotate(e.angle + Math.PI / 2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = flash ? '#ffffff' : PALETTE.bulwark;
      ctx.fill();
      ctx.strokeStyle = 'rgba(60,4,18,0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fill();
      ctx.restore();
      // Plating left, as an arc over the hull.
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.hp / e.maxHp));
      ctx.strokeStyle = '#ffd0da';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
      return;
    } else if (e.kind === 'boss') {
      const rot = e.angle;
      // Rotating rays.
      ctx.strokeStyle = flash ? '#ffffff' : PALETTE.boss;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = rot + (i / 12) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * (e.radius * 0.8), Math.sin(a) * (e.radius * 0.8));
        ctx.lineTo(Math.cos(a) * (e.radius * 1.22), Math.sin(a) * (e.radius * 1.22));
      }
      ctx.stroke();
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, e.radius);
      g.addColorStop(0, PALETTE.bossCore);
      g.addColorStop(0.6, flash ? '#ffffff' : PALETTE.boss);
      g.addColorStop(1, '#c78f1b');
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.82, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = e.hp < e.maxHp * 0.3 ? '#ff5c3a' : '#7a4d00';
      ctx.fill();
    }
    ctx.restore();
  }

  _bullets(world) {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.bullet;
    for (const b of world.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of world.ebullets) {
      const g = ctx.createRadialGradient(b.x, b.y, 0.5, b.x, b.y, b.radius * 2.1);
      g.addColorStop(0, '#ffd9cf');
      g.addColorStop(0.45, PALETTE.enemyBullet);
      g.addColorStop(1, 'rgba(255,122,92,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _pickups(world) {
    const { ctx } = this;
    for (const pk of world.pickups) {
      const pulse = 1 + Math.sin(world.time * 5 + pk.x) * 0.12;
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(pulse, pulse);
      if (pk.kind === 'core') {
        ctx.rotate(world.time * 2.4);
        polygon(ctx, [[0, -9], [6, 0], [0, 9], [-6, 0]]);
        ctx.fillStyle = PALETTE.core;
        ctx.fill();
      } else if (pk.kind === 'repair') {
        ctx.fillStyle = PALETTE.repair;
        ctx.fillRect(-3.4, -11, 6.8, 22);
        ctx.fillRect(-11, -3.4, 22, 6.8);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.strokeStyle = PALETTE.overdrive;
        ctx.lineWidth = 3;
        ctx.stroke();
        polygon(ctx, [[2.5, -7], [-3.5, 1.5], [0, 1.5], [-2, 7], [4.5, -1.5], [1, -1.5]]);
        ctx.fillStyle = PALETTE.overdrive;
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _particles(world) {
    const { ctx } = this;
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  _texts(world) {
    const { ctx } = this;
    ctx.font = `600 15px ${FONT}`;
    ctx.textAlign = 'center';
    for (const t of world.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  _hud(world, view) {
    const { ctx } = this;
    const p = world.player;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(String(world.score).padStart(6, '0'), 22, 38);
    ctx.font = `500 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(view.best, world.score)}`, 22, 58);

    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 19px ${FONT}`;
    ctx.fillText(`WAVE ${Math.max(1, world.wave)}`, FIELD.width / 2, 34);

    // Boss health, under the wave label.
    if (world.boss) {
      ctx.font = `600 12px ${FONT}`;
      ctx.fillStyle = PALETTE.boss;
      ctx.fillText(BOSS.name, FIELD.width / 2, 58);
      bar(ctx, FIELD.width / 2 - 170, 66, 340, 8, world.boss.hp / world.boss.maxHp, PALETTE.boss);
    }

    // Combo, top right.
    const mult = world.multiplier();
    ctx.textAlign = 'right';
    ctx.font = `700 21px ${FONT}`;
    ctx.fillStyle = world.comboLinks > 0 ? '#ffe066' : PALETTE.muted;
    ctx.fillText(`x${mult} COMBO`, FIELD.width - 22, 38);
    if (world.comboT > 0) {
      bar(ctx, FIELD.width - 162, 48, 140, 5, world.comboT / 4.0, '#ffe066');
    }
    ctx.font = `500 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`${world.kills} kills`, FIELD.width - 22, 72);

    // Hull, bottom left.
    ctx.textAlign = 'left';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('HULL', 22, FIELD.height - 34);
    bar(ctx, 22, FIELD.height - 28, 210, 11, p.hp / PLAYER.hp, p.hp > 30 ? '#6dffa8' : PALETTE.danger);

    // Dash and overdrive, bottom right.
    ctx.textAlign = 'right';
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('DASH', FIELD.width - 22, FIELD.height - 34);
    bar(ctx, FIELD.width - 142, FIELD.height - 28, 120, 11, 1 - Math.max(0, p.dashCd) / 1.6, '#57f7d6');
    if (p.overdriveT > 0) {
      ctx.fillStyle = PALETTE.overdrive;
      ctx.font = `700 14px ${FONT}`;
      ctx.fillText(`OVERDRIVE ${p.overdriveT.toFixed(1)}s`, FIELD.width - 22, FIELD.height - 52);
    }
    if (view.muted) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `500 12px ${FONT}`;
      ctx.fillText('MUTED (M)', FIELD.width - 22, 92);
    }

    // Wave banner.
    if (world.waveBannerT > 0) {
      ctx.globalAlpha = Math.min(1, world.waveBannerT);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText(world.waveBanner, FIELD.width / 2, 210);
      ctx.globalAlpha = 1;
    }
  }

  _panel(w, h) {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.panel;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,160,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return { x, y };
  }

  _title(world, view) {
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 76px ${FONT}`;
    ctx.fillText('VOID HARVEST', FIELD.width / 2, 218);
    ctx.font = `500 19px ${FONT}`;
    ctx.fillStyle = '#a8fff0';
    ctx.fillText('Harvest the cores. Outfly the swarm. Break the Hollow Sun.', FIELD.width / 2, 256);

    ctx.font = `500 16.5px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    const lines = [
      'WASD or arrows to fly — mouse to aim, hold to fire',
      'SHIFT or SPACE to dash through danger',
      'Chain kills to raise your combo multiplier; getting hit breaks it',
      'Grab green crosses to repair, blue cells for OVERDRIVE',
      'Every 5th wave, the Hollow Sun comes for you',
    ];
    lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 486 + i * 25));

    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 21px ${FONT}`;
    const blink = Math.floor(world.time * 1.6) % 2 === 0;
    if (blink) ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, 640);
    ctx.font = `500 14px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Best score: ${view.best}    ·    P pauses    ·    M mutes`, FIELD.width / 2, 676);
  }

  _gameOver(world, view) {
    const { ctx } = this;
    const { y } = this._panel(480, 330);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = `800 42px ${FONT}`;
    ctx.fillText('SHIP LOST', FIELD.width / 2, y + 70);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(`${world.score}`, FIELD.width / 2, y + 128);
    ctx.font = `500 16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`Wave ${Math.max(1, world.wave)} reached · ${world.kills} kills`, FIELD.width / 2, y + 160);
    if (world.score >= view.best && world.score > 0) {
      ctx.fillStyle = '#ffe066';
      ctx.font = `700 17px ${FONT}`;
      ctx.fillText('NEW BEST SCORE!', FIELD.width / 2, y + 196);
    } else {
      ctx.fillText(`Best: ${view.best}`, FIELD.width / 2, y + 196);
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 19px ${FONT}`;
    const blink = Math.floor(world.time * 1.6) % 2 === 0;
    if (blink) ctx.fillText('PRESS ENTER OR CLICK TO FLY AGAIN', FIELD.width / 2, y + 262);
  }

  _paused() {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(4, 6, 12, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2);
    ctx.font = `500 16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 34);
  }
}
