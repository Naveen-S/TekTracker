-- CreateTable
CREATE TABLE "ErrorLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "route" TEXT,
    "path" TEXT,
    "method" TEXT,
    "userId" TEXT,
    "teamId" TEXT,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");

-- CreateIndex
CREATE INDEX "ErrorLog_code_idx" ON "ErrorLog"("code");

-- CreateIndex
CREATE INDEX "ErrorLog_requestId_idx" ON "ErrorLog"("requestId");
