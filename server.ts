import noble from "@abandonware/noble";
import {
  SERVICE_UUID,
  PHOTO_DATA_UUID,
  PHOTO_CONTROL_UUID,
} from "./src/utils/uuid";
import * as fs from "fs";
import * as path from "path";

let connectedDevice: any = null;

const normalizeUUID = (uuid: string): string =>
  uuid.replace(/-/g, "").toLowerCase();

let buffer: Buffer = Buffer.alloc(0); // Buffer to hold incoming photo data
let previousChunk = -1; // Track the previous chunk ID

// Save photo function
const savePhoto = (photoBuffer: Buffer) => {
  const filePath = path.join(__dirname, "tmp", "images", `${Date.now()}.jpg`);
  fs.writeFile(filePath, photoBuffer, (err) => {
    if (err) {
      console.error("Error saving photo:", err);
    } else {
      console.log(`Photo saved at: ${filePath}`);
    }
  });
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

      photoCharacteristic.on("data", handlePhotoData);

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
      await photoControlCharacteristic.writeAsync(Buffer.from([0x05]), false); // Start command
    }
  } catch (error) {
    console.error("Error connecting to device:", error);
  }
};

let capturing = false; // New flag to indicate if we are currently capturing an image

const handlePhotoData = (data: Buffer) => {
  const packetId = data.readUInt16LE(0); // Get the packet ID
  const packet = data.slice(2); // Get the actual image data after the first 2 bytes

  console.log(
    `Received chunk with packetId: ${packetId}, size: ${packet.length}`
  );

  // If packetId is 65535 (0xFFFF), it's the end of the image transmission
  if (packetId === 0xffff) {
    console.log(`Photo complete, total size: ${buffer.length} bytes`);

    // Save the complete image
    savePhoto(buffer);

    // Reset for the next capture
    previousChunk = -1;
    capturing = false;
    buffer = Buffer.alloc(0); // Reset buffer for next image
    return;
  }

  // If we haven't started capturing yet, wait for the first valid packet (packetId = 0)
  if (!capturing) {
    if (packetId === 0) {
      console.log("Starting new photo capture");
      capturing = true;
      previousChunk = 0;
      buffer = Buffer.concat([buffer, packet]); // Initialize the buffer with the first packet
    } else {
      console.log("Ignoring packet until valid start of image (packetId = 0).");
      return;
    }
  } else {
    // Continue capturing and buffering the chunks sequentially
    if (packetId === previousChunk + 1) {
      previousChunk = packetId;
      buffer = Buffer.concat([buffer, packet]); // Append the packet to the buffer
      console.log(
        `Packet ${packetId} received, total buffer size: ${buffer.length}`
      );
    } else {
      // Handle invalid sequence if chunks arrive out of order
      console.error(
        `Invalid chunk sequence, expected: ${
          previousChunk + 1
        }, received: ${packetId}`
      );
      previousChunk = -1;
      capturing = false;
      buffer = Buffer.alloc(0); // Reset buffer to avoid partial or corrupt data
      return;
    }
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
