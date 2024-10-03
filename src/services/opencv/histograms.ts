import cv, { Mat, HistAxes, calcHist } from "@u4/opencv4nodejs";

export function calculateHistogram(image: Mat): Mat {
  const gray = image.cvtColor(cv.COLOR_BGR2GRAY);

  const histAxes = new HistAxes({
    channel: 0,
    bins: 256,
    ranges: [0, 256],
  });

  const hist = calcHist(gray, [histAxes]);

  gray.release();

  return hist;
}
