import * as cv from "opencv4nodejs";

export function detectWithHOG(imagePath: string) {
  // Load the image
  const image = cv.imread(imagePath);

  // Initialize HOGDescriptor with default people detector
  const hog = new cv.HOGDescriptor();
  hog.setSVMDetector(hog.getDefaultPeopleDetector());

  // Detect people
  const { foundLocations, foundWeights } = hog.detectMultiScale(image);

  console.log("Found people locations:", foundLocations);
  console.log("Detection confidence scores:", foundWeights);

  // Draw rectangles around detected people
  foundLocations.forEach((rect) => {
    image.drawRectangle(
      new cv.Point2(rect.x, rect.y),
      new cv.Point2(rect.x + rect.width, rect.y + rect.height),
      new cv.Vec3(0, 255, 0), // Green color for the rectangle
      2 // Line thickness
    );
  });

  // Display the result
  cv.imshow("Detected People", image);
  cv.waitKey();

  image.release();
  return foundLocations;
}
