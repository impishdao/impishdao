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
  const {r, g, b} = color;

  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('');
}

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


type RGBPolarPoint = {
  rr: number;
  th: number;
  color: RGB;
};

type RGBCartPoint = {
  xx: number;
  yy: number;
  color: RGB;
};

function get_random_byte(gen: Generator<number>): number {
  let byte = 0;
  for (let i = 0; i < 8; i++) {
    byte = (byte << 1) | gen.next().value;
  }

  return byte;
}

type MinMax = {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
};

function get_min_max(path: RGBCartPoint[]): MinMax {
  const minmax: MinMax = {min_x: 0, max_x: 0, min_y: 0, max_y: 0};

  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (p.xx < minmax.min_x) {
      minmax.min_x = p.xx;
    }
    if (p.yy < minmax.min_y) {
      minmax.min_y = p.yy;
    }
    if (p.xx > minmax.max_x) {
      minmax.max_x = p.xx;
    }
    if (p.yy > minmax.max_y) {
      minmax.max_y = p.yy;
    }
  }

  return minmax;
}

function get_random_rgb(gen: Generator<number>): RGB {
  // each point is random 8 bits
  return { r: get_random_byte(gen), g: get_random_byte(gen), b: get_random_byte(gen) };
}

// Get the next color evolution
function get_next_rgb(rgb: RGB, gen: Generator<number>): RGB {
  const newRGB = Object.assign({...rgb});

  newRGB.r += gen.next().value === 0 ? +1 : -1;
  if (newRGB.r < 0) {
    newRGB.r = 255;
  }
  newRGB.r %= 255;

  newRGB.g += gen.next().value === 0 ? +1 : -1;
  if (newRGB.g < 0) {
    newRGB.g = 255;
  }
  newRGB.g %= 255;

  newRGB.b += gen.next().value === 0 ? +1 : -1;
  if (newRGB.b < 0) {
    newRGB.b = 255;
  }
  newRGB.b %= 255;

  return newRGB;
}

// Get a random walk starting at (0, 0).
function get_path_polar(seed: string, length: number, startAngle: number): RGBPolarPoint[] {
  const gen = random_generator(seed);

  // Start at 0, 0 with a random color
  const points: RGBPolarPoint[] = [{ rr: 0, th: startAngle, color: get_random_rgb(gen) }];

  for (let i = 0; i < length - 1; i++) {
    const rr = points[i].rr + (gen.next().value === 0 ? 0.1 : 1);
    const th = points[i].th + (gen.next().value === 0 ? +0.01 : -0.01);

    const color = get_next_rgb(points[i].color, gen);

    points.push({ rr, th, color });
  }

  return points;
}

function draw_image(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number, seed: string) {
  const path = get_path_polar(seed, 1000, Math.PI / 4);
  console.log(`PAth length: ${path.length}`);

  const cart_path: RGBCartPoint[] = path.map(({rr, th, color}) => {
    let xx = rr * Math.cos(th);
    let yy = rr * Math.sin(th);

    return {xx, yy, color}
  });
  
  // Find min and max
  const {min_x, min_y, max_x, max_y} = get_min_max(cart_path);
  console.log(get_min_max(cart_path));

  // const id = new ImageData(canvasWidth, canvasHeight);
  // const pixels = id.data;
  const border = canvasWidth * 0.03; // 3% border each side
  const drawableWidth = canvasWidth - (2 * border);
  const longer_range = Math.max(max_x - min_x, max_y - min_y);
  const scale = drawableWidth / longer_range;

  const translatePoint = (p: RGBCartPoint) => {
    const x = Math.round(scale * (p.xx - min_x) + border);
    const y = Math.round(scale * (p.yy - min_y) + border);

    return {x, y};
  };

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  

  // ctx.fillStyle = "black";
  // ctx.strokeStyle = "black";
  // ctx.rect(0, 0, canvasWidth, canvasHeight);
  // ctx.fill();

  const {x, y} = translatePoint(cart_path[0]);
  let prev_x = x;
  let prev_y = y;

  for (let i = 0; i < cart_path.length; i++) {
    const p = cart_path[i];

    const {x, y} = translatePoint(cart_path[i]);
    
    ctx.beginPath();
    ctx.moveTo(prev_x, prev_y);

    ctx.strokeStyle = rgbToHex(p.color);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.closePath();
    
    prev_x = x;
    prev_y = y;
  }
  
  // ctx.putImageData(id, 0, 0);
}

export function setup_crystal(canvas: HTMLCanvasElement, seed: string) {
  console.log("setup crystal");
  const ctx = canvas.getContext("2d");

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  if (ctx) {
    draw_image(ctx, canvasWidth, canvasHeight, seed);
  } else {
    console.log("No context");
  }
  
}
