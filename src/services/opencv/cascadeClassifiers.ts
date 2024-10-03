import cv, { Mat, Rect } from "@u4/opencv4nodejs";

export async function detectWithCascade(
  image: Mat,
  modelPath: string
): Promise<Rect[]> {
  const classifier = new cv.CascadeClassifier(modelPath);
  const gray = image.cvtColor(cv.COLOR_BGR2GRAY);

  const objects = classifier.detectMultiScale(gray);
  const detectedObjects: Rect[] = [];
  for (const obj of objects.objects) {
    detectedObjects.push(new Rect(obj.x, obj.y, obj.width, obj.height));
  }

  gray.release();

  return detectedObjects;
}
