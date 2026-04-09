import { persistSocialMessage, type SocialAttachmentInput } from '@/lib/social/socialMessageIngest';

const FACEBOOK_GRAPH_API_VERSION = process.env.FACEBOOK_GRAPH_API_VERSION || 'v21.0';

interface GraphPaging {
  cursors?: {
    after?: string;
  };
}

interface GraphResponse<T> {
  data: T[];
  paging?: GraphPaging;
}

interface FacebookConversation {
  id: string;
  updated_time?: string;
  senders?: {
    data?: Array<{ id?: string; name?: string }>;
  };
  messages?: GraphResponse<FacebookConversationMessage>;
}

interface FacebookConversationMessage {
  id?: string;
  message?: string;
  created_time?: string;
  from?: {
    id?: string;
    name?: string;
  };
  attachments?: {
    data?: FacebookAttachment[];
  };
}

interface FacebookAttachment {
  id?: string;
  mime_type?: string;
  name?: string;
  file_url?: string;
  image_data?: {
    url?: string;
    preview_url?: string;
  };
  video_data?: {
    url?: string;
    preview_url?: string;
  };
  audio_data?: {
    url?: string;
  };
  payload?: {
    url?: string;
  };
  type?: string;
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
  const response = await fetch(buildFacebookGraphUrl(path, token, params), {
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Facebook Graph API error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
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

  const attachmentTypes = normalizeFacebookAttachments(message.attachments?.data).map((attachment) => attachment.type);
  if (attachmentTypes.length === 0) return '[Facebook message]';
  return `[${attachmentTypes.join(', ')} attachment${attachmentTypes.length > 1 ? 's' : ''}]`;
}

export async function syncRecentFacebookInbox({
  accessToken,
  pageId,
  conversationLimit = 25,
  messageLimitPerConversation = 50,
}: {
  accessToken: string;
  pageId: string;
  conversationLimit?: number;
  messageLimitPerConversation?: number;
}) {
  const conversations: FacebookConversation[] = [];
  let afterCursor: string | null = null;

  while (conversations.length < conversationLimit) {
    const params: Record<string, string> = {
      fields: `id,updated_time,senders.limit(10){id,name},messages.limit(${messageLimitPerConversation}){id,message,created_time,from,attachments{mime_type,name,file_url,image_data,video_data,audio_data}}`,
      platform: 'messenger',
      limit: String(Math.min(50, conversationLimit - conversations.length)),
    };
    if (afterCursor) {
      params.after = afterCursor;
    }

    const page: GraphResponse<FacebookConversation> = await fetchFacebookGraph(
      `${pageId}/conversations`,
      accessToken,
      params
    );

    const pageData = page.data ?? [];
    conversations.push(...pageData);
    afterCursor = page.paging?.cursors?.after ?? null;

    if (!afterCursor || pageData.length === 0) {
      break;
    }
  }

  let processedMessages = 0;
  let processedAttachments = 0;

  for (const conversation of conversations) {
    const conversationId = `facebook:${conversation.id}`;
    const messages = conversation.messages?.data ?? [];

    for (const message of messages) {
      const attachments = normalizeFacebookAttachments(message.attachments?.data);
      await persistSocialMessage({
        platform: 'facebook',
        type: 'message',
        externalId: message.id ?? null,
        conversationId,
        senderId: message.from?.id ?? null,
        senderName: message.from?.name ?? null,
        content: buildMessageText(message),
        rawPayload: {
          conversation,
          message,
        },
        isIncoming: true,
        isRead: false,
        timestamp: message.created_time ? new Date(message.created_time) : new Date(),
        attachments,
        attachmentAccessToken: accessToken,
      });
      processedMessages += 1;
      processedAttachments += attachments.length;
    }
  }

  return {
    processedConversations: conversations.length,
    processedMessages,
    processedAttachments,
  };
}
