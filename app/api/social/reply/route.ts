import { NextRequest, NextResponse } from 'next/server';

interface ReplyRequestBody {
  platform?: 'facebook' | 'instagram' | 'whatsapp' | 'youtube';
  messageId?: string;
  messageType?: string;
  conversationId?: string;
  recipientId?: string;
  text?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ReplyRequestBody;
    const { platform, messageId, messageType, conversationId, recipientId, text } = body;

    if (!platform || !text) {
      return NextResponse.json(
        { error: 'Platform and text are required' },
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
          text,
        });
        break;
      case 'instagram':
        result = await sendInstagramReply(messageId, text);
        break;
      case 'whatsapp':
        result = await sendWhatsAppReply(conversationId, text);
        break;
      case 'youtube':
        result = await sendYouTubeReply(messageId, text);
        break;
      default:
        return NextResponse.json(
          { error: 'Unsupported platform' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Reply error:', error);
    return NextResponse.json(
      { error: 'Failed to send reply' },
      { status: 500 }
    );
  }
}

async function sendFacebookReply({
  messageId,
  messageType,
  recipientId,
  text,
}: {
  messageId?: string;
  messageType?: string;
  recipientId?: string;
  text: string;
}) {
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (!accessToken) {
    throw new Error('Missing FACEBOOK_ACCESS_TOKEN');
  }

  if (messageType === 'comment') {
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

    return await response.json();
  }

  if (!recipientId) {
    throw new Error('Facebook message reply requires recipientId');
  }

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

  return await response.json();
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

  return await response.json();
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

  return await response.json();
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

  return await response.json();
}
