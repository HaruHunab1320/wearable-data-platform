import cv from "@techstark/opencv-js";

export async function detectWithCascade(
  image: cv.Mat,
  modelPath: string
): Promise<cv.RectVector> {
  const classifier = new cv.CascadeClassifier();
  await classifier.load(modelPath);

  const gray = new cv.Mat();
  cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY, 0);

  const objects = new cv.RectVector();
  classifier.detectMultiScale(gray, objects, 1.1, 3, 0);

  gray.delete();
  return objects;
}
