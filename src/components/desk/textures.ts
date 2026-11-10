import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  MeshBasicMaterial,
  NearestFilter,
  SRGBColorSpace,
} from 'three';
import {
  OLED_HEIGHT,
  OLED_WIDTH,
  frame as oledFrame,
  type OledPalette,
} from '../../lib/desk/oled';
import type { CalendarFace, LocalDate } from '../../lib/desk/calendar';

/** A canvas-backed texture on an unlit material, with its own redraw and disposal. */
export interface CanvasMaterial {
  material: MeshBasicMaterial;
  dispose(): void;
}

function make(canvas: HTMLCanvasElement): {
  texture: CanvasTexture;
  material: MeshBasicMaterial;
} {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // The quads' UVs run v up (D-03 models), so the default flipY puts the top row on top.
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false });
  return { texture, material };
}

export interface OledTexture extends CanvasMaterial {
  draw(tick: number): void;
}

export function createOledTexture(palette: OledPalette): OledTexture {
  const canvas = document.createElement('canvas');
  canvas.width = OLED_WIDTH;
  canvas.height = OLED_HEIGHT;
  const { texture, material } = make(canvas);
  texture.magFilter = NearestFilter; // crisp pixels when close
  texture.minFilter = LinearMipmapLinearFilter; // legible, not aliased, at desk size
  const ctx = canvas.getContext('2d');
  return {
    material,
    draw(tick) {
      if (!ctx) return;
      const f = oledFrame(tick, palette);
      ctx.putImageData(new ImageData(f.data, f.width, f.height), 0, 0);
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}

export interface CalendarTexture extends CanvasMaterial {
  draw(local: LocalDate, face: CalendarFace | undefined): void;
}

/** The desk calendar's page: today's date where the visitor is, with the Nepali date and any holiday below. */
export function createCalendarTexture(
  paper: string,
  ink: string,
): CalendarTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 300;
  const { texture, material } = make(canvas);
  const ctx = canvas.getContext('2d');
  return {
    material,
    draw(local, face) {
      if (!ctx) return;
      const { width: w, height: h } = canvas;
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '500 30px "JetBrains Mono", ui-monospace, monospace';
      ctx.fillText(`${local.weekday} ${local.monthYear}`, w / 2, 40, w - 30);
      ctx.font = '700 150px Fraunces, Georgia, serif';
      ctx.fillText(local.day, w / 2, 190);
      ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
      const line = face
        ? face.holiday
          ? face.holiday.toLowerCase()
          : `${face.day} ${face.monthYear.toLowerCase()} bs`
        : '';
      if (line) ctx.fillText(line, w / 2, 262, w - 40);
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}

export interface ScreenState {
  /** 0 an editor, 1 a terminal, 2 the page preview. */
  mode: number;
  /** Keystrokes so far: the editor scrolls and the cursor line grows with it. */
  typed: number;
  /** 0..1, set by a mouse click: a ring grows where the pointer is. */
  click: number;
  /** A message in a window over the screen, typed out: what the drawer's finds say. */
  note: { text: string; t: number } | null;
}

export interface ScreenPalette {
  background: string;
  ink: string;
}

export interface ScreenTexture extends CanvasMaterial {
  draw(state: ScreenState): void;
  /** New colours after a theme or lamp change (the next `draw` uses them). */
  setPalette(next: ScreenPalette): void;
}

export const SCREEN_MODES = 3;

/** Deterministic pseudo-random per line, so the same line always looks the same as it scrolls. */
function lineHash(i: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * The monitor's glass: line-art stand-ins for an editor, a terminal and the page being built (no
 * text, so nothing needs a font or a translation). One canvas, redrawn only when the state moves.
 */
export function createScreenTexture(initial: ScreenPalette): ScreenTexture {
  let palette = initial;
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 176;
  const { texture, material } = make(canvas);
  texture.minFilter = LinearMipmapLinearFilter;
  const ctx = canvas.getContext('2d');
  const bar = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    a = 1,
  ) => {
    c.globalAlpha = a;
    c.fillRect(x, y, Math.max(2, w), 5);
    c.globalAlpha = 1;
  };
  return {
    material,
    setPalette(next) {
      palette = next;
    },
    draw({ mode, typed, click, note }) {
      if (!ctx) return;
      const { width: W, height: H } = canvas;
      ctx.fillStyle = palette.background;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = palette.ink;
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 2;
      // window bar
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(12 + i * 12, 11, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 22);
      ctx.lineTo(W, 22);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (mode === 0) {
        const first = Math.floor(typed / 4);
        const rows = 11;
        for (let i = 0; i < rows; i++) {
          const n = first + i;
          const h = lineHash(n);
          const y = 32 + i * 13;
          bar(ctx, 10, y, 10, 0.35);
          const indent = (h % 3) * 16;
          const w = 36 + ((h >>> 4) % 150);
          const last = i === rows - 1;
          const shown = last ? (w * ((typed % 4) + 1)) / 4 : w;
          bar(ctx, 34 + indent, y, shown, i % 2 ? 0.95 : 0.6);
          if (!last && (h >>> 9) % 3 === 0)
            bar(ctx, 40 + indent + w, y, 24 + ((h >>> 12) % 40), 0.4);
          if (last) {
            ctx.fillRect(34 + indent + shown + 4, y - 2, 6, 9);
          }
        }
      } else if (mode === 1) {
        for (let i = 0; i < 10; i++) {
          const n = Math.floor(typed / 3) + i;
          const h = lineHash(n + 99);
          const y = 34 + i * 14;
          ctx.beginPath();
          ctx.moveTo(12, y - 1);
          ctx.lineTo(18, y + 2);
          ctx.lineTo(12, y + 5);
          ctx.stroke();
          bar(ctx, 26, y, 30 + (h % 120), 0.85);
          if ((h >>> 5) % 2 === 0)
            bar(ctx, 26, y + 7, 20 + ((h >>> 8) % 90), 0.4);
        }
        // a progress bar that fills with the typing
        ctx.strokeRect(12, H - 22, W - 24, 9);
        ctx.fillRect(14, H - 20, ((W - 28) * ((typed % 40) + 1)) / 40, 5);
      } else {
        // the page preview: a hero block and three cards
        ctx.strokeRect(34, 30, W - 68, 14);
        bar(ctx, 40, 35, 80, 0.7);
        ctx.strokeRect(24, 54, W - 48, 44);
        bar(ctx, 36, 66, 110, 0.95);
        bar(ctx, 36, 78, 70, 0.45);
        const cw = (W - 48 - 16) / 3;
        for (let i = 0; i < 3; i++) {
          const x = 24 + i * (cw + 8);
          ctx.strokeRect(x, 108, cw, 52);
          bar(ctx, x + 8, 118, cw * 0.6, 0.9);
          bar(ctx, x + 8, 130, cw * 0.4, 0.4);
          bar(ctx, x + 8, 142, cw * 0.5, 0.4);
        }
      }
      if (note) {
        // a window with the message typed out in it
        const x0 = 20;
        const y0 = 34;
        const w = W - 40;
        const h = H - 62;
        ctx.fillStyle = palette.background;
        ctx.fillRect(x0, y0, w, h);
        ctx.fillStyle = palette.ink;
        ctx.lineWidth = 2;
        ctx.strokeRect(x0, y0, w, h);
        ctx.beginPath();
        ctx.moveTo(x0, y0 + 16);
        ctx.lineTo(x0 + w, y0 + 16);
        ctx.stroke();
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(x0 + 10 + i * 10, y0 + 8, 2.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.font = '500 15px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        const shown = note.text.slice(0, Math.floor(note.t * 30));
        const words = shown.split(' ');
        let line = '';
        let y = y0 + 26;
        for (const word of words) {
          const next = line ? `${line} ${word}` : word;
          if (ctx.measureText(next).width > w - 20 && line) {
            ctx.fillText(line, x0 + 10, y);
            y += 19;
            line = word;
          } else line = next;
        }
        const caret = Math.floor(note.t * 3) % 2 === 0 ? '_' : '';
        ctx.fillText(line + caret, x0 + 10, y);
      }
      if (click > 0) {
        ctx.globalAlpha = click;
        ctx.beginPath();
        ctx.arc(W * 0.62, H * 0.58, 6 + (1 - click) * 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}

export interface CardTexture extends CanvasMaterial {
  draw(lines: readonly string[], style: 'paper' | 'sticky'): void;
}

/** The card in the drawer: a few short lines in the page's own colours. */
export function createCardTexture(
  paper: string,
  ink: string,
  height = 256,
): CardTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 416;
  canvas.height = height;
  const { texture, material } = make(canvas);
  const ctx = canvas.getContext('2d');
  return {
    material,
    draw(lines, style) {
      if (!ctx) return;
      const { width: w, height: h } = canvas;
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = ink;
      ctx.fillStyle = ink;
      ctx.lineWidth = 6;
      ctx.strokeRect(10, 10, w - 20, h - 20);
      if (style === 'sticky') {
        // a folded corner
        ctx.beginPath();
        ctx.moveTo(w - 70, h - 10);
        ctx.lineTo(w - 10, h - 70);
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const size = Math.min(lines.length > 2 ? 40 : 54, h * 0.5);
      ctx.font = `700 ${size}px Fraunces, Georgia, serif`;
      const gap = size * 1.25;
      const top = h / 2 - ((lines.length - 1) * gap) / 2;
      lines.forEach((l, i) => ctx.fillText(l, w / 2, top + i * gap, w - 50));
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}
