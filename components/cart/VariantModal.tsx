'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Minus, Plus, ShoppingCart, X } from 'lucide-react';

export interface VariantOption {
  id: string;
  name: string;
  price: number;
  stock: number;
  sku?: string;
  image?: string | null;
  attributes: Record<string, string>;
}

export interface VariantSelectionPayload {
  productId: string;
  productName: string;
  productImage: string;
  basePrice: number;
  variant: VariantOption;
  quantity: number;
}

export interface VariantAdjustmentPayload {
  variant: VariantOption;
  delta: 1 | -1;
}

export type VariantModalMode = 'select' | 'increase' | 'decrease';

interface VariantModalProps {
  isOpen: boolean;
  mode: VariantModalMode;
  productId: string;
  productName?: string;
  productImage?: string;
  variants?: VariantOption[];
  currentVariantId?: string | null;
  onClose: () => void;
  onConfirm?: (payload: VariantSelectionPayload) => Promise<void> | void;
  onAdjust?: (payload: VariantAdjustmentPayload) => Promise<void> | void;
}

interface ProductResponse {
  product: {
    id: string;
    name: string;
    image: string;
    price: number;
    variants: Array<{
      id: string;
      name: string;
      price: number;
      stock: number;
      sku?: string;
      image?: string;
      attributes?: Record<string, string>;
    }>;
  };
}

function normalizeVariants(variants: VariantModalProps['variants']): VariantOption[] {
  return (variants ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    price: v.price,
    stock: v.stock,
    sku: v.sku,
    image: v.image ?? null,
    attributes: (v.attributes ?? {}) as Record<string, string>,
  }));
}

function toVariantLabel(variant: VariantOption) {
  return (
    [variant.attributes.size, variant.attributes.color].filter(Boolean).join(' / ') || variant.name
  );
}

export default function VariantModal({
  isOpen,
  mode,
  productId,
  productName,
  productImage,
  variants,
  currentVariantId,
  onClose,
  onConfirm,
  onAdjust,
}: VariantModalProps) {
  const [resolvedProductName, setResolvedProductName] = useState(productName ?? '');
  const [resolvedProductImage, setResolvedProductImage] = useState(productImage ?? '');
  const [resolvedBasePrice, setResolvedBasePrice] = useState(0);
  const [resolvedVariants, setResolvedVariants] = useState<VariantOption[]>(
    normalizeVariants(variants)
  );
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    currentVariantId ?? null
  );
  const [selectedQuantity, setSelectedQuantity] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const prefetched = normalizeVariants(variants);
    setResolvedProductName(productName ?? '');
    setResolvedProductImage(productImage ?? '');
    setResolvedVariants(prefetched);
    setSelectedVariantId(currentVariantId ?? null);
    setSelectedQuantity(currentVariantId ? 1 : prefetched.length === 1 ? 1 : 0);
    setError(null);

    if (prefetched.length > 0) return;

    const loadProduct = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products/${productId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load variants');
        const data = (await res.json()) as ProductResponse;
        if (!active) return;

        setResolvedProductName(data.product.name);
        setResolvedProductImage(data.product.image);
        setResolvedBasePrice(data.product.price);

        const fetchedVariants = data.product.variants.map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          stock: v.stock,
          sku: v.sku,
          image: v.image ?? null,
          attributes: (v.attributes ?? {}) as Record<string, string>,
        }));

        setResolvedVariants(fetchedVariants);
        setSelectedQuantity(currentVariantId ? 1 : fetchedVariants.length === 1 ? 1 : 0);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load variants');
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProduct();
    return () => {
      active = false;
    };
  }, [currentVariantId, isOpen, productId, productImage, productName, variants]);

  useEffect(() => {
    if (!isOpen || resolvedBasePrice > 0 || resolvedVariants.length === 0) return;
    const lowest = resolvedVariants.reduce(
      (min, v) => Math.min(min, v.price),
      resolvedVariants[0].price
    );
    setResolvedBasePrice(lowest);
  }, [isOpen, resolvedBasePrice, resolvedVariants]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const actionVariants = useMemo(() => {
    if (mode === 'select') return [];
    const currentId = currentVariantId ?? selectedVariantId;
    return [...resolvedVariants].sort((a, b) => {
      if (a.id === currentId) return -1;
      if (b.id === currentId) return 1;
      return 0;
    });
  }, [currentVariantId, mode, resolvedVariants, selectedVariantId]);

  const selectedVariant = resolvedVariants.find((v) => v.id === selectedVariantId) ?? null;

  useEffect(() => {
    if (!isOpen || mode !== 'select') return;
    if (!selectedVariantId && resolvedVariants.length === 1) {
      setSelectedVariantId(resolvedVariants[0].id);
      setSelectedQuantity(1);
      return;
    }
    if (!selectedVariantId && selectedQuantity !== 0) {
      setSelectedQuantity(0);
    }
  }, [isOpen, mode, resolvedVariants, selectedQuantity, selectedVariantId]);

  const canConfirm =
    mode === 'select' &&
    Boolean(
      selectedVariant &&
        selectedVariant.stock > 0 &&
        selectedQuantity > 0 &&
        !submitting &&
        !loading
    );

  const modalTitle =
    mode === 'decrease'
      ? 'Update Cart'
      : mode === 'increase'
        ? 'Add Another Variant'
        : 'Select Variant';

  const handleConfirm = async () => {
    if (!selectedVariant || !onConfirm) return;
    setSubmitting(true);
    try {
      await onConfirm({
        productId,
        productName: resolvedProductName,
        productImage: resolvedProductImage,
        basePrice: resolvedBasePrice || selectedVariant.price,
        variant: selectedVariant,
        quantity: selectedQuantity,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjust = async (variant: VariantOption, delta: 1 | -1) => {
    if (!onAdjust) return;
    setSubmitting(true);
    try {
      await onAdjust({ variant, delta });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const updateSelectedVariantQuantity = (variant: VariantOption, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setSelectedVariantId(null);
      setSelectedQuantity(0);
      return;
    }

    setSelectedVariantId(variant.id);
    setSelectedQuantity(Math.min(variant.stock, nextQuantity));
  };

  if (!isOpen) return null;

  const modalNode = (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 sm:items-center sm:px-4 sm:py-6">
      <div className="flex h-[min(100dvh,calc(100dvh-0.25rem))] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:h-auto sm:max-h-[min(88vh,760px)] sm:rounded-[30px]">
        <div className="shrink-0 border-b border-stone-200 px-4 py-4 sm:px-5">
          <div className="mb-3 flex justify-center sm:hidden">
            <span className="h-1.5 w-12 rounded-full bg-stone-200" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                {modalTitle}
              </p>
              <h2 className="mt-1 line-clamp-2 text-base font-semibold text-stone-900 sm:text-lg">
                {resolvedProductName || productName || 'Product'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-stone-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : resolvedVariants.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No variants available for this product right now.
            </div>
          ) : mode === 'select' ? (
            <div className="space-y-4">
              <div className="rounded-3xl bg-[#F7F2EC] p-4 text-sm text-stone-700">
                Select the variant and quantity you want to add to your cart.
              </div>

              {resolvedVariants.map((variant) => {
                const quantity = selectedVariantId === variant.id ? selectedQuantity : 0;
                const isSelected = quantity > 0;
                const outOfStock = variant.stock <= 0;

                return (
                  <div
                    key={variant.id}
                    className={`rounded-2xl border px-3 py-3 sm:px-4 ${
                      isSelected
                        ? 'border-[#3D1F0E] bg-[#F5E9DC]'
                        : outOfStock
                          ? 'border-stone-200 bg-stone-50 opacity-60'
                          : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-stone-100 sm:h-16 sm:w-16">
                        {(variant.image || resolvedProductImage) ? (
                          <img
                            src={variant.image || resolvedProductImage}
                            alt={toVariantLabel(variant)}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-semibold text-stone-900">
                            {toVariantLabel(variant)}
                          </p>
                          {isSelected && (
                            <span className="flex-shrink-0 rounded-full bg-[#3D1F0E] px-2 py-0.5 text-[10px] font-semibold text-white">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {outOfStock
                            ? 'Out of stock'
                            : `à§³${variant.price.toLocaleString('bn-BD')} Â· ${variant.stock} available`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <div className="flex items-center rounded-full border border-[#D6C0A9] bg-white">
                        <button
                          type="button"
                          onClick={() => updateSelectedVariantQuantity(variant, quantity - 1)}
                          disabled={quantity <= 0 || submitting}
                          className="flex h-9 w-9 items-center justify-center rounded-l-full text-[#3D1F0E] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-stone-900">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateSelectedVariantQuantity(variant, quantity + 1)}
                          disabled={outOfStock || quantity >= variant.stock || submitting}
                          className="flex h-9 w-9 items-center justify-center rounded-r-full text-[#3D1F0E] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-stone-600">Selected Qty</span>
                  <span className="font-semibold text-stone-900">{selectedQuantity}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-stone-600">Subtotal</span>
                  <span className="font-semibold text-stone-900">
                    {selectedVariant
                      ? `à§³${(selectedVariant.price * selectedQuantity).toLocaleString('bn-BD')}`
                      : 'à§³0'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-3xl bg-[#F7F2EC] px-4 py-3 text-sm text-stone-600">
                {mode === 'decrease'
                  ? 'Decrease quantity or remove a variant from your cart.'
                  : 'Choose which variant to add more of.'}
              </div>

              {actionVariants.map((variant) => {
                const isCurrent = variant.id === (currentVariantId ?? selectedVariantId);
                const delta: 1 | -1 = isCurrent && mode === 'decrease' ? -1 : 1;
                const disableAction = delta === 1 ? variant.stock <= 0 : false;

                return (
                  <div
                    key={variant.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      isCurrent ? 'border-[#3D1F0E] bg-[#F5E9DC]' : 'border-stone-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-stone-100 sm:h-16 sm:w-16">
                        {(variant.image || resolvedProductImage) ? (
                          <img
                            src={variant.image || resolvedProductImage}
                            alt={toVariantLabel(variant)}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-sm font-semibold text-stone-900">
                            {toVariantLabel(variant)}
                          </p>
                          {isCurrent && (
                            <span className="flex-shrink-0 rounded-full bg-[#3D1F0E] px-2 py-0.5 text-[10px] font-semibold text-white">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500">
                          {variant.stock > 0 ? `${variant.stock} available` : 'Out of stock'}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-stone-900">
                          à§³{variant.price.toLocaleString('bn-BD')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        disabled={disableAction || submitting}
                        onClick={() => void handleAdjust(variant, delta)}
                        className={`flex h-10 min-w-10 items-center justify-center rounded-full border px-3 transition sm:w-10 sm:px-0 ${
                          disableAction
                            ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                            : delta === -1
                              ? 'border-[#3D1F0E] bg-white text-[#3D1F0E] hover:bg-[#F5E9DC]'
                              : 'border-[#3D1F0E] bg-[#3D1F0E] text-white hover:bg-[#2A1509]'
                        }`}
                        aria-label={delta === -1 ? `Decrease ${variant.name}` : `Add ${variant.name}`}
                      >
                        {submitting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : delta === -1 ? (
                          <Minus size={14} />
                        ) : (
                          <Plus size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {mode === 'select' && (
          <div className="sticky bottom-0 shrink-0 border-t border-stone-200 bg-white px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-10px_24px_rgba(28,25,23,0.08)] sm:px-5 sm:pb-4">
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!canConfirm}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                canConfirm
                  ? 'bg-[#3D1F0E] text-[#F5E6D3] hover:bg-[#2A1509]'
                  : 'cursor-not-allowed bg-stone-200 text-stone-500'
              }`}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShoppingCart size={16} />
              )}
              Add to Cart
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}
