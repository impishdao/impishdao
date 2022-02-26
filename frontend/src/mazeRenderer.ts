/* eslint-disable no-undef */
/* eslint-disable camelcase */

import { random_255, random_bool, random_generator, rgbToHex } from "./renderUtils";

function renderToCanvas(maze_seed: string, ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.rect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "white";
  ctx.fill();

  const size = 40;
  const sqWidth = 600 / size;

  const squares: boolean[][] = [];

  const gen = random_generator(maze_seed);
  for (let i = 0; i < size; i++) {
    squares[i] = [];
    for (let j = 0; j < size; j++) {
      squares[i][j] = random_255(gen) < 150;
    }
  }

  // Draw only boundaries
  ctx.strokeStyle = "black";
  for (let r = 0; r < size; r++) {  
    for (let c = 0; c < size; c++) {
      // left border
      const lborder = c === 0 || squares[r][c - 1] !== squares[r][c];
      if (lborder) {
        ctx.moveTo(c * sqWidth, r * sqWidth);
        ctx.lineTo(c * sqWidth, (r + 1) * sqWidth);
        ctx.stroke();
      }

      // bottom border
      const bborder = r == 0 || squares[r - 1][c] != squares[r][c];
      if (bborder) {
        ctx.moveTo(c * sqWidth, r * sqWidth);
        ctx.lineTo((c + 1) * sqWidth, r * sqWidth);
        ctx.stroke();
      }

      // if (squares[r][c]) {
      //   ctx.fillStyle = rgbToHex({r: 200, g: 200, b: 200});
      // } else {
      //   ctx.fillStyle = rgbToHex({r: 20, g: 20, b: 20});
      // }

      // ctx.fillRect(c*sqWidth+3, r*sqWidth+3, sqWidth - 6, sqWidth - 6);
    }
  }
}

export function setup_maze(canvas: HTMLCanvasElement, maze_seed: string) {
  const ctx = canvas.getContext("2d");

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  if (ctx) {
    renderToCanvas(maze_seed, ctx, canvasWidth, canvasHeight);
  } else {
    console.log("No context");
  }
}
