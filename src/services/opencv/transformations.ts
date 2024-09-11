import cv from "@techstark/opencv-js";

export function resizeImage(
  image: cv.Mat,
  width: number,
  height: number
): cv.Mat {
  const output = new cv.Mat();
  const dsize = new cv.Size(width, height);
  cv.resize(image, output, dsize, 0, 0, cv.INTER_LINEAR);
  return output;
}

export function rotateImage(image: cv.Mat, angle: number): cv.Mat {
  const center = new cv.Point(image.cols / 2, image.rows / 2);
  const matrix = cv.getRotationMatrix2D(center, angle, 1);
  const output = new cv.Mat();
  cv.warpAffine(image, output, matrix, new cv.Size(image.cols, image.rows));
  return output;
}
