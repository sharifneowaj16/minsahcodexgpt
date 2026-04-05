'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth, PERMISSIONS } from '@/contexts/AdminAuthContext';
import {
  Search,
  CheckCircle,
  XCircle,
  RefreshCw,
  Eye,
  MessageCircle,
  TrendingUp,
  AlertCircle,
  X,
  ImageIcon,
  Package,
  TriangleAlert,
} from 'lucide-react';
import { clsx } from 'clsx';
import { formatPrice, convertUSDtoBDT } from '@/utils/currency';

interface ReturnRequest {
  id: string;
  dbId?: string;
  orderId: string;
  customer: {
    name: string;
    email: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed';
  refundAmount: number;
  requestDate: string;
  updatedAt: string;
  images?: string[];
  notes?: string;
  paymentStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  paymentMethod?: string;
  paidAt?: string;
  orderCreatedAt?: string;
  orderUpdatedAt?: string;
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  totalRefundAmount: number;
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

interface ConfirmActionState {
  mode: 'single' | 'bulk';
  ids: string[];
  status: ReturnRequest['status'];
  note: string;
  title: string;
  description: string;
  requireNote?: boolean;
}

interface TimelineEvent {
  id: string;
  title: string;
  timestamp?: string;
  description: string;
  tone: 'complete' | 'current' | 'neutral' | 'warning';
}

export default function ReturnsPage() {
  const { hasPermission } = useAdminAuth();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, approved: 0, totalRefundAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [detailStatus, setDetailStatus] = useState<ReturnRequest['status']>('pending');
  const [detailNote, setDetailNote] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkNote, setBulkNote] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionState | null>(null);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/admin/orders/returns?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch returns');
      }

      const data = await res.json();
      setReturns(data.returns || []);
      setStats(data.stats || { total: 0, pending: 0, approved: 0, totalRefundAmount: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (hasPermission(PERMISSIONS.ORDERS_REFUND)) {
      fetchReturns();
    }
  }, [fetchReturns, hasPermission]);

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => returns.some((item) => item.id === id)));
  }, [returns]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!hasPermission(PERMISSIONS.ORDERS_REFUND)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">You don&apos;t have permission to manage returns.</p>
      </div>
    );
  }

  const getStatusColor = (status: ReturnRequest['status']) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTimelineDotClasses = (tone: TimelineEvent['tone']) => {
    switch (tone) {
      case 'complete':
        return 'bg-green-500';
      case 'current':
        return 'bg-purple-600';
      case 'warning':
        return 'bg-amber-500';
      default:
        return 'bg-gray-300';
    }
  };

  const formatDateTime = (value?: string) =>
    value ? new Date(value).toLocaleString() : 'Time unavailable';

  const buildRefundTimeline = (returnRequest: ReturnRequest): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    if (returnRequest.paidAt || returnRequest.paymentStatus === 'completed' || returnRequest.paymentStatus === 'refunded') {
      events.push({
        id: 'payment-captured',
        title: 'Original payment captured',
        timestamp: returnRequest.paidAt || returnRequest.orderCreatedAt,
        description: returnRequest.paymentMethod
          ? `Payment received via ${returnRequest.paymentMethod.replace(/_/g, ' ')}.`
          : 'Original order payment was received.',
        tone: returnRequest.status === 'pending' ? 'complete' : 'complete',
      });
    } else if (returnRequest.orderCreatedAt) {
      events.push({
        id: 'order-created',
        title: 'Order placed',
        timestamp: returnRequest.orderCreatedAt,
        description: 'The original order was created before the refund flow started.',
        tone: 'neutral',
      });
    }

    events.push({
      id: 'return-requested',
      title: 'Return requested',
      timestamp: returnRequest.requestDate,
      description: 'Customer submitted the return request and refund estimate was created.',
      tone: returnRequest.status === 'pending' ? 'current' : 'complete',
    });

    if (returnRequest.status === 'rejected') {
      events.push({
        id: 'return-rejected',
        title: 'Return rejected',
        timestamp: returnRequest.updatedAt,
        description: returnRequest.notes || 'The request was rejected by the admin team.',
        tone: 'warning',
      });
    } else if (returnRequest.status !== 'pending') {
      events.push({
        id: 'admin-reviewed',
        title:
          returnRequest.status === 'approved'
            ? 'Return approved'
            : returnRequest.status === 'processing'
              ? 'Refund in progress'
              : 'Refund completed',
        timestamp: returnRequest.updatedAt,
        description:
          returnRequest.status === 'approved'
            ? returnRequest.notes || 'The return was approved and is ready for the next step.'
            : returnRequest.status === 'processing'
              ? returnRequest.notes || 'The team is actively processing the refund.'
              : returnRequest.notes || 'The refund flow has been completed.',
        tone: returnRequest.status === 'completed' ? 'complete' : 'current',
      });
    }

    if (returnRequest.paymentStatus === 'refunded') {
      events.push({
        id: 'payment-refunded',
        title: 'Payment marked refunded',
        timestamp: returnRequest.orderUpdatedAt || returnRequest.updatedAt,
        description: 'Order payment status is currently marked as refunded.',
        tone: 'complete',
      });
    }

    return events;
  };

  const openReturnDetails = (returnRequest: ReturnRequest) => {
    setSelectedReturn(returnRequest);
    setDetailStatus(returnRequest.status);
    setDetailNote(returnRequest.notes || '');
  };

  const closeReturnDetails = () => {
    setSelectedReturn(null);
    setDetailStatus('pending');
    setDetailNote('');
  };

  const executeSingleUpdate = async (
    returnId: string,
    status: ReturnRequest['status'],
    adminNote?: string
  ) => {
    const res = await fetch(`/api/admin/orders/returns/${returnId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, adminNote }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update return');
    }

    const data = await res.json();

    setReturns((prev) =>
      prev.map((ret) =>
        ret.id === returnId
          ? {
              ...ret,
              status: data.return.status as ReturnRequest['status'],
              notes: data.return.adminNote,
            }
          : ret
      )
    );

    setSelectedReturn((prev) =>
      prev && prev.id === returnId
        ? {
            ...prev,
            status: data.return.status as ReturnRequest['status'],
            notes: data.return.adminNote,
          }
        : prev
    );

    fetchReturns();
    return data;
  };

  const openSingleActionModal = (
    returnId: string,
    status: ReturnRequest['status'],
    note = ''
  ) => {
    const actionLabel = status === 'approved'
      ? 'approve'
      : status === 'rejected'
        ? 'reject'
        : `mark as ${status}`;

    setConfirmAction({
      mode: 'single',
      ids: [returnId],
      status,
      note,
      title: `Confirm ${actionLabel}`,
      description: `This will ${actionLabel} return request ${returnId}.`,
      requireNote: status === 'rejected',
    });
  };

  const handleApprove = (returnId: string) => {
    openSingleActionModal(returnId, 'approved');
  };

  const handleReject = (returnId: string) => {
    openSingleActionModal(returnId, 'rejected');
  };

  const handleSaveDetails = async () => {
    if (!selectedReturn) {
      return;
    }

    setConfirmAction({
      mode: 'single',
      ids: [selectedReturn.id],
      status: detailStatus,
      note: detailNote,
      title: 'Confirm status update',
      description: `Save this decision for return ${selectedReturn.id}.`,
      requireNote: detailStatus === 'rejected',
    });
  };

  const allVisibleSelected = returns.length > 0 && selectedIds.length === returns.length;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(returns.map((item) => item.id));
  };

  const toggleSelected = (returnId: string) => {
    setSelectedIds((prev) =>
      prev.includes(returnId)
        ? prev.filter((id) => id !== returnId)
        : [...prev, returnId]
    );
  };

  const openBulkActionModal = (status: ReturnRequest['status']) => {
    if (selectedIds.length === 0) {
      return;
    }

    setConfirmAction({
      mode: 'bulk',
      ids: selectedIds,
      status,
      note: bulkNote,
      title: `Confirm bulk ${status}`,
      description: `Apply "${status}" to ${selectedIds.length} selected return request${selectedIds.length === 1 ? '' : 's'}.`,
      requireNote: status === 'rejected',
    });
  };

  const executeBulkUpdate = async (
    ids: string[],
    status: ReturnRequest['status'],
    note?: string
  ) => {
    const res = await fetch('/api/admin/orders/returns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ids,
        status,
        adminNote: note?.trim() || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update selected returns');
    }

    const data = await res.json();
    const updatedStatus = data.status as ReturnRequest['status'];
    const updatedIds = new Set<string>(data.ids || ids);

    setReturns((prev) =>
      prev.map((ret) =>
        updatedIds.has(ret.id)
          ? {
              ...ret,
              status: updatedStatus,
              notes: data.adminNote ?? ret.notes,
            }
          : ret
      )
    );

    setSelectedReturn((prev) =>
      prev && updatedIds.has(prev.id)
        ? {
            ...prev,
            status: updatedStatus,
            notes: data.adminNote ?? prev.notes,
          }
        : prev
    );

    setSelectedIds([]);
    setBulkNote('');
    fetchReturns();
    return data;
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    if (confirmAction.requireNote && !confirmAction.note.trim()) {
      setToast({
        type: 'error',
        message: 'A note is required for this action.',
      });
      return;
    }

    if (confirmAction.mode === 'single') {
      setSavingDetail(true);
    } else {
      setBulkUpdating(true);
    }

    try {
      if (confirmAction.mode === 'single') {
        await executeSingleUpdate(
          confirmAction.ids[0],
          confirmAction.status,
          confirmAction.note.trim() || undefined
        );
        setToast({
          type: 'success',
          message: `Return ${confirmAction.ids[0]} marked ${confirmAction.status}.`,
        });
      } else {
        await executeBulkUpdate(
          confirmAction.ids,
          confirmAction.status,
          confirmAction.note.trim() || undefined
        );
        setToast({
          type: 'success',
          message: `${confirmAction.ids.length} return request${confirmAction.ids.length === 1 ? '' : 's'} marked ${confirmAction.status}.`,
        });
      }

      if (confirmAction.mode === 'bulk') {
        setBulkNote('');
      } else {
        setDetailNote(confirmAction.note);
      }

      setConfirmAction(null);
    } catch (err) {
      setToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update return',
      });
    } finally {
      setSavingDetail(false);
      setBulkUpdating(false);
    }
  };

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed right-4 top-4 z-[60]">
          <div
            className={clsx(
              'flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg',
              toast.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            )}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="mt-0.5 h-5 w-5" />
            ) : (
              <TriangleAlert className="mt-0.5 h-5 w-5" />
            )}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Returns &amp; Refunds</h1>
          <p className="text-gray-600">Manage customer return requests and refunds</p>
        </div>
        <button
          onClick={fetchReturns}
          disabled={loading}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
        >
          <RefreshCw className={clsx('w-5 h-5 mr-2', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Returns</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <RefreshCw className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
            </div>
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Refund Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatPrice(convertUSDtoBDT(stats.totalRefundAmount))}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by return ID, order ID, or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-6 rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-purple-900">
                {selectedIds.length} return request{selectedIds.length === 1 ? '' : 's'} selected
              </p>
              <p className="text-sm text-purple-700">
                Apply one status update to all selected requests.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[520px]">
              <input
                type="text"
                value={bulkNote}
                onChange={(event) => setBulkNote(event.target.value)}
                placeholder="Optional bulk note or rejection reason"
                className="w-full rounded-lg border border-purple-200 bg-white px-4 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openBulkActionModal('approved')}
                  disabled={bulkUpdating}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-70"
                >
                  Approve Selected
                </button>
                <button
                  type="button"
                  onClick={() => openBulkActionModal('processing')}
                  disabled={bulkUpdating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
                >
                  Mark Processing
                </button>
                <button
                  type="button"
                  onClick={() => openBulkActionModal('completed')}
                  disabled={bulkUpdating}
                  className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-70"
                >
                  Mark Completed
                </button>
                <button
                  type="button"
                  onClick={() => openBulkActionModal('rejected')}
                  disabled={bulkUpdating}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
                >
                  Reject Selected
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  disabled={bulkUpdating}
                  className="rounded-lg border border-purple-200 bg-white px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-70"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
          <button onClick={fetchReturns} className="mt-2 text-sm text-red-600 underline">
            Try again
          </button>
        </div>
      )}

      {/* Returns Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-8 h-8 text-purple-500 animate-spin" />
            <span className="ml-3 text-gray-500">Loading returns...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      aria-label="Select all visible returns"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Return ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Refund Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {returns.map((returnRequest) => (
                  <tr key={returnRequest.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(returnRequest.id)}
                        onChange={() => toggleSelected(returnRequest.id)}
                        className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        aria-label={`Select return ${returnRequest.id}`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{returnRequest.id}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(returnRequest.requestDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{returnRequest.orderId}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{returnRequest.customer.name}</div>
                      <div className="text-xs text-gray-500">{returnRequest.customer.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{returnRequest.items.length} item(s)</div>
                      {returnRequest.items.map((item, idx) => (
                        <div key={idx} className="text-xs text-gray-500">{item.name}</div>
                      ))}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">{returnRequest.reason}</div>
                      {Boolean(returnRequest.images?.length) && (
                        <div className="mt-1 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          <ImageIcon className="mr-1 h-3 w-3" />
                          {returnRequest.images?.length} photo{returnRequest.images?.length === 1 ? '' : 's'}
                        </div>
                      )}
                      {returnRequest.notes && (
                        <div className="text-xs text-blue-600 italic mt-1">{returnRequest.notes}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatPrice(convertUSDtoBDT(returnRequest.refundAmount))}
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                        getStatusColor(returnRequest.status)
                      )}>
                        {returnRequest.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openReturnDetails(returnRequest)}
                          className="text-purple-600 hover:text-purple-800"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {returnRequest.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleApprove(returnRequest.id)}
                              className="text-green-600 hover:text-green-800"
                              title="Approve"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(returnRequest.id)}
                              className="text-red-600 hover:text-red-800"
                              title="Reject"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <a
                          href={`mailto:${returnRequest.customer.email}?subject=Update on return ${returnRequest.id}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="Message Customer"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {returns.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-gray-500">No return requests found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 p-4">
          <div className="h-full w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-900">{selectedReturn.id}</h2>
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize',
                        getStatusColor(selectedReturn.status)
                      )}
                    >
                      {selectedReturn.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Order {selectedReturn.orderId} for {selectedReturn.customer.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeReturnDetails}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close return details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Customer</p>
                  <p className="mt-2 font-medium text-gray-900">{selectedReturn.customer.name}</p>
                  <p className="text-sm text-gray-600">{selectedReturn.customer.email}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Requested</p>
                  <p className="mt-2 font-medium text-gray-900">
                    {new Date(selectedReturn.requestDate).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Refund</p>
                  <p className="mt-2 font-medium text-gray-900">
                    {formatPrice(convertUSDtoBDT(selectedReturn.refundAmount))}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Return Reason
                </h3>
                <p className="mt-3 text-sm leading-6 text-gray-800">{selectedReturn.reason}</p>
              </div>

              <div className="rounded-xl border border-gray-200 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Package className="h-4 w-4 text-gray-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Returned Items
                  </h3>
                </div>
                <div className="space-y-3">
                  {selectedReturn.items.map((item, index) => (
                    <div
                      key={`${selectedReturn.id}-${item.name}-${index}`}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatPrice(convertUSDtoBDT(item.price * item.quantity))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Evidence Photos
                  </h3>
                  <span className="text-sm text-gray-500">
                    {selectedReturn.images?.length || 0} uploaded
                  </span>
                </div>
                {selectedReturn.images && selectedReturn.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    {selectedReturn.images.map((imageUrl) => (
                      <a
                        key={imageUrl}
                        href={imageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                      >
                        <img
                          src={imageUrl}
                          alt="Return evidence"
                          className="h-32 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                    No evidence photos were uploaded by the customer.
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Refund Timeline
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Derived from current order payment and return timestamps.
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 capitalize">
                    Payment: {selectedReturn.paymentStatus || 'unknown'}
                  </span>
                </div>

                <div className="space-y-5">
                  {buildRefundTimeline(selectedReturn).map((event, index, array) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span
                          className={clsx(
                            'mt-1 h-3 w-3 rounded-full',
                            getTimelineDotClasses(event.tone)
                          )}
                        />
                        {index < array.length - 1 && (
                          <span className="mt-2 h-full w-px bg-gray-200" />
                        )}
                      </div>
                      <div className="pb-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium text-gray-900">{event.title}</h4>
                          <span className="text-xs text-gray-500">
                            {formatDateTime(event.timestamp)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-gray-600">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Admin Decision
                </h3>
                <div className="mt-4 grid gap-4 md:grid-cols-[200px,1fr]">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Status
                    </label>
                    <select
                      value={detailStatus}
                      onChange={(event) =>
                        setDetailStatus(event.target.value as ReturnRequest['status'])
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="processing">Processing</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Internal Note / Customer Reply
                    </label>
                    <textarea
                      rows={4}
                      value={detailNote}
                      onChange={(event) => setDetailNote(event.target.value)}
                      placeholder="Add approval notes, rejection reason, or handling instructions..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveDetails}
                    disabled={savingDetail}
                    className="inline-flex items-center rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-70"
                  >
                    {savingDetail && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                    Save Decision
                  </button>
                  <a
                    href={`mailto:${selectedReturn.customer.email}?subject=Update on return ${selectedReturn.id}`}
                    className="inline-flex items-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Email Customer
                  </a>
                  <a
                    href="/admin/orders"
                    className="inline-flex items-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Open Orders
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{confirmAction.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{confirmAction.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Status will change to <span className="font-semibold capitalize">{confirmAction.status}</span>.
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Note {confirmAction.requireNote ? '(Required)' : '(Optional)'}
                </label>
                <textarea
                  rows={4}
                  value={confirmAction.note}
                  onChange={(event) =>
                    setConfirmAction((prev) =>
                      prev ? { ...prev, note: event.target.value } : prev
                    )
                  }
                  placeholder="Add handling note, rejection reason, or customer-facing context..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                disabled={savingDetail || bulkUpdating}
                className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-70"
              >
                {savingDetail || bulkUpdating ? 'Saving...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
