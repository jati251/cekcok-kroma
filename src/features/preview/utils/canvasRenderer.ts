/**
 * Canvas Renderer Utilities for Program Monitor
 * Handles aspect-ratio preservation, letterboxing, and empty timeline black-outs.
 */

export interface RenderDimensions {
  drawX: number;
  drawY: number;
  drawWidth: number;
  drawHeight: number;
}

/**
 * Calculates letterboxed or pillarboxed dimensions to fit within canvas while maintaining aspect ratio.
 */
export function calculateFitDimensions(
  canvasWidth: number,
  canvasHeight: number,
  frameWidth: number,
  frameHeight: number
): RenderDimensions {
  if (canvasWidth <= 0 || canvasHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return { drawX: 0, drawY: 0, drawWidth: canvasWidth, drawHeight: canvasHeight };
  }

  const canvasRatio = canvasWidth / canvasHeight;
  const frameRatio = frameWidth / frameHeight;

  let drawWidth = canvasWidth;
  let drawHeight = canvasHeight;
  let drawX = 0;
  let drawY = 0;

  if (frameRatio > canvasRatio) {
    drawHeight = canvasWidth / frameRatio;
    drawY = (canvasHeight - drawHeight) / 2;
  } else {
    drawWidth = canvasHeight * frameRatio;
    drawX = (canvasWidth - drawWidth) / 2;
  }

  return { drawX, drawY, drawWidth, drawHeight };
}

/**
 * Fills the entire canvas with solid black (#000000).
 * Used when the playhead is over an empty gap or outside any media.
 */
export function renderBlackFrame(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Draws a VideoFrame onto the canvas with proper aspect ratio letterboxing.
 */
export function renderVideoFrame(
  canvas: HTMLCanvasElement | null,
  frame: VideoFrame
): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { drawX, drawY, drawWidth, drawHeight } = calculateFitDimensions(
    canvas.width,
    canvas.height,
    frame.displayWidth,
    frame.displayHeight
  );

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(frame as CanvasImageSource, drawX, drawY, drawWidth, drawHeight);
}
