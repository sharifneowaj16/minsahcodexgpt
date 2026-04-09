'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Minus, Plus, ShoppingCart, X } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Reset & optionally fetch product on open
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const prefetched = normalizeVariants(variants);
    setResolvedProductName(productName ?? '');
    setResolvedProductImage(productImage ?? '');
    setResolvedVariants(prefetched);
    setSelectedVariantId(currentVariantId ?? null);
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
        setResolvedVariants(
          data.product.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: v.price,
            stock: v.stock,
            sku: v.sku,
            image: v.image ?? null,
            attributes: (v.attributes ?? {}) as Record<string, string>,
          }))
        );
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

  // Derive base price from variants if not set
  useEffect(() => {
    if (!isOpen || resolvedBasePrice > 0 || resolvedVariants.length === 0) return;
    const lowest = resolvedVariants.reduce(
      (min, v) => Math.min(min, v.price),
      resolvedVariants[0].price
    );
    setResolvedBasePrice(lowest);
  }, [isOpen, resolvedBasePrice, resolvedVariants]);

  // Keyboard close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // For increase/decrease modes — sorted list with current variant first
  const actionVariants = useMemo(() => {
    if (mode === 'select') return [];
    const currentId = currentVariantId ?? selectedVariantId;
    return [...resolvedVariants].sort((a, b) => {
      if (a.id === currentId) return -1;
      if (b.id === currentId) return 1;
      return 0;
    });
  }, [currentVariantId, mode, resolvedVariants, selectedVariantId]);

  const selectedVariant =
    resolvedVariants.find((v) => v.id === selectedVariantId) ?? null;

  const canConfirm =
    mode === 'select' &&
    Boolean(selectedVariant && selectedVariant.stock > 0 && !submitting && !loading);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 px-4 py-6 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-[30px] bg-white shadow-2xl">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
              {modalTitle}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-stone-900">
              {resolvedProductName || productName || 'Product'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">
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
            <div className="space-y-3">
              {/* hint banner */}
              <div className="rounded-3xl bg-[#F7F2EC] px-4 py-3 text-sm text-stone-600">
                Choose a variant to add to your cart.
              </div>

              {/* Variant rows */}
              {resolvedVariants.map((variant) => {
                const isSelected = selectedVariantId === variant.id;
                const outOfStock = variant.stock <= 0;

                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => !outOfStock && setSelectedVariantId(variant.id)}
                    disabled={outOfStock}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? 'border-[#3D1F0E] bg-[#F5E9DC]'
                        : outOfStock
                          ? 'cursor-not-allowed border-stone-200 bg-stone-50 opacity-60'
                          : 'border-stone-200 hover:border-[#3D1F0E] hover:bg-[#FAF5EF]'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-stone-100">
                      {(variant.image || resolvedProductImage) ? (
                        <img
                          src={variant.image || resolvedProductImage}
                          alt={toVariantLabel(variant)}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {toVariantLabel(variant)}
                        </p>
                        {isSelected && (
                          <span className="flex-shrink-0 rounded-full bg-[#3D1F0E] p-0.5 text-white">
                            <Check size={11} />
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {outOfStock ? 'Out of stock' : `${variant.stock} available`}
                      </p>
                    </div>

                    {/* Price */}
                    <p className="flex-shrink-0 text-sm font-semibold text-stone-900">
                      ৳{variant.price.toLocaleString('bn-BD')}
                    </p>
                  </button>
                );
              })}

              {/* Selected variant preview */}
              {selectedVariant && (
                <div className="rounded-3xl bg-[#F7F2EC] p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-stone-100">
                      {(selectedVariant.image || resolvedProductImage) ? (
                        <img
                          src={selectedVariant.image || resolvedProductImage}
                          alt={resolvedProductName}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-900">
                        {toVariantLabel(selectedVariant)}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {selectedVariant.stock} available
                      </p>
                    </div>
                    <p className="flex-shrink-0 text-base font-bold text-[#3D1F0E]">
                      ৳{selectedVariant.price.toLocaleString('bn-BD')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* increase / decrease mode */
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
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                      isCurrent ? 'border-[#3D1F0E] bg-[#F5E9DC]' : 'border-stone-200'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl bg-stone-100">
                      {(variant.image || resolvedProductImage) ? (
                        <img
                          src={variant.image || resolvedProductImage}
                          alt={toVariantLabel(variant)}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-stone-900">
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
                    </div>

                    {/* Price */}
                    <p className="flex-shrink-0 text-sm font-semibold text-stone-900">
                      ৳{variant.price.toLocaleString('bn-BD')}
                    </p>

                    {/* Action button */}
                    <button
                      type="button"
                      disabled={disableAction || submitting}
                      onClick={() => void handleAdjust(variant, delta)}
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition ${
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
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        {mode === 'select' && (
          <div className="border-t border-stone-200 px-5 py-4">
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
}