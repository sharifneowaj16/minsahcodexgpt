'use client';

import { useMemo, useState } from 'react';
import { Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import VariantModal, { type VariantOption, type VariantSelectionPayload } from './VariantModal';

interface CartStepperProps {
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
  hasRequiredVariants?: boolean;
  variants?: VariantOption[];
  className?: string;
  disabled?: boolean;
}

function clampStock(stock?: number) {
  if (typeof stock !== 'number' || Number.isNaN(stock)) {
    return 99;
  }

  return Math.max(0, stock);
}

export default function CartStepper({
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
  hasRequiredVariants = false,
  variants,
  className = '',
  disabled = false,
}: CartStepperProps) {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const [isBusy, setIsBusy] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);

  const requiresVariantSelection = hasRequiredVariants && !variantId;
  const cartItemId = variantId || productId;
  const directQty = items.find((item) => item.id === cartItemId)?.quantity ?? 0;
  const aggregateQty = useMemo(
    () =>
      items
        .filter((item) => item.productId === productId || (!item.productId && item.id === productId))
        .reduce((sum, item) => sum + item.quantity, 0),
    [items, productId]
  );
  const qty = requiresVariantSelection ? aggregateQty : directQty;
  const safeMaxStock = clampStock(maxStock);
  const isOutOfStock = safeMaxStock <= 0;
  const disablePlus = disabled || isBusy || isOutOfStock || (!requiresVariantSelection && qty >= safeMaxStock);
  const disableLeft = disabled || isBusy || qty === 0;

  const runMutation = async (action: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  const handlePlus = async () => {
    if (disablePlus) {
      return;
    }

    if (requiresVariantSelection) {
      setIsVariantModalOpen(true);
      return;
    }

    await runMutation(async () => {
      if (qty === 0) {
        await Promise.resolve(
          addItem({
            id: cartItemId,
            productId,
            variantId: variantId ?? null,
            variantName: variantName ?? null,
            size: size ?? null,
            color: color ?? null,
            variantImage: variantImage ?? null,
            name: productName,
            price,
            quantity: 1,
            image: variantImage || productImage,
          })
        );
        return;
      }

      await Promise.resolve(updateQuantity(cartItemId, qty + 1));
    });
  };

  const handleLeft = async () => {
    if (disableLeft) {
      return;
    }

    if (requiresVariantSelection) {
      setIsVariantModalOpen(true);
      return;
    }

    await runMutation(async () => {
      if (qty === 1) {
        await Promise.resolve(removeItem(cartItemId));
        return;
      }

      await Promise.resolve(updateQuantity(cartItemId, qty - 1));
    });
  };

  const handleVariantConfirm = async ({
    productName: resolvedName,
    productImage: resolvedImage,
    variant,
  }: VariantSelectionPayload) => {
    const selectedId = variant.id;
    const existingQty = items.find((item) => item.id === selectedId)?.quantity ?? 0;

    await runMutation(async () => {
      if (existingQty === 0) {
        await Promise.resolve(
          addItem({
            id: selectedId,
            productId,
            variantId: variant.id,
            variantName:
              [variant.attributes.size, variant.attributes.color].filter(Boolean).join(' / ') || variant.name,
            size: variant.attributes.size ?? null,
            color: variant.attributes.color ?? null,
            variantImage: variant.image ?? null,
            name: resolvedName,
            price: variant.price,
            quantity: 1,
            image: variant.image || resolvedImage,
          })
        );
        return;
      }

      await Promise.resolve(updateQuantity(selectedId, existingQty + 1));
    });
  };

  return (
    <>
      <div
        className={`inline-flex h-11 items-center rounded-2xl border-2 border-[#3D1F0E] bg-white ${className}`}
        role="group"
        aria-label={`${productName} cart quantity`}
      >
        <button
          type="button"
          onClick={() => void handleLeft()}
          disabled={disableLeft}
          aria-label={
            qty <= 1
              ? `Remove ${productName} from cart`
              : `Decrease ${productName} quantity`
          }
          className="flex h-full w-10 flex-shrink-0 items-center justify-center rounded-l-2xl text-[#3D1F0E] transition-colors hover:bg-[#F5E9DC] disabled:cursor-not-allowed disabled:opacity-35"
        >
          {qty <= 1 ? <Trash2 size={15} /> : <Minus size={15} />}
        </button>

        <span
          className="flex min-w-10 flex-1 items-center justify-center px-2 text-sm font-bold text-[#1A0D06]"
          aria-live="polite"
          aria-atomic="true"
        >
          {isBusy ? <Loader2 size={14} className="animate-spin" /> : qty}
        </span>

        <button
          type="button"
          onClick={() => void handlePlus()}
          disabled={disablePlus}
          aria-label={`Increase ${productName} quantity`}
          className="flex h-full w-10 flex-shrink-0 items-center justify-center rounded-r-2xl text-[#3D1F0E] transition-colors hover:bg-[#F5E9DC] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Plus size={15} />
        </button>
      </div>

      <VariantModal
        isOpen={isVariantModalOpen}
        productId={productId}
        productName={productName}
        productImage={productImage}
        variants={variants}
        onClose={() => setIsVariantModalOpen(false)}
        onConfirm={handleVariantConfirm}
      />
    </>
  );
}
