import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { adminUnauthorizedResponse, getVerifiedAdmin } from '@/app/api/admin/_utils';

export const dynamic = 'force-dynamic';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const admin = await getVerifiedAdmin(request);
  if (!admin) return adminUnauthorizedResponse();

  const platform = request.nextUrl.searchParams.get('platform');
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let lastFingerprint = '';
      let lastHeartbeatAt = 0;
      // Start fast (500ms), slow down if no changes, max 2s
      let pollInterval = 500;
      let noChangeStreak = 0;

      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      const send = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
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
              select: { id: true, updatedAt: true, conversationId: true, platform: true },
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
            noChangeStreak = 0;
            // Speed back up when there's activity
            pollInterval = 500;
            send('message', {
              type: 'social-update',
              fingerprint,
              unreadCount,
              platform: latestMessage?.platform,
            });
          } else {
            noChangeStreak++;
            // Gradually slow down when idle: 500ms → 1s → 2s
            if (noChangeStreak > 10) pollInterval = 2000;
            else if (noChangeStreak > 5) pollInterval = 1000;

            if (Date.now() - lastHeartbeatAt > 15000) {
              lastHeartbeatAt = Date.now();
              send('ping', { now: new Date().toISOString(), unreadCount });
            }
          }
        } catch (error) {
          send('error', {
            message: error instanceof Error ? error.message : 'Failed to stream inbox updates',
          });
        }

        await sleep(pollInterval);
      }
    },
    cancel() { return undefined; },
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
