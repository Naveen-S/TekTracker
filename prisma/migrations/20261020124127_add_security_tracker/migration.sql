-- CreateTable
CREATE TABLE "SecurityTrackerSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "openPipelineJql" TEXT NOT NULL,
    "priorityJql" TEXT NOT NULL,
    "vulnLabelsPageId" TEXT NOT NULL,
    "trackLabelsPageId" TEXT NOT NULL,
    "serviceTrackPageId" TEXT NOT NULL,
    "monthLabelPrefix" TEXT NOT NULL,
    "slaDays" JSONB NOT NULL,
    "dueSoonDays" INTEGER NOT NULL,
    "placeholderEstimateDays" INTEGER[],
    "storyPointsField" TEXT NOT NULL,
    "sprintField" TEXT NOT NULL,
    "subComponentField" TEXT NOT NULL,
    "workbenchUrl" TEXT,
    "riskThresholds" JSONB NOT NULL,
    "vocab" JSONB,
    "vocabFetchedAt" TIMESTAMP(3),
    "vocabError" TEXT,
    "lastRefreshedAt" TIMESTAMP(3),
    "lastRefreshedByEmail" TEXT,
    "lastRefreshError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityTrackerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityProgram" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "progressJql" TEXT NOT NULL,
    "excludeLabel" TEXT,
    "trackBreached" BOOLEAN NOT NULL DEFAULT false,
    "usesTrackLabels" BOOLEAN NOT NULL DEFAULT false,
    "legacyLabel" TEXT,
    "note" TEXT,
    "programId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityIssue" (
    "id" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCategory" TEXT NOT NULL,
    "resolution" TEXT,
    "priority" TEXT,
    "assigneeName" TEXT,
    "components" TEXT[],
    "subComponent" TEXT,
    "labels" TEXT[],
    "fixVersions" TEXT[],
    "sprintName" TEXT,
    "sprintState" TEXT,
    "storyPoints" DOUBLE PRECISION,
    "originalEstimateSec" INTEGER,
    "jiraCreatedAt" TIMESTAMP(3) NOT NULL,
    "jiraUpdatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "statusCategoryChangedAt" TIMESTAMP(3),
    "inOpenPipeline" BOOLEAN NOT NULL DEFAULT false,
    "progressProgramKeys" TEXT[],
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecuritySnapshot" (
    "id" TEXT NOT NULL,
    "programKey" TEXT NOT NULL,
    "programLabel" TEXT NOT NULL,
    "capturedOn" TIMESTAMP(3) NOT NULL,
    "total" INTEGER NOT NULL,
    "done" INTEGER NOT NULL,
    "dismissed" INTEGER NOT NULL,
    "inProgress" INTEGER NOT NULL,
    "open" INTEGER NOT NULL,
    "pipeline" INTEGER NOT NULL,
    "overdue" INTEGER NOT NULL,
    "noFixVersion" INTEGER NOT NULL,
    "plannedCurrent" INTEGER NOT NULL,
    "plannedNext" INTEGER NOT NULL,
    "noStoryPoints" INTEGER NOT NULL,
    "noPlan" INTEGER NOT NULL,
    "pastSla" INTEGER NOT NULL,
    "dueSoon" INTEGER NOT NULL,
    "untriaged" INTEGER NOT NULL,
    "unassigned" INTEGER NOT NULL,
    "stale" INTEGER NOT NULL,
    "closed7d" INTEGER NOT NULL,
    "movedToSecVal7d" INTEGER NOT NULL,
    "currentReleaseName" TEXT NOT NULL,

    CONSTRAINT "SecuritySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityRelease" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "shipDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityProgram_key_key" ON "SecurityProgram"("key");

-- CreateIndex
CREATE INDEX "SecurityProgram_programId_idx" ON "SecurityProgram"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityIssue_jiraKey_key" ON "SecurityIssue"("jiraKey");

-- CreateIndex
CREATE INDEX "SecurityIssue_inOpenPipeline_idx" ON "SecurityIssue"("inOpenPipeline");

-- CreateIndex
CREATE INDEX "SecuritySnapshot_capturedOn_idx" ON "SecuritySnapshot"("capturedOn");

-- CreateIndex
CREATE UNIQUE INDEX "SecuritySnapshot_programKey_capturedOn_key" ON "SecuritySnapshot"("programKey", "capturedOn");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityRelease_month_key" ON "SecurityRelease"("month");

-- AddForeignKey
ALTER TABLE "SecurityProgram" ADD CONSTRAINT "SecurityProgram_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
