import noble from "@abandonware/noble";
import {
  SERVICE_UUID,
  PHOTO_DATA_UUID,
  PHOTO_ACK_UUID,
  AUDIO_DATA_UUID,
  AUDIO_ACK_UUID,
  DEVICE_CONTROL_UUID,
} from "./src/utils/uuid";
import * as fs from "fs";
import * as path from "path";
import { imageQueue } from "./src/services/Job-Queue/queue";

let connectedDevice: noble.Peripheral | null = null;
let photoAckCharacteristic: noble.Characteristic | null = null;
let deviceControlCharacteristic: noble.Characteristic | null = null;
let audioAckCharacteristic: noble.Characteristic | null = null;
const normalizeUUID = (uuid: string) => uuid.replace(/-/g, "").toLowerCase();

let photoBuffer: Buffer = Buffer.alloc(0);
let audioBuffer: Buffer = Buffer.alloc(0);

// Photo transmission variables
let capturingPhoto = false;

// Audio transmission variables
const AUDIO_WINDOW_SIZE = 5;
let audioReceiveWindow: Buffer[] = new Array(AUDIO_WINDOW_SIZE).fill(
  Buffer.alloc(0)
);
let audioWindowBase = 0;
let audioPacketsReceivedSinceLastAck = 0;
let capturingAudio = false;

const WINDOW_SIZE = 5;
let receiveWindow: Buffer[] = new Array(WINDOW_SIZE).fill(null);
let windowBase = 0;
let packetsReceivedSinceLastAck = 0;

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
  const fileName = `${Date.now()}.pcm`;
  const rootDir = process.cwd();
  const filePath = path.join(rootDir, "tmp", "audio", fileName);
  fs.mkdirSync(path.join(rootDir, "tmp", "audio"), { recursive: true });
  fs.writeFile(filePath, audioBuffer, (err) => {
    if (err) {
      console.error("Error saving audio:", err);
      return;
    }
    console.log(`Audio saved at: ${filePath}`);
    // Here you can add code to process the audio file (e.g., convert to WAV, send for transcription)
  });
};

const sendAudioAck = async (ackNum: number, missingSeqNums: number[] = []) => {
  if (audioAckCharacteristic) {
    ackNum = Math.max(0, Math.min(ackNum, 65535));

    const numMissingSeqs = missingSeqNums.length;
    const ackPacket = Buffer.alloc(3 + numMissingSeqs * 2); // 2 bytes for ackNum, 1 byte for fileType
    ackPacket.writeUInt16LE(ackNum, 0);
    ackPacket.writeUInt8(0x02, 2); // fileType 0x02 for audio

    missingSeqNums.forEach((seqNum, index) => {
      seqNum = Math.max(0, Math.min(seqNum, 65535));
      ackPacket.writeUInt16LE(seqNum, 3 + index * 2);
    });

    try {
      await audioAckCharacteristic.writeAsync(ackPacket, false);
      console.log(
        `Sent Audio ACK for packet ${ackNum}${
          missingSeqNums.length
            ? ` with missing packets: ${missingSeqNums}`
            : ""
        }`
      );
    } catch (error) {
      console.error("Error sending Audio ACK:", error);
    }
  } else {
    console.error("Audio ACK characteristic is not available");
  }
};

// Send acknowledgment to the device (1 = ACK, 0 = NACK)
const sendAck = async (ackNum: number, missingSeqNums: number[] = []) => {
  if (photoAckCharacteristic) {
    ackNum = Math.max(0, Math.min(ackNum, 65535));

    const numMissingSeqs = missingSeqNums.length;
    const ackPacket = Buffer.alloc(3 + numMissingSeqs * 2); // 2 bytes for ackNum, 1 byte for fileType
    ackPacket.writeUInt16LE(ackNum, 0);
    ackPacket.writeUInt8(0x01, 2); // fileType 0x01 for photo

    missingSeqNums.forEach((seqNum, index) => {
      seqNum = Math.max(0, Math.min(seqNum, 65535));
      ackPacket.writeUInt16LE(seqNum, 3 + index * 2);
    });

    try {
      await photoAckCharacteristic.writeAsync(ackPacket, false);
      console.log(
        `Sent ACK for packet ${ackNum}${
          missingSeqNums.length
            ? ` with missing packets: ${missingSeqNums}`
            : ""
        }`
      );
    } catch (error) {
      console.error("Error sending ACK:", error);
    }
  } else {
    console.error("Photo ACK characteristic is not available");
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
    audioAckCharacteristic = setupChar(
      findChar(AUDIO_ACK_UUID),
      "Audio acknowledgment"
    );
    setupChar(findChar(PHOTO_DATA_UUID), "Photo", handlePhotoData);
    setupChar(findChar(AUDIO_DATA_UUID), "Audio", handleAudioData);

    // Send photo start command
    await sendPhotoStartCommand();
    await sendAudioStartCommand();
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

  const packetId = data.readUInt16LE(0);
  const flags = data.readUInt8(2);
  const packet = data.subarray(4);

  console.log(
    `Received photo chunk with packetId: ${packetId}, flags: ${flags}, size: ${packet.length} bytes`
  );

  if (!capturingPhoto) {
    capturingPhoto = true;
    windowBase = packetId;
    receiveWindow = new Array(WINDOW_SIZE).fill(Buffer.alloc(0));
    photoBuffer = Buffer.alloc(0);
    packetsReceivedSinceLastAck = 0;
    console.log("Started new photo capture.");
  }

  const windowIndex = (packetId - windowBase) % WINDOW_SIZE;

  if (windowIndex >= 0 && windowIndex < WINDOW_SIZE) {
    receiveWindow[windowIndex] = packet;
    packetsReceivedSinceLastAck++;

    // Process contiguous packets
    while (receiveWindow[0]?.length > 0) {
      photoBuffer = Buffer.concat([photoBuffer, receiveWindow[0]]);
      receiveWindow.shift();
      receiveWindow.push(Buffer.alloc(0));
      windowBase++;
    }

    // Send ACK if window is full, or we've received 5 packets since last ACK, or EOF
    if (packetsReceivedSinceLastAck >= WINDOW_SIZE || flags === 1) {
      const missingPackets = receiveWindow
        .map((p, i) => (p.length === 0 ? windowBase + i : null))
        .filter((id): id is number => id !== null);
      await sendAck(windowBase - 1, missingPackets);
      console.log(
        `Sent ACK for packetId: ${
          windowBase - 1
        }, missing packets: ${missingPackets}`
      );
      packetsReceivedSinceLastAck = 0;
    }
  } else if (packetId < windowBase) {
    console.warn(`Duplicate packet received: ${packetId}`);
  } else {
    console.warn(`Packet too far ahead: ${packetId}`);
  }

  // Check for EOF
  if (flags === 1) {
    console.log(`Photo complete, total size: ${photoBuffer.length} bytes`);
    savePhoto(photoBuffer);
    capturingPhoto = false;
    photoBuffer = Buffer.alloc(0);
    receiveWindow = new Array(WINDOW_SIZE).fill(null);
    packetsReceivedSinceLastAck = 0;
    console.log("Photo saved, sending final ACK to device");
    await sendAck(packetId);
  }
};

// Handle audio data
const handleAudioData = async (data: Buffer) => {
  if (data.length < 4) {
    console.error(
      `Received audio data with insufficient length: ${data.length} bytes`
    );
    return;
  }

  const packetId = data.readUInt16LE(0);
  const flags = data.readUInt8(2);
  const packet = data.subarray(4);

  console.log(
    `Received audio chunk with packetId: ${packetId}, flags: ${flags}, size: ${packet.length} bytes`
  );

  if (!capturingAudio) {
    capturingAudio = true;
    audioWindowBase = packetId;
    audioReceiveWindow = new Array(AUDIO_WINDOW_SIZE).fill(Buffer.alloc(0));
    audioBuffer = Buffer.alloc(0);
    audioPacketsReceivedSinceLastAck = 0;
    console.log("Started new audio capture.");
  }

  const windowIndex = (packetId - audioWindowBase) % AUDIO_WINDOW_SIZE;

  if (windowIndex >= 0 && windowIndex < AUDIO_WINDOW_SIZE) {
    audioReceiveWindow[windowIndex] = packet;
    audioPacketsReceivedSinceLastAck++;

    // Process contiguous packets
    while (audioReceiveWindow[0].length > 0) {
      audioBuffer = Buffer.concat([audioBuffer, audioReceiveWindow[0]]);
      audioReceiveWindow.shift();
      audioReceiveWindow.push(Buffer.alloc(0));
      audioWindowBase++;
    }

    // Send ACK if window is full, or we've received AUDIO_WINDOW_SIZE packets since last ACK, or EOF
    if (audioPacketsReceivedSinceLastAck >= AUDIO_WINDOW_SIZE || flags === 1) {
      const missingPackets = audioReceiveWindow
        .map((p, i) => (p.length === 0 ? audioWindowBase + i : null))
        .filter((id): id is number => id !== null);
      await sendAudioAck(audioWindowBase - 1, missingPackets);
      console.log(
        `Sent Audio ACK for packetId: ${
          audioWindowBase - 1
        }, missing packets: ${missingPackets}`
      );
      audioPacketsReceivedSinceLastAck = 0;
    }
  } else if (packetId < audioWindowBase) {
    console.warn(`Duplicate audio packet received: ${packetId}`);
  } else {
    console.warn(`Audio packet too far ahead: ${packetId}`);
  }

  // Check for EOF
  if (flags === 1) {
    console.log(`Audio complete, total size: ${audioBuffer.length} bytes`);
    saveAudio(audioBuffer);
    capturingAudio = false;
    audioBuffer = Buffer.alloc(0);
    audioReceiveWindow = new Array(AUDIO_WINDOW_SIZE).fill(Buffer.alloc(0));
    audioPacketsReceivedSinceLastAck = 0;
    console.log("Audio saved, sending final ACK to device");
    await sendAudioAck(packetId);
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
