import cv from "@techstark/opencv-js";

export function calculateHistogram(image: cv.Mat): cv.Mat {
  const gray = new cv.Mat();
  cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY, 0);

  const hist = new cv.Mat();
  const channels = [0];
  const mask = new cv.Mat();
  const histSize = [256];
  const ranges = [0, 256];

  const grayVector = new cv.MatVector();
  grayVector.push_back(gray);

  cv.calcHist(grayVector, channels, mask, hist, histSize, ranges, false);

  gray.delete();
  mask.delete();
  grayVector.delete();

  return hist;
}
