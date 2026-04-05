'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatPrice } from '@/utils/currency';
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  Clock,
  Package,
  MapPin,
  FileText,
  Phone,
  Mail,
  RotateCcw,
} from 'lucide-react';

interface OrderDetailClientProps {
  order: any;
  printMode?: boolean;
}

function ProductImage({ src, name }: { src: string | null; name: string }) {
  if (src && (src.startsWith('/') || src.startsWith('http'))) {
    return <img src={src} alt={name} className="h-full w-full rounded-lg object-cover" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-pink-100 to-purple-100 text-xl font-semibold text-purple-600">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function OrderDetailClient({ order, printMode = false }: OrderDetailClientProps) {
  const router = useRouter();

  useEffect(() => {
    if (!printMode) {
      return;
    }

    const timer = window.setTimeout(() => {
      window.print();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [printMode]);

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Order Not Found</h1>
          <p className="text-gray-600 mb-6">The order you're looking for doesn't exist.</p>
          <Link
            href="/account/orders"
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const getTimelineIcon = (status: string, isCompleted: boolean) => {
    const baseClasses = 'w-6 h-6 rounded-full flex items-center justify-center';
    if (isCompleted) {
      return (
        <div className={`${baseClasses} bg-green-500`}>
          <CheckCircle className="w-4 h-4 text-white" />
        </div>
      );
    }

    switch (status) {
      case 'ordered':
        return <div className={`${baseClasses} bg-blue-500`}><Package className="w-3 h-3 text-white" /></div>;
      case 'shipped':
        return <div className={`${baseClasses} bg-purple-500`}><Truck className="w-3 h-3 text-white" /></div>;
      default:
        return <div className={`${baseClasses} bg-gray-300`}><Clock className="w-3 h-3 text-white" /></div>;
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'shipped':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-indigo-100 text-indigo-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (value: string | Date) => new Date(value).toLocaleString();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          {!printMode && (
            <button
              onClick={() => router.back()}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4 transition"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </button>
          )}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Details</h1>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-gray-600">Order {order.orderNumber}</p>
            {printMode && (
              <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
                Invoice Print View
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Status & Timeline</h2>

              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-600">Current Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusBadgeClasses(order.status)}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>
                {order.trackingNumber && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Tracking Number</span>
                      <span className="text-sm text-gray-900">{order.trackingNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Carrier</span>
                      <span className="text-sm text-gray-900">{order.carrier}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {order.tracking.map((event: any, index: number) => (
                  <div key={index} className="flex items-start space-x-4">
                    {getTimelineIcon(event.status, event.completed)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900">{event.description}</h4>
                        <span className="text-sm text-gray-600">{formatDateTime(event.timestamp)}</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {event.location && <MapPin className="w-4 h-4 inline mr-1" />}
                        {event.location}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Items</h2>
              <div className="space-y-4">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex items-center space-x-4 pb-4 border-b last:border-0 last:pb-0">
                    <div className="h-16 w-16 overflow-hidden rounded-lg">
                      <ProductImage src={item.productImage} name={item.productName} />
                    </div>
                    <div className="flex-1">
                      <Link href={`/products/${item.productSlug}`} className="font-medium text-gray-900 hover:text-purple-600">
                        {item.productName}
                      </Link>
                      <p className="text-sm text-gray-600">SKU: {item.sku}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity} x {formatPrice(item.price)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{formatPrice(item.totalPrice)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {order.notes && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Order Notes</h2>
                <p className="text-gray-600">{order.notes}</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Order Summary</h2>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatPrice(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Discount</span>
                    <span className="font-medium text-green-600">-{formatPrice(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium">{formatPrice(order.shipping)}</span>
                </div>
                {order.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">{formatPrice(order.tax)}</span>
                  </div>
                )}
                <div className="border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-purple-600">{formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Payment Information</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Method</span>
                    <span className="font-medium capitalize">{order.paymentMethod.replace('_', ' ')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className={`font-medium ${order.paymentStatus === 'paid' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping Address</h2>
              {order.shippingAddress ? (
                <div className="space-y-2">
                  <p className="font-medium text-gray-900">
                    {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                  </p>
                  <p className="text-gray-600">{order.shippingAddress.addressLine1}</p>
                  {order.shippingAddress.addressLine2 && (
                    <p className="text-gray-600">{order.shippingAddress.addressLine2}</p>
                  )}
                  <p className="text-gray-600">
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                  </p>
                  <p className="text-gray-600">{order.shippingAddress.country}</p>
                  {order.shippingAddress.phone && (
                    <div className="flex items-center text-gray-600">
                      <Phone className="w-4 h-4 mr-2" />
                      {order.shippingAddress.phone}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600">No shipping address available for this order.</p>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions</h2>
              <div className="space-y-3">
                {order.latestReturn && (
                  <Link
                    href={`/account/orders/${order.id}/return`}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-amber-300 bg-amber-50 rounded-lg text-sm font-medium text-amber-800 hover:bg-amber-100 transition"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    View Return {order.latestReturn.status.replace('_', ' ')}
                  </Link>
                )}
                {order.trackingNumber && (
                  <a
                    href={order.steadfastTrackingCode ? `/track?code=${order.steadfastTrackingCode}` : `/track?order=${order.orderNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    <Truck className="w-4 h-4 mr-2" />
                    Track Package
                  </a>
                )}
                <button
                  onClick={() => window.print()}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download Invoice
                </button>
                {(order.status === 'delivered' || order.status === 'shipped') && !order.latestReturn && (
                  <Link
                    href={`/account/orders/${order.id}/return`}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  >
                    Return/Exchange
                  </Link>
                )}
                <button className="w-full inline-flex items-center justify-center px-4 py-2 border border-purple-600 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
