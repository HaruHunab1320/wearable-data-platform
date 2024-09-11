import cv from "@techstark/opencv-js";

export function detectFeatures(image: cv.Mat): {
  keyPoints: cv.KeyPointVector;
  descriptors: cv.Mat;
} {
  const gray = new cv.Mat();
  cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY, 0);

  const orb = new cv.ORB();
  const keyPoints = new cv.KeyPointVector();
  const descriptors = new cv.Mat();

  orb.detectAndCompute(gray, new cv.Mat(), keyPoints, descriptors);

  gray.delete();

  return { keyPoints, descriptors };
}
