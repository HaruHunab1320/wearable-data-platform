import * as cv from "opencv4nodejs";

// Function to match descriptors between two images
export function matchDescriptors(descriptors1: cv.Mat, descriptors2: cv.Mat) {
  // Create BFMatcher object (using Hamming distance for ORB descriptors)
  const bf = new cv.BFMatcher(cv.NORM_HAMMING, true);

  // Perform the matching
  const matches = bf.match(descriptors1, descriptors2);

  return matches;
}
