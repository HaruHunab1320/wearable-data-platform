import noble from "@abandonware/noble";
import {
  SERVICE_UUID,
  PHOTO_DATA_UUID,
  PHOTO_CONTROL_UUID,
  PHOTO_ACK_UUID,
  AUDIO_DATA_UUID,
} from "./src/utils/uuid";
import * as fs from "fs";
import * as path from "path";
import imageQueue from "./src/services/Job-Queue/queue";

let connectedDevice: any = null;
let photoAckCharacteristic: any = null;

const normalizeUUID = (uuid: string): string =>
  uuid.replace(/-/g, "").toLowerCase();

let buffer: Buffer = Buffer.alloc(0);
let previousChunk = -1; // Track the previous chunk ID
let capturing = false; // Flag to indicate if we are currently capturing an image
let packetCount = 0; // Track the number of packets received

const savePhoto = (photoBuffer: Buffer) => {
  const fileName = `${Date.now()}.jpg`;
  const rootDir = process.cwd();
  const filePath = path.join(rootDir, "tmp", "images", fileName);
  fs.mkdirSync(path.join(rootDir, "tmp", "images"), { recursive: true });
  fs.writeFile(filePath, photoBuffer, async (err) => {
    if (err) {
      console.error("Error saving photo:", err);
      return;
    }
    console.log(`Photo saved at: ${filePath}`);

    // Add job to the queue after the photo is successfully saved
    try {
      await imageQueue.add("process-image", { imagePath: filePath });
      console.log("Job added to the queue for image processing");
    } catch (error) {
      console.error("Error adding job to the queue:", error);
    }
  });
};

// Send acknowledgment to the device (1 = ACK, 0 = NACK)
const sendAck = async (ackValue: number) => {
  if (photoAckCharacteristic) {
    try {
      await photoAckCharacteristic.writeAsync(Buffer.from([ackValue]), false);
      console.log(`Sent ${ackValue === 1 ? "ACK" : "NACK"} to device`);
    } catch (error) {
      console.error("Error sending ACK:", error);
    }
  }
};

// Bluetooth functions
const startBluetoothScanning = async () => {
  noble.on("stateChange", async (state) => {
    console.log(`Bluetooth state changed: ${state}`);
    if (state === "poweredOn") {
      console.log("Bluetooth scanning started...");
      try {
        await noble.startScanningAsync([SERVICE_UUID], false);
        console.log("Scanning started successfully");
      } catch (error) {
        console.error("Error starting Bluetooth scan:", error);
      }
    } else {
      console.log(`Bluetooth state is not poweredOn, current state: ${state}`);
      try {
        await noble.stopScanningAsync();
      } catch (error) {
        console.error("Error stopping Bluetooth scan:", error);
      }
    }
  });

  noble.on("discover", async (peripheral) => {
    console.log("Discovered peripheral:", peripheral.advertisement.localName);
    if (peripheral.advertisement.localName === "OpenGlass") {
      console.log("Discovered 'OpenGlass' device");
      try {
        await noble.stopScanningAsync();
        console.log("Scanning stopped after discovering 'OpenGlass'");
        await connectToDevice(peripheral);
      } catch (error) {
        console.error("Error during discovery or connecting to device:", error);
      }
    } else {
      console.log(`Ignoring device: ${peripheral.advertisement.localName}`);
    }
  });

  noble.on("scanStop", () => {
    console.log("Bluetooth scanning stopped.");
  });

  noble.on("warning", (message: any) => {
    console.error("Noble warning:", message);
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

    const photoAckChar = characteristics.find(
      (char: any) => normalizeUUID(char.uuid) === normalizeUUID(PHOTO_ACK_UUID)
    );

    if (photoAckChar) {
      photoAckCharacteristic = photoAckChar;
      console.log("Photo acknowledgment characteristic found.");
    } else {
      console.error("Photo acknowledgment characteristic not found.");
    }

    if (photoCharacteristic) {
      photoCharacteristic.notify(true, (error: any) => {
        if (error) {
          console.error("Error starting notifications:", error);
          return;
        }
        console.log("Notifications started for photo characteristic.");
        sendAck(1);
      });
      photoCharacteristic.on("data", handlePhotoData);
    } else {
      console.log("Photo characteristic not found.");
    }

    const photoControlCharacteristic = characteristics.find(
      (char: any) =>
        normalizeUUID(char.uuid) === normalizeUUID(PHOTO_CONTROL_UUID)
    );

    if (photoControlCharacteristic) {
      console.log("Writing to photo control characteristic...");
      await photoControlCharacteristic.writeAsync(Buffer.from([0x05]), false);
    }

    const audioDataCharacteristic = characteristics.find(
      (char: any) => normalizeUUID(char.uuid) === normalizeUUID(AUDIO_DATA_UUID)
    );

    if (audioDataCharacteristic) {
      audioDataCharacteristic.notify(true, (error: any) => {
        if (error) {
          console.error("Error starting notifications for audio:", error);
          return;
        }
        console.log("Notifications started for audio characteristic.");
      });
      audioDataCharacteristic.on("data", handleAudioData);
    } else {
      console.log("Audio characteristic not found.");
    }
  } catch (error) {
    console.error("Error connecting to device:", error);
  }
};

// Handle photo data
const handlePhotoData = async (data: Buffer) => {
  const packetId = data.readUInt16LE(0); // Read the packet ID
  const packet = data.slice(2); // Extract the data from the packet

  console.log(
    `Received chunk with packetId: ${packetId}, size: ${packet.length}`
  );

  if (packetId === 0xffff) {
    // If the packet ID signals the end of the photo
    console.log(`Photo complete, total size: ${buffer.length} bytes`);
    console.log(`Total packets received: ${packetCount}`);
    savePhoto(buffer); // Save the photo buffer
    previousChunk = -1; // Reset the previous chunk tracker
    capturing = false;
    buffer = Buffer.alloc(0); // Reset the buffer
    packetCount = 0; // Reset packet count
    console.log("Photo saved, sending final ACK to device");
    await sendAck(1); // Final ACK after receiving the end frame
    return;
  }

  if (packetId === 0x0001) {
    console.log("Starting new photo capture");
    capturing = true;
    previousChunk = packetId;
    buffer = Buffer.concat([buffer, packet]); // Concatenate the packet
    packetCount = 1; // Initialize packet count
    console.log("Sending ACK for first chunk");
    await sendAck(1);
  }

  // Begin photo capture if not already capturing
  if (!capturing) {
    if (packetId === 0) {
      console.log("Starting new photo capture");
      capturing = true;
      previousChunk = packetId;
      buffer = Buffer.concat([buffer, packet]); // Concatenate the packet
      packetCount = 1; // Initialize packet count
      console.log("Sending ACK for first chunk");
      await sendAck(1);
    }
  } else {
    // Continue photo capture for sequential packets
    if (packetId === previousChunk + 1) {
      previousChunk = packetId;
      buffer = Buffer.concat([buffer, packet]); // Append the packet to the buffer
      packetCount++; // Increment the packet count
      console.log(
        `Received chunk ${packetId} - Total buffer size: ${buffer.length} bytes - Packets received: ${packetCount}`
      );
      await sendAck(1); // Send ACK
    } else {
      // Handle out-of-order packets
      console.error(
        `Invalid chunk sequence: expected ${
          previousChunk + 1
        }, received: ${packetId}`
      );
      console.log("Sending NACK, requesting retransmission");
      await sendAck(0); // Send NACK for the out-of-order packet
    }
  }
};

const handleAudioData = async (data: Buffer) => {
  const packetId = data.readUInt16LE(0);
  const packet = data.slice(2);

  console.log(
    `Received audio chunk with packetId: ${packetId}, size: ${packet.length}`
  );

  // Handle the audio data buffering, processing, and saving here...
};

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down...`);

  // Set a timeout for the entire shutdown process
  const shutdownTimeout = setTimeout(() => {
    console.log("Shutdown timed out. Forcing exit...");
    process.exit(1);
  }, 5000); // 5 seconds timeout

  try {
    // Immediately stop processing photo data
    capturing = false;
    buffer = Buffer.alloc(0);
    packetCount = 0;

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
            PHOTO_DATA_UUID,
          ]);
          const photoControlCharacteristic = characteristics.find(
            (char: any) =>
              normalizeUUID(char.uuid) === normalizeUUID(PHOTO_CONTROL_UUID)
          );
          const photoDataCharacteristic = characteristics.find(
            (char: any) =>
              normalizeUUID(char.uuid) === normalizeUUID(PHOTO_DATA_UUID)
          );

          if (photoControlCharacteristic) {
            await photoControlCharacteristic.writeAsync(
              Buffer.from([0]),
              false
            ); // Stop command
            console.log("Photo capture stop command sent.");
          }

          if (photoDataCharacteristic) {
            photoDataCharacteristic.removeAllListeners("data");
            await photoDataCharacteristic.notifyAsync(false);
            console.log("Stopped listening for photo data.");
          }
        }
        // Wait for a moment to allow the device to process the disconnect command
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log("Disconnecting Bluetooth device...");
        await connectedDevice.disconnectAsync();
        console.log("Bluetooth device disconnected.");
      } catch (error) {
        console.error("Error during disconnect process:", error);
      }
    }

    // Clear the shutdown timeout as we've completed successfully
    clearTimeout(shutdownTimeout);
    console.log("Graceful shutdown completed.");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown process:", error);
    // Clear the shutdown timeout and exit with an error code
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
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
