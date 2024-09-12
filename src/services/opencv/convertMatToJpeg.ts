import * as cv from "opencv4nodejs";

/**
 * Converts a Mat to a JPEG-encoded image and returns it as a base64 string.
 * @param mat The processed Mat image.
 * @returns The base64-encoded JPEG image string.
 */
export function convertMatToJpeg(mat: cv.Mat): string {
  // Create a canvas element
  const canvas = document.createElement("canvas");
  canvas.width = mat.cols;
  canvas.height = mat.rows;

  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  const imgData = new ImageData(
    new Uint8ClampedArray(mat.getData()),
    mat.cols,
    mat.rows
  );

  // Draw the image onto the canvas
  ctx.putImageData(imgData, 0, 0);

  // Convert the canvas to a base64-encoded JPEG
  const base64Image = canvas.toDataURL("image/jpeg");

  return base64Image;
}
