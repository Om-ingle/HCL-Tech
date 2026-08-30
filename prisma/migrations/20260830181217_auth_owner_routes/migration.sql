-- AlterTable
ALTER TABLE "LearnerProfile" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "LearnerProfile_ownerId_idx" ON "LearnerProfile"("ownerId");
