-- CreateTable
CREATE TABLE "BugReport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "ownerName" TEXT,
    "targetDate" TIMESTAMP(3),
    "targetLabel" TEXT,
    "fallbackCategoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRefreshedAt" TIMESTAMP(3),
    "lastRefreshedByEmail" TEXT,
    "lastRefreshError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReportScope" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceType" "FilterSourceType" NOT NULL,
    "jql" TEXT,
    "jiraFilterId" TEXT,
    "resolvedJql" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugReportScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugSlaTarget" (
    "id" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "priorityName" TEXT NOT NULL,
    "days" INTEGER NOT NULL,

    CONSTRAINT "BugSlaTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReportBand" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priorityNames" TEXT[],
    "isCatchAll" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BugReportBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReportCategory" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "statuses" TEXT[],
    "accentColor" TEXT,

    CONSTRAINT "BugReportCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReportIssue" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "jiraStatus" TEXT NOT NULL,
    "statusCategory" TEXT,
    "priority" TEXT,
    "assigneeName" TEXT,
    "reporterName" TEXT,
    "components" TEXT,
    "labels" TEXT,
    "jiraCreatedAt" TIMESTAMP(3),
    "jiraUpdatedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugReportIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "capturedOn" TIMESTAMP(3) NOT NULL,
    "rowKey" TEXT NOT NULL,
    "rowLabel" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "scopeLabel" TEXT NOT NULL,
    "bandKey" TEXT NOT NULL,
    "bandLabel" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "breachedCount" INTEGER NOT NULL,

    CONSTRAINT "BugReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BugReport_slug_key" ON "BugReport"("slug");

-- CreateIndex
CREATE INDEX "BugReportScope_reportId_sortOrder_idx" ON "BugReportScope"("reportId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BugReportScope_reportId_name_key" ON "BugReportScope"("reportId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BugSlaTarget_scopeId_priorityName_key" ON "BugSlaTarget"("scopeId", "priorityName");

-- CreateIndex
CREATE INDEX "BugReportBand_reportId_sortOrder_idx" ON "BugReportBand"("reportId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BugReportBand_reportId_label_key" ON "BugReportBand"("reportId", "label");

-- CreateIndex
CREATE INDEX "BugReportCategory_reportId_sortOrder_idx" ON "BugReportCategory"("reportId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BugReportCategory_reportId_name_key" ON "BugReportCategory"("reportId", "name");

-- CreateIndex
CREATE INDEX "BugReportIssue_reportId_idx" ON "BugReportIssue"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "BugReportIssue_scopeId_jiraKey_key" ON "BugReportIssue"("scopeId", "jiraKey");

-- CreateIndex
CREATE INDEX "BugReportSnapshot_reportId_capturedOn_idx" ON "BugReportSnapshot"("reportId", "capturedOn");

-- CreateIndex
CREATE UNIQUE INDEX "BugReportSnapshot_reportId_capturedOn_rowKey_scopeKey_bandK_key" ON "BugReportSnapshot"("reportId", "capturedOn", "rowKey", "scopeKey", "bandKey");

-- AddForeignKey
ALTER TABLE "BugReportScope" ADD CONSTRAINT "BugReportScope_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugSlaTarget" ADD CONSTRAINT "BugSlaTarget_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "BugReportScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReportBand" ADD CONSTRAINT "BugReportBand_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReportCategory" ADD CONSTRAINT "BugReportCategory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReportIssue" ADD CONSTRAINT "BugReportIssue_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReportIssue" ADD CONSTRAINT "BugReportIssue_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "BugReportScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugReportSnapshot" ADD CONSTRAINT "BugReportSnapshot_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
