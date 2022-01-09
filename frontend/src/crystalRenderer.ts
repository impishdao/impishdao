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

function random_bool(gen: Generator<number>): boolean {
  return gen.next().value === 0;
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

function random_color_bright(gen: Generator<number>): RGB {
  return {
    r: Math.floor(rb(gen, 150, 255)),
    g: Math.floor(rb(gen, 150, 255)),
    b: Math.floor(rb(gen, 150, 255)),
  };
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
  neg: boolean;
  topper: number;
  depth: number;

  children: Child[];

  constructor(gen: Generator<number>, depth: number) {
    const width = depth === 0 ? rb(gen, 2, 20) : depth === 1 ? rb(gen, 1, 14) : rb(gen, 1, 3);
    const height = depth === 0 ? rb(gen, 200, 255) : depth === 1 ? rb(gen, 10, 100) : rb(gen, 1, 10);

    this.rect = { width, height, color: random_color_bright(gen) };
    this.relPos = depth === 0 ? 0 : rb(gen, 1, 10) / 10;
    this.rotation = depth === 0 ? 0 : Math.PI / rb(gen, 1, 6);
    this.neg = random_bool(gen);
    this.depth = depth;
    this.topper = rb(gen, 0, 2);

    this.children = [];

    if (depth === 0) {
      const numChildren = rb(gen, 3, 8);
      for (let i = 0; i < numChildren; i++) {
        this.children.push(new Child(gen, depth + 1));
      }
    }

    if (depth === 1) {
      const numChildren = rb(gen, 0, 1);
      for (let i = 0; i < numChildren; i++) {
        this.children.push(new Child(gen, depth + 1));
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // Draw the base rect
    ctx.fillStyle = rgbToHex(this.rect.color);
    ctx.fillRect(-this.rect.width / 2, 0, this.rect.width, this.rect.height);

    // Draw a topper if needed
    // if (this.depth === 0) {
      // Circle
      ctx.fillStyle = rgbToHex(this.rect.color);
      ctx.beginPath();
      ctx.arc(0, this.rect.height, this.rect.width / 2, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
    // }

    // If there is a "neg", then draw a negative space inside
    if (this.neg) {
      ctx.fillStyle = "black";
      ctx.fillRect(-this.rect.width / 4, 0, this.rect.width / 2, this.rect.height * 0.9);
    }

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
    this.sym = 15;

    const gen = random_generator(seed);
    const mainColor = random_color_bright(gen);

    this.mainChild = new Child(gen, 0);
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
