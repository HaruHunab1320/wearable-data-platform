// src/worker.ts
import { Worker, Job } from "bullmq";
import { redisConfig } from "../redis/redisConfig";
import { PrismaClient } from "@prisma/client";
import { describeImage } from "../openai";

const prisma = new PrismaClient();
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

    // 1. Send the image to OpenAI for description
    const description = await describeImage(imagePath);
    await prisma.image.create({
      data: {
        filePath: imagePath,
        description,
      },
    });

    console.log(
      `Image metadata saved to database with description: ${description}`
    );
  },
  { connection: redisConfig }
);
