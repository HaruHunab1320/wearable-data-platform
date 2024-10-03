import cv from "@u4/opencv4nodejs";
import { detectWithHOG } from "./hogDescriptors";
import { detectFacesWithDNN } from "./dnnFaceDetection";
import { detectAndDescribeFeatures } from "./detectAndDescribeFeatures";
import { findContours } from "./shapeDescriptors";
import { drawBoundingBoxes, drawContours } from "./drawingFunctions";

export async function processImage(
  imagePath: string,
  modelPath: string,
  configPath: string
) {
  const image = cv.imread(imagePath);

  // Detect people
  const people = detectWithHOG(imagePath);

  // Detect faces
  const faces = await detectFacesWithDNN(image, modelPath, configPath);

  // Detect features
  const { keyPoints, descriptors } = detectAndDescribeFeatures(imagePath);

  // Find contours
  const contours = await findContours(image);

  // Draw results
  let resultImage = image.copy();
  resultImage = drawBoundingBoxes(resultImage, people);
  resultImage = drawBoundingBoxes(resultImage, faces);
  resultImage = drawContours(resultImage, contours);

  // Display or save the result
  cv.imshow("Processed Image", resultImage);
  cv.waitKey();

  // Clean up
  image.release();
  resultImage.release();

  return {
    people,
    faces,
    keyPoints,
    descriptors,
    contours,
  };
}
