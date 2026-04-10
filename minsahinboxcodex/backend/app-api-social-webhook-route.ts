import { NextRequest, NextResponse } from 'next/server';
import { getFacebookProfile } from '@/lib/facebook/profile';
import { normalizeFacebookAttachments } from '@/lib/facebook/inboxSync';
import { persistSocialMessage } from '@/lib/social/socialMessageIngest';

interface FacebookMessagingEvent {
  message?: {
    text?: string;
    mid?: string;
    attachments?: Array<{
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
    }>;
  };
  sender?: {
    id?: string;
  };
  recipient?: {
    id?: string;
  };
  timestamp?: number;
}

interface SocialCommentPayload {
  id?: string;
  message?: string;
  post_id?: string;
  from?: {
    id?: string;
    name?: string;
  };
  created_time?: string;
}

interface WhatsAppMessagePayload {
  id?: string;
  from?: string;
  text?: {
    body?: string;
  };
}

interface YouTubeCommentPayload {
  id?: string;
  content?: string;
  published?: string;
  author?: {
    yt_channelId?: string;
    name?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headerPlatform = request.headers.get('x-platform') || 'unknown';
    const platform =
      body.object === 'page'
        ? 'facebook'
        : body.object === 'instagram'
          ? 'instagram'
          : headerPlatform;

    if (platform === 'facebook' || platform === 'instagram') {
      for (const entry of body.entry || []) {
        if (entry.messaging) {
          for (const event of entry.messaging) {
            await processMessage(platform, event);
          }
        }
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === 'comments') {
              await processComment(platform, change.value);
            }
          }
        }
      }
    } else if (platform === 'whatsapp') {
      if (body.entry) {
        for (const entry of body.entry) {
          for (const change of entry.changes || []) {
            if (change.value.messages) {
              for (const message of change.value.messages) {
                await processWhatsAppMessage(message);
              }
            }
          }
        }
      }
    } else if (platform === 'youtube') {
      if (body.feed?.entry) {
        for (const entry of body.feed.entry) {
          await processYouTubeComment(entry);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN || 'your_verify_token';

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

async function processMessage(platform: string, event: FacebookMessagingEvent) {
  if (!event.sender?.id || (!event.message?.text && !event.message?.attachments?.length)) return;

  const attachments = normalizeFacebookAttachments(event.message?.attachments);
  const content =
    event.message?.text ||
    `[${attachments.map((attachment) => attachment.type).join(', ') || 'attachment'}]`;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const isFacebook = platform === 'facebook';
  const isIncoming = isFacebook && pageId ? event.sender.id !== pageId : true;
  const conversationPeerId =
    isFacebook && pageId && event.sender.id === pageId
      ? event.recipient?.id ?? event.sender.id
      : event.sender.id;
  const senderProfile =
    isFacebook && accessToken
      ? await getFacebookProfile(
          isIncoming ? event.sender.id : pageId,
          accessToken,
          { id: isIncoming ? event.sender.id : pageId ?? 'facebook-page' }
        )
      : {
          id: event.sender.id,
          name: event.sender.id,
          avatar: null,
        };

  await persistSocialMessage({
    platform,
    type: 'message',
    externalId: event.message?.mid ?? null,
    conversationId: `${platform}:${conversationPeerId}`,
    senderId: isIncoming ? event.sender.id : pageId ?? event.sender.id,
    senderName: senderProfile.name ?? event.sender.id,
    senderAvatar: senderProfile.avatar,
    content,
    rawPayload: event,
    isIncoming,
    isRead: !isIncoming,
    timestamp: new Date(event.timestamp ?? Date.now()),
    attachments,
    attachmentAccessToken: accessToken,
  });
}

async function processComment(platform: string, comment: SocialCommentPayload) {
  if (!comment.message) return;
  const senderProfile =
    platform === 'facebook' && process.env.FACEBOOK_ACCESS_TOKEN
      ? await getFacebookProfile(comment.from?.id, process.env.FACEBOOK_ACCESS_TOKEN, {
          id: comment.from?.id ?? undefined,
          name: comment.from?.name ?? null,
        })
      : {
          id: comment.from?.id ?? 'unknown',
          name: comment.from?.name ?? null,
          avatar: null,
        };

  await persistSocialMessage({
    platform,
    type: 'comment',
    externalId: comment.id,
    conversationId: comment.post_id
      ? `${platform}:post:${comment.post_id}:${comment.from?.id ?? comment.id}`
      : `${platform}:comment:${comment.id}`,
    postId: comment.post_id,
    senderId: comment.from?.id,
    senderName: senderProfile.name ?? comment.from?.name ?? null,
    senderAvatar: senderProfile.avatar,
    content: comment.message,
    rawPayload: comment,
    isIncoming: true,
    isRead: false,
    timestamp: new Date(comment.created_time ?? Date.now()),
  });
}

async function processWhatsAppMessage(message: WhatsAppMessagePayload) {
  if (!message.text?.body || !message.from) return;
  await persistSocialMessage({
    platform: 'whatsapp',
    type: 'message',
    externalId: message.id,
    conversationId: `whatsapp:${message.from}`,
    senderId: message.from,
    content: message.text.body,
    rawPayload: message,
    isIncoming: true,
    isRead: false,
    timestamp: new Date(),
  });
}

async function processYouTubeComment(entry: YouTubeCommentPayload) {
  if (!entry.content) return;
  await persistSocialMessage({
    platform: 'youtube',
    type: 'comment',
    externalId: entry.id,
    conversationId: `youtube:${entry.author?.yt_channelId ?? entry.id}`,
    senderId: entry.author?.yt_channelId,
    senderName: entry.author?.name,
    content: entry.content,
    rawPayload: entry,
    isIncoming: true,
    isRead: false,
    timestamp: new Date(entry.published ?? Date.now()),
  });
}
// ﻿import { NextRequest, NextResponse } from 'next/server';

// // Webhook endpoint for receiving social media messages/comments
// // Supports Facebook, Instagram, WhatsApp, YouTube

// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json();
//     const platform = request.headers.get('x-platform') || 'unknown';

//     // Verify webhook signature (implement based on platform)
//     // Facebook/Instagram: X-Hub-Signature-256
//     // WhatsApp: X-Hub-Signature-256
//     // YouTube: X-Goog-Channel-Token

//     console.log(`Received webhook from ${platform}:`, body);

//     // Process different webhook types
//     if (platform === 'facebook' || platform === 'instagram') {
//       // Handle Facebook/Instagram webhooks
//       if (body.object === 'page' || body.object === 'instagram') {
//         for (const entry of body.entry || []) {
//           // Handle messages
//           if (entry.messaging) {
//             for (const event of entry.messaging) {
//               await processMessage(platform, event);
//             }
//           }
//           // Handle comments
//           if (entry.changes) {
//             for (const change of entry.changes) {
//               if (change.field === 'comments') {
//                 await processComment(platform, change.value);
//               }
//             }
//           }
//         }
//       }
//     } else if (platform === 'whatsapp') {
//       // Handle WhatsApp webhooks
//       if (body.entry) {
//         for (const entry of body.entry) {
//           for (const change of entry.changes || []) {
//             if (change.value.messages) {
//               for (const message of change.value.messages) {
//                 await processWhatsAppMessage(message);
//               }
//             }
//           }
//         }
//       }
//     } else if (platform === 'youtube') {
//       // Handle YouTube webhooks
//       if (body.feed?.entry) {
//         for (const entry of body.feed.entry) {
//           await processYouTubeComment(entry);
//         }
//       }
//     }

//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error('Webhook error:', error);
//     return NextResponse.json(
//       { error: 'Webhook processing failed' },
//       { status: 500 }
//     );
//   }
// }

// // GET endpoint for webhook verification (Facebook, Instagram)
// export async function GET(request: NextRequest) {
//   const searchParams = request.nextUrl.searchParams;
//   const mode = searchParams.get('hub.mode');
//   const token = searchParams.get('hub.verify_token');
//   const challenge = searchParams.get('hub.challenge');

//   // Verify token (should match your configured token)
//   const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN || 'your_verify_token';

//   if (mode === 'subscribe' && token === verifyToken) {
//     console.log('Webhook verified');
//     return new NextResponse(challenge, { status: 200 });
//   }

//   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
// }

// async function processMessage(platform: string, event: any) {
//   // Save message to database
//   // Send notification to admin
//   // Update unread count
//   console.log(`Processing ${platform} message:`, event);
  
//   // In production, save to database:
//   // await db.socialMessages.create({
//   //   platform,
//   //   type: 'message',
//   //   senderId: event.sender.id,
//   //   content: event.message.text,
//   //   timestamp: new Date(event.timestamp),
//   //   status: 'unread',
//   // });
// }

// async function processComment(platform: string, comment: any) {
//   // Save comment to database
//   // Send notification to admin
//   console.log(`Processing ${platform} comment:`, comment);
  
//   // In production, save to database:
//   // await db.socialMessages.create({
//   //   platform,
//   //   type: 'comment',
//   //   postId: comment.post_id,
//   //   senderId: comment.from.id,
//   //   content: comment.message,
//   //   timestamp: new Date(comment.created_time),
//   //   status: 'unread',
//   // });
// }

// async function processWhatsAppMessage(message: any) {
//   // Save WhatsApp message to database
//   // Send notification to admin
//   console.log('Processing WhatsApp message:', message);
  
//   // In production, save to database:
//   // await db.socialMessages.create({
//   //   platform: 'whatsapp',
//   //   type: 'message',
//   //   senderId: message.from,
//   //   content: message.text.body,
//   //   timestamp: new Date(),
//   //   status: 'unread',
//   // });
// }

// async function processYouTubeComment(entry: any) {
//   // Save YouTube comment to database
//   // Send notification to admin
//   console.log('Processing YouTube comment:', entry);
  
//   // In production, save to database:
//   // await db.socialMessages.create({
//   //   platform: 'youtube',
//   //   type: 'comment',
//   //   videoId: entry.videoId,
//   //   senderId: entry.author.yt_channelId,
//   //   content: entry.content,
//   //   timestamp: new Date(entry.published),
//   //   status: 'unread',
//   // });
// }

