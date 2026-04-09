'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fixEncoding } from '@/lib/fixEncoding';
import {
  MessageCircle,
  Send,
  CheckCircle,
  UserCircle,
  Bell,
  Search,
  RefreshCw,
  Video as VideoIcon,
  FileAudio,
  FileText,
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
  replies?: SocialMessage[];
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

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPlatform !== 'all') {
        params.set('platform', filterPlatform);
      }
      const query = params.toString();
      const res = await fetch(`/api/social/messages${query ? `?${query}` : ''}`);
      const data = (await res.json()) as {
        messages: SocialMessageApiRecord[];
        unreadCount: number;
      };
      const mapped: SocialMessage[] = data.messages.map((m): SocialMessage => ({
        id: m.id,
        platform: m.platform,
        type: m.type,
        conversationId: m.conversationId || (m.senderId ? `${m.platform}:${m.senderId}` : m.id),
        sender: {
          id: m.senderId || 'unknown',
          name: m.senderName || 'Unknown',
          avatar: m.senderAvatar ?? undefined,
        },
        content: {
          text: m.content,
          media: (m.attachments ?? [])
            .map((attachment) => ({
              type:
                attachment.type === 'image' || attachment.type === 'video' || attachment.type === 'audio'
                  ? attachment.type
                  : 'file',
              url: attachment.storageUrl || attachment.externalUrl || '',
              thumbnail: attachment.thumbnailUrl || undefined,
              fileName: attachment.fileName || undefined,
              mimeType: attachment.mimeType || undefined,
            }))
            .filter((attachment) => Boolean(attachment.url)),
        },
        status: m.isRead ? 'read' : 'unread',
        timestamp: m.timestamp,
        isIncoming: m.isIncoming,
      }));
      setMessages(mapped);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, [filterPlatform]);

  useEffect(() => {
    void loadMessages();
    const interval = setInterval(() => {
      void loadMessages();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  const handleFacebookSync = async () => {
    setSyncingFacebook(true);
    setSyncMessage(null);

    try {
      const response = await fetch('/api/admin/social/facebook/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = (await response.json()) as {
        error?: string;
        processedConversations?: number;
        processedMessages?: number;
        processedAttachments?: number;
      };

      if (!response.ok) {
        throw new Error(data.error || 'Facebook sync failed');
      }

      setSyncMessage(
        `Synced ${data.processedMessages ?? 0} messages and ${data.processedAttachments ?? 0} attachments`
      );
      await loadMessages();
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Facebook sync failed');
    } finally {
      setSyncingFacebook(false);
    }
  };

  const handleReply = async (conversationId: string) => {
    if (!replyText.trim()) return;

    const originalMessage = messages.find(m => m.conversationId === conversationId);
    if (!originalMessage) return;

    try {
      await fetch('/api/social/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: originalMessage.platform,
          messageId: originalMessage.id,
          messageType: originalMessage.type,
          conversationId,
          recipientId: originalMessage.sender.id,
          text: replyText,
        }),
      });

      const newReply: SocialMessage = {
        id: `reply-${Date.now()}`,
        platform: originalMessage.platform,
        type: 'message',
        conversationId,
        sender: { id: 'admin', name: 'Minsah Beauty' },
        content: { text: replyText },
        status: 'read',
        timestamp: new Date().toISOString(),
        isIncoming: false,
      };

      setMessages(prev =>
        prev.map(msg =>
          msg.conversationId === conversationId
            ? { ...msg, status: 'replied' as const, replies: [...(msg.replies || []), newReply] }
            : msg
        )
      );
      setReplyText('');
    } catch (error) {
      console.error('Reply failed:', error);
    }
  };

  const markAsRead = async (messageId: string, conversationId?: string) => {
    const markedUnreadCount = messages.filter(
      (msg) =>
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
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId || (conversationId && msg.conversationId === conversationId)
          ? { ...msg, status: 'read' as const }
          : msg
      )
    );
    setUnreadCount(prev => Math.max(0, prev - markedUnreadCount));
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook':
        return <div className="w-5 h-5 bg-blue-600 rounded text-white flex items-center justify-center text-xs font-bold">f</div>;
      case 'instagram':
        return <div className="w-5 h-5 bg-gradient-to-br from-purple-600 to-pink-500 rounded text-white flex items-center justify-center text-xs font-bold">ig</div>;
      case 'whatsapp':
        return <div className="w-5 h-5 bg-green-500 rounded text-white flex items-center justify-center text-xs font-bold">W</div>;
      case 'youtube':
        return <div className="w-5 h-5 bg-red-600 rounded text-white flex items-center justify-center text-xs font-bold">YT</div>;
      default:
        return <MessageCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'unread':
        return <div className="w-2 h-2 bg-blue-500 rounded-full"></div>;
      case 'replied':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'read':
        return <CheckCircle className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  const renderMediaAttachment = (
    media: NonNullable<SocialMessage['content']['media']>[number],
    key: string
  ) => {
    if (media.type === 'image') {
      return (
        <a key={key} href={media.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-gray-200">
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
        <a key={key} href={media.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <VideoIcon className="h-4 w-4 text-purple-600" />
          <span className="truncate">{media.fileName || 'Video attachment'}</span>
        </a>
      );
    }

    if (media.type === 'audio') {
      return (
        <a key={key} href={media.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <FileAudio className="h-4 w-4 text-emerald-600" />
          <span className="truncate">{media.fileName || 'Audio attachment'}</span>
        </a>
      );
    }

    return (
      <a key={key} href={media.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
        <FileText className="h-4 w-4 text-gray-500" />
        <span className="truncate">{media.fileName || media.mimeType || 'File attachment'}</span>
      </a>
    );
  };

  const filteredMessages = useMemo(
    () =>
      messages.filter((msg) => {
        if (filterPlatform !== 'all' && msg.platform !== filterPlatform) return false;
        if (filterStatus !== 'all' && msg.status !== filterStatus) return false;
        if (
          searchQuery &&
          !msg.content.text.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !msg.sender.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [filterPlatform, filterStatus, messages, searchQuery]
  );

  const conversationList = useMemo(() => {
    const grouped = new Map<string, SocialMessage>();
    for (const message of filteredMessages) {
      const key = message.conversationId || message.id;
      const existing = grouped.get(key);
      if (!existing || new Date(message.timestamp) > new Date(existing.timestamp)) {
        grouped.set(key, message);
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [filteredMessages]);

  useEffect(() => {
    if (conversationList.length === 0) {
      if (selectedConversation) setSelectedConversation(null);
      return;
    }

    const hasSelection = conversationList.some(
      (message) => message.conversationId === selectedConversation
    );

    if (!hasSelection) {
      setSelectedConversation(conversationList[0].conversationId);
    }
  }, [conversationList, selectedConversation]);

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

  const selectedMessage = conversationMessages[conversationMessages.length - 1];

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="col-span-2 h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-gray-50 ${className}`}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-600 text-sm">{description}</p>
            {syncMessage && (
              <p className="mt-2 text-sm text-gray-600">{syncMessage}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {filterPlatform === 'facebook' && (
              <button
                type="button"
                onClick={() => void handleFacebookSync()}
                disabled={syncingFacebook}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${syncingFacebook ? 'animate-spin' : ''}`} />
                Sync Facebook
              </button>
            )}
            {unreadCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                <Bell className="w-4 h-4" />
                {unreadCount} unread
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
          </select>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          {conversationList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <MessageCircle className="w-12 h-12 mb-3" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {conversationList.map((message) => (
                <div
                  key={message.conversationId}
                  onClick={() => {
                    setSelectedConversation(message.conversationId);
                    void markAsRead(message.id, message.conversationId);
                  }}
                  className={`p-4 rounded-lg cursor-pointer transition-colors ${
                    selectedConversation === message.conversationId
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      {message.sender.avatar ? (
                        <img
                          src={message.sender.avatar}
                          alt={message.sender.name}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <UserCircle className="w-10 h-10 text-gray-400" />
                      )}
                      <div className="absolute -bottom-1 -right-1">
                        {getPlatformIcon(message.platform)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {message.sender.name}
                        </p>
                        {getStatusIcon(message.status)}
                      </div>
                      <p className="text-xs text-gray-500 mb-1">
                        {message.platform} • {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {fixEncoding(message.content.text)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Thread */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedMessage ? (
            <>
              {/* Message Header */}
              <div className="border-b border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  {selectedMessage.sender.avatar ? (
                    <img
                      src={selectedMessage.sender.avatar}
                      alt={selectedMessage.sender.name}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <UserCircle className="w-12 h-12 text-gray-400" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {selectedMessage.sender.name}
                      </h3>
                      {getPlatformIcon(selectedMessage.platform)}
                    </div>
                    <p className="text-sm text-gray-500">
                      {selectedMessage.sender.username || selectedMessage.sender.phone || selectedMessage.platform}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      selectedMessage.status === 'unread'
                        ? 'bg-blue-100 text-blue-700'
                        : selectedMessage.status === 'replied'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {selectedMessage.status}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {selectedMessage.post && (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">Original Post:</p>
                    <p className="text-sm text-gray-600">{selectedMessage.post.text}</p>
                  </div>
                )}

                {conversationMessages.map((message) => (
                  <div key={message.id} className="flex items-start gap-3">
                    {message.sender.avatar ? (
                      <img
                        src={message.sender.avatar}
                        alt={message.sender.name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <UserCircle className="w-8 h-8 text-gray-400" />
                    )}
                    <div className="flex-1">
                      <div className="bg-gray-100 rounded-lg p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium capitalize text-gray-600">
                            {message.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900">
                          {fixEncoding(message.content.text)}
                        </p>
                        {message.content.media && message.content.media.length > 0 && (
                          <div className="mt-3 grid gap-2">
                            {message.content.media.map((media, index) =>
                              renderMediaAttachment(media, `${message.id}-${index}`)
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(message.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Replies */}
                {selectedMessage.replies?.map((reply) => (
                  <div key={reply.id} className="flex items-start gap-3 justify-end">
                    <div className="flex-1 flex flex-col items-end">
                      <div className="bg-blue-600 text-white rounded-lg p-4 max-w-md">
                        <p className="text-sm">{reply.content.text}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(reply.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">MB</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply Input */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                  </div>
                  <button
                    onClick={() => handleReply(selectedMessage.conversationId)}
                    disabled={!replyText.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
