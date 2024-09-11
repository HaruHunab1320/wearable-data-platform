/*
  Warnings:

  - Added the required column `capturedAt` to the `Image` table without a default value. This is not possible if the table is not empty.
  - Made the column `description` on table `Image` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Image" ADD COLUMN     "capturedAt" BIGINT NOT NULL,
ALTER COLUMN "description" SET NOT NULL;
