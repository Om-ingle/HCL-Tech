-- CreateTable
CREATE TABLE "LearnerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "goalText" TEXT NOT NULL DEFAULT '',
    "experienceLevel" TEXT NOT NULL DEFAULT 'beginner',
    "learningStyle" TEXT NOT NULL DEFAULT 'mixed',
    "weeklyHours" INTEGER NOT NULL DEFAULT 8,
    "timelineWeeks" INTEGER NOT NULL DEFAULT 24,
    "careerOutcome" TEXT NOT NULL DEFAULT '',
    "interests" TEXT NOT NULL DEFAULT '[]',
    "knownSkills" TEXT NOT NULL DEFAULT '[]',
    "preferences" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPath" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "phases" TEXT NOT NULL DEFAULT '[]',
    "rationale" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StepState" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "score" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StepState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "provider" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "mode" TEXT NOT NULL DEFAULT 'hybrid',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningPath_profileId_idx" ON "LearningPath"("profileId");

-- CreateIndex
CREATE INDEX "StepState_profileId_idx" ON "StepState"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "StepState_profileId_stepId_key" ON "StepState"("profileId", "stepId");

-- CreateIndex
CREATE INDEX "Event_profileId_idx" ON "Event"("profileId");

-- AddForeignKey
ALTER TABLE "LearningPath" ADD CONSTRAINT "LearningPath_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StepState" ADD CONSTRAINT "StepState_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "LearnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
