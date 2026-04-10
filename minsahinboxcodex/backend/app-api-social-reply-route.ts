import { NextRequest, NextResponse } from 'next/server';
import { getFacebookProfile } from '@/lib/facebook/profile';
import type { SocialAttachmentInput } from '@/lib/social/socialMessageIngest';
import { persistSocialMessage } from '@/lib/social/socialMessageIngest';

interface ReplyAttachmentInput {
  type: 'image' | 'video' | 'audio' | 'file' | 'document';
  url: string;
  fileName?: string;
  mimeType?: string;
  thumbnail?: string;
}

interface ReplyRequestBody {
  platform?: 'facebook' | 'instagram' | 'whatsapp' | 'youtube';
  messageId?: string;
  messageType?: string;
  conversationId?: string;
  recipientId?: string;
  text?: string;
  attachments?: ReplyAttachmentInput[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReplyRequestBody;
    const { platform, messageId, messageType, conversationId, recipientId, text, attachments } = body;
    const normalizedText = text?.trim() ?? '';
    const normalizedAttachments = (attachments ?? []).filter((attachment) => Boolean(attachment.url));

    if (!platform || (!normalizedText && normalizedAttachments.length === 0)) {
      return NextResponse.json(
        { error: 'Platform and text or attachments are required' },
        { status: 400 }
      );
    }

    let result;
    switch (platform) {
      case 'facebook':
        result = await sendFacebookReply({
          messageId,
          messageType,
          recipientId,
          text: normalizedText,
          attachments: normalizedAttachments,
        });
        break;
      case 'instagram':
        if (normalizedAttachments.length > 0) {
          throw new Error('Instagram media reply is not supported from this inbox yet');
        }
        result = await sendInstagramReply(messageId, normalizedText);
        break;
      case 'whatsapp':
        if (normalizedAttachments.length > 0) {
          throw new Error('WhatsApp media reply is not supported from this inbox yet');
        }
        result = await sendWhatsAppReply(conversationId, normalizedText);
        break;
      case 'youtube':
        if (normalizedAttachments.length > 0) {
          throw new Error('YouTube media reply is not supported from this inbox yet');
        }
        result = await sendYouTubeReply(messageId, normalizedText);
        break;
      default:
        return NextResponse.json(
          { error: 'Unsupported platform' },
          { status: 400 }
        );
    }

    const persistedMessage = await persistOutgoingReply({
      platform,
      messageId,
      messageType,
      conversationId,
      recipientId,
      text: normalizedText,
      attachments: normalizedAttachments,
      result,
    });

    return NextResponse.json({ success: true, result, message: persistedMessage });
  } catch (error) {
    console.error('Reply error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send reply',
      },
      { status: 500 }
    );
  }
}

async function sendFacebookReply({
  messageId,
  messageType,
  recipientId,
  text,
  attachments,
}: {
  messageId?: string;
  messageType?: string;
  recipientId?: string;
  text: string;
  attachments: ReplyAttachmentInput[];
}) {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Missing FACEBOOK_ACCESS_TOKEN');
  }

  if (messageType === 'comment') {
    if (attachments.length > 0) {
      throw new Error('Facebook comment replies do not support media attachments in this inbox');
    }
    if (!messageId) {
      throw new Error('Facebook comment reply requires messageId');
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${messageId}/comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          access_token: accessToken,
        }),
      }
    );

    return await parseGraphResponse(response, 'Failed to send Facebook comment reply');
  }

  if (!recipientId) {
    throw new Error('Facebook message reply requires recipientId');
  }

  const results: Array<{ id?: string; message_id?: string }> = [];

  if (text) {
    const response = await fetch(
      'https://graph.facebook.com/v18.0/me/messages',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: 'RESPONSE',
          message: { text },
        }),
      }
    );

    results.push(await parseGraphResponse(response, 'Failed to send Facebook message reply'));
  }

  for (const attachment of attachments) {
    const response = await fetch('https://graph.facebook.com/v18.0/me/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        messaging_type: 'RESPONSE',
        message: {
          attachment: {
            type: normalizeFacebookAttachmentType(attachment.type),
            payload: {
              url: attachment.url,
              is_reusable: true,
            },
          },
        },
      }),
    });

    results.push(await parseGraphResponse(response, 'Failed to send Facebook media reply'));
  }

  const lastResult = results[results.length - 1] ?? null;
  return {
    id: lastResult?.id,
    message_id: lastResult?.message_id,
    deliveries: results,
  };
}

async function sendInstagramReply(messageId: string | undefined, text: string) {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  if (!messageId) {
    throw new Error('Instagram reply requires messageId');
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${messageId}/replies`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: text,
        access_token: accessToken,
      }),
    }
  );

  return await parseGraphResponse(response, 'Failed to send Instagram reply');
}

async function sendWhatsAppReply(conversationId: string | undefined, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!conversationId) {
    throw new Error('WhatsApp reply requires conversationId');
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: conversationId,
        type: 'text',
        text: {
          body: text,
        },
      }),
    }
  );

  return await parseGraphResponse(response, 'Failed to send WhatsApp reply');
}

async function sendYouTubeReply(commentId: string | undefined, text: string) {
  const accessToken = process.env.YOUTUBE_ACCESS_TOKEN;

  if (!commentId) {
    throw new Error('YouTube reply requires commentId');
  }

  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/comments',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        snippet: {
          parentId: commentId,
          textOriginal: text,
        },
      }),
    }
  );

  return await parseGraphResponse(response, 'Failed to send YouTube reply');
}

async function parseGraphResponse(
  response: Response,
  fallbackMessage: string
): Promise<{ error?: { message?: string }; message_id?: string; id?: string }> {
  const data = (await response.json().catch(() => null)) as
    | { error?: { message?: string }; message_id?: string; id?: string }
    | null;

  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || fallbackMessage);
  }

  return data ?? {};
}

async function persistOutgoingReply({
  platform,
  messageId,
  messageType,
  conversationId,
  recipientId,
  text,
  attachments,
  result,
}: Required<Pick<ReplyRequestBody, 'platform' | 'text'>> &
  Pick<ReplyRequestBody, 'messageId' | 'messageType' | 'conversationId' | 'recipientId' | 'attachments'> & {
    result: { id?: string; message_id?: string } | null;
  }) {
  const baseConversationId =
    conversationId || (recipientId ? `${platform}:${recipientId}` : null);
  const externalId = result?.message_id ?? result?.id ?? null;
  const content =
    text || `[${(attachments ?? []).map((attachment) => attachment.type).join(', ')} attachment${(attachments ?? []).length > 1 ? 's' : ''}]`;
  const normalizedAttachments: SocialAttachmentInput[] = (attachments ?? []).map((attachment, index) => ({
    externalId: `${externalId || 'outgoing'}-${index}`,
    type: attachment.type,
    mimeType: attachment.mimeType ?? null,
    fileName: attachment.fileName ?? null,
    externalUrl: attachment.url,
    thumbnailUrl: attachment.thumbnail ?? null,
    metadata: attachment as unknown as Record<string, unknown>,
  }));

  if (platform === 'facebook') {
    const pageId = process.env.FACEBOOK_PAGE_ID;
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const pageProfile = await getFacebookProfile(pageId, accessToken, {
      id: pageId ?? 'facebook-page',
      name: 'Minsah Beauty',
    });

    return await persistSocialMessage({
      platform,
      type: messageType === 'comment' ? 'comment' : 'message',
      externalId,
      conversationId: baseConversationId,
      senderId: pageProfile.id,
      senderName: pageProfile.name,
      senderAvatar: pageProfile.avatar,
      content,
      rawPayload: {
        request: {
          messageId,
          messageType,
          conversationId,
          recipientId,
          text,
          attachments,
        },
        response: result,
      },
      isIncoming: false,
      isRead: true,
      timestamp: new Date(),
      attachments: normalizedAttachments,
    });
  }

  return await persistSocialMessage({
    platform,
    type: messageType === 'comment' ? 'comment' : 'message',
    externalId,
    conversationId: baseConversationId,
    senderId: `${platform}:admin`,
    senderName: 'Minsah Beauty',
    content,
    rawPayload: {
      request: {
        messageId,
        messageType,
        conversationId,
        recipientId,
        text,
        attachments,
      },
      response: result,
    },
    isIncoming: false,
    isRead: true,
    timestamp: new Date(),
    attachments: normalizedAttachments,
  });
}

function normalizeFacebookAttachmentType(type: ReplyAttachmentInput['type']) {
  if (type === 'image' || type === 'video' || type === 'audio') {
    return type;
  }

  return 'file';
}
