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

  constructor(width: number, height: number, relPos: number) {
    this.rect = {width, height, color: {r: 200, g: 0, b: 0}};
    this.relPos = relPos;
    this.rotation = Math.PI / 3;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // Draw the base rect
    ctx.fillStyle = rgbToHex(this.rect.color);
    ctx.fillRect(-this.rect.width/2, 0, this.rect.width, this.rect.height);

    ctx.restore();
  }
}

class Finger {
  rect: Rect;
  sym: number;
  children: Child[]

  constructor() {
    this.rect = {width: 10, height: 80, color: {r: 250, g: 0, b: 0}};
    this.sym = 9;
    this.children = [new Child(5, 20, 0.8), new Child(8, 20, 0.6), new Child(2, 40, 0.1)];
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();
    
    // First, move the ctx to the center
    ctx.translate(canvasWidth/2, canvasHeight/2);
    for (let s = 0; s < this.sym; s++) {
      console.log(`Rendering ${s} at ${s * 2 * Math.PI / this.sym}`);

      // Rotate for this finger. Note that this is incremental for each iteration
      // so we rotate by the same amount each time.
      ctx.rotate(2 * Math.PI / this.sym);

      // Draw the base rect
      ctx.fillStyle = rgbToHex({r: 150 + (s*20), g: 0, b: 0});
      ctx.fillRect(-this.rect.width/2, 0, this.rect.width, this.rect.height);

      // Draw each of the children
      for (let c = 0; c < this.children.length; c++) {
        ctx.save();

        // Move to the relative position
        ctx.translate(0, this.rect.height*this.children[c].relPos);
        // We draw each child twice, 
        
        // once rotating left
        ctx.rotate(-this.children[c].rotation);
        this.children[c].render(ctx);

        // once rotating right
        ctx.rotate(2*this.children[c].rotation);
        this.children[c].render(ctx);

        // reset the rotations and translates
        ctx.restore();
      }
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

  const f = new Finger();

  if (ctx) {
    f.render(ctx, canvasWidth, canvasHeight);
  } else {
    console.log("No context");
  }
}
