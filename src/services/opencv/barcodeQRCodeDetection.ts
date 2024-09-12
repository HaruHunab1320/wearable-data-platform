import { BrowserCodeReader } from "@zxing/browser";
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  QRCodeReader,
} from "@zxing/library";

const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.CODE_128,
]);

const reader = new MultiFormatReader(); // Create the barcode reader
reader.setHints(hints);

const codeReader = new BrowserCodeReader(reader); // Pass the reader instance

export async function detectBarcode(
  imageElement: HTMLImageElement
): Promise<string | null> {
  try {
    const result = await codeReader.decodeFromImageElement(imageElement);
    return result.getText();
  } catch (error) {
    console.error("Barcode not detected:", error);
    return null;
  }
}

const qrReader = new QRCodeReader(); // Use the QRCodeReader for QR detection
const qrCodeReader = new BrowserCodeReader(qrReader);

export async function detectQRCode(
  imageElement: HTMLImageElement
): Promise<string | null> {
  try {
    const result = await qrCodeReader.decodeFromImageElement(imageElement);
    return result.getText(); // The decoded QR code text
  } catch (error) {
    console.error("QR Code not detected:", error);
    return null;
  }
}
