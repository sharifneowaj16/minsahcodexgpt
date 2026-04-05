'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { bangladeshLocations } from '@/data/bangladesh-locations';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/utils/currency';
import SocialLoginModal from '@/app/products/[id]/components/SocialLoginModal';

export interface BuyNowVariantOption {
  id: string;
  name: string;
  price: number;
  stock: number;
  image?: string | null;
  attributes: Record<string, string>;
  weight?: number | null;
}

interface BuyNowModalProps {
  isOpen: boolean;
  productId: string;
  productName: string;
  productImage: string;
  basePrice: number;
  baseWeightKg?: number | null;
  variants?: BuyNowVariantOption[];
  initialVariantId?: string | null;
  initialQuantity?: number;
  onClose: () => void;
}

interface SavedAddress {
  id: string;
  firstName: string;
  lastName: string;
  street1: string;
  street2: string | null;
  city: string;
  state: string;
  phone: string | null;
  isDefault: boolean;
}

interface ProductResponse {
  product: {
    id: string;
    name: string;
    image: string;
    price: number;
    weight: number | null;
    variants: Array<{
      id: string;
      name: string;
      price: number;
      stock: number;
      image?: string;
      weight?: number | null;
      attributes?: Record<string, string>;
    }>;
  };
}

interface ShippingFormState {
  name: string;
  phone: string;
  address: string;
  city: string;
  area: string;
}

interface DeliveryResponse {
  deliveryCharge: number;
  message: string | null;
  weights: {
    itemsWeightKg: number;
    packagingWeightKg: number;
    parcelWeightKg: number;
  };
}

type ModalStage = 'select' | 'summary' | 'success';

function toVariantLabel(variant: BuyNowVariantOption) {
  return [variant.attributes.size, variant.attributes.color].filter(Boolean).join(' / ') || variant.name;
}

function formatWeight(weightKg: number) {
  return `${weightKg.toFixed(3).replace(/\.?0+$/, '')}kg`;
}

function clampQuantity(nextQuantity: number, stock: number) {
  return Math.max(0, Math.min(stock, nextQuantity));
}

const districtOptions = bangladeshLocations.flatMap((division) => division.districts);

export default function BuyNowModal({
  isOpen,
  productId,
  productName,
  productImage,
  basePrice,
  baseWeightKg = null,
  variants,
  initialVariantId,
  initialQuantity = 1,
  onClose,
}: BuyNowModalProps) {
  const { user } = useAuth();
  const [stage, setStage] = useState<ModalStage>('select');
  const [loading, setLoading] = useState(false);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [resolvedProductName, setResolvedProductName] = useState(productName);
  const [resolvedProductImage, setResolvedProductImage] = useState(productImage);
  const [resolvedBasePrice, setResolvedBasePrice] = useState(basePrice);
  const [resolvedBaseWeightKg, setResolvedBaseWeightKg] = useState(baseWeightKg);
  const [resolvedVariants, setResolvedVariants] = useState<BuyNowVariantOption[]>(variants ?? []);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [shippingForm, setShippingForm] = useState<ShippingFormState>({
    name: '',
    phone: '',
    address: '',
    city: '',
    area: '',
  });
  const [deliveryState, setDeliveryState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [deliveryCharge, setDeliveryCharge] = useState<number | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState<string | null>(null);
  const [weights, setWeights] = useState<DeliveryResponse['weights'] | null>(null);
  const [successPayload, setSuccessPayload] = useState<{ orderNumber: string; estimatedDelivery: string } | null>(null);

  const hasVariants = resolvedVariants.length > 0;

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    setStage('select');
    setError(null);
    setSubmitting(false);
    setDeliveryState('idle');
    setDeliveryCharge(null);
    setDeliveryMessage(null);
    setWeights(null);
    setSuccessPayload(null);
    setShowLoginModal(false);
    setResolvedProductName(productName);
    setResolvedProductImage(productImage);
    setResolvedBasePrice(basePrice);
    setResolvedBaseWeightKg(baseWeightKg);
    setResolvedVariants(variants ?? []);
    setShippingForm({
      name: user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : '',
      phone: user?.phone ?? '',
      address: '',
      city: '',
      area: '',
    });

    if (variants?.length) {
      const preferredVariant =
        (initialVariantId && variants.find((variant) => variant.id === initialVariantId)) ||
        (variants.length === 1 ? variants[0] : null);
      setSelectedQuantities(preferredVariant ? { [preferredVariant.id]: Math.max(1, initialQuantity) } : {});
    } else {
      setSelectedQuantities({ simple: Math.max(1, initialQuantity) });
    }

    const loadProduct = async () => {
      if (variants?.length) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/products/${productId}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load product details');
        const data = (await response.json()) as ProductResponse;
        if (!active) return;
        setResolvedProductName(data.product.name);
        setResolvedProductImage(data.product.image);
        setResolvedBasePrice(data.product.price);
        setResolvedBaseWeightKg(data.product.weight);
        const fetchedVariants = data.product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          price: variant.price,
          stock: variant.stock,
          image: variant.image ?? null,
          weight: variant.weight ?? data.product.weight,
          attributes: (variant.attributes ?? {}) as Record<string, string>,
        }));
        setResolvedVariants(fetchedVariants);
        if (fetchedVariants.length) {
          const preferredVariant =
            (initialVariantId && fetchedVariants.find((variant) => variant.id === initialVariantId)) ||
            (fetchedVariants.length === 1 ? fetchedVariants[0] : null);
          setSelectedQuantities(preferredVariant ? { [preferredVariant.id]: Math.max(1, initialQuantity) } : {});
        } else {
          setSelectedQuantities({ simple: Math.max(1, initialQuantity) });
        }
      } catch (fetchError) {
        if (active) setError(fetchError instanceof Error ? fetchError.message : 'Failed to load product');
      } finally {
        if (active) setLoading(false);
      }
    };

    const loadAddresses = async () => {
      if (!user) return;
      setAddressesLoading(true);
      try {
        const response = await fetch('/api/addresses', { credentials: 'include', cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { addresses?: SavedAddress[] };
        if (!active) return;
        const preferredAddress = data.addresses?.find((address) => address.isDefault) ?? data.addresses?.[0];
        if (!preferredAddress) return;
        setShippingForm((current) => ({
          name: current.name || [preferredAddress.firstName, preferredAddress.lastName].filter(Boolean).join(' '),
          phone: current.phone || preferredAddress.phone || '',
          address: current.address || preferredAddress.street1,
          city: current.city || preferredAddress.city,
          area: current.area || preferredAddress.street2 || preferredAddress.state || '',
        }));
      } finally {
        if (active) setAddressesLoading(false);
      }
    };

    void Promise.all([loadProduct(), loadAddresses()]);

    return () => {
      active = false;
    };
  }, [basePrice, baseWeightKg, initialQuantity, initialVariantId, isOpen, productId, productImage, productName, user, variants]);

  const areaOptions = useMemo(() => {
    if (!shippingForm.city) return [];
    const district = districtOptions.find((option) => option.name === shippingForm.city);
    if (!district) return [];
    return district.thanas.flatMap((thana) => [thana.name, ...(thana.areas?.map((area) => area.name) ?? [])]);
  }, [shippingForm.city]);

  const selectedItems = useMemo(() => {
    if (hasVariants) {
      return resolvedVariants
        .filter((variant) => (selectedQuantities[variant.id] ?? 0) > 0)
        .map((variant) => {
          const quantity = selectedQuantities[variant.id];
          const unitWeightKg = variant.weight ?? resolvedBaseWeightKg ?? 0.1;
          return {
            key: variant.id,
            productId,
            variantId: variant.id,
            label: toVariantLabel(variant),
            quantity,
            unitPrice: variant.price,
            subtotal: variant.price * quantity,
            unitWeightKg,
            totalWeightKg: unitWeightKg * quantity,
            image: variant.image || resolvedProductImage,
          };
        });
    }

    const quantity = selectedQuantities.simple ?? 0;
    if (quantity <= 0) return [];
    const unitWeightKg = resolvedBaseWeightKg ?? 0.1;
    return [{
      key: 'simple',
      productId,
      variantId: null,
      label: resolvedProductName,
      quantity,
      unitPrice: resolvedBasePrice,
      subtotal: resolvedBasePrice * quantity,
      unitWeightKg,
      totalWeightKg: unitWeightKg * quantity,
      image: resolvedProductImage,
    }];
  }, [hasVariants, productId, resolvedBasePrice, resolvedBaseWeightKg, resolvedProductImage, resolvedProductName, resolvedVariants, selectedQuantities]);

  const subtotal = Number(selectedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const grandTotal = Number((subtotal + (deliveryCharge ?? 0)).toFixed(2));
  const canContinue = selectedItems.length > 0;
  const hasRequiredShippingFields = Boolean(shippingForm.name.trim() && shippingForm.phone.trim() && shippingForm.address.trim() && shippingForm.city.trim() && shippingForm.area.trim());
  const canPlaceOrder = canContinue && hasRequiredShippingFields && !submitting && (deliveryState === 'success' || deliveryState === 'error');

  useEffect(() => {
    if (!isOpen || stage !== 'summary' || !canContinue) return;
    if (!shippingForm.city || !shippingForm.area) {
      setDeliveryState('idle');
      setDeliveryCharge(null);
      setDeliveryMessage(null);
      setWeights(null);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDeliveryState('loading');
      setDeliveryMessage(null);
      try {
        const response = await fetch('/api/buy-now/shipping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city: shippingForm.city,
            area: shippingForm.area,
            items: selectedItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          }),
          signal: controller.signal,
        });
        const data = (await response.json()) as DeliveryResponse | { error?: string };
        if (!active) return;
        if (!response.ok || !('deliveryCharge' in data)) {
          throw new Error('error' in data && data.error ? data.error : 'Delivery charge will be confirmed');
        }
        setDeliveryCharge(data.deliveryCharge);
        setDeliveryState('success');
        setDeliveryMessage(data.message);
        setWeights(data.weights);
      } catch (deliveryError) {
        if (!active || controller.signal.aborted) return;
        setDeliveryCharge(0);
        setWeights(null);
        setDeliveryState('error');
        setDeliveryMessage(deliveryError instanceof Error ? deliveryError.message : 'Delivery charge will be confirmed');
      }
    }, 350);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [canContinue, isOpen, selectedItems, shippingForm.area, shippingForm.city, stage]);

  useEffect(() => {
    if (!isOpen || stage !== 'success' || !successPayload) return;
    const timer = window.setTimeout(() => {
      onClose();
    }, 3500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen, onClose, stage, successPayload]);

  const updateVariantQuantity = (key: string, nextQuantity: number, stock: number) => {
    setSelectedQuantities((current) => ({
      ...current,
      [key]: clampQuantity(nextQuantity, stock),
    }));
  };

  const handleContinue = () => {
    if (canContinue) {
      setStage('summary');
    }
  };

  const placeOrder = async () => {
    if (!canPlaceOrder) return;
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/buy-now/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          items: selectedItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          parcelWeight: weights?.parcelWeightKg ?? selectedItems.reduce((sum, item) => sum + item.totalWeightKg, 0),
          shippingAddress: shippingForm,
          deliveryCharge: deliveryCharge ?? 0,
          subtotal,
          grandTotal,
          paymentMethod: 'COD',
          deliveryPendingConfirmation: deliveryState === 'error',
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        orderNumber?: string;
        estimatedDelivery?: string;
      };

      if (response.status === 401) {
        setShowLoginModal(true);
        return;
      }

      if (!response.ok || !data.orderNumber) {
        throw new Error(data.error || 'Failed to place order');
      }

      setSuccessPayload({
        orderNumber: data.orderNumber,
        estimatedDelivery: data.estimatedDelivery || '2-3 days',
      });
      setStage('success');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSuccess = async () => {
    setShowLoginModal(false);
    try {
      const response = await fetch('/api/addresses', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { addresses?: SavedAddress[] };
      const preferredAddress = data.addresses?.find((address) => address.isDefault) ?? data.addresses?.[0];
      if (!preferredAddress) return;
      setShippingForm((current) => ({
        name: current.name || [preferredAddress.firstName, preferredAddress.lastName].filter(Boolean).join(' '),
        phone: current.phone || preferredAddress.phone || '',
        address: current.address || preferredAddress.street1,
        city: current.city || preferredAddress.city,
        area: current.area || preferredAddress.street2 || preferredAddress.state || '',
      }));
    } catch {
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/55 px-4 py-6 sm:items-center">
        <div className="w-full max-w-2xl overflow-hidden rounded-[30px] bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-stone-200 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                {stage === 'select' ? 'Buy Now' : stage === 'summary' ? 'Order Summary' : 'Order Placed'}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-stone-900">{resolvedProductName}</h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900" aria-label="Close buy now modal">
              <X size={18} />
            </button>
          </div>

          <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-stone-500">
                <Loader2 size={22} className="animate-spin" />
              </div>
            ) : stage === 'select' ? (
              <div className="space-y-4">
                <div className="rounded-3xl bg-[#F7F2EC] p-4 text-sm text-stone-700">
                  Select the variant and quantity you want for this instant order. Your main cart stays untouched.
                </div>

                {hasVariants ? (
                  <div className="space-y-3">
                    {resolvedVariants.map((variant) => {
                      const quantity = selectedQuantities[variant.id] ?? 0;
                      const isCurrent = variant.id === initialVariantId;
                      const isOutOfStock = variant.stock <= 0;
                      return (
                        <div key={variant.id} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${isCurrent ? 'border-[#3D1F0E] bg-[#F5E9DC]' : 'border-stone-200'}`}>
                          <div className="h-14 w-14 overflow-hidden rounded-2xl bg-stone-100">
                            {(variant.image || resolvedProductImage) ? <img src={variant.image || resolvedProductImage} alt={resolvedProductName} className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-stone-900">{toVariantLabel(variant)}</p>
                              {isCurrent ? <span className="rounded-full bg-[#3D1F0E] px-2 py-0.5 text-[10px] font-semibold text-white">Selected</span> : null}
                            </div>
                            <p className="mt-1 text-xs text-stone-500">{formatPrice(variant.price)} · {variant.stock > 0 ? `${variant.stock} available` : 'Out of stock'}</p>
                          </div>
                          <div className="flex items-center rounded-full border border-[#D6C0A9] bg-white">
                            <button type="button" onClick={() => updateVariantQuantity(variant.id, quantity - 1, variant.stock)} disabled={quantity <= 0 || submitting} className="flex h-9 w-9 items-center justify-center rounded-l-full text-[#3D1F0E] disabled:cursor-not-allowed disabled:opacity-35">
                              <Minus size={14} />
                            </button>
                            <span className="min-w-8 text-center text-sm font-semibold text-stone-900">{quantity}</span>
                            <button type="button" onClick={() => updateVariantQuantity(variant.id, quantity + 1, variant.stock)} disabled={isOutOfStock || quantity >= variant.stock || submitting} className="flex h-9 w-9 items-center justify-center rounded-r-full text-[#3D1F0E] disabled:cursor-not-allowed disabled:opacity-35">
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-stone-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-2xl bg-stone-100">
                        {resolvedProductImage ? <img src={resolvedProductImage} alt={resolvedProductName} className="h-full w-full object-cover" /> : null}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-stone-900">{resolvedProductName}</p>
                        <p className="mt-1 text-xs text-stone-500">{formatPrice(resolvedBasePrice)}</p>
                      </div>
                      <div className="flex items-center rounded-full border border-[#D6C0A9] bg-white">
                        <button type="button" onClick={() => setSelectedQuantities((current) => ({ ...current, simple: Math.max(0, (current.simple ?? 0) - 1) }))} disabled={(selectedQuantities.simple ?? 0) <= 0 || submitting} className="flex h-9 w-9 items-center justify-center rounded-l-full text-[#3D1F0E] disabled:cursor-not-allowed disabled:opacity-35">
                          <Minus size={14} />
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-stone-900">{selectedQuantities.simple ?? 0}</span>
                        <button type="button" onClick={() => setSelectedQuantities((current) => ({ ...current, simple: (current.simple ?? 0) + 1 }))} disabled={submitting} className="flex h-9 w-9 items-center justify-center rounded-r-full text-[#3D1F0E] disabled:cursor-not-allowed disabled:opacity-35">
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="flex items-center justify-between text-sm"><span className="text-stone-600">Selected Items</span><span className="font-semibold text-stone-900">{selectedItems.reduce((sum, item) => sum + item.quantity, 0)}</span></div>
                  <div className="mt-2 flex items-center justify-between text-sm"><span className="text-stone-600">Subtotal</span><span className="font-semibold text-stone-900">{formatPrice(subtotal)}</span></div>
                </div>
              </div>
            ) : stage === 'summary' ? (
              <div className="space-y-5">
                <div className="rounded-3xl bg-[#F7F2EC] p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Selected Items</h3>
                    <button type="button" onClick={() => setStage('select')} className="inline-flex items-center gap-1 text-sm font-medium text-[#3D1F0E]"><ArrowLeft size={14} />Back</button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedItems.map((item) => (
                      <div key={item.key} className="flex items-center gap-3">
                        <div className="h-14 w-14 overflow-hidden rounded-2xl bg-stone-100">{item.image ? <img src={item.image} alt={item.label} className="h-full w-full object-cover" /> : null}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-900">{item.label}</p>
                          <p className="mt-1 text-xs text-stone-500">x{item.quantity} · {formatWeight(item.totalWeightKg)}</p>
                        </div>
                        <p className="text-sm font-semibold text-stone-900">{formatPrice(item.subtotal)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm">
                    <div className="flex items-center justify-between"><span className="text-stone-600">Subtotal</span><span className="font-semibold text-stone-900">{formatPrice(subtotal)}</span></div>
                    <div className="flex items-center justify-between"><span className="text-stone-600">Package Weight</span><span className="font-semibold text-stone-900">{weights ? formatWeight(weights.parcelWeightKg) : formatWeight(selectedItems.reduce((sum, item) => sum + item.totalWeightKg, 0))}</span></div>
                    <div className="flex items-center justify-between"><span className="text-stone-600">Delivery Charge</span><span className="font-semibold text-stone-900">{deliveryState === 'loading' ? 'Calculating...' : deliveryState === 'success' ? formatPrice(deliveryCharge ?? 0) : deliveryState === 'error' ? 'Will be confirmed' : 'Select city and area'}</span></div>
                    <div className="flex items-center justify-between border-t border-stone-200 pt-3"><span className="font-semibold text-stone-900">Grand Total</span><span className="text-lg font-bold text-[#3D1F0E]">{deliveryState === 'error' ? `${formatPrice(subtotal)}+` : formatPrice(grandTotal)}</span></div>
                    {deliveryMessage ? <p className={`text-xs ${deliveryState === 'error' ? 'text-amber-700' : 'text-stone-500'}`}>{deliveryMessage}</p> : null}
                  </div>
                </div>

                <div className="rounded-3xl border border-stone-200 p-4">
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Shipping Address</h3>{addressesLoading ? <Loader2 size={14} className="animate-spin text-stone-500" /> : null}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input value={shippingForm.name} onChange={(event) => setShippingForm((current) => ({ ...current, name: event.target.value }))} placeholder="Name" className="rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-[#3D1F0E]" />
                    <input value={shippingForm.phone} onChange={(event) => setShippingForm((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone" className="rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-[#3D1F0E]" />
                    <textarea value={shippingForm.address} onChange={(event) => setShippingForm((current) => ({ ...current, address: event.target.value }))} placeholder="Address" rows={3} className="sm:col-span-2 rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-[#3D1F0E]" />
                    <select value={shippingForm.city} onChange={(event) => setShippingForm((current) => ({ ...current, city: event.target.value, area: '' }))} className="rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-[#3D1F0E]">
                      <option value="">City</option>
                      {districtOptions.map((district) => <option key={district.name} value={district.name}>{district.name}</option>)}
                    </select>
                    <select value={shippingForm.area} onChange={(event) => setShippingForm((current) => ({ ...current, area: event.target.value }))} disabled={!shippingForm.city} className="rounded-2xl border border-stone-200 px-4 py-3 text-sm outline-none transition focus:border-[#3D1F0E] disabled:cursor-not-allowed disabled:bg-stone-100">
                      <option value="">Area</option>
                      {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
                    </select>
                  </div>
                </div>

                <div className="rounded-3xl border border-stone-200 p-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Payment</h3>
                  <div className="mt-3 flex items-center gap-3 rounded-2xl bg-[#F7F2EC] px-4 py-3"><span className="h-3 w-3 rounded-full bg-[#3D1F0E]" /><div><p className="text-sm font-semibold text-stone-900">COD</p><p className="text-xs text-stone-500">Cash on Delivery</p></div></div>
                </div>

                {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700"><CheckCircle2 size={28} /></div>
                <h3 className="mt-4 text-xl font-semibold text-stone-900">Order Placed!</h3>
                <p className="mt-2 text-sm text-stone-600">Order ID: #{successPayload?.orderNumber}</p>
                <p className="mt-1 text-sm text-stone-600">Est. Delivery: {successPayload?.estimatedDelivery}</p>
              </div>
            )}
          </div>

          {stage !== 'success' ? (
            <div className="border-t border-stone-200 px-5 py-4">
              {stage === 'select' ? (
                <button type="button" onClick={handleContinue} disabled={!canContinue || submitting} className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${canContinue ? 'bg-[#3D1F0E] text-[#F5E6D3] hover:bg-[#2A1509]' : 'cursor-not-allowed bg-stone-200 text-stone-500'}`}>
                  <ShoppingBag size={16} />Confirm
                </button>
              ) : (
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStage('select')} className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-stone-300 px-4 py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"><ArrowLeft size={15} />Back</button>
                  <button type="button" onClick={() => void placeOrder()} disabled={!canPlaceOrder} className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${canPlaceOrder ? 'bg-[#3D1F0E] text-[#F5E6D3] hover:bg-[#2A1509]' : 'cursor-not-allowed bg-stone-200 text-stone-500'}`}>
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShoppingBag size={16} />}Place Order
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {showLoginModal ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <SocialLoginModal purpose="checkout" onSuccess={() => void handleLoginSuccess()} onClose={() => setShowLoginModal(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}
