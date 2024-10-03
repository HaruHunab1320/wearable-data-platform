import cv, { Mat, Contour } from "@u4/opencv4nodejs";

export async function findContours(image: Mat): Promise<Contour[]> {
  const gray = image.cvtColor(cv.COLOR_RGBA2GRAY);
  const thresholded = gray.threshold(100, 255, cv.THRESH_BINARY);

  const contours = await thresholded.findContoursAsync(
    cv.RETR_CCOMP,
    cv.CHAIN_APPROX_SIMPLE
  );

  gray.release();

  return contours;
}
