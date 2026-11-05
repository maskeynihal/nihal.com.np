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
import type { CalendarFace } from '../../lib/desk/calendar';

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
  draw(face: CalendarFace | undefined): void;
}

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
    draw(face) {
      if (!ctx) return;
      const { width: w, height: h } = canvas;
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, w, h);
      if (face) {
        ctx.fillStyle = ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '700 150px Fraunces, Georgia, serif';
        ctx.fillText(face.day, w / 2, 150);
        ctx.font = '500 34px "JetBrains Mono", ui-monospace, monospace';
        ctx.fillText(face.monthYear.toLowerCase(), w / 2, 200);
        if (face.holiday) {
          ctx.font = '500 26px "JetBrains Mono", ui-monospace, monospace';
          ctx.fillText(face.holiday.toLowerCase(), w / 2, 258, w - 40);
        }
      }
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      material.dispose();
    },
  };
}
