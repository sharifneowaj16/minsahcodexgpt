/**
 * app/admin/inbox/page.tsx
 *
 * Full-screen social inbox — opens in a new tab from admin panel.
 * Uses its own layout (app/admin/inbox/layout.tsx) so there is no
 * admin nav chrome. The SocialMediaInboxChat component is self-contained
 * and handles all real-time SSE, message loading, and reply sending.
 *
 * Link to open this: <a href="/admin/inbox" target="_blank">Open Inbox</a>
 */
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import SocialMediaInboxChat from '@/app/components/admin/SocialMediaInboxChat';

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxSkeleton />}>
      <SocialMediaInboxChat />
    </Suspense>
  );
}

function InboxSkeleton() {
  return (
    <div className="flex h-full w-full animate-pulse">
      <div className="w-80 shrink-0 border-r border-minsah-accent bg-white" />
      <div className="flex-1 bg-minsah-light" />
    </div>
  );
}