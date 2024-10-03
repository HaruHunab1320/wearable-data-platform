import cv, { Rect } from "@u4/opencv4nodejs";

export async function detectObject(
  imagePath: string,
  modelPath: string
): Promise<Rect[]> {
  const classifier = new cv.CascadeClassifier(modelPath);

  // Read the image
  const src = cv.imread(imagePath);

  // Convert the image to grayscale (features work better in grayscale)
  const gray = src.cvtColor(cv.COLOR_RGBA2GRAY);

  const result = await classifier.detectMultiScaleAsync(gray);
  gray.release();
  return result.objects;
}
