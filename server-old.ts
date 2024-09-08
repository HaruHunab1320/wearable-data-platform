import noble from "@abandonware/noble";
import {
  SERVICE_UUID,
  PHOTO_DATA_UUID,
  PHOTO_CONTROL_UUID,
} from "./src/utils/uuid";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

let connectedDevice: any = null;
let isReceivingImage = false;
let imageBuffer: Buffer | null = null;
let receivedBytes = 0;
let lastChunkTime = 0;
let imageCount = 0;
const CHUNK_TIMEOUT = 10000; // 10 seconds

const normalizeUUID = (uuid: string): string =>
  uuid.replace(/-/g, "").toLowerCase();

// Handles incoming photo data chunks
const handlePhotoData = async (data: Buffer) => {
  console.log("Handling photo data, length:", data.length);

  if (data.length < 2) {
    console.error("Received data is too short to contain a chunk ID");
    return;
  }

  const chunkId = data.readUInt16LE(0);
  const packet = data.slice(2); // Remove chunk ID

  if (chunkId === 0xffff) {
    console.log("End of image marker received. Processing complete image...");
    await processCompleteImage();
    return;
  }

  if (!isReceivingImage) {
    console.log("Starting new image reception");
    resetImageReception();
    isReceivingImage = true;
    imageBuffer = Buffer.alloc(1024 * 1024); // Allocate 1MB buffer, adjust if needed
  }

  packet.copy(imageBuffer!, receivedBytes);
  receivedBytes += packet.length;
  lastChunkTime = Date.now();
  console.log(`Received chunk ${chunkId}, total bytes: ${receivedBytes}`);
};

// Resets the image reception state
const resetImageReception = () => {
  console.log("Resetting image reception");
  isReceivingImage = false;
  imageBuffer = null;
  receivedBytes = 0;
  lastChunkTime = 0;
};

// Rotates image data (useful if the orientation needs adjustment)
const rotateImageData = (
  buffer: Buffer,
  width: number,
  height: number
): Buffer => {
  const rotated = Buffer.alloc(buffer.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIndex = (y * width + x) * 3;
      const dstIndex = ((width - x - 1) * height + y) * 3;
      rotated[dstIndex] = buffer[srcIndex];
      rotated[dstIndex + 1] = buffer[srcIndex + 1];
      rotated[dstIndex + 2] = buffer[srcIndex + 2];
    }
  }
  return rotated;
};

// Processes the complete image
const processCompleteImage = async () => {
  imageCount++;
  console.log(`Processing image #${imageCount}...`);
  console.log(`Received ${receivedBytes} bytes`);

  if (!imageBuffer || receivedBytes === 0) {
    console.warn("No image data received. Skipping image processing.");
    resetImageReception();
    return;
  }

  const finalImageBuffer = imageBuffer.slice(0, receivedBytes);

  console.log("First 32 bytes:", finalImageBuffer.slice(0, 32).toString("hex"));
  console.log("Last 32 bytes:", finalImageBuffer.slice(-32).toString("hex"));

  const imgPath = path.join(__dirname, "tmp", "images");
  if (!fs.existsSync(imgPath)) {
    fs.mkdirSync(imgPath, { recursive: true });
  }
  const timestamp = Date.now();

  // Save raw data
  const rawFile = path.join(imgPath, `${timestamp}_raw.bin`);
  fs.writeFileSync(rawFile, finalImageBuffer);
  console.log(`Saved raw data as ${rawFile}`);

  try {
    // Assume the image is 800x600 (adjust these values if different)
    const width = 800;
    const height = 600;
    const rotatedBuffer = rotateImageData(finalImageBuffer, width, height);

    // Save rotated raw data for debugging
    const rotatedRawFile = path.join(imgPath, `${timestamp}_rotated_raw.bin`);
    fs.writeFileSync(rotatedRawFile, rotatedBuffer);
    console.log(`Saved rotated raw data as ${rotatedRawFile}`);

    // Use sharp to process the rotated image
    const image = sharp(rotatedBuffer, {
      raw: { width: height, height: width, channels: 3 },
    });
    const metadata = await image.metadata();
    console.log("Image metadata:", metadata);

    // Save the processed JPEG
    const processedJpegFile = path.join(imgPath, `${timestamp}_processed.jpg`);
    await image.jpeg().toFile(processedJpegFile);
    console.log(`Saved processed JPEG as ${processedJpegFile}`);

    // Save the rotated JPEG (no need for additional rotation)
    const rotatedJpegFile = path.join(imgPath, `${timestamp}_rotated.jpg`);
    await image.jpeg().toFile(rotatedJpegFile);
    console.log(`Saved rotated JPEG as ${rotatedJpegFile}`);
  } catch (error) {
    console.error("Failed to process image data:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }

    // Save the raw buffer as a JPEG even if processing fails
    const rawJpegFile = path.join(imgPath, `${timestamp}_raw.jpg`);
    fs.writeFileSync(rawJpegFile, finalImageBuffer);
    console.log(`Saved raw JPEG as ${rawJpegFile}`);
  }

  resetImageReception();
};

// Timeout check to process incomplete images
const checkImageTimeout = () => {
  if (isReceivingImage && Date.now() - lastChunkTime > CHUNK_TIMEOUT) {
    console.log("Image reception timed out. Processing partial image...");
    processCompleteImage();
  }
};

// Call this function periodically, e.g., every second
setInterval(checkImageTimeout, 1000);

// Bluetooth functions
const startBluetoothScanning = async () => {
  noble.on("stateChange", async (state) => {
    if (state === "poweredOn") {
      console.log("Bluetooth scanning started...");
      await noble.startScanningAsync([SERVICE_UUID], false);
    } else {
      await noble.stopScanningAsync();
    }
  });

  noble.on("discover", async (peripheral) => {
    if (peripheral.advertisement.localName === "OpenGlass") {
      console.log("Discovered:", peripheral.advertisement.localName);
      await noble.stopScanningAsync();
      await connectToDevice(peripheral);
    }
  });
};

// Connects to the Bluetooth device
const connectToDevice = async (peripheral: any) => {
  try {
    await peripheral.connectAsync();
    connectedDevice = peripheral; // Set the connected device
    console.log("Connected to:", peripheral.advertisement.localName);

    const services = await peripheral.discoverServicesAsync();
    const service = services.find(
      (s: any) => normalizeUUID(s.uuid) === normalizeUUID(SERVICE_UUID)
    );
    if (!service) {
      console.error(`Service with UUID ${SERVICE_UUID} not found!`);
      return;
    }

    const characteristics = await service.discoverCharacteristicsAsync();
    const photoCharacteristic = characteristics.find(
      (char: any) => normalizeUUID(char.uuid) === normalizeUUID(PHOTO_DATA_UUID)
    );

    if (photoCharacteristic) {
      // Start notifications on the characteristic
      photoCharacteristic.notify(true, (error: any) => {
        if (error) {
          console.error("Error starting notifications:", error);
          return;
        }
        console.log("Notifications started for photo characteristic.");
      });

      photoCharacteristic.on("data", (data: Buffer) => {
        console.log(`Received photo data, length: ${data.length}`);
        handlePhotoData(data);
      });

      console.log(
        "Photo characteristic found and notifications started, UUID:",
        photoCharacteristic.uuid
      );
    } else {
      console.log("Photo characteristic not found.");
    }

    const photoControlCharacteristic = characteristics.find(
      (char: any) =>
        normalizeUUID(char.uuid) === normalizeUUID(PHOTO_CONTROL_UUID)
    );

    if (photoControlCharacteristic) {
      console.log("Writing to photo control characteristic...");
      await photoControlCharacteristic.writeAsync(Buffer.from([-1]), false);
    }
  } catch (error) {
    console.error("Error connecting to device:", error);
  }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down...`);

  await noble.stopScanningAsync();

  if (connectedDevice) {
    try {
      console.log("Stopping photo capture...");

      const services = await connectedDevice.discoverServicesAsync([
        SERVICE_UUID,
      ]);
      const service = services[0];

      if (service) {
        const characteristics = await service.discoverCharacteristicsAsync([
          PHOTO_CONTROL_UUID,
        ]);
        const photoControlCharacteristic = characteristics[0];

        if (photoControlCharacteristic) {
          await photoControlCharacteristic.writeAsync(Buffer.from([0]), false); // Stop command
          console.log("Photo capture stop command sent.");
        }
      }
      console.log("Disconnecting Bluetooth device...");
      await connectedDevice.disconnectAsync();
      console.log("Bluetooth device disconnected.");
    } catch (error) {
      console.error("Error during shutdown process:", error);
    }
  }

  setTimeout(() => {
    console.log("Forcefully exiting...");
    process.exit(1);
  }, 5000);

  process.exit(0);
};

// Event listeners for graceful shutdown
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Start the server
const startServer = async () => {
  console.log("Starting server...");
  await startBluetoothScanning();
};

startServer();
