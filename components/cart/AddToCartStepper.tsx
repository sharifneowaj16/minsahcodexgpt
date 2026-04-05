'use client';

import { useTransition } from 'react';
import { ShoppingCart, Minus, Plus, Trash2, Loader2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';

interface AddToCartStepperProps {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  maxStock?: number;
  variantId?: string | null;
  variantName?: string | null;
  size?: string | null;
  color?: string | null;
  variantImage?: string | null;
  initialQuantity?: number;
  className?: string;
  disabled?: boolean;
  disabledLabel?: string;
}

export default function AddToCartStepper({
  productId,
  productName,
  productImage,
  price,
  maxStock = 99,
  variantId,
  variantName,
  size,
  color,
  variantImage,
  initialQuantity = 1,
  className = '',
  disabled = false,
  disabledLabel = 'Out of Stock',
}: AddToCartStepperProps) {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const [isPending, startTransition] = useTransition();

  const cartItemId = variantId || productId;
  const cartItem = items.find((item) => item.id === cartItemId);
  const qty = cartItem?.quantity ?? 0;
  const isUnavailable = disabled || maxStock <= 0;

  const handleAdd = () => {
    if (isUnavailable) {
      return;
    }

    startTransition(async () => {
      await addItem({
        id: cartItemId,
        productId,
        variantId: variantId ?? null,
        variantName: variantName ?? null,
        size: size ?? null,
        color: color ?? null,
        variantImage: variantImage ?? null,
        name: productName,
        price,
        quantity: initialQuantity,
        image: variantImage || productImage,
      });
    });
  };

  const handleIncrement = () => {
    if (qty >= maxStock) {
      return;
    }

    startTransition(async () => {
      await updateQuantity(cartItemId, qty + 1);
    });
  };

  const handleDecrement = () => {
    if (qty > 1) {
      startTransition(async () => {
        await updateQuantity(cartItemId, qty - 1);
      });
      return;
    }

    startTransition(async () => {
      await removeItem(cartItemId);
    });
  };

  if (qty === 0) {
    return (
      <button
        onClick={handleAdd}
        disabled={isPending || isUnavailable}
        aria-label={
          isUnavailable ? `${productName} is unavailable` : `Add ${productName} to cart`
        }
        className={`flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
          isUnavailable
            ? 'bg-stone-300 text-stone-500'
            : 'bg-[#3D1F0E] text-[#F5E6D3] hover:bg-[#2A1509]'
        } ${className}`}
      >
        {isUnavailable ? (
          disabledLabel
        ) : (
          <>
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ShoppingCart size={16} />
            )}
            Add to Cart
          </>
        )}
      </button>
    );
  }

  return (
    <div
      className={`flex items-center h-11 rounded-2xl border-2 border-[#3D1F0E] ${className}`}
      role="group"
      aria-label={`${productName} quantity`}
    >
      <button
        onClick={handleDecrement}
        disabled={isPending}
        aria-label={
          qty === 1
            ? `Remove ${productName} from cart`
            : `Decrease ${productName} quantity`
        }
        className="w-10 h-full flex items-center justify-center flex-shrink-0 text-[#3D1F0E] hover:bg-[#F5E9DC] rounded-l-2xl transition-colors duration-150 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : qty === 1 ? (
          <Trash2 size={14} className="text-red-500" />
        ) : (
          <Minus size={14} />
        )}
      </button>

      <span
        className="flex-1 text-center text-sm font-bold text-[#1A0D06] select-none"
        aria-live="polite"
        aria-atomic="true"
      >
        {isPending ? <Loader2 size={13} className="animate-spin mx-auto" /> : qty}
      </span>

      <button
        onClick={handleIncrement}
        disabled={isPending || qty >= maxStock}
        aria-label={`Increase ${productName} quantity`}
        className="w-10 h-full flex items-center justify-center flex-shrink-0 text-[#3D1F0E] hover:bg-[#F5E9DC] rounded-r-2xl transition-colors duration-150 disabled:opacity-40"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
