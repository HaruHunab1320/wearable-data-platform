import * as cv from "opencv4nodejs";

export function blurImage(image: cv.Mat): cv.Mat {
  const output = new cv.Mat();
  const ksize = new cv.Size(5, 5);
  const sigmaX = 0;
  const sigmaY = 0;
  cv.gaussianBlur(image, ksize, sigmaX, sigmaY, cv.BORDER_DEFAULT);
  return output;
}

export function sharpenImage(image: cv.Mat): cv.Mat {
  const kernel = new cv.Mat(
    3,
    3,
    cv.CV_32F,
    [-1, -1, -1, -1, 9, -1, -1, -1, -1]
  );
  return image.filter2D(cv.CV_8U, kernel);
}
