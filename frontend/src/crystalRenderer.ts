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
    throw new Error("Range too broad");
  }

  return startInc + (random_255(gen) * (endInc - startInc)) / 255;
}

function random_color_bright(gen: Generator<number>): RGB {
  return {
    r: Math.floor(rb(gen, 100, 255)),
    g: Math.floor(rb(gen, 100, 255)),
    b: Math.floor(rb(gen, 100, 255)),
  };
}

type RGB = {
  r: number;
  g: number;
  b: number;
};

type MinMax = {
  min: number;
  max: number;
};

class Rect {
  bottomWidth: number;
  topWidth: number;
  height: number;
  color: RGB;

  neg: boolean;
  negRelHeight: number = 0;
  roundTopper: boolean;

  constructor(gen: Generator<number>, depth: number) {
    let widths = this.get_minmax_width_at_depth(depth);
    this.bottomWidth = rb(gen, widths[0].min, widths[0].max);
    this.topWidth = rb(gen, widths[1].min, widths[1].max);

    let height = this.get_minmax_height_at_depth(depth);
    this.height = rb(gen, height.min, height.max);

    this.neg = random_bool(gen);
    if (this.neg) {
      this.negRelHeight = 0.5 + rb(gen, 0, 0.75);
    }
    this.roundTopper = random_bool(gen);

    this.color = random_color_bright(gen);
  }

  get_minmax_width_at_depth = (depth: number): MinMax[] => {
    if (depth === 0) {
      return [
        { min: 2, max: 20 },
        { min: 0, max: 20 },
      ];
    } else if (depth === 1) {
      return [
        { min: 1, max: 14 },
        { min: 0, max: 14 },
      ];
    } else {
      return [
        { min: 1, max: 3 },
        { min: 0, max: 3 },
      ];
    }
  };

  get_minmax_height_at_depth = (depth: number): MinMax => {
    if (depth === 0) {
      return { min: 200, max: 255 };
    } else if (depth === 1) {
      return { min: 10, max: 100 };
    } else {
      return { min: 1, max: 10 };
    }
  };
}

class Child {
  rect: Rect;
  relPos: number;
  rotation: number;
  depth: number;
  isGhost: boolean = false; 

  children: Child[];

  constructor(gen: Generator<number>, depth: number) {
    // Generate a random Rect.
    this.rect = new Rect(gen, depth);

    this.relPos = depth === 0 ? 0 : rb(gen, 1, 10) / 10;
    this.rotation = depth === 0 ? 0 : Math.PI / rb(gen, 1, 8);

    this.depth = depth;

    // Gen the chilren, depending on the depth
    this.children = [];
    let numChildren = 0;

    if (depth === 0) {
      numChildren = rb(gen, 3, 8);
    } else if (depth === 1) {
      numChildren = rb(gen, 0, 1);
    }

    for (let i = 0; i < numChildren; i++) {
      this.children.push(new Child(gen, depth + 1));
    }

    // Generate "ghost children at depth = 0" (Rects that are black)
    if (depth === 0) {
      const numGhosts = rb(gen, 0, 2);
      for (let i = 0; i < numGhosts; i++) {
        const child = new Child(gen, depth + 1);
        // Ghost props
        child.rect.color = { r: 0, g: 0, b: 0};
        child.rect.topWidth /= 4;
        child.rect.bottomWidth /= 4;
        child.rect.neg = false;
        child.relPos /= 10;
        child.isGhost = true;

        this.children.push(child);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, pass: number) {
    ctx.save();

    if ((this.isGhost && pass === 2) || (!this.isGhost && pass === 1)) {
      // Draw the base rect
      ctx.fillStyle = rgbToHex(this.rect.color);
      ctx.beginPath();
      ctx.moveTo(-this.rect.bottomWidth/2, 0);
      ctx.lineTo(-this.rect.topWidth/2, this.rect.height);
      ctx.lineTo(this.rect.topWidth/2, this.rect.height);
      ctx.lineTo(this.rect.bottomWidth/2, 0);
      ctx.closePath();
      ctx.fill();

      // Draw a roundTopper if needed
      if (this.rect.roundTopper) {
        // Circle
        ctx.fillStyle = rgbToHex(this.rect.color);
        ctx.beginPath();
        ctx.arc(0, this.rect.height, this.rect.topWidth / 2, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
      } else {
        // Triangle on top
        ctx.fillStyle = rgbToHex(this.rect.color);
        ctx.beginPath();
        ctx.moveTo(-this.rect.topWidth / 2, this.rect.height - 1);
        ctx.lineTo(0, this.rect.height * 1.1);
        ctx.lineTo(this.rect.topWidth / 2, this.rect.height - 1);
        ctx.closePath();
        ctx.fill();
      }

      // If there is a "neg", then draw a negative space inside
      if (this.rect.neg) {
        ctx.fillStyle = "black";
        ctx.fillRect(-this.rect.bottomWidth / 4, 0, this.rect.bottomWidth / 2, this.rect.height * this.rect.negRelHeight);
      }

      // Draw a "bottom" circle
      ctx.fillStyle = rgbToHex(this.rect.color);
      ctx.beginPath();
      ctx.arc(0, 0, this.rect.bottomWidth / 2, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
    }

    // Draw each of the children
    for (let c = 0; c < this.children.length; c++) {
      ctx.save();

      // Move to the relative position
      ctx.translate(0, this.rect.height * this.children[c].relPos);
      // We draw each child twice,

      // once rotating left
      ctx.rotate(-this.children[c].rotation);
      this.children[c].render(ctx, pass);

      // once rotating right
      ctx.rotate(2 * this.children[c].rotation);
      this.children[c].render(ctx, pass);

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
    this.sym = 25;

    const gen = random_generator(seed);

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

      this.mainChild.render(ctx, 1);
    }

    // 2nd Pass renders "ghosts"
    for (let s = 0; s < this.sym; s++) {
      // Rotate for this finger. Note that this is incremental for each iteration
      // so we rotate by the same amount each time.
      ctx.rotate((2 * Math.PI) / this.sym);

      this.mainChild.render(ctx, 2);
    }

    ctx.restore();
  }
}

// function get_random_byte(gen: Generator<number>): number {
//   let byte = 0;
//   for (let i = 0; i < 8; i++) {
//     byte = (byte << 1) | gen.next().value;
//   }

//   return byte;
// }

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
