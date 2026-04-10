import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET - Inbox messages list
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const platform = searchParams.get('platform'); // optional filter
    const unreadOnly = searchParams.get('unread') === 'true';
    const baseWhere = {
      ...(platform && { platform }),
      ...(unreadOnly ? { isRead: false, isIncoming: true } : {}),
    };

    const messages = await prisma.socialMessage.findMany({
      where: baseWhere,
      orderBy: { timestamp: 'desc' },
      take: 200,
      include: {
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const unreadCount = await prisma.socialMessage.count({
      where: {
        ...(platform && { platform }),
        isRead: false,
        isIncoming: true,
      },
    });

    return NextResponse.json({ messages, unreadCount });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// PATCH - Mark as read
export async function PATCH(request: NextRequest) {
  try {
    const { id, conversationId, platform, markAll } = await request.json();

    if (markAll) {
      await prisma.socialMessage.updateMany({
        where: {
          ...(platform && { platform }),
          isRead: false,
          isIncoming: true,
        },
        data: { isRead: true },
      });
    } else if (conversationId) {
      await prisma.socialMessage.updateMany({
        where: {
          conversationId,
          ...(platform && { platform }),
          isRead: false,
          isIncoming: true,
        },
        data: { isRead: true },
      });
    } else {
      await prisma.socialMessage.update({
        where: { id },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}
