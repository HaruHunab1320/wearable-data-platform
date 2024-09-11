import cv from "@techstark/opencv-js";

export function trackObject(
  prevImage: cv.Mat,
  nextImage: cv.Mat,
  prevPoints: cv.Mat
): cv.Mat {
  const nextPoints = new cv.Mat();
  const status = new cv.Mat();
  const err = new cv.Mat();
  cv.calcOpticalFlowPyrLK(
    prevImage,
    nextImage,
    prevPoints,
    nextPoints,
    status,
    err
  );

  status.delete();
  err.delete();

  return nextPoints;
}
