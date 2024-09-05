import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle audio data reception
  // Process and save the audio data
  res.status(200).json({ message: "Audio data received" });
}
