import cv, { Mat, BFMatcher } from "@u4/opencv4nodejs";

// Function to match descriptors between two images
export function matchDescriptors(descriptors1: Mat, descriptors2: Mat) {
  // Create BFMatcher object (using Hamming distance for ORB descriptors)
  const bf = new BFMatcher(cv.NORM_HAMMING, true);

  // Perform the matching
  const matches = bf.match(descriptors1, descriptors2);

  return matches;
}
