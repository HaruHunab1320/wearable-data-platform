// src/queue.ts
import { Queue } from "bullmq";
import { redisConfig } from "../redis/redisConfig";

// Define the type for the job data
interface JobData {
  imagePath: string;
}

// Create the queue for image processing
const imageQueue = new Queue<JobData>("image-processing", {
  connection: redisConfig,
});

export default imageQueue;
