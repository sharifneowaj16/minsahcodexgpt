-- AlterTable
ALTER TABLE "SocialMessage"
ADD COLUMN "rawPayload" JSONB;

-- CreateTable
CREATE TABLE "SocialMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "externalId" TEXT,
    "type" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "durationMs" INTEGER,
    "externalUrl" TEXT,
    "storageKey" TEXT,
    "storageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialMessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialMessageAttachment_messageId_idx" ON "SocialMessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "SocialMessageAttachment_type_idx" ON "SocialMessageAttachment"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMessage_platform_externalId_key" ON "SocialMessage"("platform", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMessageAttachment_messageId_externalId_key" ON "SocialMessageAttachment"("messageId", "externalId");

-- AddForeignKey
ALTER TABLE "SocialMessageAttachment"
ADD CONSTRAINT "SocialMessageAttachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "SocialMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
