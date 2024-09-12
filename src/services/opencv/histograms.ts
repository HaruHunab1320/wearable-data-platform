import * as cv from "opencv4nodejs";

export function calculateHistogram(image: cv.Mat): cv.Mat {
  const gray = image.cvtColor(cv.COLOR_BGR2GRAY);

  const histAxes = new cv.HistAxes({
    channel: 0,
    bins: 256,
    ranges: [0, 256],
  });

  const hist = cv.calcHist(gray, [histAxes]);

  gray.release();

  return hist;
}
