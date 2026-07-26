-- AlterTable
ALTER TABLE "Sprint" ADD COLUMN     "fixVersions" TEXT[];

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "featureIssueTypes" TEXT[],
ADD COLUMN     "internalBugIssueTypes" TEXT[],
ADD COLUMN     "supportIssueTypes" TEXT[],
ADD COLUMN     "techDebtIssueTypes" TEXT[];

-- CreateTable
CREATE TABLE "JiraComponent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JiraSubComponent" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraSubComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JiraComponent_projectKey_name_key" ON "JiraComponent"("projectKey", "name");

-- CreateIndex
CREATE INDEX "JiraSubComponent_teamId_idx" ON "JiraSubComponent"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "JiraSubComponent_componentId_name_key" ON "JiraSubComponent"("componentId", "name");

-- AddForeignKey
ALTER TABLE "JiraSubComponent" ADD CONSTRAINT "JiraSubComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "JiraComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JiraSubComponent" ADD CONSTRAINT "JiraSubComponent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
