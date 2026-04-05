'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import AddToCartStepper from './AddToCartStepper';

interface StickyBottomBarProps {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  unitPrice: number;
  variantId: string | null;
  variantName?: string | null;
  size?: string | null;
  color?: string | null;
  variantImage?: string | null;
  quantity: number;
  maxStock: number;
  inStock: boolean;
  requiresVariantSelection?: boolean;
  whatsappNumber: string;
}

export default function StickyBottomBar({
  productId,
  productName,
  productImage,
  price,
  unitPrice,
  variantId,
  variantName,
  size,
  color,
  variantImage,
  quantity,
  maxStock,
  inStock,
  requiresVariantSelection = false,
  whatsappNumber,
}: StickyBottomBarProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [buying, setBuying] = useState(false);

  const displayImage = variantImage || productImage;
  const isDisabled = !inStock || requiresVariantSelection;
  const whatsappMessage = `🛒 অর্ডার করতে চাই:\n\nপণ্য: ${productName}${
    variantName ? `\nভ্যারিয়েন্ট: ${variantName}` : ''
  }\nপরিমাণ: ${quantity}\nমোট মূল্য: ৳${price.toLocaleString(
    'bn-BD'
  )}\n\nঅনুগ্রহ করে কনফার্ম করুন।`;

  const handleBuyNow = () => {
    if (isDisabled) return;

    setBuying(true);
    addItem({
      id: variantId || productId,
      productId,
      variantId: variantId ?? null,
      variantName: variantName ?? null,
      size: size ?? null,
      color: color ?? null,
      variantImage: variantImage ?? null,
      name: productName,
      price: unitPrice,
      quantity,
      image: displayImage,
    });

    const params = new URLSearchParams();
    params.set('productId', productId);
    params.set('quantity', String(quantity));
    if (variantId) params.set('variantId', variantId);

    router.push(`/checkout?${params.toString()}`);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E8D5C0] bg-white/96 shadow-[0_-4px_24px_rgba(61,31,14,0.10)] backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 pt-2.5 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[#8B5E3C]">মোট মূল্য</span>
            <span className="text-base font-semibold text-[#1A0D06]">
              ৳{price.toLocaleString('bn-BD')}
            </span>
          </div>

          <div className="flex gap-2">
            <AddToCartStepper
              productId={productId}
              productName={productName}
              productImage={productImage}
              price={unitPrice}
              maxStock={maxStock}
              variantId={variantId}
              variantName={variantName}
              size={size}
              color={color}
              variantImage={variantImage}
              initialQuantity={quantity}
              className="flex-1"
              disabled={isDisabled}
              disabledLabel={requiresVariantSelection ? 'Select Option' : 'Out of Stock'}
            />

            <button
              onClick={handleBuyNow}
              disabled={isDisabled || buying}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3 text-sm font-semibold text-white transition-all duration-200 active:scale-95 ${
                isDisabled
                  ? 'cursor-not-allowed bg-gray-400'
                  : buying
                    ? 'scale-95 bg-[#2A1509]'
                    : 'bg-[#3D1F0E] hover:bg-[#2A1509]'
              }`}
            >
              <ShoppingBag size={15} />
              {requiresVariantSelection ? 'Select Option' : 'Buy Now'}
            </button>
          </div>
        </div>
      </div>

      <div className="fixed right-4 bottom-28 z-50 flex flex-col items-center gap-1 md:bottom-24">
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[#25D366] opacity-40 animate-ping"
        />
        <a
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp এ অর্ডার করুন"
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-[0_4px_20px_rgba(37,211,102,0.55)] transition-all duration-200 hover:bg-[#1DA851] active:scale-95"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.815 0 00-3.48-8.413z" />
          </svg>
        </a>
        <span className="relative whitespace-nowrap rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-[#1A0D06] shadow-sm">
          WhatsApp
        </span>
      </div>
    </>
  );
}
