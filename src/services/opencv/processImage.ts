import * as cv from "opencv4nodejs";
import { detectWithHOG } from "./hogDescriptors";
import { detectAndDescribeFeatures } from "./detectAndDescribeFeatures";
import { drawBoundingBoxes } from "./drawingFunctions";

export interface ProcessedImageData {
  objects: cv.Rect[];
  keyPoints: cv.KeyPoint[];
  descriptors: cv.Mat;
  imageWithBoxes: cv.Mat;
}

export function processImage(imagePath: string): ProcessedImageData {
  const image = cv.imread(imagePath);

  // 1. Object Detection
  const objects = detectWithHOG(imagePath);
  const imageWithBoxes = drawBoundingBoxes(image, objects);

  // 2. Feature Detection and Description
  const { keyPoints, descriptors } = detectAndDescribeFeatures(imagePath);

  // Clean up
  image.release();

  return {
    objects,
    keyPoints,
    descriptors,
    imageWithBoxes,
  };
}
