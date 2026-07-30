-- CreateTable
CREATE TABLE "SprintCapacity" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "committedPoints" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SprintCapacity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SprintCapacity_sprintId_idx" ON "SprintCapacity"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintCapacity_sprintId_teamId_key" ON "SprintCapacity"("sprintId", "teamId");

-- AddForeignKey
ALTER TABLE "SprintCapacity" ADD CONSTRAINT "SprintCapacity_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintCapacity" ADD CONSTRAINT "SprintCapacity_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
