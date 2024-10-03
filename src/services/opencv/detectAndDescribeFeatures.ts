import cv from "@u4/opencv4nodejs";

// Function to detect keypoints and compute descriptors
export function detectAndDescribeFeatures(imagePath: string) {
  // Read the image
  const src = cv.imread(imagePath);

  // Convert the image to grayscale (features work better in grayscale)
  const gray = src.cvtColor(cv.COLOR_RGBA2GRAY);

  // Initialize ORB detector
  const orb = new cv.ORBDetector();

  // Detect keypoints and compute descriptors
  const keyPoints = orb.detect(gray);
  const descriptors = orb.compute(gray, keyPoints);

  // Clean up
  src.release();
  gray.release();

  return { keyPoints, descriptors };
}
