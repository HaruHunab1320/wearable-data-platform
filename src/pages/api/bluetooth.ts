import { NextApiRequest, NextApiResponse } from "next";
import noble from "@abandonware/noble";

// Bluetooth API Route for scanning
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    noble.on("stateChange", async (state) => {
      if (state === "poweredOn") {
        console.log("Bluetooth is powered on, starting scan...");
        await noble.startScanningAsync();

        // Listen for device discovery
        noble.on("discover", async (peripheral) => {
          const localName =
            peripheral.advertisement.localName || "Unnamed device";
          const deviceAddress = peripheral.address || "Unknown address";

          console.log(`Found device: ${localName} (${deviceAddress})`);
          // Stop scanning after discovery
          await noble.stopScanningAsync();

          // You could extend this to connect to the device here
          // await peripheral.connectAsync();

          res.status(200).json({
            message: `Found device: ${localName} (${deviceAddress})`,
            address: deviceAddress,
          });
        });
      } else {
        console.log(`Bluetooth state changed to: ${state}`);
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
}
