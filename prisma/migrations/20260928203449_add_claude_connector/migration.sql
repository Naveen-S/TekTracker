-- CreateEnum
CREATE TYPE "AnalysisJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ConnectorToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "connectorVersion" TEXT,
    "claudeVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalysisJob" (
    "id" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "AnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
    "model" TEXT NOT NULL,
    "effort" TEXT NOT NULL,
    "context" JSONB NOT NULL,
    "progressNote" TEXT,
    "error" TEXT,
    "claimedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueAnalysis" (
    "id" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "costUsd" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "analyzedById" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaudeAnalysisSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedModels" TEXT[],
    "defaultModel" TEXT NOT NULL,
    "effort" TEXT NOT NULL,
    "maxBudgetUsd" DOUBLE PRECISION NOT NULL,
    "timeoutMinutes" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaudeAnalysisSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorToken_userId_key" ON "ConnectorToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorToken_tokenHash_key" ON "ConnectorToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AnalysisJob_requestedById_status_idx" ON "AnalysisJob"("requestedById", "status");

-- CreateIndex
CREATE INDEX "AnalysisJob_jiraKey_idx" ON "AnalysisJob"("jiraKey");

-- CreateIndex
CREATE UNIQUE INDEX "IssueAnalysis_jiraKey_key" ON "IssueAnalysis"("jiraKey");

-- AddForeignKey
ALTER TABLE "ConnectorToken" ADD CONSTRAINT "ConnectorToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalysisJob" ADD CONSTRAINT "AnalysisJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueAnalysis" ADD CONSTRAINT "IssueAnalysis_analyzedById_fkey" FOREIGN KEY ("analyzedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
