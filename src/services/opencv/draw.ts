import cv, { Mat, KeyPoint, DescriptorMatch } from "@u4/opencv4nodejs";

// Function to draw keypoints
export function drawKeypoints(image: Mat, keyPoints: KeyPoint[]): Mat {
  return cv.drawKeyPoints(image, keyPoints);
}

// Function to draw matches between two images
export function drawMatches(
  image1: Mat,
  keyPoints1: KeyPoint[],
  image2: Mat,
  keyPoints2: KeyPoint[],
  matches: DescriptorMatch[]
): Mat {
  return cv.drawMatches(image1, image2, keyPoints1, keyPoints2, matches);
}
