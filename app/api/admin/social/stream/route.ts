import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { adminUnauthorizedResponse, getVerifiedAdmin } from '@/app/api/admin/_utils';

export const dynamic = 'force-dynamic';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const admin = await getVerifiedAdmin(request);
  if (!admin) {
    return adminUnauthorizedResponse();
  }

  const platform = request.nextUrl.searchParams.get('platform');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastFingerprint = '';
      let lastHeartbeatAt = 0;

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      const send = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      request.signal.addEventListener('abort', close);
      send('ready', { ok: true, adminId: admin.adminId });

      while (!closed) {
        try {
          const where = platform ? { platform } : undefined;
          const [latestMessage, unreadCount] = await Promise.all([
            prisma.socialMessage.findFirst({
              where,
              orderBy: { updatedAt: 'desc' },
              select: {
                id: true,
                updatedAt: true,
                conversationId: true,
              },
            }),
            prisma.socialMessage.count({
              where: {
                ...(platform ? { platform } : {}),
                isIncoming: true,
                isRead: false,
              },
            }),
          ]);

          const fingerprint = JSON.stringify({
            id: latestMessage?.id ?? null,
            updatedAt: latestMessage?.updatedAt?.toISOString() ?? null,
            conversationId: latestMessage?.conversationId ?? null,
            unreadCount,
          });

          if (fingerprint !== lastFingerprint) {
            lastFingerprint = fingerprint;
            send('message', { type: 'social-update', fingerprint });
          } else if (Date.now() - lastHeartbeatAt > 15000) {
            lastHeartbeatAt = Date.now();
            send('ping', { now: new Date().toISOString() });
          }
        } catch (error) {
          send('error', {
            message: error instanceof Error ? error.message : 'Failed to stream inbox updates',
          });
        }

        await sleep(1000);
      }
    },
    cancel() {
      return undefined;
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
