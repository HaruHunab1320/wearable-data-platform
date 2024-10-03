import cv, { Mat, Point2, Size, getRotationMatrix2D } from "@u4/opencv4nodejs";

export function resizeImage(image: Mat, width: number, height: number): Mat {
  const output = new Mat();
  const dsize = new Size(width, height);
  image.resize(dsize, 0, 0, cv.INTER_LINEAR);
  return output;
}

export function rotateImage(image: Mat, angle: number): Mat {
  const center = new Point2(image.cols / 2, image.rows / 2);
  const matrix = getRotationMatrix2D(center, angle, 1);

  return image.warpAffine(matrix, new Size(image.cols, image.rows));
}
