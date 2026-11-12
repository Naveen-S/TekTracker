-- CreateTable
CREATE TABLE "Sow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "ownerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "programId" TEXT,
    "sourceType" "FilterSourceType" NOT NULL,
    "jql" TEXT,
    "jiraFilterId" TEXT,
    "resolvedJql" TEXT,
    "homeProjectKeys" TEXT[],
    "kindRules" JSONB NOT NULL,
    "kindWeights" JSONB NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "launchDate" TIMESTAMP(3) NOT NULL,
    "lastRefreshedAt" TIMESTAMP(3),
    "lastRefreshedByEmail" TEXT,
    "lastRefreshError" TEXT,
    "slackChannelId" TEXT,
    "slackChannelName" TEXT,
    "slackLastSyncedAt" TIMESTAMP(3),
    "slackSyncError" TEXT,
    "feedChannels" JSONB NOT NULL DEFAULT '[]',
    "references" JSONB NOT NULL DEFAULT '[]',
    "knowledge" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SowPhase" (
    "id" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "kinds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SowPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SowPlanItem" (
    "id" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "baselineDate" TIMESTAMP(3),
    "currentDate" TIMESTAMP(3),
    "isGate" BOOLEAN NOT NULL DEFAULT false,
    "jiraKey" TEXT,
    "comment" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SowPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SowRisk" (
    "id" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RISK',
    "title" TEXT NOT NULL,
    "ownerName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "dueDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SowRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SowIssue" (
    "id" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCategory" TEXT NOT NULL,
    "priority" TEXT,
    "assigneeName" TEXT,
    "parentKey" TEXT,
    "labels" TEXT[],
    "components" TEXT[],
    "fixVersions" TEXT[],
    "storyPoints" DOUBLE PRECISION,
    "dueDate" TIMESTAMP(3),
    "jiraCreatedAt" TIMESTAMP(3),
    "jiraUpdatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SowIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SowSlackIssue" (
    "id" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "ts" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reactions" TEXT[],
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "lastReplyAt" TIMESTAMP(3),
    "mentions" TEXT[],
    "jiraKeys" TEXT[],
    "sessionId" TEXT,
    "hasMedia" BOOLEAN NOT NULL DEFAULT false,
    "files" JSONB NOT NULL DEFAULT '[]',
    "suggestedIssue" BOOLEAN NOT NULL DEFAULT false,
    "overrideStatus" TEXT,
    "linkedJiraKey" TEXT,
    "note" TEXT,
    "updatedById" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SowSlackIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SowFeedItem" (
    "id" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ts" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "authorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "url" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SowFeedItem_pkey" PRIMARY KEY ("id")
);


-- CreateTable
CREATE TABLE "SowSnapshot" (
    "id" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "sowName" TEXT NOT NULL,
    "capturedOn" TIMESTAMP(3) NOT NULL,
    "progressPct" DOUBLE PRECISION NOT NULL,
    "totalIssues" INTEGER NOT NULL,
    "doneIssues" INTEGER NOT NULL,
    "openBugs" INTEGER NOT NULL,
    "byKind" JSONB NOT NULL,

    CONSTRAINT "SowSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SowShare" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sowId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SowShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sow_slug_key" ON "Sow"("slug");

-- CreateIndex
CREATE INDEX "Sow_programId_idx" ON "Sow"("programId");

-- CreateIndex
CREATE INDEX "SowPhase_sowId_sortOrder_idx" ON "SowPhase"("sowId", "sortOrder");

-- CreateIndex
CREATE INDEX "SowPlanItem_sowId_idx" ON "SowPlanItem"("sowId");

-- CreateIndex
CREATE INDEX "SowPlanItem_phaseId_sortOrder_idx" ON "SowPlanItem"("phaseId", "sortOrder");

-- CreateIndex
CREATE INDEX "SowRisk_sowId_sortOrder_idx" ON "SowRisk"("sowId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SowIssue_sowId_jiraKey_key" ON "SowIssue"("sowId", "jiraKey");

-- CreateIndex
CREATE UNIQUE INDEX "SowSlackIssue_sowId_ts_key" ON "SowSlackIssue"("sowId", "ts");

-- CreateIndex
CREATE INDEX "SowSnapshot_capturedOn_idx" ON "SowSnapshot"("capturedOn");

-- CreateIndex
CREATE UNIQUE INDEX "SowSnapshot_sowId_capturedOn_key" ON "SowSnapshot"("sowId", "capturedOn");

-- CreateIndex
CREATE UNIQUE INDEX "SowShare_token_key" ON "SowShare"("token");

-- CreateIndex
CREATE INDEX "SowShare_sowId_idx" ON "SowShare"("sowId");

-- AddForeignKey
ALTER TABLE "Sow" ADD CONSTRAINT "Sow_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowPhase" ADD CONSTRAINT "SowPhase_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "Sow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowPlanItem" ADD CONSTRAINT "SowPlanItem_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "Sow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowPlanItem" ADD CONSTRAINT "SowPlanItem_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "SowPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowRisk" ADD CONSTRAINT "SowRisk_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "Sow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowIssue" ADD CONSTRAINT "SowIssue_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "Sow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowSlackIssue" ADD CONSTRAINT "SowSlackIssue_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "Sow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SowShare" ADD CONSTRAINT "SowShare_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "Sow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SowFeedItem_sowId_postedAt_idx" ON "SowFeedItem"("sowId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SowFeedItem_sowId_key_key" ON "SowFeedItem"("sowId", "key");

-- AddForeignKey
ALTER TABLE "SowFeedItem" ADD CONSTRAINT "SowFeedItem_sowId_fkey" FOREIGN KEY ("sowId") REFERENCES "Sow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
