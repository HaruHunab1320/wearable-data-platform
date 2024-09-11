import { Worker, Job, QueueEvents } from "bullmq";
import { redisConfig } from "../redis/redisConfig";
import { PrismaClient } from "@prisma/client";
import { describeImage } from "../openai";
import { Storage } from "@google-cloud/storage";
import * as fs from "fs/promises";
import * as path from "path";

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
    try {
      const { imagePath } = job.data;

      console.log(`Processing image: ${imagePath}`);

      // Ensure the file exists
      if (
        !(await fs
          .access(imagePath)
          .then(() => true)
          .catch(() => false))
      ) {
        throw new Error(`File not found: ${imagePath}`);
      }

      // 1. Read the image file
      const imageBuffer = await fs.readFile(imagePath);

      const description = await describeImage(imagePath);
      if (!description) {
        throw new Error("Failed to describe image");
      }

      // 3. Upload the image to Google Cloud Storage
      const bucket = storage.bucket(
        process.env["GOOGLE_CLOUD_STORAGE_BUCKET"] as string
      );
      const file = bucket.file(`image_${path.basename(imagePath)}`);

      await file.save(imageBuffer, {
        contentType: "image/jpeg",
      });

      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000, // 15 mins
      });

      // 4. Save metadata to database
      const newImage = await prisma.image.create({
        data: {
          url,
          description,
          capturedAt: BigInt(job.data.imagePath.split("_")[1]),
        },
      });

      if (!newImage) {
        throw new Error("Failed to save image metadata to database");
      }
      console.log(
        `Image metadata saved to database with description: ${description}`
      );

      // 5. Delete the local file
      await fs.unlink(imagePath);
      console.log(`Deleted local file: ${imagePath}`);
    } catch (error) {
      console.error("Error in imageWorker:", error);
    }
  },
  { connection: redisConfig }
);

async function runWorker() {
  console.log("Starting worker...");

  const queueEvents = new QueueEvents("image-processing", {
    connection: redisConfig,
  });

  queueEvents.on("completed", (job) => {
    console.log(`Job ${job.jobId} has completed!`);
  });

  queueEvents.on("failed", (job, err) => {
    console.log(`Job ${job.jobId} has failed with ${err}`);
  });

  imageWorker.on("active", (job) => {
    console.log(`Job ${job.id} is now active!`);
  });

  // Keep the script running
  await new Promise(() => {});
}

runWorker().catch(console.error);
