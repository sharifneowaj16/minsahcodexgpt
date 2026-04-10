'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fixEncoding } from '@/lib/fixEncoding';
import {
  ArrowLeft,
  Bell,
  CheckCircle,
  FileAudio,
  FileText,
  MessageCircle,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  UserCircle,
  Video as VideoIcon,
  X,
} from 'lucide-react';

export interface SocialMessage {
  id: string;
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'youtube';
  type: 'comment' | 'message' | 'dm' | 'mention';
  conversationId: string;
  sender: {
    id: string;
    name: string;
    username?: string;
    avatar?: string;
    phone?: string;
  };
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
  post?: {
    id: string;
    text: string;
    media?: string;
  };
  status: 'unread' | 'read' | 'replied' | 'archived';
  timestamp: string;
  isIncoming: boolean;
}

interface SocialMediaInboxProps {
  className?: string;
  initialPlatform?: 'all' | SocialMessage['platform'];
  title?: string;
  description?: string;
}

interface SocialMessageApiRecord {
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

interface SocialConversationSummary {
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
  type: SocialMediaContentItem['type'];
}

interface FacebookSyncProgressState {
  stage: 'idle' | 'starting' | 'fetching' | 'processing_conversation' | 'processing_message' | 'completed' | 'error';
  processedConversations: number;
  totalConversations: number;
  processedMessages: number;
  processedAttachments: number;
  conversationId?: string;
  senderName?: string | null;
  error?: string;
}

type SocialMediaContentItem = NonNullable<SocialMessage['content']['media']>[number];

function normalizeMediaType(type: string): SocialMediaContentItem['type'] {
  if (type === 'image' || type === 'video' || type === 'audio' || type === 'document') {
    return type;
  }

  return 'file';
}

function mapApiMessage(m: SocialMessageApiRecord): SocialMessage {
  return {
    id: m.id,
    platform: m.platform,
    type: m.type,
    conversationId: m.conversationId || (m.senderId ? `${m.platform}:${m.senderId}` : m.id),
    sender: {
      id: m.senderId || 'unknown',
      name: m.senderName || (m.isIncoming ? 'Facebook user' : 'Minsah Beauty'),
      avatar: m.senderAvatar ?? undefined,
    },
    content: {
      text: m.content,
      media: (m.attachments ?? [])
        .map((attachment): SocialMediaContentItem => ({
          type: normalizeMediaType(attachment.type),
          url: attachment.storageUrl || attachment.externalUrl || '',
          thumbnail: attachment.thumbnailUrl || undefined,
          fileName: attachment.fileName || undefined,
          mimeType: attachment.mimeType || undefined,
        }))
        .filter((attachment) => Boolean(attachment.url)),
    },
    status: m.isIncoming ? (m.isRead ? 'read' : 'unread') : 'replied',
    timestamp: m.timestamp,
    isIncoming: m.isIncoming,
  };
}

function formatConversationPreview(message: SocialMessage) {
  const prefix = message.isIncoming ? '' : 'You: ';
  const text = fixEncoding(message.content.text || '').trim();
  return `${prefix}${text || 'No message content'}`;
}

function inferDraftAttachmentType(file: File): SocialMediaContentItem['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function formatConversationTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function formatDayDivider(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isSameDay(left: string, right: string) {
  return new Date(left).toDateString() === new Date(right).toDateString();
}

export default function SocialMediaInbox({
  className = '',
  initialPlatform = 'all',
  title = 'Social Media Inbox',
  description = 'Manage all social media messages and comments',
}: SocialMediaInboxProps) {
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string>(initialPlatform);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [syncingFacebook, setSyncingFacebook] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<FacebookSyncProgressState>({
    stage: 'idle',
    processedConversations: 0,
    totalConversations: 0,
    processedMessages: 0,
    processedAttachments: 0,
  });
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const [showThreadOnMobile, setShowThreadOnMobile] = useState(false);

  const clearDraftAttachments = useCallback(() => {
    setDraftAttachments((prev) => {
      prev.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
      return [];
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform !== 'all') {
        params.set('platform', filterPlatform);
      }
      const query = params.toString();
      const res = await fetch(`/api/social/messages${query ? `?${query}` : ''}`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as {
        messages: SocialMessageApiRecord[];
        unreadCount: number;
      };
      setMessages((data.messages || []).map(mapApiMessage));
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [filterPlatform]);

  useEffect(() => {
    void loadMessages();
    const streamUrl =
      filterPlatform !== 'all'
        ? `/api/admin/social/stream?platform=${encodeURIComponent(filterPlatform)}`
        : '/api/admin/social/stream';
    let eventSource: EventSource | null = null;
    let fallbackInterval: number | null = null;

    const attachStream = () => {
      eventSource?.close();
      eventSource = new EventSource(streamUrl);

      eventSource.addEventListener('message', () => {
        void loadMessages();
      });

      eventSource.addEventListener('error', () => {
        eventSource?.close();
        eventSource = null;

        if (fallbackInterval === null) {
          fallbackInterval = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
              void loadMessages();
            }
          }, 3000);
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadMessages();
        if (!eventSource || eventSource.readyState === EventSource.CLOSED) {
          attachStream();
        }
      }
    };

    attachStream();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      eventSource?.close();
      if (fallbackInterval !== null) {
        window.clearInterval(fallbackInterval);
      }
    };
  }, [filterPlatform, loadMessages]);

  const handleFacebookSync = async () => {
    if (syncingFacebook) return;

    setSyncingFacebook(true);
    setSyncMessage(null);
    setSyncProgress({
      stage: 'starting',
      processedConversations: 0,
      totalConversations: 0,
      processedMessages: 0,
      processedAttachments: 0,
    });

    await new Promise<void>((resolve) => {
      const source = new EventSource('/api/admin/social/facebook/sync');
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        source.close();
        resolve();
      };

      source.addEventListener('started', () => {
        setSyncProgress((prev) => ({
          ...prev,
          stage: 'fetching',
        }));
      });

      source.addEventListener('progress', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as Omit<
          FacebookSyncProgressState,
          'stage'
        > & { stage: FacebookSyncProgressState['stage'] };
        setSyncProgress((prev) => ({
          ...prev,
          ...data,
        }));
      });

      source.addEventListener('completed', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as {
          processedMessages?: number;
          processedAttachments?: number;
          processedConversations?: number;
        };
        setSyncProgress((prev) => ({
          ...prev,
          stage: 'completed',
          processedConversations: data.processedConversations ?? prev.processedConversations,
          processedMessages: data.processedMessages ?? prev.processedMessages,
          processedAttachments: data.processedAttachments ?? prev.processedAttachments,
        }));
        setSyncMessage(
          `Synced ${data.processedMessages ?? 0} messages and ${data.processedAttachments ?? 0} attachments`
        );
        setSyncingFacebook(false);
        void loadMessages();
        finish();
      });

      source.addEventListener('error', (event) => {
        let message = 'Facebook sync failed';
        if ((event as MessageEvent).data) {
          try {
            const data = JSON.parse((event as MessageEvent).data) as { error?: string };
            message = data.error || message;
          } catch {}
        }
        setSyncProgress((prev) => ({
          ...prev,
          stage: 'error',
          error: message,
        }));
        setSyncMessage(message);
        setSyncingFacebook(false);
        finish();
      });

      source.onerror = () => {
        setSyncProgress((prev) => {
          if (prev.stage === 'completed') {
            return prev;
          }
          return {
            ...prev,
            stage: 'error',
            error: prev.error || 'Facebook sync connection dropped',
          };
        });
        setSyncingFacebook(false);
        finish();
      };
    });
  };

  const syncStatusLabel = useMemo(() => {
    switch (syncProgress.stage) {
      case 'starting':
        return 'Starting Facebook sync...';
      case 'fetching':
        return 'Fetching Facebook conversations...';
      case 'processing_conversation':
        return syncProgress.senderName
          ? `Processing conversation: ${syncProgress.senderName}`
          : 'Processing conversation...';
      case 'processing_message':
        return syncProgress.senderName
          ? `Saving messages from ${syncProgress.senderName}`
          : 'Saving Facebook messages...';
      case 'completed':
        return 'Facebook sync completed';
      case 'error':
        return syncProgress.error || 'Facebook sync failed';
      default:
        return null;
    }
  }, [syncProgress]);

  const filteredMessages = useMemo(
    () =>
      messages.filter((msg) => {
        if (filterPlatform !== 'all' && msg.platform !== filterPlatform) return false;
        if (filterStatus !== 'all' && msg.status !== filterStatus) return false;

        if (
          searchQuery &&
          !fixEncoding(msg.content.text).toLowerCase().includes(searchQuery.toLowerCase()) &&
          !msg.sender.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }

        return true;
      }),
    [filterPlatform, filterStatus, messages, searchQuery]
  );

  const conversationList = useMemo(() => {
    const grouped = new Map<string, SocialMessage[]>();

    for (const message of filteredMessages) {
      const key = message.conversationId || message.id;
      const items = grouped.get(key);
      if (items) {
        items.push(message);
      } else {
        grouped.set(key, [message]);
      }
    }

    return Array.from(grouped.entries())
      .map(([conversationId, items]): SocialConversationSummary => {
        const sortedItems = [...items].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const latestMessage = sortedItems[sortedItems.length - 1];
        const participant =
          [...sortedItems].reverse().find((message) => message.isIncoming)?.sender ??
          sortedItems[0].sender;
        const unreadMessages = sortedItems.filter(
          (message) => message.isIncoming && message.status === 'unread'
        );

        return {
          conversationId,
          platform: latestMessage.platform,
          participant,
          latestMessage,
          unreadCount: unreadMessages.length,
        };
      })
      .sort(
        (a, b) =>
          new Date(b.latestMessage.timestamp).getTime() -
          new Date(a.latestMessage.timestamp).getTime()
      );
  }, [filteredMessages]);

  useEffect(() => {
    if (conversationList.length === 0) {
      if (selectedConversation) setSelectedConversation(null);
      return;
    }

    const hasSelection = conversationList.some(
      (conversation) => conversation.conversationId === selectedConversation
    );

    if (!hasSelection) {
      setSelectedConversation(conversationList[0].conversationId);
    }
  }, [conversationList, selectedConversation]);

  const selectedConversationSummary = useMemo(
    () =>
      conversationList.find(
        (conversation) => conversation.conversationId === selectedConversation
      ) ?? null,
    [conversationList, selectedConversation]
  );

  useEffect(() => {
    if (selectedConversationSummary?.platform !== 'facebook' && draftAttachments.length > 0) {
      clearDraftAttachments();
    }
  }, [clearDraftAttachments, draftAttachments.length, selectedConversationSummary?.platform]);

  useEffect(() => {
    if (!selectedConversation) return;
    setShowThreadOnMobile(true);
  }, [selectedConversation]);

  const conversationMessages = useMemo(
    () =>
      selectedConversation
        ? filteredMessages
            .filter((message) => message.conversationId === selectedConversation)
            .sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            )
        : [],
    [filteredMessages, selectedConversation]
  );

  const selectedParticipantMessage = useMemo(
    () =>
      [...conversationMessages].reverse().find((message) => message.isIncoming) ??
      conversationMessages[0] ??
      null,
    [conversationMessages]
  );

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversationMessages.length, selectedConversation]);

  const markAsRead = async (messageId: string, conversationId?: string) => {
    const markedUnreadCount = messages.filter(
      (msg) =>
        msg.isIncoming &&
        msg.status === 'unread' &&
        (msg.id === messageId || (conversationId && msg.conversationId === conversationId))
    ).length;

    await fetch('/api/social/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: messageId,
        conversationId,
        platform: filterPlatform !== 'all' ? filterPlatform : undefined,
      }),
    });

    setMessages((prev) =>
      prev.map((msg) =>
        msg.isIncoming &&
        (msg.id === messageId || (conversationId && msg.conversationId === conversationId))
          ? { ...msg, status: 'read' as const }
          : msg
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - markedUnreadCount));
  };

  const handleReply = async (conversationId: string) => {
    if ((!replyText.trim() && draftAttachments.length === 0) || sendingReply) return;

    const threadMessages = messages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const targetMessage =
      [...threadMessages].reverse().find((message) => message.isIncoming) ??
      threadMessages[threadMessages.length - 1];

    if (!targetMessage) return;

    setSendingReply(true);
    setReplyError(null);

    try {
      const uploadedAttachments = await Promise.all(
        draftAttachments.map(async (attachment) => {
          const formData = new FormData();
          formData.append('file', attachment.file);

          const uploadResponse = await fetch('/api/admin/social/upload', {
            method: 'POST',
            body: formData,
          });
          const uploadData = (await uploadResponse.json()) as {
            error?: string;
            url?: string;
            fileName?: string;
            mimeType?: string;
          };

          if (!uploadResponse.ok || !uploadData.url) {
            throw new Error(uploadData.error || 'Attachment upload failed');
          }

          return {
            type: attachment.type,
            url: uploadData.url,
            fileName: uploadData.fileName || attachment.file.name,
            mimeType: uploadData.mimeType || attachment.file.type,
          };
        })
      );

      const response = await fetch('/api/social/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: targetMessage.platform,
          messageId: targetMessage.id,
          messageType: targetMessage.type,
          conversationId,
          recipientId: targetMessage.sender.id,
          text: replyText.trim(),
          attachments: uploadedAttachments,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        message?: SocialMessageApiRecord;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Reply failed');
      }

      if (data.message) {
        const mappedReply = mapApiMessage(data.message);
        setMessages((prev) => {
          const updated = prev.map((message) =>
            message.isIncoming && message.conversationId === conversationId
              ? { ...message, status: 'read' as const }
              : message
          );

          if (updated.some((message) => message.id === mappedReply.id)) {
            return updated;
          }

          return [...updated, mappedReply];
        });
      }

      setUnreadCount((prev) => {
        const remainingUnreadOutsideConversation = messages.filter(
          (message) =>
            message.isIncoming &&
            message.status === 'unread' &&
            message.conversationId !== conversationId
        ).length;
        return Math.min(prev, remainingUnreadOutsideConversation);
      });
      setReplyText('');
      clearDraftAttachments();
      void loadMessages();
    } catch (error) {
      console.error('Reply failed:', error);
      setReplyError(error instanceof Error ? error.message : 'Reply failed');
    } finally {
      setSendingReply(false);
    }
  };

  const handleDraftAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const nextItems = files
      .filter(
        (file) =>
          file.type.startsWith('image/') ||
          file.type.startsWith('video/') ||
          file.type.startsWith('audio/')
      )
      .map((file, index) => ({
        id: `${file.name}-${file.size}-${Date.now()}-${index}`,
        file,
        previewUrl: URL.createObjectURL(file),
        type: inferDraftAttachmentType(file),
      }));

    setDraftAttachments((prev) => [...prev, ...nextItems]);
    event.target.value = '';
  };

  const removeDraftAttachment = (attachmentId: string) => {
    setDraftAttachments((prev) => {
      const target = prev.find((attachment) => attachment.id === attachmentId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((attachment) => attachment.id !== attachmentId);
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
            f
          </div>
        );
      case 'instagram':
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-purple-600 to-pink-500 text-xs font-bold text-white">
            ig
          </div>
        );
      case 'whatsapp':
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded bg-green-500 text-xs font-bold text-white">
            W
          </div>
        );
      case 'youtube':
        return (
          <div className="flex h-5 w-5 items-center justify-center rounded bg-red-600 text-xs font-bold text-white">
            YT
          </div>
        );
      default:
        return <MessageCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusIcon = (unreadMessages: number, latestMessage: SocialMessage) => {
    if (unreadMessages > 0) {
      return <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />;
    }

    if (!latestMessage.isIncoming) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }

    return <CheckCircle className="h-4 w-4 text-gray-300" />;
  };

  const renderMediaAttachment = (
    media: NonNullable<SocialMessage['content']['media']>[number],
    key: string
  ) => {
    if (media.type === 'image') {
      return (
        <a
          key={key}
          href={media.url}
          target="_blank"
          rel="noreferrer"
          className="block overflow-hidden rounded-lg border border-gray-200"
        >
          <img
            src={media.thumbnail || media.url}
            alt={media.fileName || 'Image attachment'}
            className="h-40 w-full object-cover"
          />
        </a>
      );
    }

    if (media.type === 'video') {
      return (
        <div key={key} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <video
            controls
            preload="metadata"
            poster={media.thumbnail}
            className="max-h-72 w-full bg-black"
            src={media.url}
          />
          <div className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700">
            <VideoIcon className="h-4 w-4 text-purple-600" />
            <a href={media.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
              {media.fileName || 'Video attachment'}
            </a>
          </div>
        </div>
      );
    }

    if (media.type === 'audio') {
      return (
        <div key={key} className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-3 text-sm text-gray-700">
            <FileAudio className="h-4 w-4 text-emerald-600" />
            <a href={media.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
              {media.fileName || 'Audio attachment'}
            </a>
          </div>
          <audio controls preload="metadata" className="w-full" src={media.url} />
        </div>
      );
    }

    return (
      <a
        key={key}
        href={media.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
      >
        <FileText className="h-4 w-4 text-gray-500" />
        <span className="truncate">{media.fileName || media.mimeType || 'File attachment'}</span>
      </a>
    );
  };

  const canAttachMedia = selectedConversationSummary?.platform === 'facebook';

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-96 rounded bg-gray-200" />
            <div className="col-span-2 h-96 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col bg-[#edf2f7] ${className}`}>
      <div className="border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="text-sm text-slate-600">{description}</p>
            {syncMessage && <p className="mt-2 text-sm text-slate-600">{syncMessage}</p>}
            {syncStatusLabel && (
              <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                <div className="flex items-center gap-2">
                  {syncingFacebook && <RefreshCw className="h-4 w-4 animate-spin" />}
                  <span className="font-medium">{syncStatusLabel}</span>
                </div>
                <p className="mt-1 text-xs text-sky-700">
                  Conversations {syncProgress.processedConversations}/
                  {Math.max(syncProgress.totalConversations, syncProgress.processedConversations)}
                  {' '}| Messages {syncProgress.processedMessages} | Attachments {syncProgress.processedAttachments}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
              {conversationList.length} conversations
            </div>
            <div className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-700">
              <Bell className="h-4 w-4" />
              {unreadCount} unread
            </div>
            {filterPlatform === 'facebook' && (
              <button
                type="button"
                onClick={() => void handleFacebookSync()}
                disabled={syncingFacebook}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${syncingFacebook ? 'animate-spin' : ''}`} />
                Sync Facebook
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, message, order issue..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-400"
            >
              <option value="all">All Platforms</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="youtube">YouTube</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-sky-400"
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
              <option value="replied">Replied</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-0 overflow-hidden xl:gap-4 xl:p-4">
        <div
          className={`${
            showThreadOnMobile ? 'hidden md:flex' : 'flex'
          } min-h-0 w-full shrink-0 flex-col border-r border-slate-200 bg-white xl:w-[380px] xl:rounded-[28px] xl:border xl:shadow-[0_18px_60px_rgba(15,23,42,0.08)]`}
        >
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Conversations</h2>
                <p className="text-xs text-slate-500">Latest customer activity</p>
              </div>
              <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {conversationList.length}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {conversationList.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-400">
              <MessageCircle className="mb-3 h-12 w-12" />
              <p className="text-sm">No conversations found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversationList.map((conversation) => (
                <button
                  key={conversation.conversationId}
                  type="button"
                  onClick={() => {
                    setSelectedConversation(conversation.conversationId);
                    setShowThreadOnMobile(true);
                    void markAsRead(conversation.latestMessage.id, conversation.conversationId);
                  }}
                  className={`w-full rounded-[22px] border px-3 py-3 text-left transition ${
                    selectedConversation === conversation.conversationId
                      ? 'border-sky-200 bg-sky-50 shadow-[0_12px_30px_rgba(14,165,233,0.12)]'
                      : 'border-transparent bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      {conversation.participant.avatar ? (
                        <img
                          src={conversation.participant.avatar}
                          alt={conversation.participant.name}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-white"
                        />
                      ) : (
                        <UserCircle className="h-12 w-12 text-slate-300" />
                      )}
                      <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-white">
                        {getPlatformIcon(conversation.platform)}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {conversation.participant.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatConversationTimestamp(conversation.latestMessage.timestamp)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {conversation.unreadCount > 0 && (
                            <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                              {conversation.unreadCount}
                            </span>
                          )}
                          {getStatusIcon(conversation.unreadCount, conversation.latestMessage)}
                        </div>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">
                        {formatConversationPreview(conversation.latestMessage)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        </div>

        <div
          className={`${
            !showThreadOnMobile ? 'hidden md:flex' : 'flex'
          } min-h-0 flex-1 flex-col bg-white xl:rounded-[32px] xl:border xl:border-slate-200 xl:shadow-[0_24px_80px_rgba(15,23,42,0.10)]`}
        >
          {selectedConversationSummary ? (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => setShowThreadOnMobile(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="relative shrink-0">
                  {selectedConversationSummary.participant.avatar ? (
                    <img
                      src={selectedConversationSummary.participant.avatar}
                      alt={selectedConversationSummary.participant.name}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle className="h-12 w-12 text-slate-300" />
                  )}
                  <div className="absolute -bottom-1 -right-1 rounded-full border-2 border-white bg-white">
                    {getPlatformIcon(selectedConversationSummary.platform)}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-slate-900">
                      {selectedConversationSummary.participant.name}
                    </h3>
                    {selectedConversationSummary.unreadCount > 0 && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                        {selectedConversationSummary.unreadCount} unread
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    {selectedParticipantMessage?.sender.id || selectedConversationSummary.platform}
                  </p>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f8fbff_0%,#eef4fa_100%)] px-4 py-5 sm:px-6">
                <div className="mx-auto flex max-w-4xl flex-col gap-3">
                  {conversationMessages.map((message, index) => {
                    const previousMessage = conversationMessages[index - 1];
                    const nextMessage = conversationMessages[index + 1];
                    const showDayDivider =
                      !previousMessage ||
                      !isSameDay(previousMessage.timestamp, message.timestamp);
                    const showAvatar =
                      message.isIncoming &&
                      (!nextMessage || !nextMessage.isIncoming || nextMessage.sender.id !== message.sender.id);

                    return (
                      <div key={message.id}>
                        {showDayDivider && (
                          <div className="my-3 flex items-center justify-center">
                            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200">
                              {formatDayDivider(message.timestamp)}
                            </span>
                          </div>
                        )}

                        <div className={`flex ${message.isIncoming ? 'justify-start' : 'justify-end'}`}>
                          <div
                            className={`flex max-w-[88%] items-end gap-3 sm:max-w-[75%] ${
                              message.isIncoming ? '' : 'flex-row-reverse'
                            }`}
                          >
                            <div className="w-8 shrink-0">
                              {showAvatar ? (
                                message.sender.avatar ? (
                                  <img
                                    src={message.sender.avatar}
                                    alt={message.sender.name}
                                    className="h-8 w-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <UserCircle className="h-8 w-8 text-slate-300" />
                                )
                              ) : null}
                            </div>

                            <div className={message.isIncoming ? '' : 'text-right'}>
                              <div
                                className={`rounded-[24px] px-4 py-3 shadow-sm ${
                                  message.isIncoming
                                    ? 'rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200'
                                    : 'rounded-br-md bg-sky-600 text-white'
                                }`}
                              >
                                <div className="mb-2 flex items-center gap-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
                                      message.isIncoming
                                        ? 'bg-slate-100 text-slate-600'
                                        : 'bg-white/20 text-white'
                                    }`}
                                  >
                                    {message.type}
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap text-sm leading-6">
                                  {fixEncoding(message.content.text)}
                                </p>
                                {message.content.media && message.content.media.length > 0 && (
                                  <div className="mt-3 grid gap-2">
                                    {message.content.media.map((media, mediaIndex) =>
                                      renderMediaAttachment(media, `${message.id}-${mediaIndex}`)
                                    )}
                                  </div>
                                )}
                              </div>
                              <p className="mt-1 px-1 text-xs text-slate-500">
                                {new Date(message.timestamp).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messageEndRef} />
                </div>
              </div>

              <div className="border-t border-slate-100 bg-white px-4 py-4 sm:px-6">
                {replyError && (
                  <p className="mb-3 rounded-2xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {replyError}
                  </p>
                )}
                {draftAttachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-3">
                    {draftAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="relative w-28 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                      >
                        <button
                          type="button"
                          onClick={() => removeDraftAttachment(attachment.id)}
                          className="absolute right-1 top-1 z-10 rounded-full bg-black/70 p-1 text-white"
                          aria-label="Remove attachment"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        <div className="flex h-24 items-center justify-center bg-slate-100">
                          {attachment.type === 'image' ? (
                            <img
                              src={attachment.previewUrl}
                              alt={attachment.file.name}
                              className="h-full w-full object-cover"
                            />
                          ) : attachment.type === 'video' ? (
                            <video
                              className="h-full w-full object-cover"
                              src={attachment.previewUrl}
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-slate-500">
                              <FileAudio className="h-6 w-6" />
                              <span className="px-2 text-center text-[11px]">
                                {attachment.file.name}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="truncate px-2 py-1 text-[11px] text-slate-600">
                          {attachment.file.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!canAttachMedia && (
                  <p className="mb-3 text-xs text-slate-500">
                    Media sending is currently enabled for Facebook Messenger only.
                  </p>
                )}
                <div className="flex items-end gap-3 rounded-[26px] border border-slate-200 bg-slate-50 p-3">
                  <div className="shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,audio/*"
                      multiple
                      className="hidden"
                      onChange={handleDraftAttachmentChange}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!canAttachMedia || sendingReply}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Attach image, video, or audio"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a reply..."
                      rows={1}
                      className="max-h-36 min-h-[44px] w-full resize-none bg-transparent px-2 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <button
                    onClick={() =>
                      void handleReply(selectedConversationSummary.conversationId)
                    }
                    disabled={(!replyText.trim() && draftAttachments.length === 0) || sendingReply}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-sky-600 px-5 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {sendingReply ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <MessageCircle className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                <p className="text-slate-500">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
