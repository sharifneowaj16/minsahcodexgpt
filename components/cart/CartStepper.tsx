'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Minus, Plus, ShoppingCart } from 'lucide-react';
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

type BoundVariantState = {
  id: string;
  name: string;
  price: number;
  stock?: number;
  image?: string | null;
  size?: string | null;
  color?: string | null;
};

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
  const [boundVariant, setBoundVariant] = useState<BoundVariantState | null>(null);

  const productCartItems = useMemo(
    () =>
      items.filter(
        (item) => item.productId === productId || (!item.productId && item.id === productId)
      ),
    [items, productId]
  );

  useEffect(() => {
    if (variantId) {
      return;
    }

    if (boundVariant) {
      const stillExists = items.some((item) => item.id === boundVariant.id);
      if (!stillExists) {
        setBoundVariant(null);
      }
      return;
    }

    if (productCartItems.length !== 1) {
      return;
    }

    const [singleItem] = productCartItems;
    if (!singleItem.variantId) {
      return;
    }

    setBoundVariant({
      id: singleItem.variantId,
      name: singleItem.variantName || singleItem.name,
      price: singleItem.price,
      image: singleItem.variantImage || singleItem.image,
      size: singleItem.size ?? null,
      color: singleItem.color ?? null,
      stock: variants?.find((variant) => variant.id === singleItem.variantId)?.stock,
    });
  }, [boundVariant, items, productCartItems, variantId, variants]);

  const resolvedVariantId = variantId ?? boundVariant?.id ?? null;
  const resolvedVariant = useMemo(() => {
    if (variantId) {
      const matchedVariant = variants?.find((variant) => variant.id === variantId);
      return {
        id: variantId,
        name: matchedVariant?.name || variantName || productName,
        price: matchedVariant?.price ?? price,
        stock: matchedVariant?.stock,
        image: matchedVariant?.image ?? variantImage ?? productImage,
        size: matchedVariant?.attributes.size ?? size ?? null,
        color: matchedVariant?.attributes.color ?? color ?? null,
      };
    }

    return boundVariant;
  }, [
    boundVariant,
    color,
    price,
    productImage,
    productName,
    size,
    variantId,
    variantImage,
    variantName,
    variants,
  ]);

  const requiresVariantSelection = hasRequiredVariants && !resolvedVariantId;
  const cartItemId = resolvedVariantId || productId;
  const qty = requiresVariantSelection
    ? 0
    : items.find((item) => item.id === cartItemId)?.quantity ?? 0;
  const effectiveMaxStock = resolvedVariant?.stock ?? maxStock;
  const safeMaxStock = clampStock(effectiveMaxStock);
  const isOutOfStock = safeMaxStock <= 0;
  const disablePlus =
    disabled || isBusy || isOutOfStock || (!requiresVariantSelection && qty >= safeMaxStock);

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
            variantId: resolvedVariantId,
            variantName:
              (resolvedVariant &&
                [resolvedVariant.size, resolvedVariant.color].filter(Boolean).join(' / ')) ||
              variantName ||
              resolvedVariant?.name ||
              null,
            size: resolvedVariant?.size ?? size ?? null,
            color: resolvedVariant?.color ?? color ?? null,
            variantImage: resolvedVariant?.image ?? variantImage ?? null,
            name: productName,
            price: resolvedVariant?.price ?? price,
            quantity: 1,
            image: resolvedVariant?.image || variantImage || productImage,
          })
        );
        return;
      }

      await Promise.resolve(updateQuantity(cartItemId, qty + 1));
    });
  };

  const handleLeft = async () => {
    if (disabled || isBusy) {
      return;
    }

    await runMutation(async () => {
      if (qty === 1) {
        await Promise.resolve(removeItem(cartItemId));
        if (!variantId) {
          setBoundVariant(null);
        }
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
    const normalizedVariantName =
      [variant.attributes.size, variant.attributes.color].filter(Boolean).join(' / ') || variant.name;

    setBoundVariant({
      id: variant.id,
      name: variant.name,
      price: variant.price,
      stock: variant.stock,
      image: variant.image ?? null,
      size: variant.attributes.size ?? null,
      color: variant.attributes.color ?? null,
    });

    await runMutation(async () => {
      if (existingQty === 0) {
        await Promise.resolve(
          addItem({
            id: selectedId,
            productId,
            variantId: variant.id,
            variantName: normalizedVariantName,
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

  if (qty === 0) {
    return (
      <>
        <button
          type="button"
          onClick={() => void handlePlus()}
          disabled={disablePlus}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#3D1F0E] px-5 py-3 text-sm font-semibold text-[#F5E6D3] transition-all duration-200 hover:bg-[#2A1509] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 ${className}`}
        >
          {isBusy ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
          Add to Cart
        </button>

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
          disabled={disabled || isBusy}
          aria-label={
            qty === 1 ? `Remove ${productName} from cart` : `Decrease ${productName} quantity`
          }
          className="flex h-full w-10 flex-shrink-0 items-center justify-center rounded-l-2xl text-[#3D1F0E] transition-colors hover:bg-[#F5E9DC] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Minus size={15} />
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
