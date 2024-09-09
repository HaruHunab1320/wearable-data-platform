// src/worker.ts
import { Worker, Job } from "bullmq";
import { redisConfig } from "../redis/redisConfig";
import { PrismaClient } from "@prisma/client";
import { describeImage } from "../openai";
import { Storage } from "@google-cloud/storage";
import * as fs from "fs";

const prisma = new PrismaClient();

const storage = new Storage({
  projectId: process.env["GOOGLE_CLOUD_PROJECT_ID"],
  credentials: {
    client_email: process.env["GOOGLE_CLOUD_CLIENT_EMAIL"],
    private_key: process.env["GOOGLE_CLOUD_PRIVATE_KEY"]?.replace(/\\n/g, "\n"),
  },
});
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

    const [metadata] = await storage
      .bucket(process.env["GOOGLE_CLOUD_STORAGE_BUCKET"] as string)
      .file(imagePath)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      });

    if (!metadata) {
      console.error("Failed to get signed URL for image");
      return;
    }

    // 1. Send the image to OpenAI for description
    const description = await describeImage(imagePath);
    if (!description) {
      console.error("Failed to describe image");
      return;
    }

    await prisma.image.create({
      data: {
        url: metadata[0],
        description,
      },
    });

    await fs.promises.unlink(imagePath);

    console.log(
      `Image metadata saved to database with description: ${description}`
    );
  },
  { connection: redisConfig }
);
