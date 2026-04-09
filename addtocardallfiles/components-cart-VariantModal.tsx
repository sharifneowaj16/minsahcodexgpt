'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Minus, Plus, X } from 'lucide-react';

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
  return (variants ?? []).map((variant) => ({
    id: variant.id,
    name: variant.name,
    price: variant.price,
    stock: variant.stock,
    sku: variant.sku,
    image: variant.image ?? null,
    attributes: (variant.attributes ?? {}) as Record<string, string>,
  }));
}

function toVariantLabel(variant: VariantOption) {
  return [variant.attributes.size, variant.attributes.color].filter(Boolean).join(' / ') || variant.name;
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
  const [resolvedVariants, setResolvedVariants] = useState<VariantOption[]>(normalizeVariants(variants));
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(currentVariantId ?? null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let active = true;

    const prefetchedVariants = normalizeVariants(variants);
    setResolvedProductName(productName ?? '');
    setResolvedProductImage(productImage ?? '');
    setResolvedVariants(prefetchedVariants);
    setSelectedAttributes({});
    setSelectedVariantId(currentVariantId ?? null);
    setError(null);

    if (prefetchedVariants.length > 0) {
      return;
    }

    const loadProduct = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/products/${productId}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load variants');
        }

        const data = (await response.json()) as ProductResponse;
        if (!active) {
          return;
        }

        setResolvedProductName(data.product.name);
        setResolvedProductImage(data.product.image);
        setResolvedBasePrice(data.product.price);
        setResolvedVariants(
          data.product.variants.map((variant) => ({
            id: variant.id,
            name: variant.name,
            price: variant.price,
            stock: variant.stock,
            sku: variant.sku,
            image: variant.image ?? null,
            attributes: (variant.attributes ?? {}) as Record<string, string>,
          }))
        );
      } catch (fetchError) {
        if (!active) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load variants');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProduct();

    return () => {
      active = false;
    };
  }, [currentVariantId, isOpen, productId, productImage, productName, variants]);

  useEffect(() => {
    if (!isOpen || resolvedBasePrice > 0 || resolvedVariants.length === 0) {
      return;
    }

    const lowestPrice = resolvedVariants.reduce((min, variant) => Math.min(min, variant.price), resolvedVariants[0].price);
    setResolvedBasePrice(lowestPrice);
  }, [isOpen, resolvedBasePrice, resolvedVariants]);

  useEffect(() => {
    if (!isOpen || !currentVariantId || resolvedVariants.length === 0) {
      return;
    }

    const matchedVariant = resolvedVariants.find((variant) => variant.id === currentVariantId);
    if (!matchedVariant) {
      return;
    }

    setSelectedVariantId(matchedVariant.id);
    setSelectedAttributes(
      Object.fromEntries(Object.entries(matchedVariant.attributes).filter(([, value]) => Boolean(value)))
    );
  }, [currentVariantId, isOpen, resolvedVariants]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const attributeKeys = useMemo(() => {
    const keys = new Set<string>();
    resolvedVariants.forEach((variant) => {
      Object.entries(variant.attributes).forEach(([key, value]) => {
        if (value) {
          keys.add(key);
        }
      });
    });
    return [...keys];
  }, [resolvedVariants]);

  const selectedVariant = useMemo(() => {
    if (attributeKeys.length === 0) {
      return resolvedVariants.find((variant) => variant.id === selectedVariantId) ?? null;
    }

    if (attributeKeys.some((key) => !selectedAttributes[key])) {
      return null;
    }

    return (
      resolvedVariants.find((variant) =>
        attributeKeys.every((key) => variant.attributes[key] === selectedAttributes[key])
      ) ?? null
    );
  }, [attributeKeys, resolvedVariants, selectedAttributes, selectedVariantId]);

  const optionsByAttribute = useMemo(() => {
    return attributeKeys.map((attributeKey) => {
      const values = new Map<string, { disabled: boolean }>();

      resolvedVariants.forEach((variant) => {
        const value = variant.attributes[attributeKey];
        if (!value) {
          return;
        }

        const matchesOtherSelections = attributeKeys.every((key) => {
          if (key === attributeKey) {
            return true;
          }

          const selectedValue = selectedAttributes[key];
          return !selectedValue || variant.attributes[key] === selectedValue;
        });

        if (!matchesOtherSelections) {
          return;
        }

        const existing = values.get(value);
        const disabled = variant.stock <= 0;
        values.set(value, {
          disabled: existing ? existing.disabled && disabled : disabled,
        });
      });

      return {
        key: attributeKey,
        options: [...values.entries()].map(([value, meta]) => ({
          value,
          disabled: meta.disabled,
        })),
      };
    });
  }, [attributeKeys, resolvedVariants, selectedAttributes]);

  const actionVariants = useMemo(() => {
    if (mode === 'select') {
      return [];
    }

    const currentId = currentVariantId ?? selectedVariantId;
    return [...resolvedVariants].sort((left, right) => {
      if (left.id === currentId) return -1;
      if (right.id === currentId) return 1;
      return 0;
    });
  }, [currentVariantId, mode, resolvedVariants, selectedVariantId]);

  const canConfirm =
    mode === 'select' &&
    Boolean(selectedVariant && selectedVariant.stock > 0 && !submitting && !loading);

  const modalTitle =
    mode === 'decrease'
      ? 'Update Variants'
      : mode === 'increase'
        ? 'Add Another Variant'
        : 'Select Variant';

  const handleAttributeSelect = (attributeKey: string, value: string) => {
    setSelectedVariantId(null);
    setSelectedAttributes((current) => ({ ...current, [attributeKey]: value }));
  };

  const handleConfirm = async () => {
    if (!selectedVariant || !onConfirm) {
      return;
    }

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
    if (!onAdjust) {
      return;
    }

    setSubmitting(true);
    try {
      await onAdjust({ variant, delta });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 px-4 py-6 sm:items-center">
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
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
            aria-label="Close variant modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-stone-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : resolvedVariants.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No selectable variants are available for this product right now.
            </div>
          ) : mode === 'select' ? (
            <div className="space-y-5">
              {attributeKeys.length === 0 ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                    Options
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {resolvedVariants.map((variant) => {
                      const isSelected = selectedVariantId === variant.id;
                      const outOfStock = variant.stock <= 0;

                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => setSelectedVariantId(variant.id)}
                          disabled={outOfStock}
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                            isSelected
                              ? 'border-[#3D1F0E] bg-[#F5E9DC]'
                              : outOfStock
                                ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                                : 'border-stone-200 hover:border-[#3D1F0E]'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-stone-900">{toVariantLabel(variant)}</p>
                            <p className="mt-1 text-xs text-stone-500">
                              {variant.stock > 0 ? `${variant.stock} available` : 'Out of stock'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-stone-900">
                              ৳{variant.price.toLocaleString('bn-BD')}
                            </span>
                            {isSelected && (
                              <span className="rounded-full bg-[#3D1F0E] p-1 text-white">
                                <Check size={12} />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                optionsByAttribute.map(({ key, options }) => (
                  <div key={key}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
                      {key}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {options.map((option) => {
                        const isSelected = selectedAttributes[key] === option.value;
                        return (
                          <button
                            key={`${key}-${option.value}`}
                            type="button"
                            onClick={() => handleAttributeSelect(key, option.value)}
                            disabled={option.disabled}
                            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                              isSelected
                                ? 'border-[#3D1F0E] bg-[#3D1F0E] text-[#F5E6D3]'
                                : option.disabled
                                  ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400 line-through'
                                  : 'border-stone-300 text-stone-800 hover:border-[#3D1F0E]'
                            }`}
                          >
                            {option.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {selectedVariant && (
                <div className="rounded-3xl bg-[#F7F2EC] p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-stone-100">
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
                      <p className="mt-1 text-xs text-stone-500">
                        {selectedVariant.stock > 0 ? `${selectedVariant.stock} available` : 'Out of stock'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-stone-900">
                      ৳{selectedVariant.price.toLocaleString('bn-BD')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {actionVariants.map((variant) => {
                const isCurrent = variant.id === (currentVariantId ?? selectedVariantId);
                const actionDelta: 1 | -1 = isCurrent && mode === 'decrease' ? -1 : 1;
                const disableAction = actionDelta === 1 ? variant.stock <= 0 : false;

                return (
                  <div
                    key={variant.id}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                      isCurrent ? 'border-[#3D1F0E] bg-[#F5E9DC]' : 'border-stone-200'
                    }`}
                  >
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-stone-100">
                      {(variant.image || resolvedProductImage) ? (
                        <img
                          src={variant.image || resolvedProductImage}
                          alt={resolvedProductName}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {toVariantLabel(variant)}
                        </p>
                        {isCurrent && (
                          <span className="rounded-full bg-[#3D1F0E] px-2 py-0.5 text-[10px] font-semibold text-white">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {variant.stock > 0 ? `${variant.stock} available` : 'Out of stock'}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-stone-900">
                      ৳{variant.price.toLocaleString('bn-BD')}
                    </p>
                    <button
                      type="button"
                      disabled={disableAction || submitting}
                      onClick={() => void handleAdjust(variant, actionDelta)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                        disableAction
                          ? 'cursor-not-allowed border-stone-200 bg-stone-100 text-stone-400'
                          : actionDelta === -1
                            ? 'border-[#3D1F0E] bg-white text-[#3D1F0E] hover:bg-[#F5E9DC]'
                            : 'border-[#3D1F0E] bg-[#3D1F0E] text-white hover:bg-[#2A1509]'
                      }`}
                      aria-label={actionDelta === -1 ? `Decrease ${variant.name}` : `Increase ${variant.name}`}
                    >
                      {submitting ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : actionDelta === -1 ? (
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
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Confirm Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
