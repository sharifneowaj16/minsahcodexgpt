import { persistSocialMessage, type SocialAttachmentInput } from '@/lib/social/socialMessageIngest';
import { getFacebookProfile } from '@/lib/facebook/profile';

const FACEBOOK_GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v21.0';

interface GraphPaging {
  cursors?: { after?: string; before?: string };
  next?: string;
}

interface GraphResponse<T> {
  data: T[];
  paging?: GraphPaging;
}

interface FacebookConversation {
  id: string;
  updated_time?: string;
  senders?: { data?: Array<{ id?: string; name?: string }> };
  messages?: GraphResponse<FacebookConversationMessage>;
}

interface FacebookConversationMessage {
  id?: string;
  message?: string;
  created_time?: string;
  from?: { id?: string; name?: string };
  attachments?: { data?: FacebookAttachment[] };
}

interface FacebookAttachment {
  id?: string;
  mime_type?: string;
  name?: string;
  file_url?: string;
  image_data?: { url?: string; preview_url?: string };
  video_data?: { url?: string; preview_url?: string };
  audio_data?: { url?: string };
  payload?: { url?: string };
  type?: string;
}

export interface FacebookInboxSyncProgress {
  stage: 'fetching' | 'processing_conversation' | 'processing_message' | 'completed';
  processedConversations: number;
  totalConversations: number;
  processedMessages: number;
  processedAttachments: number;
  conversationId?: string;
  senderName?: string | null;
  currentPage?: number;
}

function buildFacebookGraphUrl(path: string, token: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('access_token', token);
  return url.toString();
}

async function fetchFacebookGraph<T>(path: string, token: string, params: Record<string, string>) {
  const response = await fetch(buildFacebookGraphUrl(path, token, params), { cache: 'no-store' });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Facebook Graph API error ${response.status}: ${body}`);
  }
  return (await response.json()) as T;
}

// Fetch ALL pages of a paginated endpoint
async function fetchAllPages<T>(
  path: string,
  token: string,
  baseParams: Record<string, string>,
  limit = 100
): Promise<T[]> {
  const all: T[] = [];
  let afterCursor: string | null = null;

  while (true) {
    const params: Record<string, string> = { ...baseParams, limit: String(limit) };
    if (afterCursor) params.after = afterCursor;

    const page = await fetchFacebookGraph<GraphResponse<T>>(path, token, params);
    const pageData = page.data ?? [];
    all.push(...pageData);

    afterCursor = page.paging?.cursors?.after ?? null;
    if (!afterCursor || pageData.length === 0) break;
  }

  return all;
}

export function normalizeFacebookAttachments(attachments: FacebookAttachment[] | undefined): SocialAttachmentInput[] {
  return (attachments ?? []).map((attachment, index) => {
    const externalUrl =
      attachment.file_url ||
      attachment.image_data?.url ||
      attachment.video_data?.url ||
      attachment.audio_data?.url ||
      attachment.payload?.url ||
      null;
    const thumbnailUrl =
      attachment.image_data?.preview_url ||
      attachment.video_data?.preview_url ||
      null;
    const normalizedType =
      attachment.type ||
      (attachment.mime_type?.startsWith('image/') ? 'image' : null) ||
      (attachment.mime_type?.startsWith('video/') ? 'video' : null) ||
      (attachment.mime_type?.startsWith('audio/') ? 'audio' : null) ||
      'file';

    return {
      externalId: attachment.id || `${normalizedType}-${index}`,
      type: normalizedType,
      mimeType: attachment.mime_type ?? null,
      fileName: attachment.name ?? null,
      externalUrl,
      thumbnailUrl,
      metadata: attachment as unknown as Record<string, unknown>,
    };
  });
}

function buildMessageText(message: FacebookConversationMessage) {
  if (message.message?.trim()) return message.message.trim();
  const attachmentTypes = normalizeFacebookAttachments(message.attachments?.data).map((a) => a.type);
  if (attachmentTypes.length === 0) return '[Facebook message]';
  return `[${attachmentTypes.join(', ')} attachment${attachmentTypes.length > 1 ? 's' : ''}]`;
}

export async function syncRecentFacebookInbox({
  accessToken,
  pageId,
  // conversationLimit = 0 means UNLIMITED
  conversationLimit = 0,
  messageLimitPerConversation = 100,
  onProgress,
}: {
  accessToken: string;
  pageId: string;
  conversationLimit?: number;
  messageLimitPerConversation?: number;
  onProgress?: (progress: FacebookInboxSyncProgress) => void | Promise<void>;
}) {
  const pageProfile = await getFacebookProfile(pageId, accessToken);

  await onProgress?.({
    stage: 'fetching',
    processedConversations: 0,
    totalConversations: 0,
    processedMessages: 0,
    processedAttachments: 0,
  });

  // Fetch ALL conversations (no limit unless specified)
  const conversations: FacebookConversation[] = [];
  let afterCursor: string | null = null;
  const batchSize = 50;

  while (true) {
    const params: Record<string, string> = {
      fields: `id,updated_time,senders.limit(10){id,name},messages.limit(${messageLimitPerConversation}){id,message,created_time,from,attachments{id,type,mime_type,name,file_url,image_data,video_data,audio_data,payload}}`,
      platform: 'messenger',
      limit: String(batchSize),
    };
    if (afterCursor) params.after = afterCursor;

    const page = await fetchFacebookGraph<GraphResponse<FacebookConversation>>(
      `${pageId}/conversations`,
      accessToken,
      params
    );

    const pageData = page.data ?? [];
    conversations.push(...pageData);
    afterCursor = page.paging?.cursors?.after ?? null;

    await onProgress?.({
      stage: 'fetching',
      processedConversations: 0,
      totalConversations: conversations.length,
      processedMessages: 0,
      processedAttachments: 0,
    });

    // Stop if we've hit the limit (0 = unlimited)
    if (conversationLimit > 0 && conversations.length >= conversationLimit) break;
    if (!afterCursor || pageData.length === 0) break;
  }

  let processedMessages = 0;
  let processedAttachments = 0;
  let processedConversations = 0;

  for (const conversation of conversations) {
    const participants = conversation.senders?.data ?? [];
    const customerParticipant =
      participants.find((p) => p.id && p.id !== pageId) ?? participants[0] ?? null;
    const customerProfile = await getFacebookProfile(customerParticipant?.id, accessToken, {
      id: customerParticipant?.id ?? undefined,
      name: customerParticipant?.name ?? null,
    });
    const conversationId = customerParticipant?.id
      ? `facebook:${customerParticipant.id}`
      : `facebook:${conversation.id}`;
    const messages = conversation.messages?.data ?? [];

    await onProgress?.({
      stage: 'processing_conversation',
      processedConversations,
      totalConversations: conversations.length,
      processedMessages,
      processedAttachments,
      conversationId,
      senderName: customerProfile.name,
    });

    for (const message of messages) {
      const attachments = normalizeFacebookAttachments(message.attachments?.data);
      const fromId = message.from?.id ?? customerParticipant?.id ?? null;
      const isIncoming = fromId !== pageId;
      const senderProfile =
        !fromId || !isIncoming
          ? pageProfile
          : fromId === customerProfile.id
          ? customerProfile
          : await getFacebookProfile(fromId, accessToken, { id: fromId, name: message.from?.name ?? null });

      await persistSocialMessage({
        platform: 'facebook',
        type: 'message',
        externalId: message.id ?? null,
        conversationId,
        senderId: fromId,
        senderName: senderProfile.name ?? message.from?.name ?? customerParticipant?.name ?? null,
        senderAvatar: senderProfile.avatar,
        content: buildMessageText(message),
        rawPayload: { conversation, message, customerProfile },
        isIncoming,
        isRead: !isIncoming,
        timestamp: message.created_time ? new Date(message.created_time) : new Date(),
        attachments,
        attachmentAccessToken: accessToken,
      });
      processedMessages += 1;
      processedAttachments += attachments.length;

      await onProgress?.({
        stage: 'processing_message',
        processedConversations,
        totalConversations: conversations.length,
        processedMessages,
        processedAttachments,
        conversationId,
        senderName: senderProfile.name,
      });
    }

    processedConversations += 1;
  }

  await onProgress?.({
    stage: 'completed',
    processedConversations,
    totalConversations: conversations.length,
    processedMessages,
    processedAttachments,
  });

  return { processedConversations: conversations.length, processedMessages, processedAttachments };
}
