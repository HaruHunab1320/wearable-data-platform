import * as cv from "opencv4nodejs";

export async function detectFacesWithDNN(
  image: cv.Mat,
  modelPath: string,
  configPath: string
): Promise<cv.Rect[]> {
  const net = await cv.readNetFromCaffeAsync(configPath, modelPath);

  const blob = cv.blobFromImage(
    image,
    1.0,
    new cv.Size(300, 300),
    new cv.Vec3(104.0, 177.0, 123.0),
    false,
    false
  );

  net.setInput(blob);

  const detections = await net.forwardAsync();
  const faces: cv.Rect[] = [];

  for (let i = 0; i < detections.rows; i++) {
    const confidence = detections.at(i, 2);
    if (confidence > 0.5) {
      const x1 = detections.at(i, 3) * image.cols;
      const y1 = detections.at(i, 4) * image.rows;
      const x2 = detections.at(i, 5) * image.cols;
      const y2 = detections.at(i, 6) * image.rows;
      faces.push(new cv.Rect(x1, y1, x2 - x1, y2 - y1));
    }
  }

  blob.release();
  return faces;
}
