'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, RotateCcw, Upload, X } from 'lucide-react';
import { formatPrice } from '@/utils/currency';

interface ReturnableItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  quantity: number;
  price: number;
  totalPrice: number;
  sku: string;
}

interface ExistingReturn {
  id: string;
  returnNumber: string;
  status: string;
  reason: string;
  refundAmount: number;
  requestDate: string | Date;
  images: string[];
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

interface UploadedEvidenceImage {
  key: string;
  url: string;
}

interface ReturnRequestClientProps {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string | Date;
    items: ReturnableItem[];
    latestReturn: ExistingReturn | null;
  };
}

const RETURN_REASON_PRESETS = [
  'Damaged item',
  'Wrong product received',
  'Missing item',
  'Quality issue',
  'Item arrived leaked or opened',
  'Changed my mind',
];

const MAX_RETURN_IMAGES = 4;

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  if (src && (src.startsWith('/') || src.startsWith('http'))) {
    return <img src={src} alt={alt} className="h-full w-full object-cover" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100 text-lg font-semibold text-purple-600">
      {alt.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ReturnRequestClient({ order }: ReturnRequestClientProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [evidenceImages, setEvidenceImages] = useState<UploadedEvidenceImage[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const selectedCount = Object.keys(selectedItems).length;
  const estimatedRefund = useMemo(
    () =>
      order.items.reduce((sum, item) => {
        const qty = selectedItems[item.id] ?? 0;
        return sum + qty * item.price;
      }, 0),
    [order.items, selectedItems]
  );

  const toggleItem = (item: ReturnableItem) => {
    setSelectedItems((prev) => {
      if (prev[item.id]) {
        const next = { ...prev };
        delete next[item.id];
        return next;
      }

      return {
        ...prev,
        [item.id]: item.quantity,
      };
    });
  };

  const setItemQuantity = (itemId: string, quantity: number) => {
    setSelectedItems((prev) => {
      if (quantity <= 0) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }

      return {
        ...prev,
        [itemId]: quantity,
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedCount === 0) {
      setErrorMessage('Select at least one item to continue.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('Please tell us why you want to return these items.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          reason: reason.trim(),
          images: evidenceImages.map((image) => image.url),
          items: Object.entries(selectedItems).map(([orderItemId, quantity]) => ({
            orderItemId,
            quantity,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit return request');
      }

      router.push(`/account/orders/${order.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to submit return request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvidenceUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const remainingSlots = MAX_RETURN_IMAGES - evidenceImages.length;
    if (remainingSlots <= 0) {
      setErrorMessage(`You can upload up to ${MAX_RETURN_IMAGES} images.`);
      event.target.value = '';
      return;
    }

    setErrorMessage('');
    setIsUploadingImages(true);

    try {
      const filesToUpload = files.slice(0, remainingSlots);
      const uploadedImages: UploadedEvidenceImage[] = [];

      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/returns/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }

        uploadedImages.push({
          key: data.key,
          url: data.url,
        });
      }

      setEvidenceImages((prev) => [...prev, ...uploadedImages]);

      if (files.length > remainingSlots) {
        setErrorMessage(`Only the first ${remainingSlots} image(s) were uploaded.`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to upload images');
    } finally {
      setIsUploadingImages(false);
      event.target.value = '';
    }
  };

  const removeEvidenceImage = async (image: UploadedEvidenceImage) => {
    setErrorMessage('');

    try {
      const response = await fetch(
        `/api/returns/upload?key=${encodeURIComponent(image.key)}`,
        {
          method: 'DELETE',
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove image');
      }

      setEvidenceImages((prev) => prev.filter((item) => item.key !== image.key));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to remove image');
    }
  };

  const handleCancelReturn = async () => {
    if (!order.latestReturn) {
      return;
    }

    const confirmed = window.confirm(
      `Cancel return request ${order.latestReturn.returnNumber}?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage('');
    setIsCanceling(true);

    try {
      const response = await fetch(`/api/returns/${order.latestReturn.id}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel return request');
      }

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to cancel return request'
      );
    } finally {
      setIsCanceling(false);
    }
  };

  const canCancelExistingReturn = order.latestReturn?.status === 'pending';

  if (order.latestReturn) {
    return (
      <div className="space-y-6">
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Return Request</h1>
            <p className="text-gray-600">Order {order.orderNumber}</p>
          </div>
          <Link
            href={`/account/orders/${order.id}`}
            className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Order
          </Link>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900">
                Return already requested
              </h2>
              <p className="text-sm text-amber-800">
                Return #{order.latestReturn.returnNumber} is currently {order.latestReturn.status.replace('_', ' ')}.
              </p>
              <p className="text-sm text-amber-800">
                Requested on {new Date(order.latestReturn.requestDate).toLocaleDateString()} with estimated refund {formatPrice(order.latestReturn.refundAmount)}.
              </p>
              <p className="text-sm text-amber-800">Reason: {order.latestReturn.reason}</p>
              {canCancelExistingReturn && (
                <p className="text-sm text-amber-800">
                  You can still cancel this pending request and submit a new one from this page.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Requested Items</h2>
          <div className="space-y-4">
            {order.latestReturn.items.map((item) => (
              <div key={`${item.name}-${item.quantity}`} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                </div>
                <p className="font-medium text-gray-900">{formatPrice(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </div>

        {order.latestReturn.images.length > 0 && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Uploaded Photos</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {order.latestReturn.images.map((imageUrl) => (
                <div key={imageUrl} className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <img src={imageUrl} alt="Return evidence" className="h-32 w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {canCancelExistingReturn && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCancelReturn}
              disabled={isCanceling}
              className="inline-flex items-center rounded-lg border border-red-200 px-6 py-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isCanceling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Request
            </button>
            <Link
              href="/account/returns"
              className="inline-flex items-center rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View All Returns
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Request Return</h1>
          <p className="text-gray-600">Order {order.orderNumber}</p>
        </div>
        <Link
          href={`/account/orders/${order.id}`}
          className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Order
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-purple-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Choose items to return</h2>
              <p className="text-sm text-gray-600">Select full or partial quantities from this order.</p>
            </div>
          </div>

          <div className="space-y-4">
            {order.items.map((item) => {
              const isSelected = Boolean(selectedItems[item.id]);
              const selectedQuantity = selectedItems[item.id] ?? 0;

              return (
                <div key={item.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItem(item)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <div className="h-16 w-16 overflow-hidden rounded-lg bg-gray-100">
                      <ProductImage src={item.productImage} alt={item.productName} />
                    </div>
                    <div className="flex-1">
                      <Link href={`/products/${item.productSlug}`} className="font-medium text-gray-900 hover:text-purple-600">
                        {item.productName}
                      </Link>
                      <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                      <p className="text-sm text-gray-600">
                        Ordered: {item.quantity} x {formatPrice(item.price)}
                      </p>

                      {isSelected && (
                        <div className="mt-3 flex items-center gap-3">
                          <label className="text-sm font-medium text-gray-700">Return Qty</label>
                          <input
                            type="number"
                            min={1}
                            max={item.quantity}
                            value={selectedQuantity}
                            onChange={(event) =>
                              setItemQuantity(
                                item.id,
                                Math.min(item.quantity, Number(event.target.value) || 0)
                              )
                            }
                            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-500">
                            Refund: {formatPrice(selectedQuantity * item.price)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Reason for return</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {RETURN_REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className={`rounded-full border px-3 py-2 text-sm transition ${
                  reason === preset
                    ? 'border-purple-600 bg-purple-50 text-purple-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <textarea
            rows={5}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Tell us what went wrong, for example damaged item, wrong product, or quality issue."
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />

          <div className="mt-6 rounded-lg border border-dashed border-gray-300 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Upload photos</h3>
                <p className="text-sm text-gray-600">
                  Add up to {MAX_RETURN_IMAGES} photos to show damage, leakage, or the wrong item.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <Upload className="mr-2 h-4 w-4" />
                {isUploadingImages ? 'Uploading...' : 'Add Photos'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleEvidenceUpload}
                  disabled={isUploadingImages || evidenceImages.length >= MAX_RETURN_IMAGES}
                  className="hidden"
                />
              </label>
            </div>

            {evidenceImages.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {evidenceImages.map((image, index) => (
                  <div key={image.key} className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    <img
                      src={image.url}
                      alt={`Return evidence ${index + 1}`}
                      className="h-28 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeEvidenceImage(image)}
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-gray-700 shadow-sm hover:bg-white"
                      aria-label={`Remove evidence image ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-lg bg-gray-50 p-4">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Selected items</span>
              <span>{selectedCount}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-medium text-gray-900">Estimated refund</span>
              <span className="text-lg font-bold text-purple-600">{formatPrice(estimatedRefund)}</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-70"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Return Request
            </button>
            <Link
              href={`/account/orders/${order.id}`}
              className="inline-flex items-center rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
