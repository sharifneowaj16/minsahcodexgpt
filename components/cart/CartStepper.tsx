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
  circleAdd?: boolean;
}

type ZeroStateMode = 'button' | 'stepper';

interface ProductLookupResponse {
  product: {
    image?: string;
    stock?: number;
    variants?: VariantOption[];
  };
}

function clampStock(stock?: number) {
  if (typeof stock !== 'number' || Number.isNaN(stock)) return 99;
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
  circleAdd = false,
}: CartStepperProps) {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const [isBusy, setIsBusy] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<VariantModalMode>('select');
  const [boundVariantId, setBoundVariantId] = useState<string | null>(variantId ?? null);
  const [zeroStateMode, setZeroStateMode] = useState<ZeroStateMode>('button');
  const [resolvedVariants, setResolvedVariants] = useState<VariantOption[]>(variants ?? []);
  const [resolvedMaxStock, setResolvedMaxStock] = useState<number | null>(null);
  const [resolvedProductImage, setResolvedProductImage] = useState<string | null>(null);
  const [hasResolvedProductContext, setHasResolvedProductContext] = useState(Boolean(variants?.length));

  useEffect(() => {
    setResolvedVariants(variants ?? []);
    setResolvedMaxStock(null);
    setResolvedProductImage(null);
    setHasResolvedProductContext(Boolean(variants?.length));
  }, [maxStock, productId, productImage, variants]);

  const effectiveVariants = useMemo(
    () => (resolvedVariants.length > 0 ? resolvedVariants : variants ?? []),
    [resolvedVariants, variants]
  );
  const effectiveProductImage = resolvedProductImage || variantImage || productImage;

  const isVariantProduct =
    hasRequiredVariants || Boolean(variantId || boundVariantId) || effectiveVariants.length > 0;

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
      if (matchingItem || zeroStateMode === 'stepper') return;
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
    if (!currentVariantId) return null;
    return effectiveVariants.find((v) => v.id === currentVariantId) ?? null;
  }, [currentVariantId, effectiveVariants]);

  const currentCartItemId = currentVariantId || productId;
  const currentCartItem = items.find((item) => item.id === currentCartItemId);
  const currentItemQty = currentCartItem?.quantity ?? 0;
  const productQty = productCartItems.reduce((sum, item) => sum + item.quantity, 0);
  const qty = variantId ? currentItemQty : isVariantProduct ? productQty : currentItemQty;
  const safeMaxStock = clampStock(currentVariant?.stock ?? resolvedMaxStock ?? maxStock);
  const isOutOfStock = safeMaxStock <= 0;

  useEffect(() => {
    if (qty > 0 && zeroStateMode !== 'button') {
      setZeroStateMode('button');
    }
  }, [qty, zeroStateMode]);

  const runMutation = async (action: () => Promise<void>) => {
    setIsBusy(true);
    try { await action(); } finally { setIsBusy(false); }
  };

  const openModal = (mode: VariantModalMode) => {
    setModalMode(mode);
    setIsVariantModalOpen(true);
  };

  const resolveProductContext = async () => {
    if (hasRequiredVariants || variantId || hasResolvedProductContext) {
      return {
        image: effectiveProductImage,
        maxStock: resolvedMaxStock ?? maxStock,
        variants: effectiveVariants,
      };
    }

    setIsBusy(true);
    try {
      const res = await fetch(`/api/products/${productId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load product');

      const data = (await res.json()) as ProductLookupResponse;
      const fetchedVariants = (data.product.variants ?? []).map((variant) => ({
        id: variant.id,
        name: variant.name,
        price: variant.price,
        stock: variant.stock,
        sku: variant.sku,
        image: variant.image ?? null,
        attributes: (variant.attributes ?? {}) as Record<string, string>,
      }));

      setResolvedVariants(fetchedVariants);
      setResolvedMaxStock(data.product.stock ?? maxStock);
      setResolvedProductImage(data.product.image ?? null);
      setHasResolvedProductContext(true);

      return {
        image: data.product.image ?? effectiveProductImage,
        maxStock: data.product.stock ?? maxStock,
        variants: fetchedVariants,
      };
    } catch {
      return {
        image: effectiveProductImage,
        maxStock,
        variants: effectiveVariants,
      };
    } finally {
      setIsBusy(false);
    }
  };

  const addOrIncrementVariant = async (variant: {
    id: string; name: string; price: number; image?: string | null;
    attributes: Record<string, string>;
  }, quantity = 1) => {
    const targetId = variant.id;
    const existingQty = items.find((item) => item.id === targetId)?.quantity ?? 0;
    if (!variantId) setBoundVariantId(targetId);
    if (existingQty > 0) {
      await Promise.resolve(updateQuantity(targetId, existingQty + quantity));
      return;
    }
    await Promise.resolve(addItem({
      id: targetId, productId, variantId: targetId,
      variantName: [variant.attributes.size, variant.attributes.color].filter(Boolean).join(' / ') || variant.name,
      size: variant.attributes.size ?? null, color: variant.attributes.color ?? null,
      variantImage: variant.image ?? null, name: productName, price: variant.price,
      quantity: Math.max(initialQuantity, quantity), image: variant.image || effectiveProductImage,
    }));
  };

  const handleSelectConfirm = async ({ variant, quantity }: VariantSelectionPayload) => {
    setZeroStateMode('button');
    await runMutation(async () => { await addOrIncrementVariant(variant, quantity); });
  };

  const handleAdjustVariant = async ({ variant, delta }: VariantAdjustmentPayload) => {
    const targetId = variant.id;
    const existingQty = items.find((item) => item.id === targetId)?.quantity ?? 0;
    await runMutation(async () => {
      if (delta === -1) {
        if (!variantId) setBoundVariantId(targetId);
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
    if (disabled || isBusy || isOutOfStock) return;
    const context = isVariantProduct ? null : await resolveProductContext();
    const availableVariants = context?.variants ?? effectiveVariants;
    const requiresVariantSelection =
      hasRequiredVariants || Boolean(currentVariantId) || availableVariants.length > 0;
    const nextVariant = currentVariantId
      ? availableVariants.find((variant) => variant.id === currentVariantId) ?? null
      : null;

    if (requiresVariantSelection && !currentVariantId) { openModal('select'); return; }
    await runMutation(async () => {
      if (requiresVariantSelection && nextVariant) {
        setZeroStateMode('button');
        await addOrIncrementVariant(nextVariant);
        return;
      }
      const existingQty = items.find((item) => item.id === currentCartItemId)?.quantity ?? 0;
      if (existingQty > 0) {
        await Promise.resolve(updateQuantity(currentCartItemId, existingQty + 1));
        return;
      }
      await Promise.resolve(addItem({
        id: currentCartItemId, productId, variantId: variantId ?? null,
        variantName: variantName ?? null, size: size ?? null, color: color ?? null,
        variantImage: variantImage ?? null, name: productName, price,
        quantity: initialQuantity, image: variantImage || context?.image || effectiveProductImage,
      }));
    });
  };

  const handleIncrease = async () => {
    if (disabled || isBusy || isOutOfStock) return;
    const context = isVariantProduct ? null : await resolveProductContext();
    const requiresVariantSelection =
      hasRequiredVariants ||
      Boolean(currentVariantId) ||
      Boolean((context?.variants ?? effectiveVariants).length);

    if (requiresVariantSelection) { openModal(qty === 0 ? 'select' : 'increase'); return; }
    await runMutation(async () => {
      if (qty === 0) {
        await Promise.resolve(addItem({
          id: currentCartItemId, productId, variantId: variantId ?? null,
          variantName: variantName ?? null, size: size ?? null, color: color ?? null,
          variantImage: variantImage ?? null, name: productName, price,
          quantity: initialQuantity, image: variantImage || context?.image || effectiveProductImage,
        }));
        return;
      }
      await Promise.resolve(updateQuantity(currentCartItemId, qty + 1));
    });
  };

  const handleDecrease = async () => {
    if (disabled || isBusy) return;
    if (qty === 0) {
      await runMutation(async () => {
        await Promise.all(productCartItems.map((item) => Promise.resolve(removeItem(item.id))));
      });
      if (!variantId) setBoundVariantId(null);
      setZeroStateMode('button');
      return;
    }
    if (isVariantProduct) { openModal('decrease'); return; }
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
  const plusDisabled = disabled || isBusy || isOutOfStock || (!isVariantProduct && qty >= safeMaxStock);

  const variantModalNode = (
    <VariantModal
      isOpen={isVariantModalOpen}
      mode={modalMode}
      productId={productId}
      productName={productName}
      productImage={effectiveProductImage}
      variants={effectiveVariants}
      currentVariantId={currentVariantId}
      onClose={() => setIsVariantModalOpen(false)}
      onConfirm={handleSelectConfirm}
      onAdjust={handleAdjustVariant}
    />
  );

  // ─── CIRCLE-ADD MODE ──────────────────────────────────────────────────────
  if (circleAdd) {
    return (
      <>
        {showAddButton ? (
          <button
            type="button"
            onClick={() => void handleAddToCart()}
            disabled={disabled || isBusy || isOutOfStock}
            aria-label={`Add ${productName} to cart`}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-full bg-[#E8466A] shadow-[0_4px_14px_rgba(232,70,106,0.40)] transition-all duration-200 hover:scale-110 hover:bg-[#D6365A] active:scale-95 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none ${className}`}
          >
            {isBusy
              ? <Loader2 size={17} className="animate-spin text-white" />
              : <Plus size={19} strokeWidth={2.8} className="text-white" />}
            <span className="pointer-events-none absolute inset-0 rounded-full bg-[#E8466A] opacity-0 group-hover:animate-ping group-hover:opacity-25" />
          </button>
        ) : (
          <div
            className={`inline-flex h-10 items-center overflow-hidden rounded-full border-2 border-[#E8466A] bg-white shadow-[0_3px_12px_rgba(232,70,106,0.22)] ${className}`}
            role="group"
            aria-label={`${productName} cart quantity`}
          >
            <button
              type="button"
              onClick={() => void handleDecrease()}
              disabled={disabled || isBusy}
              aria-label={showZeroStepper ? `Remove ${productName}` : `Decrease ${productName}`}
              className="flex h-full w-9 flex-shrink-0 items-center justify-center text-[#E8466A] transition-colors hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {showZeroStepper ? <Trash2 size={13} /> : <Minus size={13} />}
            </button>
            <span
              className="flex min-w-[1.5rem] flex-1 items-center justify-center px-1 text-sm font-bold text-[#1A0D06]"
              aria-live="polite" aria-atomic="true"
            >
              {isBusy ? <Loader2 size={13} className="animate-spin" /> : qty}
            </span>
            <button
              type="button"
              onClick={() => void handleIncrease()}
              disabled={plusDisabled}
              aria-label={`Increase ${productName}`}
              className="flex h-full w-9 flex-shrink-0 items-center justify-center text-[#E8466A] transition-colors hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={13} />
            </button>
          </div>
        )}
        {variantModalNode}
      </>
    );
  }

  // ─── DEFAULT MODE ─────────────────────────────────────────────────────────
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
            aria-label={showZeroStepper ? `Remove ${productName} from cart` : qty <= 1 ? `Decrease ${productName} quantity to zero` : `Decrease ${productName} quantity`}
            className="flex h-full w-10 flex-shrink-0 items-center justify-center rounded-l-2xl text-[#3D1F0E] transition-colors hover:bg-[#F5E9DC] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {showZeroStepper ? <Trash2 size={15} /> : <Minus size={15} />}
          </button>
          <span
            className="flex min-w-10 flex-1 items-center justify-center px-2 text-sm font-bold text-[#1A0D06]"
            aria-live="polite" aria-atomic="true"
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
      {variantModalNode}
    </>
  );
}
