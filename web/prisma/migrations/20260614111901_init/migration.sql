-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ED', 'TPM', 'EM', 'LEAD', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "SprintState" AS ENUM ('PLANNING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('FEATURE', 'TECH_DEBT', 'SUPPORT', 'INTERNAL_BUG', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FilterSourceType" AS ENUM ('JQL', 'JIRA_FILTER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "jiraAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JiraCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jiraEmail" TEXT NOT NULL,
    "encryptedToken" TEXT NOT NULL,
    "cloudId" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "jiraProjectKeys" TEXT[],
    "storyPointsFieldId" TEXT,
    "sprintFieldId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "developmentStart" TIMESTAMP(3) NOT NULL,
    "developmentEnd" TIMESTAMP(3) NOT NULL,
    "releaseDate" TIMESTAMP(3),
    "state" "SprintState" NOT NULL DEFAULT 'PLANNING',
    "isGate" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilterTemplate" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workflowType" "WorkflowType" NOT NULL,
    "sourceType" "FilterSourceType" NOT NULL,
    "jql" TEXT,
    "jiraFilterId" TEXT,
    "accentColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilterTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filter" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workflowType" "WorkflowType" NOT NULL DEFAULT 'FEATURE',
    "sourceType" "FilterSourceType" NOT NULL,
    "jql" TEXT,
    "jiraFilterId" TEXT,
    "accentColor" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Filter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "filterId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "jiraStatus" TEXT NOT NULL,
    "assigneeName" TEXT,
    "assigneeAccountId" TEXT,
    "storyPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "priority" TEXT,
    "dueDate" TIMESTAMP(3),
    "jiraSprintName" TEXT,
    "fixVersions" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueProgress" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "workflowType" "WorkflowType" NOT NULL DEFAULT 'FEATURE',
    "stageCompletion" BOOLEAN[],
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "seededFromStatus" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusStageMapping" (
    "id" TEXT NOT NULL,
    "workflowType" "WorkflowType" NOT NULL,
    "jiraStatus" TEXT NOT NULL,
    "stageIndex" INTEGER NOT NULL,
    "teamId" TEXT,

    CONSTRAINT "StatusStageMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedView" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "isLive" BOOLEAN NOT NULL DEFAULT true,
    "includedFilterIds" TEXT[],
    "viewDensity" TEXT NOT NULL DEFAULT 'dense',
    "snapshot" JSONB,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprintSnapshot" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "capturedOn" TIMESTAMP(3) NOT NULL,
    "totalPoints" DOUBLE PRECISION NOT NULL,
    "completedPoints" DOUBLE PRECISION NOT NULL,
    "avgProgress" INTEGER NOT NULL,
    "healthCounts" JSONB NOT NULL,
    "totalIssues" INTEGER NOT NULL,

    CONSTRAINT "SprintSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_jiraAccountId_key" ON "User"("jiraAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "JiraCredential_userId_key" ON "JiraCredential"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_key_key" ON "Team"("key");

-- CreateIndex
CREATE INDEX "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMembership_userId_teamId_key" ON "TeamMembership"("userId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "Sprint_name_key" ON "Sprint"("name");

-- CreateIndex
CREATE INDEX "Sprint_state_idx" ON "Sprint"("state");

-- CreateIndex
CREATE INDEX "Filter_teamId_sprintId_sortOrder_idx" ON "Filter"("teamId", "sprintId", "sortOrder");

-- CreateIndex
CREATE INDEX "Issue_jiraKey_idx" ON "Issue"("jiraKey");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_filterId_jiraKey_key" ON "Issue"("filterId", "jiraKey");

-- CreateIndex
CREATE INDEX "IssueProgress_sprintId_idx" ON "IssueProgress"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueProgress_teamId_sprintId_jiraKey_key" ON "IssueProgress"("teamId", "sprintId", "jiraKey");

-- CreateIndex
CREATE UNIQUE INDEX "StatusStageMapping_workflowType_jiraStatus_teamId_key" ON "StatusStageMapping"("workflowType", "jiraStatus", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "SharedView_token_key" ON "SharedView"("token");

-- CreateIndex
CREATE INDEX "SharedView_sprintId_idx" ON "SharedView"("sprintId");

-- CreateIndex
CREATE INDEX "SprintSnapshot_sprintId_idx" ON "SprintSnapshot"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintSnapshot_sprintId_teamId_capturedOn_key" ON "SprintSnapshot"("sprintId", "teamId", "capturedOn");

-- AddForeignKey
ALTER TABLE "JiraCredential" ADD CONSTRAINT "JiraCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sprint" ADD CONSTRAINT "Sprint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilterTemplate" ADD CONSTRAINT "FilterTemplate_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Filter" ADD CONSTRAINT "Filter_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Filter" ADD CONSTRAINT "Filter_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_filterId_fkey" FOREIGN KEY ("filterId") REFERENCES "Filter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueProgress" ADD CONSTRAINT "IssueProgress_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueProgress" ADD CONSTRAINT "IssueProgress_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueProgress" ADD CONSTRAINT "IssueProgress_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusStageMapping" ADD CONSTRAINT "StatusStageMapping_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedView" ADD CONSTRAINT "SharedView_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedView" ADD CONSTRAINT "SharedView_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintSnapshot" ADD CONSTRAINT "SprintSnapshot_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprintSnapshot" ADD CONSTRAINT "SprintSnapshot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
