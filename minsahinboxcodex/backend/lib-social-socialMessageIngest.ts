import crypto from 'node:crypto';
import path from 'node:path';
import prisma from '@/lib/prisma';
import { uploadFile } from '@/lib/storage/minio';

export interface SocialAttachmentInput {
  externalId?: string | null;
  type?: string | null;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  durationMs?: number | null;
  externalUrl?: string | null;
  thumbnailUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface PersistSocialMessageInput {
  platform: string;
  type: string;
  externalId?: string | null;
  conversationId?: string | null;
  postId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderAvatar?: string | null;
  content: string;
  rawPayload?: unknown;
  isIncoming?: boolean;
  isRead?: boolean;
  timestamp?: Date;
  attachments?: SocialAttachmentInput[];
  attachmentAccessToken?: string | null;
}

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function inferAttachmentType(input: SocialAttachmentInput) {
  const source = `${input.type ?? ''} ${input.mimeType ?? ''}`.toLowerCase();
  if (source.includes('image')) return 'image';
  if (source.includes('video')) return 'video';
  if (source.includes('audio') || source.includes('voice')) return 'audio';
  return input.type || 'file';
}

function inferExtension(fileName: string | null | undefined, mimeType: string | null | undefined, url: string | null | undefined) {
  const fromName = fileName ? path.extname(fileName) : '';
  if (fromName) return fromName;

  if (mimeType) {
    const [, subtype] = mimeType.split('/');
    if (subtype) {
      const cleanedSubtype = subtype.split(';')[0].trim().toLowerCase();
      if (cleanedSubtype) {
        return `.${cleanedSubtype === 'jpeg' ? 'jpg' : cleanedSubtype}`;
      }
    }
  }

  if (url) {
    try {
      const pathname = new URL(url).pathname;
      const ext = path.extname(pathname);
      if (ext) return ext;
    } catch {
      return '';
    }
  }

  return '';
}

function buildFallbackAttachmentId(attachment: SocialAttachmentInput, index: number) {
  const hashBase = `${attachment.externalUrl ?? ''}|${attachment.fileName ?? ''}|${attachment.mimeType ?? ''}|${index}`;
  return crypto.createHash('sha1').update(hashBase).digest('hex').slice(0, 16);
}

async function downloadAndStoreAttachment(
  attachment: SocialAttachmentInput,
  platform: string,
  conversationId: string | null | undefined,
  externalMessageId: string | null | undefined,
  accessToken?: string | null
) {
  if (!attachment.externalUrl) {
    return {
      storageKey: null,
      storageUrl: null,
      mimeType: attachment.mimeType ?? null,
      fileSize: attachment.fileSize ?? null,
    };
  }

  const response = await fetch(attachment.externalUrl, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to download attachment: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get('content-type') || attachment.mimeType || 'application/octet-stream';
  const extension = inferExtension(attachment.fileName, contentType, attachment.externalUrl);
  const attachmentType = inferAttachmentType(attachment);
  const fileName = attachment.fileName
    ? sanitizeSegment(path.basename(attachment.fileName, path.extname(attachment.fileName)))
    : `${attachmentType}-${Date.now()}`;
  const folder = `media/social/${sanitizeSegment(platform)}/${sanitizeSegment(conversationId || 'no-conversation')}`;
  const uploadName = `${sanitizeSegment(externalMessageId || 'message')}-${fileName}${extension}`;
  const uploaded = await uploadFile(buffer, uploadName, folder, contentType);

  return {
    storageKey: uploaded.key,
    storageUrl: uploaded.url,
    mimeType: contentType,
    fileSize: buffer.length,
  };
}

export async function persistSocialMessage(input: PersistSocialMessageInput) {
  const timestamp = input.timestamp ?? new Date();
  const message =
    input.externalId
      ? await prisma.socialMessage.upsert({
          where: {
            platform_externalId: {
              platform: input.platform,
              externalId: input.externalId,
            },
          },
          create: {
            platform: input.platform,
            type: input.type,
            externalId: input.externalId,
            conversationId: input.conversationId ?? null,
            postId: input.postId ?? null,
            senderId: input.senderId ?? null,
            senderName: input.senderName ?? null,
            senderAvatar: input.senderAvatar ?? null,
            content: input.content,
            rawPayload: input.rawPayload as never,
            isIncoming: input.isIncoming ?? true,
            isRead: input.isRead ?? false,
            timestamp,
          },
          update: {
            conversationId: input.conversationId ?? null,
            postId: input.postId ?? null,
            senderId: input.senderId ?? null,
            senderName: input.senderName ?? null,
            senderAvatar: input.senderAvatar ?? null,
            content: input.content,
            rawPayload: input.rawPayload as never,
            isIncoming: input.isIncoming ?? true,
            isRead: input.isRead ?? false,
            timestamp,
          },
        })
      : await prisma.socialMessage.create({
          data: {
            platform: input.platform,
            type: input.type,
            externalId: null,
            conversationId: input.conversationId ?? null,
            postId: input.postId ?? null,
            senderId: input.senderId ?? null,
            senderName: input.senderName ?? null,
            senderAvatar: input.senderAvatar ?? null,
            content: input.content,
            rawPayload: input.rawPayload as never,
            isIncoming: input.isIncoming ?? true,
            isRead: input.isRead ?? false,
            timestamp,
          },
        });

  for (const [index, rawAttachment] of (input.attachments ?? []).entries()) {
    const attachment: SocialAttachmentInput = {
      ...rawAttachment,
      type: inferAttachmentType(rawAttachment),
    };
    const attachmentExternalId = attachment.externalId || buildFallbackAttachmentId(attachment, index);

    const existing = await prisma.socialMessageAttachment.findUnique({
      where: {
        messageId_externalId: {
          messageId: message.id,
          externalId: attachmentExternalId,
        },
      },
    });

    let mediaData = {
      storageKey: existing?.storageKey ?? null,
      storageUrl: existing?.storageUrl ?? null,
      mimeType: attachment.mimeType ?? existing?.mimeType ?? null,
      fileSize: attachment.fileSize ?? existing?.fileSize ?? null,
    };

    if (!existing?.storageUrl && attachment.externalUrl) {
      try {
        mediaData = await downloadAndStoreAttachment(
          attachment,
          input.platform,
          message.conversationId,
          input.externalId,
          input.attachmentAccessToken
        );
      } catch {
        mediaData = {
          ...mediaData,
          storageKey: null,
          storageUrl: null,
        };
      }
    }

    await prisma.socialMessageAttachment.upsert({
      where: {
        messageId_externalId: {
          messageId: message.id,
          externalId: attachmentExternalId,
        },
      },
      create: {
        messageId: message.id,
        externalId: attachmentExternalId,
        type: attachment.type ?? 'file',
        mimeType: mediaData.mimeType,
        fileName: attachment.fileName ?? null,
        fileSize: mediaData.fileSize,
        durationMs: attachment.durationMs ?? null,
        externalUrl: attachment.externalUrl ?? null,
        storageKey: mediaData.storageKey,
        storageUrl: mediaData.storageUrl,
        thumbnailUrl: attachment.thumbnailUrl ?? null,
        metadata: (attachment.metadata ?? null) as never,
      },
      update: {
        type: attachment.type ?? 'file',
        mimeType: mediaData.mimeType,
        fileName: attachment.fileName ?? null,
        fileSize: mediaData.fileSize,
        durationMs: attachment.durationMs ?? null,
        externalUrl: attachment.externalUrl ?? null,
        storageKey: mediaData.storageKey,
        storageUrl: mediaData.storageUrl,
        thumbnailUrl: attachment.thumbnailUrl ?? null,
        metadata: (attachment.metadata ?? null) as never,
      },
    });
  }

  return message;
}
