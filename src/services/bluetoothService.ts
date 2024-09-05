import noble, { Peripheral, Characteristic } from "@abandonware/noble";
import { SERVICE_UUID, AUDIO_DATA_UUID, PHOTO_DATA_UUID } from "../utils/uuid";

class BluetoothService {
  device: Peripheral | null = null;

  async startBluetoothProcess() {
    try {
      console.log("Starting Bluetooth process...");

      // Set up the state change listener for when Bluetooth becomes powered on
      noble.on("stateChange", async (state) => {
        if (state === "poweredOn") {
          console.log("Bluetooth is powered on. Scanning for devices...");
          await noble.startScanningAsync([SERVICE_UUID], false);

          noble.on("discover", async (peripheral: Peripheral) => {
            console.log(
              `Discovered device: ${peripheral.advertisement.localName}`
            );
            this.device = peripheral;

            // Stop scanning once the device is found
            await noble.stopScanningAsync();

            // Connect to the device
            await this.connectToDevice(peripheral);
          });
        } else {
          console.error(`Bluetooth state: ${state}`);
        }
      });
    } catch (error) {
      console.error("Error starting Bluetooth process:", error);
    }
  }

  async connectToDevice(peripheral: Peripheral) {
    try {
      await peripheral.connectAsync();
      console.log(`Connected to device: ${peripheral.advertisement.localName}`);

      // Discover services and characteristics
      const { characteristics } =
        await peripheral.discoverSomeServicesAndCharacteristicsAsync(
          [SERVICE_UUID],
          [AUDIO_DATA_UUID, PHOTO_DATA_UUID]
        );

      // Handle audio and photo data characteristics
      const audioCharacteristic = characteristics.find(
        (char) => char.uuid === AUDIO_DATA_UUID
      );
      const photoCharacteristic = characteristics.find(
        (char) => char.uuid === PHOTO_DATA_UUID
      );

      if (audioCharacteristic) {
        this.handleAudioData(audioCharacteristic);
      }

      if (photoCharacteristic) {
        this.handlePhotoData(photoCharacteristic);
      }
    } catch (error) {
      console.error("Error connecting to Bluetooth device:", error);
    }
  }

  handleAudioData(characteristic: Characteristic) {
    characteristic.on("data", (data: Buffer) => {
      console.log("Received audio data:", data);
      // Process audio data here (e.g., log, store, etc.)
    });

    characteristic.subscribe((error) => {
      if (error) {
        console.error(
          "Error subscribing to audio characteristic notifications:",
          error
        );
      } else {
        console.log("Subscribed to audio characteristic notifications");
      }
    });
  }

  handlePhotoData(characteristic: Characteristic) {
    characteristic.on("data", (data: Buffer) => {
      console.log("Received photo data:", data);
      // Process photo data here (e.g., log, store, etc.)
    });

    characteristic.subscribe((error) => {
      if (error) {
        console.error(
          "Error subscribing to photo characteristic notifications:",
          error
        );
      } else {
        console.log("Subscribed to photo characteristic notifications");
      }
    });
  }
}

export const bluetoothService = new BluetoothService();
