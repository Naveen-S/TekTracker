-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "onCallHeadcount" INTEGER;

-- CreateTable
CREATE TABLE "SupportPoc" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "area" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportPoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterContact" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "phone" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportPoc_sprintId_idx" ON "SupportPoc"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportPoc_teamId_sprintId_email_key" ON "SupportPoc"("teamId", "sprintId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "RosterContact_email_key" ON "RosterContact"("email");

-- AddForeignKey
ALTER TABLE "SupportPoc" ADD CONSTRAINT "SupportPoc_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPoc" ADD CONSTRAINT "SupportPoc_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
