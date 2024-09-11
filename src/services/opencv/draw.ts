import cv from "@techstark/opencv-js";

// Function to draw keypoints
export function drawKeypoints(image: cv.Mat, keyPoints: cv.KeyPointVector) {
  const output = new cv.Mat(); // Output image
  const color = new cv.Scalar(255, 0, 0, 255); // Red color for keypoints
  const flags = cv.DRAW_RICH_KEYPOINTS; // Draw rich keypoints with orientation

  // Draw keypoints on the image
  cv.drawKeypoints(image, keyPoints, output, color, flags);

  return output; // Return the image with keypoints drawn
}

// Function to draw matches between two images
export function drawMatches(
  image1: cv.Mat,
  keyPoints1: cv.KeyPointVector,
  image2: cv.Mat,
  keyPoints2: cv.KeyPointVector,
  matches: cv.DMatchVector
) {
  const output = new cv.Mat();
  cv.drawMatches(image1, keyPoints1, image2, keyPoints2, matches, output);
  return output;
}
