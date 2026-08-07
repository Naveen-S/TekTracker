-- AlterTable
ALTER TABLE "BugReport" ADD COLUMN     "sprintOwnershipPattern" TEXT;

-- AlterTable
ALTER TABLE "BugReportIssue" ADD COLUMN     "jiraSprintName" TEXT;
