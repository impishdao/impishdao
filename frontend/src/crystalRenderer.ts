/* eslint-disable no-undef */
/* eslint-disable camelcase */
import { sha3_256 } from "js-sha3";
import { min } from "lodash";

const fromHexString = (hexString: string): Uint8Array => {
  let m = hexString.match(/.{1,2}/g);
  if (!m) {
    return new Uint8Array();
  }

  return new Uint8Array(m.map((byte) => parseInt(byte, 16)));
};
export const toHexString = (bytes: Uint8Array) =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

const rgbToHex = (color: RGB) => {
  const { r, g, b } = color;

  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

function* random_generator(init_seed: string) {
  if (init_seed.startsWith("0x")) {
    init_seed = init_seed.substring(2);
  }

  const init_seed_u8 = fromHexString(init_seed);
  let seed = init_seed_u8;

  while (true) {
    const m = sha3_256.create();
    m.update(init_seed_u8);
    m.update(seed);

    seed = fromHexString(m.hex());
    for (let j = 0; j < seed.length; j++) {
      for (let i = 0; i < 8; i++) {
        const b = seed[j];
        const nextNum = (b >> i) & 1;
        yield nextNum;
      }
    }
  }
}

function random_255(gen: Generator<number>): number {
  let n = 0;
  for (let i = 0; i < 8; i++) {
    n = (n << 1) | gen.next().value;
  }

  return n;
}

function rb(gen: Generator<number>, startInc: number, endInc: number): number {
  if (endInc - startInc + 1 > 255) {
    throw "Range too broad";
  }

  return startInc + (random_255(gen) * (endInc - startInc + 1)) / 255;
}

type RGB = {
  r: number;
  g: number;
  b: number;
};

type Rect = {
  width: number;
  height: number;
  color: RGB;
};

type RGBCartPoint = {
  xx: number;
  yy: number;
  color: RGB;
};

class Child {
  rect: Rect;
  relPos: number;
  rotation: number;
  children: Child[];

  constructor(width: number, height: number, relPos: number, rotation: number, color: RGB) {
    this.rect = { width, height, color };
    this.relPos = relPos;
    this.rotation = rotation;
    this.children = [];
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // Draw the base rect
    ctx.fillStyle = rgbToHex(this.rect.color);
    ctx.fillRect(-this.rect.width / 2, 0, this.rect.width, this.rect.height);

    // Draw each of the children
    for (let c = 0; c < this.children.length; c++) {
      ctx.save();

      // Move to the relative position
      ctx.translate(0, this.rect.height * this.children[c].relPos);
      // We draw each child twice,

      // once rotating left
      ctx.rotate(-this.children[c].rotation);
      this.children[c].render(ctx);

      // once rotating right
      ctx.rotate(2 * this.children[c].rotation);
      this.children[c].render(ctx);

      // reset the rotations and translates
      ctx.restore();
    }

    ctx.restore();
  }
}

class Finger {
  sym: number;
  mainChild: Child;

  constructor(seed: string) {
    this.sym = 5;

    const gen = random_generator(seed);

    this.mainChild = new Child(rb(gen, 1, 10), rb(gen, 200, 255), 0, 0, {
      r: 250,
      g: 200,
      b: 200,
    });

    const numChildren = rb(gen, 3, 8);
    for (let i = 0; i < numChildren; i++) {
      const child = new Child(rb(gen, 2, 18), rb(gen, 10, 100), rb(gen, 1, 10) / 10, Math.PI / rb(gen, 1, 6), {
        r: 200,
        g: 255,
        b: 255,
      });
      this.mainChild.children.push(child);
    }
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();

    // First, move the ctx to the center
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    for (let s = 0; s < this.sym; s++) {
      // Rotate for this finger. Note that this is incremental for each iteration
      // so we rotate by the same amount each time.
      ctx.rotate((2 * Math.PI) / this.sym);

      this.mainChild.render(ctx);
    }

    ctx.restore();
  }
}

function get_random_byte(gen: Generator<number>): number {
  let byte = 0;
  for (let i = 0; i < 8; i++) {
    byte = (byte << 1) | gen.next().value;
  }

  return byte;
}

export function setup_crystal(canvas: HTMLCanvasElement, seed: string) {
  console.log("setup crystal");
  const ctx = canvas.getContext("2d");

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const f = new Finger(seed);

  if (ctx) {
    f.render(ctx, canvasWidth, canvasHeight);
  } else {
    console.log("No context");
  }
}
