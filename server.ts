import noble from "@abandonware/noble";
import { SERVICE_UUID, PHOTO_DATA_UUID } from "./src/utils/uuid";
import fs from "fs";
import path from "path";

let connectedDevice: any = null;

// Utility to normalize UUIDs
function normalizeUUID(uuid: string): string {
  return uuid.replace(/-/g, "").toLowerCase();
}

async function startBluetoothScanning() {
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
}

async function connectToDevice(peripheral: any) {
  try {
    await peripheral.connectAsync();
    connectedDevice = peripheral;
    console.log("Connected to:", peripheral.advertisement.localName);

    // Discover characteristics of the device
    const { characteristics } =
      await peripheral.discoverSomeServicesAndCharacteristicsAsync(
        [SERVICE_UUID],
        [PHOTO_DATA_UUID]
      );

    // Normalize UUIDs for comparison
    const normalizedPhotoUUID = normalizeUUID(PHOTO_DATA_UUID);

    // Check and log the discovered characteristics
    const photoCharacteristic = characteristics.find(
      (char: any) => normalizeUUID(char.uuid) === normalizedPhotoUUID
    );

    console.log(
      "Discovered characteristics:",
      characteristics.map((char: any) => char.uuid)
    );
    console.log("Photo characteristic:", photoCharacteristic);

    if (photoCharacteristic) {
      console.log("Photo characteristic found, starting notifications...");
      photoCharacteristic.on("data", (data: Buffer) => {
        handlePhotoData(data);
      });
      await photoCharacteristic.subscribeAsync();
    } else {
      console.log("Photo characteristic not found.");
    }
  } catch (error) {
    console.error("Error connecting to device:", error);
  }
}

function handlePhotoData(data: Buffer) {
  const imgPath = path.join(__dirname, "tmp", "images");
  if (!fs.existsSync(imgPath)) {
    fs.mkdirSync(imgPath, { recursive: true });
  }
  const timestamp = Date.now();
  const imgFile = path.join(imgPath, `${timestamp}.jpg`);
  fs.writeFileSync(imgFile, data);
  console.log(`Saved image as ${imgFile}`);
}

// Graceful shutdown to disconnect the Bluetooth device
process.on("SIGINT", async () => {
  console.log("Gracefully shutting down...");
  if (connectedDevice) {
    await connectedDevice.disconnectAsync();
    console.log("Bluetooth device disconnected.");
  }
  process.exit();
});

process.on("SIGTERM", async () => {
  console.log("Gracefully shutting down...");
  if (connectedDevice) {
    await connectedDevice.disconnectAsync();
    console.log("Bluetooth device disconnected.");
  }
  process.exit();
});

// Start the server
async function startServer() {
  console.log("Starting server...");
  await startBluetoothScanning();
}

startServer();
