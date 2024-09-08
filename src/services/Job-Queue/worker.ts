// src/worker.ts
import { Worker, Job } from "bullmq";
import { redisConfig } from "../redis/redisConfig";
import fs from "fs";
import path from "path";
import axios from "axios"; // Use axios for HTTP requests

// Define the type for job data
interface JobData {
  imagePath: string;
}

// Create the worker that processes image jobs
export const imageWorker = new Worker<JobData>(
  "image-processing",
  async (job: Job<JobData>) => {
    const { imagePath } = job.data;

    console.log(`Processing image at path: ${imagePath}`);

    // 1. Send the image to LLM for description
    const description = await getDescriptionFromLLM(imagePath);

    // 2. Save the description metadata (example using a simple JSON file)
    const metadataPath = path.join(
      __dirname,
      "tmp/images",
      `${path.basename(imagePath, ".jpg")}.json`
    );
    fs.writeFileSync(metadataPath, JSON.stringify({ description }));

    console.log(`Image processed and tagged with description: ${description}`);
  },
  { connection: redisConfig }
);

// Helper function to get a description from the LLM
const getDescriptionFromLLM = async (imagePath: string): Promise<string> => {
  const imageData = fs.readFileSync(imagePath);

  try {
    const response = await axios.post("https://your-llm-api.com/descriptions", {
      image: imageData.toString("base64"), // Send image as base64
    });
    return response.data.description;
  } catch (error) {
    console.error("Error communicating with LLM:", error);
    throw new Error("Failed to get description from LLM");
  }
};
