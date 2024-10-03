import cv, { Mat, Contour, Rect, Vec3 } from "@u4/opencv4nodejs";

export function drawContours(image: Mat, contours: Contour[]): Mat {
  const output = image.copy();
  for (let i = 0; i < contours.length; i++) {
    output.drawContours([contours[i].getPoints()], 0, new Vec3(0, 255, 0), 2);
  }
  return output;
}

export function drawBoundingBoxes(image: Mat, objects: Rect[]): Mat {
  const output = image.copy();
  for (const rect of objects) {
    const point1 = new cv.Point2(rect.x, rect.y);
    const point2 = new cv.Point2(rect.x + rect.width, rect.y + rect.height);
    output.drawRectangle(point1, point2, new cv.Vec3(255, 0, 0), 2);
  }
  return output;
}
