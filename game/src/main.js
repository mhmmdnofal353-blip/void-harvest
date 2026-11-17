// Boot and the frame loop. The canvas is scaled to the window with the 1280x720 field
// letterboxed inside it; a fixed-step accumulator runs the simulation at 60 steps a
// second whatever the display does, so the game plays identically everywhere.
// A ?shot=<scene>&seed=<n> query renders one deterministic screenshot scene instead
// of the live game (see shots.js and shots.json).

import { FIELD, STEP, BEST_KEY } from './config.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { buildShotWorld } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

const view = { scale: 1, ox: 0, oy: 0 };
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  view.scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
  view.ox = (canvas.width - FIELD.width * view.scale) / 2;
  view.oy = (canvas.height - FIELD.height * view.scale) / 2;
}
addEventListener('resize', resize);
resize();

function toField(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const dpr = canvas.width / rect.width;
  return {
    x: ((clientX - rect.left) * dpr - view.ox) / view.scale,
    y: ((clientY - rect.top) * dpr - view.oy) / view.scale,
  };
}

const sound = new Sound();
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const isShot = shotName !== null;

let best = 0;
try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch { best = 0; }

const world = isShot ? buildShotWorld(shotName, Number(params.get('seed')) || 1) : new World();
const input = new Input(canvas, toField);
const renderer = new Renderer(ctx);
const state = { paused: false, muted: false, announced: '' };

function announce(text) {
  if (state.announced !== text) {
    state.announced = text;
    if (status) status.textContent = text;
  }
}

function startRun() {
  sound.unlock();
  world.startRun();
  state.paused = false;
}

let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  acc += dt;

  // Screen flow keys work even between simulation steps.
  if (!isShot) {
    if (input.wasPressed('Enter') || input.wasPressed('NumpadEnter') || input.wasPressed('MouseDown')) {
      if (world.mode === 'title' || world.mode === 'over') startRun();
      else sound.unlock();
    }
    if (input.wasPressed('KeyM')) state.muted = sound.toggleMute();
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      if (world.mode === 'playing') state.paused = !state.paused;
    }
  }

  while (acc >= STEP) {
    acc -= STEP;
    if (!state.paused) world.update(STEP, input, sound);
    input.endFrame();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#04060c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  renderer.draw(world, { best, muted: state.muted, paused: state.paused });

  if (world.mode === 'playing') announce(`Wave ${world.wave}. Score ${world.score}. Hull ${Math.ceil(world.player.hp)} percent.`);
  else if (world.mode === 'over') {
    announce(`Game over. Score ${world.score}. Wave ${world.wave} reached.`);
    if (world.score > best) {
      best = world.score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* private mode: keep it in memory */ }
    }
  } else announce('Void Harvest. Press Enter or click to launch.');

  if (isShot) window.__shotReady = true;
}

requestAnimationFrame(frame);
