import cv from "@techstark/opencv-js";

export async function detectFacesWithDNN(
  image: cv.Mat,
  modelPath: string,
  configPath: string
): Promise<cv.RectVector> {
  const net = cv.readNetFromCaffe(configPath, modelPath);

  const blob = cv.blobFromImage(
    image,
    1.0,
    new cv.Size(300, 300),
    new cv.Scalar(104.0, 177.0, 123.0),
    false,
    false
  );
  net.setInput(blob);

  const detections = net.forward();
  const rects = new cv.RectVector();

  for (let i = 0; i < detections.rows; i++) {
    const confidence = detections.data32F[i * 7 + 2];
    if (confidence > 0.5) {
      const x1 = detections.data32F[i * 7 + 3] * image.cols;
      const y1 = detections.data32F[i * 7 + 4] * image.rows;
      const x2 = detections.data32F[i * 7 + 5] * image.cols;
      const y2 = detections.data32F[i * 7 + 6] * image.rows;
      rects.push_back(new cv.Rect(x1, y1, x2 - x1, y2 - y1));
    }
  }

  blob.delete();
  return rects;
}
