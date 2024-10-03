import cv, { Mat, Size } from "@u4/opencv4nodejs";

export function blurImage(image: Mat): Mat {
  const output = new Mat();
  const ksize = new Size(5, 5);
  const sigmaX = 0;
  const sigmaY = 0;
  cv.gaussianBlur(image, ksize, sigmaX, sigmaY, cv.BORDER_DEFAULT);
  return output;
}

export function sharpenImage(image: Mat): Mat {
  const kernel = new Mat(3, 3, cv.CV_32F, [-1, -1, -1, -1, 9, -1, -1, -1, -1]);
  return image.filter2D(cv.CV_8U, kernel);
}
