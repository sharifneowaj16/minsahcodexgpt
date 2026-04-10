import { NextRequest, NextResponse } from 'next/server';
import { adminUnauthorizedResponse, getVerifiedAdmin, parseNonNegativeInt } from '@/app/api/admin/_utils';
import { syncRecentFacebookInbox } from '@/lib/facebook/inboxSync';

export const dynamic = 'force-dynamic';
// Extend timeout for large syncs - this can take a while
export const maxDuration = 300; // 5 minutes

export async function GET(request: NextRequest) {
  const admin = await getVerifiedAdmin(request);
  if (!admin) return adminUnauthorizedResponse();

  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  if (!accessToken || !pageId) {
    return NextResponse.json(
      { error: 'FACEBOOK_ACCESS_TOKEN or FACEBOOK_PAGE_ID is not configured' },
      { status: 400 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  // 0 = unlimited (sync ALL conversations)
  const conversationLimit = parseNonNegativeInt(searchParams.get('limit'), 0) ?? 0;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send('started', { ok: true });

        const result = await syncRecentFacebookInbox({
          accessToken,
          pageId,
          conversationLimit, // 0 = unlimited
          messageLimitPerConversation: 100,
          onProgress: async (progress) => {
            send('progress', progress);
          },
        });

        send('completed', { success: true, ...result });
      } catch (error) {
        send('error', {
          error: error instanceof Error ? error.message : 'Failed to sync Facebook inbox',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(request: NextRequest) {
  const admin = await getVerifiedAdmin(request);
  if (!admin) return adminUnauthorizedResponse();

  try {
    const body = (await request.json().catch(() => ({}))) as {
      pageId?: string;
      conversationLimit?: number;
      messageLimitPerConversation?: number;
    };

    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const pageId = body.pageId || process.env.FACEBOOK_PAGE_ID;

    if (!accessToken) return NextResponse.json({ error: 'FACEBOOK_ACCESS_TOKEN is not configured' }, { status: 400 });
    if (!pageId) return NextResponse.json({ error: 'FACEBOOK_PAGE_ID is not configured' }, { status: 400 });

    const result = await syncRecentFacebookInbox({
      accessToken,
      pageId,
      // 0 = unlimited by default from POST too
      conversationLimit: parseNonNegativeInt(body.conversationLimit, 0) ?? 0,
      messageLimitPerConversation: parseNonNegativeInt(body.messageLimitPerConversation, 100) || 100,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('POST /api/admin/social/facebook/sync error:', error);
    return NextResponse.json({ error: 'Failed to sync Facebook inbox' }, { status: 500 });
  }
}
