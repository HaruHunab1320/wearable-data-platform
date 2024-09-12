import * as cv from "opencv4nodejs";

export async function detectWithCascade(
  image: cv.Mat,
  modelPath: string
): Promise<cv.Rect[]> {
  const classifier = new cv.CascadeClassifier(modelPath);
  const gray = image.cvtColor(cv.COLOR_BGR2GRAY);

  const objects = classifier.detectMultiScale(gray);
  const detectedObjects: cv.Rect[] = [];
  for (const obj of objects.objects) {
    detectedObjects.push(new cv.Rect(obj.x, obj.y, obj.width, obj.height));
  }

  gray.release();

  return detectedObjects;
}
