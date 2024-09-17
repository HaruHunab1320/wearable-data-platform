import noble from "@abandonware/noble";
import {
  SERVICE_UUID,
  PHOTO_DATA_UUID,
  PHOTO_ACK_UUID,
  AUDIO_DATA_UUID,
  DEVICE_CONTROL_UUID,
} from "./src/utils/uuid";
import * as fs from "fs";
import * as path from "path";
import { imageQueue } from "./src/services/Job-Queue/queue";

let connectedDevice: noble.Peripheral | null = null;
let photoAckCharacteristic: noble.Characteristic | null = null;
let deviceControlCharacteristic: noble.Characteristic | null = null;
const normalizeUUID = (uuid: string) => uuid.replace(/-/g, "").toLowerCase();

let photoBuffer: Buffer = Buffer.alloc(0);
let audioBuffer: Buffer = Buffer.alloc(0);

// Photo transmission variables
let expectedPhotoPacketId = 0;
let capturingPhoto = false;

// Audio transmission variables
let audioPacketCount = 0;
let expectedAudioPacketId = 0;

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
const sendAck = async (ackNum: number, missingSeqNums: number[] = []) => {
  if (photoAckCharacteristic) {
    // Prepare ACK packet with at least 2 bytes for ack_num
    const numMissingSeqs = missingSeqNums.length;
    const ackPacket = Buffer.alloc(2 + numMissingSeqs * 2);
    ackPacket.writeUInt16LE(ackNum, 0);
    // Optionally include missing sequence numbers for SACK
    missingSeqNums.forEach((seqNum, index) => {
      ackPacket.writeUInt16LE(seqNum, 2 + index * 2);
    });
    try {
      await photoAckCharacteristic.writeAsync(ackPacket, false);
      console.log(
        `Sent ACK for packet ${ackNum}${
          numMissingSeqs > 0 ? ` with missing packets: ${missingSeqNums}` : ""
        }`
      );
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
    connectedDevice = peripheral;
    console.log("Connected to:", peripheral.advertisement.localName);

    const service = (await peripheral.discoverServicesAsync()).find(
      (s) => normalizeUUID(s.uuid) === normalizeUUID(SERVICE_UUID)
    );
    if (!service)
      throw new Error(`Service with UUID ${SERVICE_UUID} not found!`);

    const chars = await service.discoverCharacteristicsAsync();
    const findChar = (uuid: string) =>
      chars.find((c) => normalizeUUID(c.uuid) === normalizeUUID(uuid));

    const setupChar = (
      char: noble.Characteristic | undefined,
      name: string,
      handler?: (data: Buffer) => void
    ) => {
      if (char) {
        console.log(`${name} characteristic found.`);
        if (handler) {
          char.notify(true, (error) => {
            if (error)
              console.error(`Error starting notifications for ${name}:`, error);
            else
              console.log(`Notifications started for ${name} characteristic.`);
          });
          char.on("data", handler);
        }
        return char;
      }
      console.error(`${name} characteristic not found.`);
      return null;
    };

    photoAckCharacteristic = setupChar(
      findChar(PHOTO_ACK_UUID),
      "Photo acknowledgment"
    );
    deviceControlCharacteristic = setupChar(
      findChar(DEVICE_CONTROL_UUID),
      "Device control"
    );
    setupChar(findChar(PHOTO_DATA_UUID), "Photo", handlePhotoData);
    setupChar(findChar(AUDIO_DATA_UUID), "Audio", handleAudioData);

    // Send photo start command
    await sendPhotoStartCommand();
    // await sendAudioStartCommand();
  } catch (error) {
    console.error("Error connecting to device:", error);
  }
};

// Add these new functions to send start commands
const sendPhotoStartCommand = async () => {
  if (deviceControlCharacteristic) {
    try {
      const command = Buffer.from([0x02, 0x01]);
      await deviceControlCharacteristic.writeAsync(command, false);
      console.log("Sent photo start command");
    } catch (error) {
      console.error("Error sending photo start command:", error);
    }
  } else {
    console.error("Control characteristic not available");
  }
};

const sendAudioStartCommand = async () => {
  if (deviceControlCharacteristic) {
    try {
      const command = Buffer.from([0x01, 0x01]);
      await deviceControlCharacteristic.writeAsync(command, false);
      console.log("Sent audio start command");
    } catch (error) {
      console.error("Error sending audio start command:", error);
    }
  } else {
    console.error("Control characteristic not available");
  }
};

const handlePhotoData = async (data: Buffer) => {
  if (data.length < 4) {
    console.error(
      `Received photo data with insufficient length: ${data.length} bytes`
    );
    return;
  }

  const packetId = data.readUInt16LE(0); // Bytes 0-1
  const flags = data.readUInt8(2); // Byte 2
  // Byte 3 is reserved
  const packet = data.subarray(4); // Data starts from byte 4

  console.log(
    `Received photo chunk with packetId: ${packetId}, flags: ${flags}, size: ${packet.length} bytes`
  );

  // If starting a new photo capture
  if (!capturingPhoto) {
    capturingPhoto = true;
    expectedPhotoPacketId = packetId;
    photoBuffer = Buffer.from(packet); // Start the buffer
    console.log("Received first photo chunk.");

    // Send ACK for the first chunk
    await sendAck(packetId);
  } else {
    // Continuation of photo capture
    if (packetId === expectedPhotoPacketId + 1) {
      expectedPhotoPacketId = packetId;
      photoBuffer = Buffer.concat([photoBuffer, packet]); // Append the packet to the buffer
      console.log(
        `Received chunk ${packetId} - Buffer size: ${photoBuffer.length} bytes`
      );

      // Send ACK for the latest in-order packet received
      await sendAck(packetId);
    } else if (packetId <= expectedPhotoPacketId) {
      // Duplicate packet received
      console.warn(`Duplicate or out-of-order packet received: ${packetId}`);
      // Optionally, re-send ACK for the last confirmed packet
      await sendAck(expectedPhotoPacketId);
    } else {
      // Out-of-order packet received
      console.error(
        `Packet sequence error: expected ${
          expectedPhotoPacketId + 1
        }, received ${packetId}`
      );
      // Optionally handle missing packets, e.g., by adding to a list of missing packets
      // For now, we can send ACK for the last contiguous packet
      await sendAck(expectedPhotoPacketId);
    }
  }

  // Check for EOF
  if (flags === 1) {
    console.log(`Photo complete, total size: ${photoBuffer.length} bytes`);
    savePhoto(photoBuffer); // Save the photo buffer
    capturingPhoto = false;
    photoBuffer = Buffer.alloc(0); // Reset the buffer
    expectedPhotoPacketId = 0; // Reset expected packet ID
    console.log("Photo saved, sending final ACK to device");
    await sendAck(packetId); // Send final ACK after receiving the end frame
  }
};

// Handle audio data
const handleAudioData = async (data: Buffer) => {
  if (data.length < 3) {
    console.error(
      `Received audio data with insufficient length: ${data.length} bytes`
    );
    return;
  }

  const packetId = data.readUInt16LE(0); // Read the packet ID
  const packet = data.slice(3); // Extract the audio packet (skip flag byte)

  console.log(
    `Received audio chunk with packetId: ${packetId}, size: ${packet.length}`
  );

  // Check for packet sequence
  if (packetId !== expectedAudioPacketId) {
    console.warn(
      `Out-of-order audio packet: expected ${expectedAudioPacketId}, received ${packetId}`
    );
    // Optionally handle out-of-order packets or reset
    expectedAudioPacketId = packetId;
  }

  // Append audio data to buffer
  audioBuffer = Buffer.concat([audioBuffer, packet]);
  audioPacketCount++;
  expectedAudioPacketId++;

  // Save every 100 packets or when buffer exceeds a certain size
  if (audioPacketCount >= 100 || audioBuffer.length >= 160000) {
    console.log(
      `Saving audio data. Packets: ${audioPacketCount}, Buffer size: ${audioBuffer.length} bytes`
    );
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
