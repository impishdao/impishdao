/* eslint-disable no-undef */
/* eslint-disable camelcase */
import { BigNumber } from "ethers";
import { sha3_256 } from "js-sha3";
import { cloneDeep } from "lodash";

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

function cosT(length: number): number {
  return 1 - Math.cos(length * (Math.PI / 2));
}

function sinT(length: number): number {
  return Math.sin(length * (Math.PI / 2));
}

function isSmallerFinger(s: number, total: number): boolean {
  if (total > 7 || total % 2 === 0) {
    return s % 2 === 0;
  }

  return false;
}

class Rect {
  bottomWidth: number;
  topWidth: number;
  height: number;
  color: RGB;
  depth: number;
  isArc: boolean;

  neg: boolean;
  negRelHeight: number = 0;
  roundTopper: boolean;

  constructor(gen: Generator<number>, depth: number) {
    this.depth = depth;

    this.isArc = false; // depth >= 1 && rb(gen, 0, 2) < 1;

    let widths = this.get_minmax_width_at_depth(depth);
    this.bottomWidth = rb(gen, widths[0].min, widths[0].max);
    this.topWidth = rb(gen, widths[1].min, widths[1].max);

    let height = this.get_minmax_height_at_depth(depth);
    this.height = rb(gen, height.min, height.max);

    this.neg = !this.isArc && random_bool(gen);
    if (this.neg) {
      this.negRelHeight = 0.5 + rb(gen, 0, 0.75);
    }
    this.roundTopper = random_bool(gen);

    this.color = random_color_bright(gen);
  }

  effective_rect = (length: number): Rect => {
    const f1 = this.depth % 2 === 0 ? cosT : sinT;
    const f2 = this.depth % 2 === 1 ? cosT : sinT;

    let bottomWidth = this.bottomWidth * f2(length);
    let topWidth = this.topWidth * f2(length);
    let height = this.height * f1(length);

    if (this.depth > 1) {
      bottomWidth *= f2(length);
      topWidth *= f2(length);
      height *= f1(length);
    }

    const er = cloneDeep(this);

    return Object.assign(er, { bottomWidth, topWidth, height });
  };

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
      numChildren = rb(gen, 3, 9);
    } else if (depth === 1) {
      numChildren = rb(gen, 0, 2);
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
        child.rect.color = { r: 0, g: 0, b: 0 };
        child.rect.topWidth /= 4;
        child.rect.bottomWidth /= 4;
        child.rect.neg = false;
        child.relPos /= 10;
        child.isGhost = true;

        this.children.push(child);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, pass: number, length: number) {
    ctx.save();

    const rect = this.rect.effective_rect(length);

    if ((this.isGhost && pass === 2) || (!this.isGhost && pass === 1)) {
      // Draw the base rect
      if (!rect.isArc) {
        ctx.fillStyle = rgbToHex(rect.color);
        ctx.beginPath();
        ctx.moveTo(-rect.bottomWidth / 2, 0);
        ctx.lineTo(-rect.topWidth / 2, rect.height);
        ctx.lineTo(rect.topWidth / 2, rect.height);
        ctx.lineTo(rect.bottomWidth / 2, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // Draw an Arc
        ctx.strokeStyle = rgbToHex(rect.color);
        ctx.lineWidth = rect.topWidth / 2;
        ctx.beginPath();

        const angle = Math.PI / 4 / rect.topWidth;

        ctx.arc(0, 0, rect.height, -angle, +angle);
        ctx.arc(0, 0, rect.height, +angle, -angle, true);
        ctx.closePath();
        ctx.stroke();
      }

      // Draw a roundTopper if needed
      if (!rect.isArc) {
        if (rect.roundTopper) {
          // Circle
          ctx.fillStyle = rgbToHex(rect.color);
          ctx.beginPath();
          ctx.arc(0, rect.height, rect.topWidth / 2, 0, 2 * Math.PI);
          ctx.closePath();
          ctx.fill();
        } else {
          // Triangle on top
          ctx.fillStyle = rgbToHex(rect.color);
          ctx.beginPath();
          ctx.moveTo(-rect.topWidth / 2, rect.height - 1);
          ctx.lineTo(0, rect.height * 1.1);
          ctx.lineTo(rect.topWidth / 2, rect.height - 1);
          ctx.closePath();
          ctx.fill();
        }

        // If there is a "neg", then draw a negative space inside
        if (rect.neg) {
          ctx.fillStyle = "black";
          ctx.fillRect(-rect.bottomWidth / 4, 0, rect.bottomWidth / 2, rect.height * rect.negRelHeight);
        }

        // Draw a "bottom" circle
        ctx.fillStyle = rgbToHex(rect.color);
        ctx.beginPath();
        ctx.arc(0, 0, rect.bottomWidth / 2, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Draw each of the children
    for (let c = 0; c < this.children.length; c++) {
      ctx.save();

      // Move to the relative position
      ctx.translate(0, rect.height * this.children[c].relPos);
      // We draw each child twice,

      // once rotating left
      const effectiveRotation = this.children[c].rotation * length;
      ctx.rotate(-effectiveRotation);
      this.children[c].render(ctx, pass, length);

      // once rotating right
      ctx.rotate(2 * effectiveRotation);
      this.children[c].render(ctx, pass, length);

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
    const gen = random_generator(seed);
    this.sym = Math.floor(rb(gen, 5, 16));

    this.mainChild = new Child(gen, 0);
  }

  render(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, length: number) {
    if (length < 0.2 || length > 1.0) {
      throw new Error(`Wrong Length: ${length}`);
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();

    // First, move the ctx to the center
    ctx.translate(canvasWidth / 2, canvasHeight / 2);

    for (let s = 0; s < this.sym; s++) {
      // Rotate for this finger. Note that this is incremental for each iteration
      // so we rotate by the same amount each time.
      ctx.rotate((2 * Math.PI) / this.sym);

      const oddEvenLength = isSmallerFinger(s, this.sym) ? cosT(length) : length;
      this.mainChild.render(ctx, 1, oddEvenLength);
    }

    // 2nd Pass renders "ghosts"
    for (let s = 0; s < this.sym; s++) {
      // Rotate for this finger. Note that this is incremental for each iteration
      // so we rotate by the same amount each time.
      ctx.rotate((2 * Math.PI) / this.sym);

      const oddEvenLength = isSmallerFinger(s, this.sym) ? cosT(length) : length;
      this.mainChild.render(ctx, 2, oddEvenLength);
    }

    ctx.restore();
  }
}

export function setup_crystal(canvas: HTMLCanvasElement, seed: string) {
  console.log("setup crystal");
  if (canvas.getAttribute("crystalPresent") === "1") {
    return;
  }

  canvas.setAttribute("crystalPresent", "1");

  const ctx = canvas.getContext("2d");

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  let f = new Finger(seed);

  if (ctx) {
    let length = 0.3;

    // Update every frame
    setInterval(() => {
      if (length > 1.2) {
        seed = BigNumber.from(seed).add(1).toHexString();
        f = new Finger(seed);
        length = 0.3;

        return;
      }

      if (length <= 1.0) {
        f.render(ctx, canvasWidth, canvasHeight, length);
      }

      length += 0.004;
    }, 40); // Every 40 ms for a 24fps
  } else {
    console.log("No context");
  }
}
