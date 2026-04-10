'use client';

/**
 * app/components/admin/SocialMediaInboxChat.tsx
 *
 * Full-screen WhatsApp-style social inbox for Minsah Beauty admin panel.
 *
 * Features:
 *  - Real-time SSE stream with silent background merge (no flicker)
 *  - Exponential-backoff SSE reconnect + polling fallback
 *  - Optimistic message append on send (with rollback on error)
 *  - Auto-mark-as-read when conversation opens
 *  - Enter to send, Shift+Enter for newline
 *  - Textarea auto-resize
 *  - Facebook Messenger sync with live progress
 *  - AI reply suggestion via Claude API
 *  - Mobile: full-screen panels toggled by back button
 *  - Minsah Beauty brand colors throughout
 */

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { fixEncoding } from '@/lib/fixEncoding';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  FileAudio,
  FileText,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserCircle,
  Video as VideoIcon,
  X,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────── types ──

export interface SocialMessage {
  id: string;
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'youtube';
  type: 'comment' | 'message' | 'dm' | 'mention';
  conversationId: string;
  sender: { id: string; name: string; avatar?: string };
  content: {
    text: string;
    media?: Array<{
      type: 'image' | 'video' | 'audio' | 'document' | 'file';
      url: string;
      thumbnail?: string;
      fileName?: string;
      mimeType?: string;
    }>;
  };
  status: 'unread' | 'read' | 'replied';
  timestamp: string;
  isIncoming: boolean;
}

interface ApiRecord {
  id: string;
  platform: SocialMessage['platform'];
  type: SocialMessage['type'];
  conversationId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  senderAvatar?: string | null;
  content: string;
  isRead: boolean;
  timestamp: string;
  isIncoming: boolean;
  attachments?: Array<{
    id: string;
    type: string;
    mimeType?: string | null;
    fileName?: string | null;
    storageUrl?: string | null;
    externalUrl?: string | null;
    thumbnailUrl?: string | null;
  }>;
}

interface Conversation {
  conversationId: string;
  platform: SocialMessage['platform'];
  participant: SocialMessage['sender'];
  latestMessage: SocialMessage;
  unreadCount: number;
}

interface DraftAttachment {
  id: string;
  file: File;
  previewUrl: string;
  type: NonNullable<SocialMessage['content']['media']>[number]['type'];
}

interface SyncProgress {
  stage: 'idle' | 'starting' | 'fetching' | 'processing_conversation' | 'processing_message' | 'completed' | 'error';
  processedConversations: number;
  totalConversations: number;
  processedMessages: number;
  processedAttachments: number;
  senderName?: string | null;
  error?: string;
}

// ─────────────────────────────────────────────────────── helpers ──

type MediaItem = NonNullable<SocialMessage['content']['media']>[number];

function normalizeType(t: string): MediaItem['type'] {
  if (t === 'image' || t === 'video' || t === 'audio' || t === 'document') return t;
  return 'file';
}

function mapRecord(m: ApiRecord): SocialMessage {
  return {
    id: m.id,
    platform: m.platform,
    type: m.type,
    conversationId: m.conversationId || (m.senderId ? `${m.platform}:${m.senderId}` : m.id),
    sender: {
      id: m.senderId || 'unknown',
      name: m.senderName || (m.isIncoming ? 'Unknown' : 'Minsah Beauty'),
      avatar: m.senderAvatar ?? undefined,
    },
    content: {
      text: m.content,
      media: (m.attachments ?? [])
        .map((a): MediaItem => ({
          type: normalizeType(a.type),
          url: a.storageUrl || a.externalUrl || '',
          thumbnail: a.thumbnailUrl || undefined,
          fileName: a.fileName || undefined,
          mimeType: a.mimeType || undefined,
        }))
        .filter((a) => Boolean(a.url)),
    },
    status: m.isIncoming ? (m.isRead ? 'read' : 'unread') : 'replied',
    timestamp: m.timestamp,
    isIncoming: m.isIncoming,
  };
}

function fmtTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtDivider(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function inferAttachType(file: File): MediaItem['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

// ─────────────────────────────────────────────── platform badge ──

const PLATFORM_CFG: Record<string, { bg: string; label: string }> = {
  facebook: { bg: '#1877f2', label: 'f' },
  instagram: { bg: '#e1306c', label: '▲' },
  whatsapp: { bg: '#25d366', label: 'W' },
  youtube: { bg: '#ff0000', label: '▶' },
};

function PlatBadge({ platform, size = 18 }: { platform: string; size?: number }) {
  const cfg = PLATFORM_CFG[platform] ?? PLATFORM_CFG.facebook;
  return (
    <span
      style={{
        width: size, height: size, borderRadius: '50%',
        background: cfg.bg, color: '#fff',
        fontSize: size * 0.52, fontWeight: 800,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, lineHeight: 1, fontFamily: 'sans-serif',
        boxShadow: '0 0 0 2px #fff',
      }}
    >
      {cfg.label}
    </span>
  );
}

// ───────────────────────────────────────────────────── avatar ──

function Avatar({
  src, name, size = 44,
}: { src?: string; name: string; size?: number }) {
  const [err, setErr] = useState(false);
  const colors = ['#64320D', '#8E6545', '#421C00', '#7a3f1a', '#a05a2c'];
  const color = colors[name.charCodeAt(0) % colors.length];

  if (src && !err) {
    return (
      <img
        src={src}
        alt={name}
        onError={() => setErr(true)}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%',
        background: color, color: '#FFE6D2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 700,
        flexShrink: 0, fontFamily: 'sans-serif',
      }}
    >
      {initials(name)}
    </div>
  );
}

// ─────────────────────────────────────────────────── main component ──

export default function SocialMediaInboxChat() {
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('facebook');
  const [search, setSearch] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncingFb, setSyncingFb] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    stage: 'idle', processedConversations: 0, totalConversations: 0,
    processedMessages: 0, processedAttachments: 0,
  });
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftAttachment[]>([]);
  const [showChat, setShowChat] = useState(false); // mobile toggle
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  const fileRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // ─────────────────────────────────────────── data fetching ──

  const fetchMessages = useCallback(async (skeleton = false) => {
    if (skeleton) setInitialLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform !== 'all') params.set('platform', filterPlatform);
      const res = await fetch(
        `/api/social/messages${params.toString() ? `?${params}` : ''}`,
        { cache: 'no-store' }
      );
      const data = (await res.json()) as { messages: ApiRecord[]; unreadCount: number };
      const incoming = (data.messages || []).map(mapRecord);
      setMessages((prev) => {
        const ids = new Set(incoming.map((m) => m.id));
        const optimistic = prev.filter((m) => !ids.has(m.id) && !m.isIncoming);
        return [...incoming, ...optimistic];
      });
      setUnreadCount(data.unreadCount || 0);
    } catch { /* silent */ }
    finally { setInitialLoading(false); }
  }, [filterPlatform]);

  // SSE real-time stream + reconnect
  useEffect(() => {
    void fetchMessages(true);
    const url = filterPlatform !== 'all'
      ? `/api/admin/social/stream?platform=${encodeURIComponent(filterPlatform)}`
      : '/api/admin/social/stream';

    let es: EventSource | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let delay = 1000;

    const connect = () => {
      es?.close();
      es = new EventSource(url);
      es.addEventListener('message', () => void fetchMessages(false));
      es.addEventListener('ping', () => { delay = 1000; });
      es.addEventListener('error', () => {
        es?.close(); es = null;
        retry = setTimeout(() => { delay = Math.min(delay * 2, 30000); connect(); }, delay);
        if (!fallback) {
          fallback = setInterval(() => {
            if (document.visibilityState === 'visible') void fetchMessages(false);
          }, 5000);
        }
      });
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchMessages(false);
        if (!es || es.readyState === EventSource.CLOSED) connect();
      }
    };

    connect();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      es?.close();
      if (fallback) clearInterval(fallback);
      if (retry) clearTimeout(retry);
    };
  }, [filterPlatform, fetchMessages]);

  // ─────────────────────────────────────────────── conversations ──

  const filtered = useMemo(() => messages.filter((m) => {
    if (filterPlatform !== 'all' && m.platform !== filterPlatform) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!fixEncoding(m.content.text).toLowerCase().includes(q) &&
          !m.sender.name.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [messages, filterPlatform, search]);

  const conversations = useMemo<Conversation[]>(() => {
    const map = new Map<string, SocialMessage[]>();
    for (const m of filtered) {
      const k = m.conversationId || m.id;
      const arr = map.get(k); if (arr) arr.push(m); else map.set(k, [m]);
    }
    return Array.from(map.entries())
      .map(([cid, items]) => {
        const sorted = [...items].sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const latest = sorted[sorted.length - 1];
        const participant =
          [...sorted].reverse().find((m) => m.isIncoming)?.sender ?? sorted[0].sender;
        return {
          conversationId: cid,
          platform: latest.platform,
          participant,
          latestMessage: latest,
          unreadCount: sorted.filter((m) => m.isIncoming && m.status === 'unread').length,
        };
      })
      .sort((a, b) =>
        new Date(b.latestMessage.timestamp).getTime() -
        new Date(a.latestMessage.timestamp).getTime()
      );
  }, [filtered]);

  // Auto-select first conversation
  useEffect(() => {
    if (!conversations.length) { if (selected) setSelected(null); return; }
    if (!conversations.some((c) => c.conversationId === selected)) {
      setSelected(conversations[0].conversationId);
    }
  }, [conversations, selected]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.conversationId === selected) ?? null,
    [conversations, selected]
  );

  const threadMessages = useMemo(
    () => selected
      ? filtered
          .filter((m) => m.conversationId === selected)
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      : [],
    [filtered, selected]
  );

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [threadMessages.length, selected]);

  // Auto-mark-as-read
  useEffect(() => {
    if (!selected) return;
    const hasUnread = messages.some(
      (m) => m.conversationId === selected && m.isIncoming && m.status === 'unread'
    );
    if (!hasUnread) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.conversationId === selected && m.isIncoming
          ? { ...m, status: 'read' as const } : m
      )
    );
    setUnreadCount((prev) =>
      Math.max(0, prev - messages.filter(
        (m) => m.conversationId === selected && m.isIncoming && m.status === 'unread'
      ).length)
    );
    void fetch('/api/social/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: selected }),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Clear drafts when switching to non-facebook
  useEffect(() => {
    if (activeConversation?.platform !== 'facebook' && drafts.length) clearDrafts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.platform]);

  // ───────────────────────────────────────────── send reply ──

  const clearDrafts = useCallback(() => {
    setDrafts((prev) => { prev.forEach((d) => URL.revokeObjectURL(d.previewUrl)); return []; });
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const send = async () => {
    if ((!replyText.trim() && !drafts.length) || sending || !activeConversation) return;

    const thread = messages
      .filter((m) => m.conversationId === selected)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const target = [...thread].reverse().find((m) => m.isIncoming) ?? thread[thread.length - 1];
    if (!target) return;

    setSending(true);
    setReplyError(null);
    setAiSuggestion('');

    // Optimistic append
    const oId = `optimistic-${Date.now()}`;
    const oMsg: SocialMessage = {
      id: oId, platform: target.platform, type: target.type,
      conversationId: selected!,
      sender: { id: 'page', name: 'Minsah Beauty' },
      content: { text: replyText.trim() },
      status: 'replied', timestamp: new Date().toISOString(), isIncoming: false,
    };
    const savedText = replyText.trim();
    setMessages((prev) => [...prev, oMsg]);
    setReplyText('');
    clearDrafts();
    if (taRef.current) taRef.current.style.height = 'auto';

    try {
      const uploaded = await Promise.all(
        drafts.map(async (d) => {
          const fd = new FormData();
          fd.append('file', d.file);
          const r = await fetch('/api/admin/social/upload', { method: 'POST', body: fd });
          const j = (await r.json()) as { url?: string; fileName?: string; mimeType?: string; error?: string };
          if (!r.ok || !j.url) throw new Error(j.error || 'Upload failed');
          return { type: d.type, url: j.url, fileName: j.fileName || d.file.name, mimeType: j.mimeType || d.file.type };
        })
      );

      const res = await fetch('/api/social/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: target.platform,
          messageId: target.id,
          messageType: target.type,
          conversationId: selected,
          recipientId: target.sender.id,
          text: savedText,
          attachments: uploaded,
        }),
      });
      const data = (await res.json()) as { error?: string; message?: ApiRecord };
      if (!res.ok) throw new Error(data.error || 'Reply failed');
      if (data.message) {
        const confirmed = mapRecord(data.message);
        setMessages((prev) => prev.map((m) => (m.id === oId ? confirmed : m)));
      }
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== oId));
      setReplyText(savedText);
      setReplyError(e instanceof Error ? e.message : 'Reply failed');
    } finally {
      setSending(false);
    }
  };

  // ─────────────────────────────────────── AI suggestion ──

  const getAiSuggestion = async () => {
    if (!activeConversation || aiLoading) return;
    setAiLoading(true);
    setAiSuggestion('');
    try {
      const history = threadMessages.slice(-10).map((m) => ({
        role: m.isIncoming ? 'user' : 'assistant' as const,
        content: fixEncoding(m.content.text),
      }));
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a friendly and helpful customer service representative for Minsah Beauty — 
a premium beauty product e-commerce brand based in Bangladesh.
Respond warmly, professionally, in the same language as the customer (Bangla, English, or mixed Banglish).
Keep replies concise (2–4 sentences). Address their question directly.
Never mention you are an AI. Sign off as "Minsah Beauty Team" if needed.`,
          messages: history,
        }),
      });
      const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = json.content?.find((b) => b.type === 'text')?.text ?? '';
      setAiSuggestion(text);
    } catch { /* silent */ }
    finally { setAiLoading(false); }
  };

  const acceptSuggestion = () => {
    setReplyText(aiSuggestion);
    setAiSuggestion('');
    taRef.current?.focus();
  };

  // ─────────────────────────────────────── Facebook sync ──

  const syncFacebook = async () => {
    if (syncingFb) return;
    setSyncingFb(true);
    setSyncProgress({ stage: 'starting', processedConversations: 0, totalConversations: 0, processedMessages: 0, processedAttachments: 0 });
    await new Promise<void>((resolve) => {
      const src = new EventSource('/api/admin/social/facebook/sync');
      let done = false;
      const finish = () => { if (done) return; done = true; src.close(); resolve(); };
      src.addEventListener('started', () => setSyncProgress((p) => ({ ...p, stage: 'fetching' })));
      src.addEventListener('progress', (e) => {
        const d = JSON.parse((e as MessageEvent).data) as Partial<SyncProgress>;
        setSyncProgress((p) => ({ ...p, ...d }));
      });
      src.addEventListener('completed', (e) => {
        const d = JSON.parse((e as MessageEvent).data) as Partial<SyncProgress>;
        setSyncProgress((p) => ({ ...p, stage: 'completed', ...d }));
        setSyncingFb(false);
        void fetchMessages(false);
        finish();
      });
      src.addEventListener('error', (e) => {
        const msg = (e as MessageEvent).data
          ? (JSON.parse((e as MessageEvent).data) as { error?: string }).error
          : 'Sync failed';
        setSyncProgress((p) => ({ ...p, stage: 'error', error: msg ?? 'Sync failed' }));
        setSyncingFb(false);
        finish();
      });
      src.onerror = () => { setSyncingFb(false); finish(); };
    });
  };

  const syncLabel = useMemo(() => {
    switch (syncProgress.stage) {
      case 'starting': return 'Starting…';
      case 'fetching': return 'Fetching conversations…';
      case 'processing_conversation': return syncProgress.senderName ? `Processing: ${syncProgress.senderName}` : 'Processing…';
      case 'processing_message': return `Saving messages… (${syncProgress.processedMessages})`;
      case 'completed': return `Synced ${syncProgress.processedMessages} messages ✓`;
      case 'error': return syncProgress.error || 'Sync failed';
      default: return null;
    }
  }, [syncProgress]);

  // ─────────────────────────────────────────── file input ──

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const next = files
      .filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/') || f.type.startsWith('audio/'))
      .map((f, i) => ({
        id: `${f.name}-${Date.now()}-${i}`,
        file: f, previewUrl: URL.createObjectURL(f),
        type: inferAttachType(f),
      }));
    setDrafts((p) => [...p, ...next]);
    e.target.value = '';
  };

  const canAttach = activeConversation?.platform === 'facebook';

  // ─────────────────────────────────────────────────── render ──

  const PLATFORM_TABS = [
    { id: 'facebook', label: 'Facebook' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'all', label: 'All' },
  ];

  if (initialLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-minsah-light">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-minsah-accent border-t-minsah-primary" />
          <p className="text-sm font-medium text-minsah-secondary">Loading inbox…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-minsah-light font-sans">

      {/* ═══════════════════════════ SIDEBAR ═══════════════════════════ */}
      <aside
        className={`
          flex flex-col bg-white border-r border-minsah-accent
          transition-all duration-200
          ${showChat ? 'hidden' : 'flex'}
          w-full sm:flex sm:w-80 lg:w-96 shrink-0
        `}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between gap-3 border-b border-minsah-accent bg-minsah-primary px-4 py-3">
          <div className="flex items-center gap-2.5">
            <a
              href="/admin/marketing?tab=inbox"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
              title="Back to admin"
            >
              <ArrowLeft className="h-4 w-4" />
            </a>
            <div>
              <h1 className="text-base font-bold leading-tight text-white">Minsah Inbox</h1>
              {unreadCount > 0 && (
                <p className="text-[11px] text-minsah-accent">{unreadCount} unread message{unreadCount > 1 ? 's' : ''}</p>
              )}
            </div>
          </div>

          {filterPlatform === 'facebook' && (
            <button
              type="button"
              onClick={() => void syncFacebook()}
              disabled={syncingFb}
              title="Sync Facebook inbox"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${syncingFb ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Sync progress banner */}
        {syncLabel && (
          <div className={`px-4 py-2 text-xs font-medium ${
            syncProgress.stage === 'error'
              ? 'bg-red-50 text-red-700'
              : syncProgress.stage === 'completed'
              ? 'bg-green-50 text-green-700'
              : 'bg-minsah-accent text-minsah-dark'
          }`}>
            {syncLabel}
          </div>
        )}

        {/* Search */}
        <div className="border-b border-minsah-accent px-3 py-2.5">
          <div className="flex items-center gap-2 rounded-full bg-minsah-light px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-minsah-secondary" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="flex-1 bg-transparent text-sm text-minsah-dark outline-none placeholder:text-minsah-secondary"
            />
          </div>
        </div>

        {/* Platform tabs */}
        <div className="flex gap-1 border-b border-minsah-accent px-3 py-2">
          {PLATFORM_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterPlatform(tab.id)}
              className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition ${
                filterPlatform === tab.id
                  ? 'bg-minsah-primary text-white'
                  : 'text-minsah-secondary hover:bg-minsah-light'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-minsah-secondary">
              <UserCircle className="h-10 w-10 opacity-40" />
              <p className="text-sm">No conversations</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.conversationId}
                type="button"
                onClick={() => { setSelected(conv.conversationId); setShowChat(true); }}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition border-b border-minsah-accent/60 ${
                  selected === conv.conversationId
                    ? 'bg-minsah-accent border-l-4 border-l-minsah-primary'
                    : 'hover:bg-minsah-light border-l-4 border-l-transparent'
                }`}
              >
                {/* Avatar + platform badge */}
                <div className="relative shrink-0">
                  <Avatar src={conv.participant.avatar} name={conv.participant.name} size={48} />
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <PlatBadge platform={conv.platform} size={16} />
                  </span>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${conv.unreadCount > 0 ? 'font-bold text-minsah-dark' : 'font-semibold text-minsah-dark'}`}>
                      {conv.participant.name}
                    </p>
                    <span className="shrink-0 text-[11px] text-minsah-secondary">
                      {fmtTime(conv.latestMessage.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={`truncate text-xs ${conv.unreadCount > 0 ? 'font-semibold text-minsah-dark' : 'text-minsah-secondary'}`}>
                      {conv.latestMessage.isIncoming ? '' : 'You: '}
                      {fixEncoding(conv.latestMessage.content.text) || '📎 Attachment'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-minsah-primary px-1.5 text-[10px] font-bold text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* ═══════════════════════════ CHAT PANEL ═══════════════════════════ */}
      <main
        className={`
          flex-1 flex flex-col min-w-0 h-full
          ${!showChat ? 'hidden sm:flex' : 'flex'}
        `}
      >
        {activeConversation ? (
          <>
            {/* Chat header */}
            <div className="flex shrink-0 items-center gap-3 border-b border-minsah-accent bg-white px-4 py-3 shadow-sm">
              {/* Mobile back */}
              <button
                type="button"
                onClick={() => setShowChat(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-minsah-secondary transition hover:bg-minsah-light sm:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              <div className="relative shrink-0">
                <Avatar src={activeConversation.participant.avatar} name={activeConversation.participant.name} size={42} />
                <span className="absolute -bottom-0.5 -right-0.5">
                  <PlatBadge platform={activeConversation.platform} size={16} />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-minsah-dark">
                  {activeConversation.participant.name}
                </p>
                <p className="truncate text-xs text-minsah-secondary capitalize">
                  {activeConversation.platform} · {activeConversation.latestMessage.type}
                </p>
              </div>

              {/* AI suggest button */}
              <button
                type="button"
                onClick={() => void getAiSuggestion()}
                disabled={aiLoading}
                title="Get AI reply suggestion"
                className="flex items-center gap-1.5 rounded-full bg-minsah-accent px-3 py-1.5 text-xs font-semibold text-minsah-primary transition hover:bg-minsah-primary hover:text-white disabled:opacity-50"
              >
                {aiLoading
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Sparkles className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">AI Reply</span>
              </button>
            </div>

            {/* AI suggestion bar */}
            {aiSuggestion && (
              <div className="shrink-0 border-b border-minsah-accent bg-minsah-accent/60 px-4 py-3">
                <div className="flex items-start gap-3">
                  <Bot className="mt-0.5 h-4 w-4 shrink-0 text-minsah-primary" />
                  <p className="flex-1 text-sm text-minsah-dark">{aiSuggestion}</p>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={acceptSuggestion}
                      className="rounded-full bg-minsah-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-minsah-dark"
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiSuggestion('')}
                      className="rounded-full bg-white px-2 py-1 text-xs text-minsah-secondary transition hover:bg-minsah-light"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-minsah-light px-3 py-4 sm:px-6">
              <div className="mx-auto flex max-w-3xl flex-col gap-1">
                {threadMessages.map((msg, i) => {
                  const prev = threadMessages[i - 1];
                  const next = threadMessages[i + 1];
                  const showDivider = !prev || !sameDay(prev.timestamp, msg.timestamp);
                  const isOptimistic = msg.id.startsWith('optimistic-');
                  // Group: show avatar only on last in a run
                  const showAvatar = msg.isIncoming && (!next || !next.isIncoming || next.sender.id !== msg.sender.id);
                  // Reduce gap within same-sender runs
                  const sameSenderAsPrev = prev && prev.isIncoming === msg.isIncoming && prev.sender.id === msg.sender.id;
                  const sameSenderAsNext = next && next.isIncoming === msg.isIncoming && next.sender.id === msg.sender.id;

                  return (
                    <div key={msg.id} className={sameSenderAsPrev ? 'mt-0.5' : 'mt-3'}>
                      {showDivider && (
                        <div className="my-4 flex items-center justify-center">
                          <span className="rounded-full bg-white px-4 py-1 text-xs font-medium text-minsah-secondary shadow-sm ring-1 ring-minsah-accent">
                            {fmtDivider(msg.timestamp)}
                          </span>
                        </div>
                      )}

                      <div className={`flex items-end gap-2 ${msg.isIncoming ? 'justify-start' : 'justify-end'}`}>
                        {/* Incoming avatar placeholder (keeps alignment) */}
                        {msg.isIncoming && (
                          <div className="w-8 shrink-0 self-end">
                            {showAvatar && (
                              <Avatar
                                src={msg.sender.avatar}
                                name={msg.sender.name}
                                size={30}
                              />
                            )}
                          </div>
                        )}

                        {/* Bubble */}
                        <div
                          className={`max-w-[75%] sm:max-w-[65%] ${isOptimistic ? 'opacity-60' : ''}`}
                        >
                          {/* Sender name for first in group (incoming only) */}
                          {msg.isIncoming && !sameSenderAsPrev && (
                            <p className="mb-1 ml-1 text-[11px] font-semibold text-minsah-secondary">
                              {msg.sender.name}
                            </p>
                          )}

                          <div
                            className={`relative px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                              msg.isIncoming
                                ? `bg-white text-minsah-dark border border-minsah-accent ${
                                    sameSenderAsPrev && sameSenderAsNext
                                      ? 'rounded-2xl rounded-tl-sm rounded-bl-sm'
                                      : sameSenderAsPrev
                                      ? 'rounded-2xl rounded-tl-sm'
                                      : sameSenderAsNext
                                      ? 'rounded-2xl rounded-bl-sm'
                                      : 'rounded-2xl rounded-tl-sm'
                                  }`
                                : `bg-minsah-primary text-white ${
                                    sameSenderAsPrev && sameSenderAsNext
                                      ? 'rounded-2xl rounded-tr-sm rounded-br-sm'
                                      : sameSenderAsPrev
                                      ? 'rounded-2xl rounded-tr-sm'
                                      : sameSenderAsNext
                                      ? 'rounded-2xl rounded-br-sm'
                                      : 'rounded-2xl rounded-tr-sm'
                                  }`
                            }`}
                          >
                            {/* Message type badge (only on first in group) */}
                            {!sameSenderAsPrev && msg.type !== 'message' && (
                              <span className={`mb-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                                msg.isIncoming
                                  ? 'bg-minsah-accent text-minsah-primary'
                                  : 'bg-white/20 text-white/90'
                              }`}>
                                {msg.type}
                              </span>
                            )}

                            <p className="whitespace-pre-wrap">{fixEncoding(msg.content.text)}</p>

                            {/* Media */}
                            {msg.content.media && msg.content.media.length > 0 && (
                              <div className="mt-2 grid gap-2">
                                {msg.content.media.map((m, mi) => renderMedia(m, `${msg.id}-${mi}`, msg.isIncoming))}
                              </div>
                            )}

                            {/* Optimistic indicator */}
                            {isOptimistic && (
                              <p className="mt-1 text-right text-[10px] text-white/60">Sending…</p>
                            )}
                          </div>

                          {/* Timestamp + read receipt (last in group) */}
                          {!sameSenderAsNext && (
                            <div className={`mt-1 flex items-center gap-1 ${msg.isIncoming ? 'justify-start ml-1' : 'justify-end'}`}>
                              <span className="text-[11px] text-minsah-secondary">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                              {!msg.isIncoming && (
                                <CheckCheck className={`h-3.5 w-3.5 ${msg.status === 'replied' ? 'text-minsah-secondary' : 'text-minsah-secondary'}`} />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} className="h-1" />
              </div>
            </div>

            {/* Compose area */}
            <div className="shrink-0 border-t border-minsah-accent bg-white px-3 py-3 sm:px-4">
              {replyError && (
                <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                  {replyError}
                </p>
              )}

              {/* Draft attachment previews */}
              {drafts.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {drafts.map((d) => (
                    <div key={d.id} className="relative w-20 overflow-hidden rounded-xl border border-minsah-accent">
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(d.previewUrl);
                          setDrafts((p) => p.filter((x) => x.id !== d.id));
                        }}
                        className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-minsah-dark/80 text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      {d.type === 'image' ? (
                        <img src={d.previewUrl} alt="" className="h-16 w-full object-cover" />
                      ) : (
                        <div className="flex h-16 items-center justify-center bg-minsah-light text-minsah-secondary">
                          <FileAudio className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!canAttach && drafts.length === 0 && (
                <p className="mb-2 text-[11px] text-minsah-secondary">
                  Media sending is available for Facebook Messenger only.
                </p>
              )}

              <div className="flex items-end gap-2 rounded-2xl border border-minsah-accent bg-minsah-light px-3 py-2">
                {/* Attach */}
                <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" multiple className="hidden" onChange={onFileChange} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!canAttach || sending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-minsah-secondary shadow-sm transition hover:text-minsah-primary disabled:opacity-40"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                {/* Textarea */}
                <textarea
                  ref={taRef}
                  value={replyText}
                  onChange={(e) => {
                    setReplyText(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Write a reply… (Enter to send)"
                  className="flex-1 resize-none bg-transparent py-2 text-sm text-minsah-dark outline-none placeholder:text-minsah-secondary"
                  style={{ minHeight: '36px', maxHeight: '120px' }}
                />

                {/* Send */}
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={(!replyText.trim() && !drafts.length) || sending}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-minsah-primary text-white shadow-sm transition hover:bg-minsah-dark disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-1.5 text-center text-[11px] text-minsah-secondary/60">
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-minsah-light">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-minsah-accent">
              <Bot className="h-10 w-10 text-minsah-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-minsah-dark">Minsah Beauty Inbox</h2>
              <p className="mt-1 text-sm text-minsah-secondary">Select a conversation to start replying</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────── media renderer ──

function renderMedia(
  media: NonNullable<SocialMessage['content']['media']>[number],
  key: string,
  isIncoming: boolean
) {
  const borderClass = isIncoming ? 'border-minsah-accent' : 'border-white/20';

  if (media.type === 'image') {
    return (
      <a key={key} href={media.url} target="_blank" rel="noreferrer"
         className={`block overflow-hidden rounded-xl border ${borderClass}`}>
        <img src={media.thumbnail || media.url} alt={media.fileName || 'Image'}
             className="max-h-60 w-full object-cover" />
      </a>
    );
  }
  if (media.type === 'video') {
    return (
      <div key={key} className={`overflow-hidden rounded-xl border ${borderClass} bg-black`}>
        <video controls preload="metadata" poster={media.thumbnail}
               className="max-h-60 w-full" src={media.url} />
        {media.fileName && (
          <div className={`flex items-center gap-2 px-3 py-1.5 text-xs ${isIncoming ? 'text-minsah-secondary' : 'text-white/70'}`}>
            <VideoIcon className="h-3.5 w-3.5" />
            <span className="truncate">{media.fileName}</span>
          </div>
        )}
      </div>
    );
  }
  if (media.type === 'audio') {
    return (
      <div key={key} className={`rounded-xl border ${borderClass} p-2.5`}>
        <div className={`mb-1.5 flex items-center gap-2 text-xs ${isIncoming ? 'text-minsah-secondary' : 'text-white/80'}`}>
          <FileAudio className="h-3.5 w-3.5" />
          <span className="truncate">{media.fileName || 'Audio'}</span>
        </div>
        <audio controls preload="metadata" className="w-full h-8" src={media.url} />
      </div>
    );
  }
  return (
    <a key={key} href={media.url} target="_blank" rel="noreferrer"
       className={`flex items-center gap-2 rounded-xl border ${borderClass} px-3 py-2 text-xs ${isIncoming ? 'text-minsah-secondary hover:bg-minsah-accent/30' : 'text-white/80 hover:bg-white/10'}`}>
      <FileText className="h-4 w-4 shrink-0" />
      <span className="truncate">{media.fileName || media.mimeType || 'File'}</span>
    </a>
  );
}