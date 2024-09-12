-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "descriptors" TEXT,
ADD COLUMN     "keyPoints" TEXT,
ADD COLUMN     "objects" TEXT,
ALTER COLUMN "capturedAt" SET DATA TYPE TEXT;
