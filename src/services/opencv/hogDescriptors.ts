import cv from "@techstark/opencv-js";

export function detectWithHOG(image: cv.Mat): cv.RectVector {
  const hog = new cv.HOGDescriptor();
  const descriptors = new cv.Mat();
  const objects = new cv.RectVector();

  // Set the SVM detector (Pre-trained people detector)
  hog.setSVMDetector(cv.HOGDescriptor.getDefaultPeopleDetector());

  // Detect people in the image
  hog.detectMultiScale(
    image,
    objects,
    descriptors,
    0,
    new cv.Size(8, 8),
    new cv.Size(32, 32),
    1.05,
    2,
    false
  );

  descriptors.delete();
  return objects;
}
