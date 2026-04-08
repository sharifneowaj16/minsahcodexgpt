'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import VariantModal, {
  type VariantAdjustmentPayload,
  type VariantModalMode,
  type VariantOption,
  type VariantSelectionPayload,
} from './VariantModal';

interface CartStepperProps {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  initialQuantity?: number;
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

type ZeroStateMode = 'button' | 'stepper';

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
  initialQuantity = 1,
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
  const [modalMode, setModalMode] = useState<VariantModalMode>('select');
  const [boundVariantId, setBoundVariantId] = useState<string | null>(variantId ?? null);
  const [zeroStateMode, setZeroStateMode] = useState<ZeroStateMode>('button');

  const isVariantProduct =
    hasRequiredVariants || Boolean(variantId) || Boolean(variants && variants.length > 0);

  const productCartItems = useMemo(
    () =>
      items.filter(
        (item) => item.productId === productId || (!item.productId && item.id === productId)
      ),
    [items, productId]
  );

  useEffect(() => {
    if (variantId) {
      setBoundVariantId(variantId);
      setZeroStateMode('button');
      return;
    }

    if (boundVariantId) {
      const matchingItem = productCartItems.find((item) => item.id === boundVariantId);
      if (matchingItem || zeroStateMode === 'stepper') {
        return;
      }
    }

    const firstVariantItem = productCartItems.find((item) => item.variantId);
    if (firstVariantItem?.variantId) {
      setBoundVariantId(firstVariantItem.variantId);
    } else if (zeroStateMode === 'button') {
      setBoundVariantId(null);
    }
  }, [boundVariantId, productCartItems, variantId, zeroStateMode]);

  const currentVariantId = variantId ?? boundVariantId;
  const currentVariant = useMemo(() => {
    if (!currentVariantId) {
      return null;
    }

    return variants?.find((variant) => variant.id === currentVariantId) ?? null;
  }, [currentVariantId, variants]);

  const currentCartItemId = currentVariantId || productId;
  const currentCartItem = items.find((item) => item.id === currentCartItemId);
  const qty = currentCartItem?.quantity ?? 0;
  const safeMaxStock = clampStock(currentVariant?.stock ?? maxStock);
  const isOutOfStock = safeMaxStock <= 0;

  const runMutation = async (action: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await action();
    } finally {
      setIsBusy(false);
    }
  };

  const openModal = (mode: VariantModalMode) => {
    setModalMode(mode);
    setIsVariantModalOpen(true);
  };

  const addOrIncrementVariant = async (variant: {
    id: string;
    name: string;
    price: number;
    image?: string | null;
    attributes: Record<string, string>;
  }) => {
    const targetId = variant.id;
    const existingQty = items.find((item) => item.id === targetId)?.quantity ?? 0;

    if (!variantId) {
      setBoundVariantId(targetId);
    }

    if (existingQty > 0) {
      await Promise.resolve(updateQuantity(targetId, existingQty + 1));
      return;
    }

    await Promise.resolve(
      addItem({
        id: targetId,
        productId,
        variantId: targetId,
        variantName:
          [variant.attributes.size, variant.attributes.color].filter(Boolean).join(' / ') ||
          variant.name,
        size: variant.attributes.size ?? null,
        color: variant.attributes.color ?? null,
        variantImage: variant.image ?? null,
        name: productName,
        price: variant.price,
        quantity: initialQuantity,
        image: variant.image || productImage,
      })
    );
  };

  const handleSelectConfirm = async ({ variant }: VariantSelectionPayload) => {
    setZeroStateMode('button');
    await runMutation(async () => {
      await addOrIncrementVariant(variant);
    });
  };

  const handleAdjustVariant = async ({ variant, delta }: VariantAdjustmentPayload) => {
    const targetId = variant.id;
    const existingQty = items.find((item) => item.id === targetId)?.quantity ?? 0;

    await runMutation(async () => {
      if (delta === -1) {
        if (!variantId) {
          setBoundVariantId(targetId);
        }

        if (existingQty <= 1) {
          await Promise.resolve(removeItem(targetId));
          setZeroStateMode('stepper');
          return;
        }

        await Promise.resolve(updateQuantity(targetId, existingQty - 1));
        setZeroStateMode('button');
        return;
      }

      setZeroStateMode('button');
      await addOrIncrementVariant(variant);
    });
  };

  const handleAddToCart = async () => {
    if (disabled || isBusy || isOutOfStock) {
      return;
    }

    if (isVariantProduct && !currentVariantId) {
      openModal('select');
      return;
    }

    await runMutation(async () => {
      if (isVariantProduct && currentVariant) {
        setZeroStateMode('button');
        await addOrIncrementVariant(currentVariant);
        return;
      }

      const existingQty = items.find((item) => item.id === currentCartItemId)?.quantity ?? 0;
      if (existingQty > 0) {
        await Promise.resolve(updateQuantity(currentCartItemId, existingQty + 1));
        return;
      }

      await Promise.resolve(
        addItem({
          id: currentCartItemId,
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
        })
      );
    });
  };

  const handleIncrease = async () => {
    if (disabled || isBusy || isOutOfStock) {
      return;
    }

    if (isVariantProduct) {
      openModal(qty === 0 ? 'select' : 'increase');
      return;
    }

    await runMutation(async () => {
      const nextQty = qty === 0 ? 1 : qty + 1;
      if (qty === 0) {
        await Promise.resolve(
          addItem({
            id: currentCartItemId,
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
          })
        );
        return;
      }

      await Promise.resolve(updateQuantity(currentCartItemId, nextQty));
    });
  };

  const handleDecrease = async () => {
    if (disabled || isBusy) {
      return;
    }

    if (qty === 0) {
      await runMutation(async () => {
        await Promise.all(
          productCartItems.map((item) => Promise.resolve(removeItem(item.id)))
        );
      });

      if (!variantId) {
        setBoundVariantId(null);
      }

      setZeroStateMode('button');
      return;
    }

    if (isVariantProduct) {
      openModal('decrease');
      return;
    }

    await runMutation(async () => {
      if (qty <= 1) {
        await Promise.resolve(removeItem(currentCartItemId));
        setZeroStateMode('stepper');
        return;
      }

      await Promise.resolve(updateQuantity(currentCartItemId, qty - 1));
    });
  };

  const showAddButton = qty === 0 && zeroStateMode === 'button';
  const showZeroStepper = qty === 0 && zeroStateMode === 'stepper';
  const plusDisabled =
    disabled || isBusy || isOutOfStock || (!isVariantProduct && qty >= safeMaxStock);

  return (
    <>
      {showAddButton ? (
        <button
          type="button"
          onClick={() => void handleAddToCart()}
          disabled={disabled || isBusy || isOutOfStock}
          aria-label={`Add ${productName} to cart`}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#3D1F0E] px-5 py-3 text-sm font-semibold text-[#F5E6D3] transition-all duration-200 hover:bg-[#2A1509] disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-500 ${className}`}
        >
          {isBusy ? <Loader2 size={15} className="animate-spin" /> : <ShoppingCart size={15} />}
          Add to Cart
        </button>
      ) : (
        <div
          className={`inline-flex h-11 items-center rounded-2xl border-2 border-[#3D1F0E] bg-white ${className}`}
          role="group"
          aria-label={`${productName} cart quantity`}
        >
          <button
            type="button"
            onClick={() => void handleDecrease()}
            disabled={disabled || isBusy}
            aria-label={
              showZeroStepper
                ? `Remove ${productName} from cart`
                : qty <= 1
                  ? `Decrease ${productName} quantity to zero`
                  : `Decrease ${productName} quantity`
            }
            className="flex h-full w-10 flex-shrink-0 items-center justify-center rounded-l-2xl text-[#3D1F0E] transition-colors hover:bg-[#F5E9DC] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {showZeroStepper ? <Trash2 size={15} /> : <Minus size={15} />}
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
            onClick={() => void handleIncrease()}
            disabled={plusDisabled}
            aria-label={`Increase ${productName} quantity`}
            className="flex h-full w-10 flex-shrink-0 items-center justify-center rounded-r-2xl text-[#3D1F0E] transition-colors hover:bg-[#F5E9DC] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Plus size={15} />
          </button>
        </div>
      )}

      <VariantModal
        isOpen={isVariantModalOpen}
        mode={modalMode}
        productId={productId}
        productName={productName}
        productImage={productImage}
        variants={variants}
        currentVariantId={currentVariantId}
        onClose={() => setIsVariantModalOpen(false)}
        onConfirm={handleSelectConfirm}
        onAdjust={handleAdjustVariant}
      />
    </>
  );
}
