import noble from "@abandonware/noble";
import {
  SERVICE_UUID,
  PHOTO_DATA_UUID,
  PHOTO_CONTROL_UUID,
  PHOTO_ACK_UUID,
  AUDIO_DATA_UUID,
  DEVICE_CONTROL_UUID,
} from "./src/utils/uuid";
import * as fs from "fs";
import * as path from "path";
import imageQueue from "./src/services/Job-Queue/queue";

let connectedDevice: noble.Peripheral | null = null;
let photoAckCharacteristic: noble.Characteristic | null = null;
let deviceControlCharacteristic: noble.Characteristic | null = null;

let photoBuffer: Buffer = Buffer.alloc(0);
let audioBuffer: Buffer = Buffer.alloc(0);
let previousPhotoChunk = -1; // Track the previous chunk ID for photos
let capturingPhoto = false; // Flag to indicate if we are currently capturing an image
let photoPacketCount = 0; // Track the number of photo packets received
let audioPacketCount = 0; // Track the number of audio packets received

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

const saveAudio = (audioBuffer: Buffer) => {
  const fileName = `${Date.now()}.pcm`; // Save as a PCM file
  const rootDir = process.cwd();
  const filePath = path.join(rootDir, "tmp", "audio", fileName);
  fs.mkdirSync(path.join(rootDir, "tmp", "audio"), { recursive: true });
  fs.writeFile(filePath, audioBuffer, (err) => {
    if (err) {
      console.error("Error saving audio:", err);
      return;
    }
    console.log(`Audio saved at: ${filePath}`);
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

  noble.on("discover", async (peripheral: noble.Peripheral) => {
    console.log("Discovered peripheral:", peripheral.advertisement.localName);
    if (peripheral.advertisement.localName === "OpenGlass") {
      console.log("Discovered 'OpenGlass' device");
      try {
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

  noble.on("warning", (message: string) => {
    console.error("Noble warning:", message);
  });
};

// Connects to the Bluetooth device
const connectToDevice = async (peripheral: noble.Peripheral) => {
  try {
    await peripheral.connectAsync();
    connectedDevice = peripheral; // Set the connected device
    console.log("Connected to:", peripheral.advertisement.localName);

    const services = await peripheral.discoverServicesAsync();
    const service = services.find(
      (s: noble.Service) =>
        normalizeUUID(s.uuid) === normalizeUUID(SERVICE_UUID)
    );
    if (!service) {
      console.error(`Service with UUID ${SERVICE_UUID} not found!`);
      return;
    }

    const characteristics = await service.discoverCharacteristicsAsync();
    const photoCharacteristic = characteristics.find(
      (char: noble.Characteristic) =>
        normalizeUUID(char.uuid) === normalizeUUID(PHOTO_DATA_UUID)
    );

    const photoAckChar = characteristics.find(
      (char: noble.Characteristic) =>
        normalizeUUID(char.uuid) === normalizeUUID(PHOTO_ACK_UUID)
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
    `Received photo chunk with packetId: ${packetId}, size: ${packet.length}`
  );

  if (packetId === 0xffff) {
    // If the packet ID signals the end of the photo
    console.log(`Photo complete, total size: ${photoBuffer.length} bytes`);
    console.log(`Total packets received: ${photoPacketCount}`);
    savePhoto(photoBuffer); // Save the photo buffer
    previousPhotoChunk = -1; // Reset the previous chunk tracker
    capturingPhoto = false;
    photoBuffer = Buffer.alloc(0); // Reset the buffer
    photoPacketCount = 0; // Reset packet count
    console.log("Photo saved, sending final ACK to device");
    await sendAck(1); // Final ACK after receiving the end frame
    return;
  }

  if (packetId === 0x0001 || packetId === 0x0000) {
    // Ensure the first chunk is always handled
    console.log("Starting new photo capture, initializing buffer.");
    capturingPhoto = true;
    previousPhotoChunk = packetId;
    photoBuffer = Buffer.concat([photoBuffer, packet]); // Concatenate the packet
    photoPacketCount = 1; // Initialize packet count
    console.log("Sending ACK for the first photo chunk.");
    await sendAck(1);
    return; // Exit after handling the first chunk
  }

  // Handle photo capture for sequential packets
  if (capturingPhoto) {
    if (packetId === previousPhotoChunk + 1) {
      previousPhotoChunk = packetId;
      photoBuffer = Buffer.concat([photoBuffer, packet]); // Append the packet to the buffer
      photoPacketCount++; // Increment the packet count
      console.log(
        `Received chunk ${packetId} - Total buffer size: ${photoBuffer.length} bytes - Packets received: ${photoPacketCount}`
      );
      await sendAck(1); // Send ACK
    } else {
      // Handle out-of-order packets
      console.error(
        `Invalid chunk sequence: expected ${
          previousPhotoChunk + 1
        }, received: ${packetId}`
      );
      console.log("Sending NACK, requesting retransmission");
      await sendAck(0); // Send NACK for the out-of-order packet
    }
  } else {
    console.log("Received photo chunk but not currently capturing.");
  }
};

// Handle audio data
const handleAudioData = async (data: Buffer) => {
  const packetId = data.readUInt16LE(0); // Read the packet ID
  const packet = data.slice(2); // Extract the audio packet

  console.log(
    `Received audio chunk with packetId: ${packetId}, size: ${packet.length}`
  );

  // Append audio data to buffer
  audioBuffer = Buffer.concat([audioBuffer, packet]);
  audioPacketCount++;

  // Save every 100 packets
  if (audioPacketCount >= 100) {
    console.log(`Saving audio data. Total packets: ${audioPacketCount}`);
    saveAudio(audioBuffer); // Save the audio data
    audioBuffer = Buffer.alloc(0); // Reset buffer
    audioPacketCount = 0; // Reset packet count
  }
};

const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Gracefully shutting down...`);

  try {
    await noble.stopScanningAsync();

    if (connectedDevice) {
      console.log("Disconnecting Bluetooth device...");
      await connectedDevice.disconnectAsync();
      console.log("Bluetooth device disconnected.");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown process:", error);
    process.exit(1);
  }
};

// Event listeners for graceful shutdown
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Start the server
const startServer = async () => {
  console.log("Starting Bluetooth scanning...");
  await startBluetoothScanning();
};

startServer();
