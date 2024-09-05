import noble from "@abandonware/noble";
import {
  SERVICE_UUID,
  PHOTO_DATA_UUID,
  PHOTO_CONTROL_UUID,
} from "./src/utils/uuid";
import fs from "fs";
import path from "path";
import sharp from "sharp"; // You'll need to install this package: npm install sharp

let connectedDevice: any = null;

interface PhotoFrame {
  frameNumber: number;
  data: Buffer;
}

let photoFrames: PhotoFrame[] = [];
let expectedPhotoSize = 0;
let lastReceivedFrame = -1;

// Utility functions
const normalizeUUID = (uuid: string): string =>
  uuid.replace(/-/g, "").toLowerCase();

const handlePhotoData = (data: Buffer) => {
  console.log("Handling photo data, length:", data.length);
  console.log("First 16 bytes:", data.slice(0, 16).toString("hex"));

  if (data.length < 2) {
    console.error("Received data is too short to contain a frame number");
    return;
  }

  const frameNumber = data.readUInt16LE(0);
  console.log(`Received frame ${frameNumber}, data length: ${data.length}`);

  if (frameNumber === 0xffff) {
    console.log("End of image detected. Processing complete image...");
    processCompleteImage();
  } else {
    const payload = data.slice(2);
    console.log(
      `Frame ${frameNumber} payload first 16 bytes:`,
      payload.slice(0, 16).toString("hex")
    );

    // Check for missing frames
    if (frameNumber !== lastReceivedFrame + 1 && lastReceivedFrame !== -1) {
      console.warn(
        `Potential missing frames. Last: ${lastReceivedFrame}, Current: ${frameNumber}`
      );
    }
    lastReceivedFrame = frameNumber;

    photoFrames.push({ frameNumber, data: payload });

    // If this is the first frame, estimate the total photo size
    if (frameNumber === 0) {
      expectedPhotoSize = payload.length * 0xffff;
      console.log(`Estimated photo size: ${expectedPhotoSize} bytes`);
    }

    // Log progress
    const totalReceivedBytes = photoFrames.reduce(
      (sum, frame) => sum + frame.data.length,
      0
    );
    if (expectedPhotoSize > 0) {
      const progress = (totalReceivedBytes / expectedPhotoSize) * 100;
      console.log(`Photo transmission progress: ${progress.toFixed(2)}%`);
    }

    console.log(
      `Total frames received: ${photoFrames.length}, Total bytes: ${totalReceivedBytes}`
    );
  }
};

const processCompleteImage = async () => {
  console.log("Processing complete image...");

  // Sort frames by frame number
  photoFrames.sort((a, b) => a.frameNumber - b.frameNumber);

  // Concatenate all frame data
  const imageBuffer = Buffer.concat(photoFrames.map((frame) => frame.data));

  console.log("Assembled image size:", imageBuffer.length);
  console.log("First 32 bytes:", imageBuffer.slice(0, 32).toString("hex"));
  console.log("Last 32 bytes:", imageBuffer.slice(-32).toString("hex"));

  const imgPath = path.join(__dirname, "tmp", "images");
  if (!fs.existsSync(imgPath)) {
    fs.mkdirSync(imgPath, { recursive: true });
  }
  const timestamp = Date.now();

  // Save raw data
  const rawFile = path.join(imgPath, `${timestamp}_raw.bin`);
  fs.writeFileSync(rawFile, imageBuffer);
  console.log(`Saved raw data as ${rawFile}`);

  // Process, rotate, and save JPEG data
  try {
    const rotatedImage = await sharp(imageBuffer).rotate(270).toBuffer();

    const jpegFile = path.join(imgPath, `${timestamp}.jpg`);
    fs.writeFileSync(jpegFile, rotatedImage);
    console.log(`Saved processed and rotated JPEG as ${jpegFile}`);
  } catch (error) {
    console.error("Failed to process or rotate JPEG data:", error);
  }

  // Save debug info
  const debugInfo = photoFrames
    .map((frame) => `Frame ${frame.frameNumber}: ${frame.data.length} bytes`)
    .join("\n");
  fs.writeFileSync(path.join(imgPath, `${timestamp}_debug.txt`), debugInfo);

  // Reset for next image
  photoFrames = [];
  expectedPhotoSize = 0;
  lastReceivedFrame = -1;
};

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

const connectToDevice = async (peripheral: any) => {
  try {
    await peripheral.connectAsync();
    connectedDevice = peripheral; // Set the connected device
    console.log("Connected to:", peripheral.advertisement.localName);

    console.log(
      "Advertised service UUIDs:",
      peripheral.advertisement.serviceUuids
    );

    const services = await peripheral.discoverServicesAsync();
    console.log(
      "Discovered services:",
      services.map((service: any) => service.uuid)
    );

    const service = services.find(
      (s: any) => normalizeUUID(s.uuid) === normalizeUUID(SERVICE_UUID)
    );
    if (!service) {
      console.error(`Service with UUID ${SERVICE_UUID} not found!`);
      return;
    }

    const characteristics = await service.discoverCharacteristicsAsync();
    console.log(
      "Discovered characteristics:",
      characteristics.map((char: any) => char.uuid)
    );

    const photoCharacteristic = characteristics.find(
      (char: any) => normalizeUUID(char.uuid) === normalizeUUID(PHOTO_DATA_UUID)
    );

    if (photoCharacteristic) {
      console.log(
        "Photo characteristic found, UUID:",
        photoCharacteristic.uuid
      );
      console.log("Starting notifications for photo characteristic...");

      const events = ["data", "notification", "characteristicvaluechanged"];

      events.forEach((event) => {
        photoCharacteristic.on(
          event,
          (data: Buffer | any, isNotification?: boolean) => {
            console.log(`Event '${event}' triggered on photo characteristic`);

            try {
              let bufferData: Buffer;
              if (Buffer.isBuffer(data)) {
                bufferData = data;
              } else if (
                typeof data === "object" &&
                data.buffer instanceof ArrayBuffer
              ) {
                bufferData = Buffer.from(data.buffer);
              } else {
                console.error(
                  "Received data is not in an expected format:",
                  data
                );
                return;
              }

              console.log(
                `Received data (${
                  isNotification ? "notification" : "read/write"
                }), length:`,
                bufferData.length
              );
              console.log(
                "First 16 bytes:",
                bufferData.slice(0, 16).toString("hex")
              );

              handlePhotoData(bufferData);
            } catch (error) {
              console.error(`Error processing photo data: ${error}`);
            }
          }
        );
      });

      try {
        await photoCharacteristic.subscribeAsync();
        console.log("Subscribed to photo characteristic successfully");
      } catch (error) {
        console.error("Error subscribing to photo characteristic:", error);
      }
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

      // Find the service
      const services = await connectedDevice.discoverServicesAsync([
        SERVICE_UUID,
      ]);
      const service = services[0];

      if (service) {
        // Find the photo control characteristic
        const characteristics = await service.discoverCharacteristicsAsync([
          PHOTO_CONTROL_UUID,
        ]);
        const photoControlCharacteristic = characteristics[0];

        if (photoControlCharacteristic) {
          // Send command to stop photo capture (assuming 0 means stop)
          await photoControlCharacteristic.writeAsync(Buffer.from([0]), false);
          console.log("Photo capture stop command sent.");
        } else {
          console.log("Photo control characteristic not found.");
        }
      } else {
        console.log("Service not found.");
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
