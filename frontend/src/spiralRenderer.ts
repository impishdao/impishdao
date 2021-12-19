/* eslint-disable no-undef */
/* eslint-disable camelcase */
import { sha3_256 } from "js-sha3";

const fromHexString = (hexString: string) : Uint8Array => {
  let m = hexString.match(/.{1,2}/g);
  if (!m) {
    return new Uint8Array();
  }

  return new Uint8Array(m.map((byte) => parseInt(byte, 16)));
}
export const toHexString = (bytes: Uint8Array) => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

const SCALE = 2;

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

function random_color_1ch(num_steps: number, gen: Generator<number>) {
  let cur = 0;
  const result = [];

  for (let i = 0; i < num_steps; i++) {
    if (gen.next().value === 1) {
      cur += 1;
    } else {
      cur -= 1;
    }

    result.push(cur);
  }

  const lowest = result.reduce((min, r) => Math.min(min, r), 0);
  const highest = result.reduce((max, r) => Math.max(max, r), 0);
  for (let i = 0; i < result.length; i++) {
    result[i] = (result[i] - lowest) / (highest - lowest);
  }

  return result;
}

function get_steps(seed: string) {
  const gen = random_generator(seed);

  const steps = [[0, 0]];

  const vert = 1500;
  const target_size_x = Math.round(vert * 1.6);
  const target_size_y = vert;

  let x = 0;
  let y = 0;

  let min_x = 0;
  let max_x = 0;
  let min_y = 0;
  let max_y = 0;

  let i = 1;

  while (true) {
    const a = gen.next().value;
    const b = gen.next().value;

    const [prev_r, prev_t] = steps[i - 1];

    if (a === 0 && b === 0) {
      x += 1;
      steps.push([prev_r + 1, prev_t + 0]);
    } else if (a === 0 && b === 1) {
      x -= 1;
      steps.push([prev_r - 1, prev_t + 0.1]);
    } else if (a === 1 && b === 0) {
      y += 1;
      steps.push([prev_r + 0, prev_t + 1]);
    } else {
      y -= 1;
      steps.push([prev_r + 0, prev_t - 1]);
    }

    // Next iteration
    i += 1;

    min_x = Math.min(min_x, x);
    max_x = Math.max(max_x, x);

    min_y = Math.min(min_y, y);
    max_y = Math.max(max_y, y);

    // console.log(`(${a}, ${b}) - |${x}, ${y}| -${min_x}:${max_x} , ${min_y}:${max_y} `);

    const x_range = max_x - min_x;
    const y_range = max_y - min_y;

    const longer_range = Math.max(x_range, y_range);
    const shorter_range = Math.min(x_range, y_range);

    if (longer_range >= target_size_x || shorter_range >= target_size_y) {
      break;
    }
  }


  const num_steps = steps.length;
  console.log(`Number of steps in walk: ${num_steps}`);

  const c1 = random_color_1ch(num_steps + 1, gen);
  const c2 = random_color_1ch(num_steps + 1, gen);
  const c3 = random_color_1ch(num_steps + 1, gen);

  const C = [];
  for (let i = 0; i < num_steps + 1; i++) {
    C.push([c1[i], c2[i], c3[i]]);
  }

  // Convert to Cartesian
  const cart_path = [];
  for (let i = 0; i < steps.length; i++) {
    const pt = steps[i];
    cart_path.push([
      (pt[0] / 1) * Math.cos(pt[1] / 200),
      (pt[0] / 1) * Math.sin(pt[1] / 200),
    ]);
  }

  return { cart_path, C };
}

type RGB = {
  r: number;
  g: number;
  b: number;
};

type RGBPolarPoint = RGB & {
  rr: number;
  th: number;
};

type ScaledPath = {
  scaled_polar_path: RGBPolarPoint[];
  min_x: number;
  min_y: number;
};

// Cartesian path, scaled to canvas width
function get_scaled_cart_path(cart_path: number[][], C: number[][], canvasWidth: number): ScaledPath {
  // 3% border on each size, scaled * SCALE
  canvasWidth = canvasWidth * (1 - 0.03 * 2) * SCALE;
  let factor = 1;
  {
    const { min_x, max_x } = cart_ranges(cart_path);
    factor = (max_x - min_x) / canvasWidth;
  }

  let min_x = 0;
  let min_y = 0;
  let max_x = 0;
  let max_y = 0;

  const scaled_cart_points: RGB[][] = [];
  for (let i = 0; i < cart_path.length; i++) {
    const x = Math.round(cart_path[i][0] / factor);
    const y = Math.round(cart_path[i][1] / factor);

    min_x = Math.min(min_x, x);
    max_x = Math.max(max_x, x);

    min_y = Math.min(min_y, y);
    max_y = Math.max(max_y, y);

    const r = Math.round(C[i][0] * 256);
    const g = Math.round(C[i][1] * 256);
    const b = Math.round(C[i][2] * 256);

    if (!scaled_cart_points[x]) {
      scaled_cart_points[x] = [];
    }
    scaled_cart_points[x][y] = { r, g, b };
  }

  // Then, gather all the non-0 points that were actually rendered, and return that as the path
  const scaled_cart_path = [];
  for (let x = min_x; x <= max_x; x++) {
    for (let y = min_y; y <= max_y; y++) {
      if (scaled_cart_points[x][y] !== undefined) {
        scaled_cart_path.push({ x, y, ...scaled_cart_points[x][y] });
      }
    }
  }

  // Convert the scaled cart path into polar
  const scaled_polar_path: RGBPolarPoint[] = [];
  for (let i = 0; i < scaled_cart_path.length; i++) {
    const { x, y, r, g, b } = scaled_cart_path[i];

    const rr = Math.sqrt(x ** 2 + y ** 2);
    const th = Math.atan2(y, x);

    scaled_polar_path.push({rr, th, r, g, b})
  }

  return { scaled_polar_path, min_x, min_y };
}

function draw_path_with_rot(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  scaled_cart_path: RGBPolarPoint[],
  min_x: number,
  min_y: number,
  rot: number
) {
  const id = new ImageData(canvasWidth * SCALE, canvasHeight * SCALE);
  const pixels = id.data;
  const border = canvasWidth * 0.03; // 3% border each side
  const max_r = canvasWidth * SCALE / 2;

  for (let i = 0; i < scaled_cart_path.length; i++) {
    const { rr, th, r, g, b } = scaled_cart_path[i];

    const scaled_rot = rot * ((10 * Math.PI * (max_r - rr)) / max_r);
    const rot_theta = th + scaled_rot;
    // console.log(`${theta} -> ${rot_theta}`);

    let xx = rr * Math.cos(rot_theta) - min_x;
    let yy = rr * Math.sin(rot_theta) - min_y;

    // Scale down
    xx = Math.round(xx + border);
    yy = Math.round(yy + border);

    const off = (yy * id.width + xx) * 4;
    pixels[off] = r;
    pixels[off + 1] = g;
    pixels[off + 2] = b;
    pixels[off + 3] = 192; // 75%, to account for a 2x SCALE
  }

  //ctx.putImageData(id, 0, 0);
  const newCanvas = document.createElement("canvas");
  newCanvas.width = id.width;
  newCanvas.height = id.height;

  newCanvas.getContext("2d")?.putImageData(id, 0, 0);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "black";
  ctx.fill();

  //ctx.filter = 'blur(1px)';
  ctx.drawImage(newCanvas, 0, 0);
}

function cart_ranges(path: number[][]) {
  let min_x = 0;
  let min_y = 0;
  let max_x = 0;
  let max_y = 0;

  // Convert polar_path to cartesian path
  for (let i = 0; i < path.length; i++) {
    const pt = path[i];

    const x = (pt[0] / 1) * Math.cos(pt[1] / 200);
    const y = (pt[0] / 1) * Math.sin(pt[1] / 200);

    min_x = Math.min(min_x, x);
    max_x = Math.max(max_x, x);

    min_y = Math.min(min_y, y);
    max_y = Math.max(max_y, y);
  }

  return { min_x, max_x, min_y, max_y };
}

// Persist the rotate timer ID across setup_image calls.
let rotateTimerIdMap = new Map<string, NodeJS.Timeout>();
let clickHandlerMap = new Map<string, any>();

export function setup_image(canvas: HTMLCanvasElement, id: string, seed: string) {
  if (canvas.getAttribute("spiralPresent") === id) {
    // console.log("Already has Spiral")
    return;
  }
  canvas.setAttribute("spiralPresent", id);

  const ctx = canvas.getContext("2d");

  // Reset scale
  ctx?.resetTransform();
  ctx?.scale(1/SCALE, 1/SCALE);

  // Remove any existing timers
  const rotateTimerId = rotateTimerIdMap.get(id);
  if (rotateTimerId) {
    clearInterval(rotateTimerId);
    rotateTimerIdMap.delete(id);
  }

  // Remove any existing listener
  const clkHdl = clickHandlerMap.get(id);
  if (clkHdl) {
    // console.log("Removing click handler that is present");
    canvas.removeEventListener('click', clkHdl);
    clickHandlerMap.delete(id);
  }

  const clearCanvas = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, canvasWidth * SCALE, canvasHeight * SCALE);
    ctx.rect(0, 0, canvas.width * SCALE, canvas.height * SCALE);
    ctx.fillStyle = "black";
    ctx.fill();
  }

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Load the static image at start while we compute everything else.
  const cachedImage = new Image();
  cachedImage.onload = function() {
    ctx?.save();
    ctx?.scale(SCALE, SCALE);
    ctx?.drawImage(cachedImage, 0, 0);
    ctx?.restore();
  };
  cachedImage.onerror = function() {
    if (!ctx) {
      return;
    }

    clearCanvas(ctx);
    ctx.fillStyle = 'white';
    ctx.font = '48px serif';
    ctx?.fillText("Loading...", 10, 100);
  }
  cachedImage.src = `/spiral_image/seed/${seed}/300`;

  let rot = 0;

  // Create the image and display it in a timeout, allowing any existing changes above to take effect and be shown to the user.
  setTimeout(() => {
    const { cart_path, C } = get_steps(seed);
    const { scaled_polar_path, min_x, min_y } = get_scaled_cart_path(cart_path, C, canvasWidth);

    const drawFirstImage = (rot: number) => {
      if (!ctx) {
        console.log("Couldn't get canvas context");
        return;
      }

      if (rot === 0) {
        clearCanvas(ctx);
      }

      draw_path_with_rot(ctx, canvasWidth, canvasHeight, scaled_polar_path, min_x, min_y, rot);
    };

    drawFirstImage(0);
    
    const clickHandler = () => {
      console.log(`Clicked for id ${id}`);
      if (!ctx) {
        console.log("Couldn't get canvas context");
        return;
      }

      const rotateTimerId = rotateTimerIdMap.get(id);
      if (rotateTimerId === undefined) {
        const rotateTimerId = setInterval(() => {
          rot += (2 * Math.PI) / (canvasWidth * 4 * 10);

          draw_path_with_rot(ctx, canvasWidth, canvasHeight, scaled_polar_path, min_x, min_y, rot);
        }, 1000 / 24);
        rotateTimerIdMap.set(id, rotateTimerId);
      } else {
        clearInterval(rotateTimerId);
        rotateTimerIdMap.delete(id);

        rot = 0;
        drawFirstImage(0);
      }
    };

    console.log("Adding click handler");
    canvas.addEventListener("click", clickHandler);
    clickHandlerMap.set(id, clickHandler);
  }, 1000);
}

