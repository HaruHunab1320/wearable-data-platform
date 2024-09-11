import cv from "@techstark/opencv-js";

export function blurImage(image: cv.Mat): cv.Mat {
  const output = new cv.Mat();
  const ksize = new cv.Size(5, 5); // Kernel size for blurring
  cv.GaussianBlur(image, output, ksize, 0, 0, cv.BORDER_DEFAULT);
  return output;
}

export function sharpenImage(image: cv.Mat): cv.Mat {
  const output = new cv.Mat();
  const kernel = cv.matFromArray(
    3,
    3,
    cv.CV_32F,
    [-1, -1, -1, -1, 9, -1, -1, -1, -1]
  );
  cv.filter2D(image, output, cv.CV_8U, kernel);
  return output;
}
