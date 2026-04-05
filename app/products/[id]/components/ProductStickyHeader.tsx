'use client';

import Link from 'next/link';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { useScrollHeader } from '@/hooks/useSwipeAndScrollHeader';
import { useCart } from '@/contexts/CartContext';

interface ProductStickyHeaderProps {
  productName: string;
  price: number;
  variantName?: string | null;
  requiresVariantSelection?: boolean;
  stock?: number;
  inStock?: boolean;
}

export default function ProductStickyHeader({
  productName,
  price,
  variantName,
  requiresVariantSelection = false,
  stock = 0,
  inStock = true,
}: ProductStickyHeaderProps) {
  const showDetails = useScrollHeader(280);
  const { items } = useCart();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtitle = requiresVariantSelection
    ? 'Select variant'
    : variantName
      ? `${variantName} • ৳${price.toLocaleString('bn-BD')}`
      : `৳${price.toLocaleString('bn-BD')}`;

  const stockLabel = requiresVariantSelection
    ? null
    : !inStock
      ? 'Out of stock'
      : stock <= 5
        ? `Only ${stock} left`
        : 'In stock';

  const stockClassName = !inStock
    ? 'bg-red-500/15 text-red-200 ring-1 ring-red-400/30'
    : stock <= 5
      ? 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-300/30'
      : 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-300/30';

  return (
    <div className="sticky top-0 z-40 bg-[#3D1F0E] transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href="/shop"
          className="flex flex-shrink-0 items-center gap-1.5 text-sm text-[#F5E6D3] transition hover:text-white"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">ফিরে যান</span>
        </Link>

        <div
          className={`flex-1 overflow-hidden transition-all duration-300 ${
            showDetails ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="truncate text-sm font-medium leading-tight text-[#F5E6D3]">
            {productName}
          </p>
          <div className="mt-0.5 flex items-center gap-2 overflow-hidden">
            <p className="truncate text-xs text-[#C4A882]">{subtitle}</p>
            {stockLabel && (
              <span
                className={`inline-flex flex-shrink-0 items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${stockClassName}`}
              >
                {stockLabel}
              </span>
            )}
          </div>
        </div>

        <p
          className={`absolute left-1/2 -translate-x-1/2 text-sm font-semibold uppercase tracking-widest text-[#F5E6D3] transition-all duration-300 ${
            showDetails ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          Minsah Beauty
        </p>

        <Link
          href="/cart"
          className="relative flex-shrink-0 text-[#F5E6D3] transition hover:text-white"
        >
          <ShoppingCart size={18} />
          {cartCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
              {cartCount > 9 ? '9+' : cartCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
