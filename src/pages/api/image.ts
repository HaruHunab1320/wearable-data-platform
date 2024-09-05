import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle image data reception
  // Process and save the image data
  res.status(200).json({ message: "Image data received" });
}
