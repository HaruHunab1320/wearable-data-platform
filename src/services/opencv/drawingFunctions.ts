import * as cv from "opencv4nodejs";

export function drawContours(image: cv.Mat, contours: cv.Contour[]): cv.Mat {
  const output = image.copy();
  for (let i = 0; i < contours.length; i++) {
    output.drawContours([contours[i]], new cv.Vec3(0, 255, 0), -1, 2);
  }
  return output;
}

export function drawBoundingBoxes(image: cv.Mat, objects: cv.Rect[]): cv.Mat {
  const output = image.copy();
  for (const rect of objects) {
    const point1 = new cv.Point2(rect.x, rect.y);
    const point2 = new cv.Point2(rect.x + rect.width, rect.y + rect.height);
    output.drawRectangle(point1, point2, new cv.Vec3(255, 0, 0), 2);
  }
  return output;
}
