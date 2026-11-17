// Keyboard and mouse state, read by the simulation once per fixed step. The mouse is
// tracked in logical field coordinates: main.js hands us the canvas transform so a
// window of any size aims the same way.

export class Input {
  constructor(canvas, toField) {
    this.keys = new Set();
    this.mouse = { x: 640, y: 300, down: false };
    this.pressed = new Set();
    this._toField = toField;

    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this._toField(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    canvas.addEventListener('pointerdown', (e) => {
      const p = this._toField(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.down = true;
      this.pressed.add('MouseDown');
    });
    addEventListener('pointerup', () => {
      this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Movement axes in [-1, 1] from WASD or the arrow keys. */
  axes() {
    const k = this.keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      return { x: x * inv, y: y * inv };
    }
    return { x, y };
  }

  /** True once per physical press; the set is cleared at the end of each frame by main.js. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
  }
}
