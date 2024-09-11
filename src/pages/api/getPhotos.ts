import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    const { start, end, page = "1", limit = "50", sort = "asc" } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    try {
      let whereClause = {};
      if (start && end) {
        whereClause = {
          capturedAt: {
            gte: BigInt(start as string),
            lte: BigInt(end as string),
          },
        };
      }

      const photos = await prisma.image.findMany({
        where: whereClause,
        orderBy: {
          capturedAt: sort === "desc" ? "desc" : "asc",
        },
        skip,
        take: limitNumber,
      });

      const totalCount = await prisma.image.count({ where: whereClause });

      return res.status(200).json({
        photos,
        pageInfo: {
          currentPage: pageNumber,
          totalPages: Math.ceil(totalCount / limitNumber),
          totalCount,
        },
      });
    } catch (error) {
      console.error("Error fetching photos:", error);
      return res.status(500).json({ error: "Error fetching photos" });
    }
  } else {
    res.setHeader("Allow", ["GET"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
