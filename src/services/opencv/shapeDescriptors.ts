import cv from "@techstark/opencv-js";

export function findContours(image: cv.Mat): cv.MatVector {
  const gray = new cv.Mat();
  cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.threshold(gray, gray, 100, 255, cv.THRESH_BINARY);

  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    gray,
    contours,
    hierarchy,
    cv.RETR_CCOMP,
    cv.CHAIN_APPROX_SIMPLE
  );

  gray.delete();
  hierarchy.delete();

  return contours;
}
