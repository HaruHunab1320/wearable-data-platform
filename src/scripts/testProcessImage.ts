import { processImage } from "../services/opencv/processImage";
import fs from "fs";
import path from "path";

const imageDirectory = "tmp/images";
const modelPath = "path/to/your/model.caffemodel";
const configPath = "path/to/your/config.prototxt";

async function testProcessImage() {
  const imageFiles = fs
    .readdirSync(imageDirectory)
    .filter((file) =>
      [".jpg", ".jpeg", ".png"].includes(path.extname(file).toLowerCase())
    );

  for (const imageFile of imageFiles) {
    const imagePath = path.join(imageDirectory, imageFile);
    console.log(`Processing image: ${imagePath}`);

    try {
      const result = await processImage(imagePath, modelPath, configPath);
      console.log(`Results for ${imageFile}:`);
      console.log(`- People detected: ${result.people.length}`);
      console.log(`- Faces detected: ${result.faces.length}`);
      console.log(`- Key points detected: ${result.keyPoints.length}`);
      console.log(`- Contours found: ${result.contours.length}`);
      console.log("---");
    } catch (error) {
      console.error(`Error processing ${imageFile}:`, error);
    }
  }
}

testProcessImage().catch(console.error);
