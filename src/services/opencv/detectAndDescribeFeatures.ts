import cv from "@techstark/opencv-js";

// Function to detect keypoints and compute descriptors
export function detectAndDescribeFeatures(imagePath: string) {
  // Read the image
  const src = cv.imread(imagePath);

  // Convert the image to grayscale (features work better in grayscale)
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

  // Initialize ORB detector
  const orb = new cv.ORB();

  // Detect keypoints and compute descriptors
  const keyPoints = new cv.KeyPointVector();
  const descriptors = new cv.Mat();
  orb.detectAndCompute(gray, new cv.Mat(), keyPoints, descriptors);

  // Clean up
  src.delete();
  gray.delete();

  return { keyPoints, descriptors };
}
