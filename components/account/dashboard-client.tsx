'use client';

import Link from 'next/link';
import {
  ShoppingBag,
  Heart,
  MapPin,
  Star,
  Users,
  Truck,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  Sparkles,
  ArrowRight,
  Trophy,
  Package,
  Bell,
} from 'lucide-react';
import { useAuth, useUserPermissions } from '@/contexts/AuthContext';

// ── Icon map ──────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  ShoppingBag,
  Heart,
  MapPin,
  Star,
  Users,
  Truck,
  CheckCircle,
  BarChart3,
  Sparkles,
  Package,
};

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashboardData {
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: Date;
    itemCount: number;
  }>;
  wishlistItems: number;
  savedAddresses: number;
  unreadNotifications: number;
  upcomingOrderDate: Date;
  loyaltyPointsExpiring: number;
  expiryDate: Date;
}

interface QuickAction {
  name: string;
  description: string;
  href: string;
  icon: string;
  color: string;
}

interface UpcomingFeature {
  name: string;
  description: string;
  icon: string;
  progress: number;
}

interface DashboardClientProps {
  initialData: DashboardData;
  quickActions: QuickAction[];
  upcomingFeatures: UpcomingFeature[];
}

// ── Color map ─────────────────────────────────────────────────────────────────
const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
  purple: { bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-100'  },
  yellow: { bg: 'bg-amber-50',   text: 'text-amber-500',   ring: 'ring-amber-100'   },
  blue:   { bg: 'bg-blue-50',    text: 'text-blue-500',    ring: 'ring-blue-100'    },
  green:  { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  pink:   { bg: 'bg-pink-50',    text: 'text-pink-500',    ring: 'ring-pink-100'    },
};

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    delivered:  'bg-emerald-50 text-emerald-700',
    shipped:    'bg-blue-50 text-blue-700',
    processing: 'bg-amber-50 text-amber-700',
    cancelled:  'bg-red-50 text-red-700',
    pending:    'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function DashboardClient({ initialData, quickActions, upcomingFeatures }: DashboardClientProps) {
  const { user } = useAuth();
  const { isVip, isPremium } = useUserPermissions();

  if (!user) return null;

  const memberLabel    = isPremium ? 'Premium Member' : isVip ? 'VIP Member' : 'Member';
  const memberSubtitle = isPremium
    ? 'Exclusive access to all features'
    : isVip
    ? 'Enjoy your exclusive VIP benefits'
    : 'Your beauty journey continues here';

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

      {/* ── Hero card ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 p-6 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 right-12 h-24 w-24 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-xl font-semibold ring-2 ring-white/30">
              {user.firstName?.[0]}{user.lastName?.[0]}
            </div>
            <h1 className="text-xl font-semibold leading-tight">
              Welcome back, {user.firstName}! 👋
            </h1>
            <p className="mt-1 text-sm text-purple-100">{memberSubtitle}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium">
              ⭐ {memberLabel}
            </span>
          </div>

          <div className="shrink-0 rounded-2xl bg-white/15 px-4 py-3 text-right backdrop-blur-sm">
            <p className="text-xs text-purple-100">Loyalty Points</p>
            <p className="text-2xl font-bold">{user.loyaltyPoints.toLocaleString()}</p>
            {initialData.loyaltyPointsExpiring > 0 && (
              <p className="mt-0.5 text-xs text-yellow-200">
                {initialData.loyaltyPointsExpiring} expiring soon
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: <Package size={18} />, label: 'Orders',    value: initialData.recentOrders.length, iconBg: 'bg-violet-50 text-violet-500'  },
          { icon: <Heart size={18} />,   label: 'Wishlist',  value: initialData.wishlistItems,       iconBg: 'bg-pink-50 text-pink-500'      },
          { icon: <MapPin size={18} />,  label: 'Addresses', value: initialData.savedAddresses,      iconBg: 'bg-emerald-50 text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white py-4 shadow-sm ring-1 ring-gray-100">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.iconBg}`}>{s.icon}</span>
            <span className="text-xl font-semibold text-gray-800">{s.value}</span>
            <span className="text-xs text-gray-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Points redeem banner ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
            <Trophy size={20} className="text-violet-600" />
          </div>
          <div>
            <p className="text-xs text-gray-400">Loyalty Points</p>
            <p className="text-xl font-semibold leading-tight text-violet-600">
              {user.loyaltyPoints.toLocaleString()}
            </p>
          </div>
        </div>
        <Link
          href="/account/loyalty"
          className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
        >
          Redeem
        </Link>
      </div>

      {/* ── Notification nudge ─────────────────────────────────────────────── */}
      {initialData.unreadNotifications > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
          <Bell size={15} className="shrink-0 text-blue-500" />
          <p className="text-sm text-blue-800">
            You have <strong>{initialData.unreadNotifications}</strong> new offers waiting for you.
          </p>
        </div>
      )}

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const c = colorMap[action.color] ?? colorMap.purple;
            return (
              <Link
                key={action.name}
                href={action.href}
                className="group flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 transition-all hover:border-violet-100 hover:shadow-sm"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-4 transition-transform group-hover:scale-105 ${c.bg} ${c.text} ${c.ring}`}>
                  <DynamicIcon name={action.icon} className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800">{action.name}</p>
                  <p className="truncate text-xs text-gray-400">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Recent orders ──────────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Recent Orders</p>
          <Link href="/account/orders" className="text-xs font-medium text-violet-600 hover:underline">
            View all
          </Link>
        </div>

        {initialData.recentOrders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-200 py-10 text-center">
            <ShoppingBag size={30} className="text-gray-300" />
            <p className="text-sm text-gray-400">এখনো কোনো order নেই</p>
            <Link
              href="/shop"
              className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Shop করুন
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {initialData.recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.id}`}
                className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3.5 transition-all hover:border-violet-100 hover:shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{order.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString('en-BD', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    {' · '}{order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={order.status} />
                  <span className="text-sm font-semibold text-gray-800">
                    ৳{order.total.toLocaleString()}
                  </span>
                  <ChevronRight size={14} className="text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── Points expiry alert ────────────────────────────────────────────── */}
      {initialData.loyaltyPointsExpiring > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Points expiring soon!</p>
            <p className="mt-0.5 text-xs text-amber-700">
              আপনার {initialData.loyaltyPointsExpiring} points{' '}
              {new Date(initialData.expiryDate).toLocaleDateString()} এ expire হবে।
            </p>
            <Link
              href="/account/loyalty"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:underline"
            >
              Points দেখুন <ChevronRight size={12} />
            </Link>
          </div>
        </div>
      )}

      {/* ── Coming soon ────────────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Coming Soon</p>
        <div className="space-y-2">
          {upcomingFeatures.map((feature) => (
            <div key={feature.name} className="rounded-2xl border border-gray-100 bg-white px-4 py-4">
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DynamicIcon name={feature.icon} className="h-4 w-4 text-violet-500" />
                  <p className="text-sm font-medium text-gray-800">{feature.name}</p>
                </div>
                <span className="text-xs font-medium text-violet-600">{feature.progress}%</span>
              </div>
              <p className="mb-2.5 text-xs text-gray-400">{feature.description}</p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-1.5 rounded-full bg-violet-500 transition-all duration-700"
                  style={{ width: `${feature.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Beauty tip ─────────────────────────────────────────────────────── */}
      <div className="rounded-3xl bg-gradient-to-br from-pink-50 to-purple-50 p-6">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-800">
          <Sparkles size={18} className="text-violet-500" />
          Beauty Tip of the Day
        </h2>
        <p className="text-sm leading-relaxed text-gray-600">
          Did you know? Applying serum to slightly damp skin can increase absorption by up to 50%.
          Pat your face gently after cleansing, then apply your serum while still slightly moist!
        </p>
        <Link href="/blog" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-violet-600 hover:underline">
          Read more tips <ArrowRight size={14} />
        </Link>
      </div>

    </div>
  );
}
