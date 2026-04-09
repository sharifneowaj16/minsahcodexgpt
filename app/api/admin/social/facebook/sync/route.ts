import { NextRequest, NextResponse } from 'next/server';
import { adminUnauthorizedResponse, getVerifiedAdmin, parseNonNegativeInt } from '@/app/api/admin/_utils';
import { syncRecentFacebookInbox } from '@/lib/facebook/inboxSync';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const admin = await getVerifiedAdmin(request);
  if (!admin) {
    return adminUnauthorizedResponse();
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      pageId?: string;
      conversationLimit?: number;
      messageLimitPerConversation?: number;
    };

    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const pageId = body.pageId || process.env.FACEBOOK_PAGE_ID;

    if (!accessToken) {
      return NextResponse.json({ error: 'FACEBOOK_ACCESS_TOKEN is not configured' }, { status: 400 });
    }

    if (!pageId) {
      return NextResponse.json({ error: 'FACEBOOK_PAGE_ID is not configured' }, { status: 400 });
    }

    const result = await syncRecentFacebookInbox({
      accessToken,
      pageId,
      conversationLimit: parseNonNegativeInt(body.conversationLimit, 25) || 25,
      messageLimitPerConversation: parseNonNegativeInt(body.messageLimitPerConversation, 50) || 50,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('POST /api/admin/social/facebook/sync error:', error);
    return NextResponse.json({ error: 'Failed to sync Facebook inbox' }, { status: 500 });
  }
}
