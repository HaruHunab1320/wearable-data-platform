import cv from "@techstark/opencv-js";

export function drawContours(image: cv.Mat, contours: cv.MatVector): cv.Mat {
  const output = image.clone();
  for (let i = 0; i < contours.size(); i++) {
    cv.drawContours(output, contours, i, [0, 255, 0, 255], 2);
  }
  return output;
}

export function drawBoundingBoxes(
  image: cv.Mat,
  objects: cv.RectVector
): cv.Mat {
  const output = image.clone();
  for (let i = 0; i < objects.size(); ++i) {
    const rect = objects.get(i);
    const point1 = new cv.Point(rect.x, rect.y);
    const point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);
    cv.rectangle(output, point1, point2, [255, 0, 0, 255], 2);
  }
  return output;
}
