-- AlterEnum
ALTER TYPE "WorkflowType" ADD VALUE 'NEEDS_ATTENTION';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "memberEmails" TEXT[];
