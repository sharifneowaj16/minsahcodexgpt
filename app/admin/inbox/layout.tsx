/**
 * app/admin/inbox/layout.tsx
 *
 * Overrides the parent admin layout so the inbox page gets
 * a true full-screen shell with no nav chrome.
 * The page header has its own back-to-admin link.
 */
export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-minsah-light">
      {children}
    </div>
  );
}