import { NextRequest } from 'next/server';
import { adminUnauthorizedResponse, getVerifiedAdmin } from '@/app/api/admin/_utils';
import { createRedisSubscriber, SOCIAL_UPDATES_CHANNEL } from '@/lib/redis';
import type { SocialUpdatePayload } from '@/lib/redis';

export const dynamic = 'force-dynamic';

const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(request: NextRequest) {
  const admin = await getVerifiedAdmin(request);
  if (!admin) return adminUnauthorizedResponse();

  const platformFilter = request.nextUrl.searchParams.get('platform') ?? null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      // ── helpers ────────────────────────────────────────────────────────────

      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      const send = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { close(); }
      };

      // ── dedicated subscriber per request ───────────────────────────────────

      const sub = createRedisSubscriber();

      const cleanup = async () => {
        try {
          await sub.unsubscribe(SOCIAL_UPDATES_CHANNEL);
          sub.disconnect();
          console.log('[social-stream] SSE subscriber disconnected — admin:', admin.adminId);
        } catch { /* ignore disconnect errors */ }
        close();
      };

      request.signal.addEventListener('abort', () => void cleanup());

      // ── heartbeat ──────────────────────────────────────────────────────────

      const heartbeatTimer = setInterval(() => {
        if (closed) { clearInterval(heartbeatTimer); return; }
        send('ping', { now: new Date().toISOString() });
      }, HEARTBEAT_INTERVAL_MS);

      // ── subscribe ──────────────────────────────────────────────────────────

      sub.on('message', (channel: string, raw: string) => {
        if (closed) return;
        if (channel !== SOCIAL_UPDATES_CHANNEL) return;

        let payload: SocialUpdatePayload;
        try {
          payload = JSON.parse(raw) as SocialUpdatePayload;
        } catch {
          console.warn('[social-stream] unparseable Redis message:', raw);
          return;
        }

        // Apply optional platform filter
        if (platformFilter && payload.platform !== platformFilter) return;

        console.log('[social-stream] SSE event forwarded — platform:', payload.platform, 'conv:', payload.conversationId);

        send('message', {
          type: 'social-update',
          platform: payload.platform,
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          timestamp: payload.timestamp,
        });
      });

      sub.on('error', (err: Error) => {
        console.error('[social-stream] subscriber error:', err.message);
        // Send error event so the client knows to reconnect
        send('error', { message: 'Realtime stream interrupted, reconnecting…' });
      });

      try {
        await sub.subscribe(SOCIAL_UPDATES_CHANNEL);
        console.log('[social-stream] SSE subscriber connected — admin:', admin.adminId, '| platform filter:', platformFilter ?? 'all');
        send('ready', { ok: true, adminId: admin.adminId });
      } catch (err) {
        console.error('[social-stream] failed to subscribe:', err);
        clearInterval(heartbeatTimer);
        send('error', { message: 'Failed to connect to realtime stream' });
        close();
      }
    },

    cancel() {
      // Called by the runtime when the client disconnects without abort signal
      // cleanup runs via the abort listener; nothing extra needed here
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
