import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const result = await prisma.image.aggregate({
        _min: {
          capturedAt: true,
        },
        _max: {
          capturedAt: true,
        },
      });

      const minTimestamp = result._min.capturedAt?.toString();
      const maxTimestamp = result._max.capturedAt?.toString();

      return res.status(200).json({
        minTimestamp,
        maxTimestamp,
      });
    } catch (error) {
      console.error("Error fetching photo timestamps:", error);
      return res.status(500).json({ error: "Error fetching photo timestamps" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
