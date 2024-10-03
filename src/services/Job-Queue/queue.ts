// src/queue.ts
import { Queue } from "bullmq";
import { redisConfig } from "../redis/redisConfig";

// Define the type for the job data
interface JobData {
  imagePath: string;
}

// Create the queue for image processing
export const imageQueue = new Queue<JobData>("image-processing", {
  connection: redisConfig,
});
