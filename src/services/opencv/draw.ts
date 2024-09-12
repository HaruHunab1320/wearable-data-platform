import * as cv from "opencv4nodejs";

// Function to draw keypoints
export function drawKeypoints(image: cv.Mat, keyPoints: cv.KeyPoint[]): cv.Mat {
  return cv.drawKeyPoints(image, keyPoints);
}

// Function to draw matches between two images
export function drawMatches(
  image1: cv.Mat,
  keyPoints1: cv.KeyPoint[],
  image2: cv.Mat,
  keyPoints2: cv.KeyPoint[],
  matches: cv.DescriptorMatch[]
): cv.Mat {
  return cv.drawMatches(image1, image2, keyPoints1, keyPoints2, matches);
}
