'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RotateCcw, Search, ChevronRight, Package, Loader2 } from 'lucide-react';
import { formatPrice } from '@/utils/currency';

interface ReturnItem {
  name: string;
  quantity: number;
  price: number;
}

interface ReturnRecord {
  returnId: string;
  id: string;
  orderId: string;
  orderNumber: string;
  status: string;
  reason: string;
  refundAmount: number;
  requestDate: string | Date;
  updatedAt: string | Date;
  images: string[];
  items: ReturnItem[];
}

interface ReturnsClientProps {
  returns: ReturnRecord[];
}

export function ReturnsClient({ returns: initialReturns }: ReturnsClientProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [cancelingReturnId, setCancelingReturnId] = useState<string | null>(null);

  const filteredReturns = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return initialReturns.filter((returnRequest) => {
      const matchesSearch =
        !normalizedSearchTerm ||
        returnRequest.id.toLowerCase().includes(normalizedSearchTerm) ||
        returnRequest.orderNumber.toLowerCase().includes(normalizedSearchTerm) ||
        returnRequest.reason.toLowerCase().includes(normalizedSearchTerm);

      const matchesStatus =
        statusFilter === 'all' || returnRequest.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [initialReturns, searchTerm, statusFilter]);

  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCancelReturn = async (returnRequest: ReturnRecord) => {
    const confirmed = window.confirm(
      `Cancel return request ${returnRequest.id}? You can submit a new request later if needed.`
    );

    if (!confirmed) {
      return;
    }

    setFeedbackMessage('');
    setErrorMessage('');
    setCancelingReturnId(returnRequest.returnId);

    try {
      const response = await fetch(`/api/returns/${returnRequest.returnId}`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel return request');
      }

      setFeedbackMessage(`Return ${returnRequest.id} was cancelled.`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to cancel return request'
      );
    } finally {
      setCancelingReturnId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">My Returns</h1>
        <p className="text-gray-600">Track your return requests and refund progress</p>
      </div>

      {feedbackMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {feedbackMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by return number, order number, or reason..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {filteredReturns.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <RotateCcw className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">No return requests found</h2>
          <p className="text-gray-600 mb-6">
            {searchTerm || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'When you request a return, it will appear here.'}
          </p>
          <Link
            href="/account/orders"
            className="inline-flex items-center rounded-lg bg-purple-600 px-6 py-3 text-sm font-medium text-white hover:bg-purple-700"
          >
            View Orders
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReturns.map((returnRequest) => (
            <div key={returnRequest.id} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-900">{returnRequest.id}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${getStatusClasses(returnRequest.status)}`}>
                      {returnRequest.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Order {returnRequest.orderNumber} - Requested on{' '}
                    {new Date(returnRequest.requestDate).toLocaleDateString()}
                  </p>
                </div>

                <div className="text-left md:text-right">
                  <p className="text-sm text-gray-500">Estimated Refund</p>
                  <p className="text-lg font-bold text-purple-600">
                    {formatPrice(returnRequest.refundAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[2fr,1fr]">
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Reason</h3>
                  <p className="text-sm text-gray-700">{returnRequest.reason}</p>
                  {returnRequest.images.length > 0 && (
                    <p className="mt-2 text-sm text-gray-500">
                      Evidence photos: {returnRequest.images.length}
                    </p>
                  )}

                  <h3 className="text-sm font-medium text-gray-900 mt-5 mb-3">Returned Items</h3>
                  <div className="space-y-3">
                    {returnRequest.items.map((item) => (
                      <div
                        key={`${returnRequest.id}-${item.name}-${item.quantity}`}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                            <Package className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
                  <div className="space-y-3">
                    <Link
                      href={`/account/orders/${returnRequest.orderId}/return`}
                      className="inline-flex w-full items-center justify-between rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View Return Details
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/account/orders/${returnRequest.orderId}`}
                      className="inline-flex w-full items-center justify-between rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      View Original Order
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                    {returnRequest.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => handleCancelReturn(returnRequest)}
                        disabled={cancelingReturnId === returnRequest.returnId}
                        className="inline-flex w-full items-center justify-center rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {cancelingReturnId === returnRequest.returnId && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Cancel Request
                      </button>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Last Updated</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {new Date(returnRequest.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
