'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { clsx } from 'clsx';
import {
  AlertTriangle,
  CheckCircle,
  Eye,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  Star,
  Truck,
  X,
} from 'lucide-react';
import { useAdminAuth, PERMISSIONS } from '@/contexts/AdminAuthContext';
import {
  useAdminInventory,
  type AdminInventoryItem,
} from '@/contexts/AdminInventoryContext';
import { convertUSDtoBDT, formatPrice } from '@/utils/currency';

type InventoryTab = 'inventory' | 'shortlist' | 'suppliers' | 'purchase-orders';
type AdjustAction = 'add' | 'remove' | 'set' | 'reorder';

interface StockModalState {
  item: AdminInventoryItem | null;
  ids: string[];
  action: AdjustAction | null;
  amount: string;
}

const QUICK_AMOUNTS = [5, 10, 25, 50];

export default function InventoryPage() {
  const { hasPermission } = useAdminAuth();
  const canEdit = hasPermission(PERMISSIONS.PRODUCTS_EDIT);
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as InventoryTab) || 'inventory';
  const [activeTab, setActiveTab] = useState<InventoryTab>(initialTab);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailItem, setDetailItem] = useState<AdminInventoryItem | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [stockModal, setStockModal] = useState<StockModalState>({ item: null, ids: [], action: null, amount: '' });
  const [saving, setSaving] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [purchaseOrderModalOpen, setPurchaseOrderModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', paymentTerms: '', notes: '' });
  const [purchaseOrderForm, setPurchaseOrderForm] = useState({
    supplierId: '',
    notes: '',
    shippingCost: '0',
    taxAmount: '0',
    items: [{ productId: '', quantity: '1', unitCost: '' }],
  });

  const {
    inventory,
    shortlist,
    suppliers,
    purchaseOrders,
    categories,
    stats,
    filters,
    setFilters,
    loading,
    refreshing,
    error,
    refreshWorkspace,
    adjustInventory,
    updateShortlist,
    createSupplier,
    createPurchaseOrder,
    receivePurchaseOrder,
  } = useAdminInventory();

  const allVisibleSelected = inventory.length > 0 && selectedIds.length === inventory.length;
  const lowStockVisible = inventory.filter((item) => item.status === 'low_stock' || item.status === 'out_of_stock').length;
  const selectedSupplier = useMemo(() => suppliers.find((supplier) => supplier.id === purchaseOrderForm.supplierId) || null, [purchaseOrderForm.supplierId, suppliers]);
  const purchaseOrderTotal = useMemo(() => purchaseOrderForm.items.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitCost) || 0)), 0) + (Number(purchaseOrderForm.shippingCost) || 0) + (Number(purchaseOrderForm.taxAmount) || 0), [purchaseOrderForm]);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  };

  const openSingleModal = (item: AdminInventoryItem, action: AdjustAction) => {
    setStockModal({
      item,
      ids: [item.id],
      action,
      amount: action === 'set' ? String(item.currentStock) : action === 'reorder' ? String(item.reorderLevel) : '',
    });
  };

  const openBulkModal = (action: AdjustAction) => {
    if (!selectedIds.length) return;
    setStockModal({ item: null, ids: selectedIds, action, amount: '' });
  };

  const closeStockModal = () => {
    setStockModal({ item: null, ids: [], action: null, amount: '' });
  };

  const handleAdjustInventory = async () => {
    if (!stockModal.action || !stockModal.ids.length) return;
    const parsed = parseInt(stockModal.amount, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      showToast('error', 'Valid quantity din.');
      return;
    }
    setSaving(true);
    try {
      await adjustInventory({
        ids: stockModal.ids,
        action: stockModal.action,
        amount: stockModal.action === 'add' || stockModal.action === 'remove' ? parsed : undefined,
        quantity: stockModal.action === 'set' ? parsed : undefined,
        reorderLevel: stockModal.action === 'reorder' ? parsed : undefined,
      });
      showToast('success', 'Inventory update successful.');
      closeStockModal();
      setSelectedIds([]);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Inventory update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleShortlist = async (item: AdminInventoryItem) => {
    try {
      await updateShortlist({ productId: item.id, action: item.shortlisted ? 'remove' : 'add', priority: item.shortlisted ? 0 : 1 });
      showToast('success', item.shortlisted ? 'Shortlist theke remove kora hoyeche.' : 'Shortlist-e add kora hoyeche.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Shortlist update failed');
    }
  };

  const handleCreateSupplier = async () => {
    if (!supplierForm.name.trim()) {
      showToast('error', 'Supplier name lagbe.');
      return;
    }
    setSaving(true);
    try {
      await createSupplier(supplierForm);
      setSupplierModalOpen(false);
      setSupplierForm({ code: '', name: '', contactPerson: '', email: '', phone: '', address: '', paymentTerms: '', notes: '' });
      showToast('success', 'Supplier create hoyeche.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Supplier create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePurchaseOrder = async () => {
    if (!purchaseOrderForm.supplierId) {
      showToast('error', 'Supplier select korun.');
      return;
    }
    const normalizedItems = purchaseOrderForm.items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity), unitCost: Number(item.unitCost) })).filter((item) => item.productId && item.quantity > 0 && item.unitCost >= 0);
    if (!normalizedItems.length) {
      showToast('error', 'At least one valid purchase item lagbe.');
      return;
    }
    setSaving(true);
    try {
      await createPurchaseOrder({
        supplierId: purchaseOrderForm.supplierId,
        notes: purchaseOrderForm.notes,
        shippingCost: Number(purchaseOrderForm.shippingCost) || 0,
        taxAmount: Number(purchaseOrderForm.taxAmount) || 0,
        items: normalizedItems,
      });
      setPurchaseOrderModalOpen(false);
      setPurchaseOrderForm({ supplierId: '', notes: '', shippingCost: '0', taxAmount: '0', items: [{ productId: '', quantity: '1', unitCost: '' }] });
      setActiveTab('purchase-orders');
      showToast('success', 'Purchase order create hoyeche.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Purchase order create failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReceivePurchaseOrder = async (purchaseOrderId: string) => {
    setSaving(true);
    try {
      await receivePurchaseOrder(purchaseOrderId);
      showToast('success', 'Stock receive hoyeche, inventory realtime update hoye গেছে.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Receive failed');
    } finally {
      setSaving(false);
    }
  };

  if (!hasPermission(PERMISSIONS.PRODUCTS_VIEW)) {
    return <div className="flex h-64 items-center justify-center"><p className="text-gray-500">You don&apos;t have permission to view inventory.</p></div>;
  }

  return (
    <div className="p-6">
      {toast && (
        <div className="fixed right-4 top-4 z-[60]">
          <div className={clsx('flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg', toast.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800')}>
            {toast.type === 'success' ? <CheckCircle className="mt-0.5 h-5 w-5" /> : <AlertTriangle className="mt-0.5 h-5 w-5" />}
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Workspace</h1>
          <p className="text-gray-600">Realtime stock, supplier, shortlist, and purchase-rate control in one place.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setSupplierModalOpen(true)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Supplier Add</button>
          <button type="button" onClick={() => setPurchaseOrderModalOpen(true)} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700">Purchase Order</button>
          <button type="button" onClick={() => refreshWorkspace(true)} disabled={refreshing} className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={clsx('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SummaryCard title="Inventory Value" value={formatPrice(convertUSDtoBDT(stats.totalValue))} />
        <SummaryCard title="Products" value={String(stats.totalProducts)} />
        <SummaryCard title="Low Stock" value={String(stats.lowStockCount)} tone="warning" />
        <SummaryCard title="Out of Stock" value={String(stats.outOfStockCount)} tone="danger" />
        <SummaryCard title="Overstocked" value={String(stats.overstockedCount)} tone="info" />
        <SummaryCard title="Shortlist" value={String(stats.shortlistCount)} tone="accent" />
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {(['inventory', 'shortlist', 'suppliers', 'purchase-orders'] as InventoryTab[]).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={clsx('rounded-full px-4 py-2 text-sm font-medium capitalize', activeTab === tab ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50')}>
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === 'inventory' && (
        <>
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input value={filters.search} onChange={(event) => setFilters({ search: event.target.value })} placeholder="Search by product, SKU, brand, category..." className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-transparent focus:ring-2 focus:ring-purple-500" />
              </div>
              <select value={filters.status} onChange={(event) => setFilters({ status: event.target.value })} className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500">
                <option value="all">All Status</option><option value="in_stock">In Stock</option><option value="low_stock">Low Stock</option><option value="out_of_stock">Out of Stock</option><option value="overstocked">Overstocked</option>
              </select>
              <select value={filters.category} onChange={(event) => setFilters({ category: event.target.value })} className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500">
                <option value="all">All Categories</option>
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <select value={filters.sort} onChange={(event) => setFilters({ sort: event.target.value })} className="rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500">
                <option value="stock">Stock Level</option><option value="lowStock">Low Stock Priority</option><option value="value">Value</option><option value="updated">Recently Updated</option><option value="name">Name</option>
              </select>
              <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700"><span className="font-semibold text-gray-900">{inventory.length}</span> visible items, <span className="font-semibold text-red-600">{lowStockVisible}</span> urgent.</div>
              <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Supplier-linked products: <span className="font-semibold">{inventory.filter((item) => item.supplierCount > 0).length}</span></div>
            </div>
          </div>

          {canEdit && selectedIds.length > 0 && (
            <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-purple-900">{selectedIds.length} products selected</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openBulkModal('add')} className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-green-700">Bulk Add</button>
                  <button type="button" onClick={() => openBulkModal('remove')} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700">Bulk Remove</button>
                  <button type="button" onClick={() => openBulkModal('set')} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700">Set Qty</button>
                  <button type="button" onClick={() => openBulkModal('reorder')} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-700">Set Reorder</button>
                  <button type="button" onClick={() => setSelectedIds([])} className="rounded-lg px-3 py-2 text-sm text-purple-700">Clear</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {activeTab === 'inventory' && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  {canEdit && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? [] : inventory.map((item) => item.id))} /></th>}
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Purchase Snapshot</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {loading ? Array.from({ length: 6 }).map((_, index) => <tr key={index}><td colSpan={6} className="px-4 py-4"><div className="h-4 animate-pulse rounded bg-gray-200" /></td></tr>) : inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {canEdit && <td className="px-4 py-4"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id])} /></td>}
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => handleToggleShortlist(item)} className={clsx('mt-1', item.shortlisted ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500')}>
                          <Star className={clsx('h-5 w-5', item.shortlisted && 'fill-current')} />
                        </button>
                        <div>
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          <p className="text-xs text-gray-500">{item.sku} / {item.brand} / {item.category}</p>
                          <p className="mt-1 text-xs text-gray-500">Updated {new Date(item.updatedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <p className="font-medium text-gray-900">{item.preferredSupplierName || item.lastSupplierName || 'No supplier yet'}</p>
                      <p className="text-xs text-gray-500">Last rate: {item.lastPurchaseRate === null ? 'N/A' : formatPrice(convertUSDtoBDT(item.lastPurchaseRate))}</p>
                      <p className="text-xs text-gray-500">Lowest: {item.lowestPurchaseRate === null ? 'N/A' : `${formatPrice(convertUSDtoBDT(item.lowestPurchaseRate))} (${item.lowestSupplierName || 'Unknown'})`}</p>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <p className="font-semibold text-gray-900">{item.currentStock}</p>
                      <p className="text-xs text-gray-500">Reorder {item.reorderLevel}</p>
                      <span className={clsx('mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize', item.status === 'out_of_stock' ? 'bg-red-100 text-red-700' : item.status === 'low_stock' ? 'bg-yellow-100 text-yellow-700' : item.status === 'overstocked' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700')}>{item.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <p className="text-gray-900">{item.costPrice === null ? 'Not set' : formatPrice(convertUSDtoBDT(item.costPrice))}</p>
                      <p className="text-xs text-gray-500">Last buy {item.lastPurchaseDate ? new Date(item.lastPurchaseDate).toLocaleDateString() : 'N/A'}</p>
                      <p className="text-xs text-gray-500">Supplier count {item.supplierCount}</p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setDetailItem(item)} className="text-purple-600 hover:text-purple-800"><Eye className="h-4 w-4" /></button>
                        {canEdit && <>
                          <button type="button" onClick={() => openSingleModal(item, 'add')} className="text-green-600 hover:text-green-800"><Plus className="h-4 w-4" /></button>
                          <button type="button" onClick={() => openSingleModal(item, 'remove')} className="text-red-600 hover:text-red-800"><Minus className="h-4 w-4" /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'shortlist' && (
        <div className="grid gap-4">
          {shortlist.map((item) => (
            <div key={item.shortlistId} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 fill-current text-amber-500" />
                    <h3 className="font-semibold text-gray-900">{item.productName}</h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{item.sku} / {item.brand} / {item.category}</p>
                  <p className="mt-2 text-sm text-gray-700">{item.note || 'No shortlist note yet.'}</p>
                </div>
                <div className="text-sm text-gray-600">
                  <p>Priority: {item.priority}</p>
                  <p>Stock: {item.currentStock}</p>
                  <p>Status: {item.status.replace(/_/g, ' ')}</p>
                </div>
              </div>
            </div>
          ))}
          {!shortlist.length && <EmptyState title="Shortlist empty" description="Inventory row-er star button diye shortlist build korte parben." />}
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {suppliers.map((supplier) => (
            <div key={supplier.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-semibold text-gray-900">{supplier.name}</h3><p className="text-sm text-gray-500">{supplier.code}</p></div>
                <span className={clsx('rounded-full px-3 py-1 text-xs font-medium', supplier.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>{supplier.isActive ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-gray-600">
                <p>Contact: {supplier.contactPerson || 'N/A'}</p>
                <p>Email: {supplier.email || 'N/A'}</p>
                <p>Phone: {supplier.phone || 'N/A'}</p>
                <p>Payment Terms: {supplier.paymentTerms || 'N/A'}</p>
                <p>Products: {supplier.productCount} / PO: {supplier.purchaseOrderCount}</p>
              </div>
            </div>
          ))}
          {!suppliers.length && <EmptyState title="No suppliers yet" description="Supplier create korle procurement history live track hobe." />}
        </div>
      )}

      {activeTab === 'purchase-orders' && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">PO</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Amounts</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {purchaseOrders.map((po) => (
                  <tr key={po.id}>
                    <td className="px-4 py-4 text-sm"><p className="font-medium text-gray-900">{po.orderNumber}</p><p className="text-xs text-gray-500">{po.itemCount} items / {po.receivedUnits} received</p></td>
                    <td className="px-4 py-4 text-sm text-gray-700">{po.supplier.name} ({po.supplier.code})</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{formatPrice(convertUSDtoBDT(po.totalAmount))}</td>
                    <td className="px-4 py-4 text-sm"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">{po.status.replace(/_/g, ' ')}</span></td>
                    <td className="px-4 py-4">{po.status !== 'RECEIVED' && <button type="button" onClick={() => handleReceivePurchaseOrder(po.id)} className="inline-flex items-center rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"><Truck className="mr-2 h-4 w-4" />Receive</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!purchaseOrders.length && <EmptyState title="No purchase orders yet" description="Create purchase order korle receive flow diye stock realtime update হবে." />}
        </div>
      )}

      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 p-4">
          <div className="h-full w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div><h2 className="text-xl font-bold text-gray-900">{detailItem.productName}</h2><p className="text-sm text-gray-500">{detailItem.sku} / {detailItem.brand}</p></div>
              <button type="button" onClick={() => setDetailItem(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailCard label="Current Stock" value={String(detailItem.currentStock)} />
              <DetailCard label="Reorder Level" value={String(detailItem.reorderLevel)} />
              <DetailCard label="Last Purchase Rate" value={detailItem.lastPurchaseRate === null ? 'N/A' : formatPrice(convertUSDtoBDT(detailItem.lastPurchaseRate))} />
              <DetailCard label="Last Purchase Supplier" value={detailItem.lastSupplierName || 'N/A'} />
              <DetailCard label="Last Purchase Date" value={detailItem.lastPurchaseDate ? new Date(detailItem.lastPurchaseDate).toLocaleDateString() : 'N/A'} />
              <DetailCard label="Lowest Purchase Rate" value={detailItem.lowestPurchaseRate === null ? 'N/A' : formatPrice(convertUSDtoBDT(detailItem.lowestPurchaseRate))} />
              <DetailCard label="Lowest Rate Supplier" value={detailItem.lowestSupplierName || 'N/A'} />
              <DetailCard label="Lowest Rate Date" value={detailItem.lowestPurchaseDate ? new Date(detailItem.lowestPurchaseDate).toLocaleDateString() : 'N/A'} />
            </div>
            <div className="mt-6 rounded-xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">Inventory shortlist</p>
              <p className="mt-2 text-sm text-gray-600">{detailItem.shortlisted ? detailItem.shortlistNote || 'Shortlisted, note not set yet.' : 'Ei product ekhono shortlist-e nei.'}</p>
              <div className="mt-4"><Link href={`/admin/products/${detailItem.id}/edit`} className="text-sm font-medium text-purple-700 hover:underline">Open product edit</Link></div>
            </div>
          </div>
        </div>
      )}

      {stockModal.action && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-6 py-4"><h3 className="text-lg font-bold text-gray-900">{stockModal.item ? stockModal.item.productName : `${stockModal.ids.length} products`} / {stockModal.action}</h3></div>
            <div className="space-y-4 px-6 py-5">
              <input type="number" min="0" value={stockModal.amount} onChange={(event) => setStockModal((prev) => ({ ...prev, amount: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:border-transparent focus:ring-2 focus:ring-purple-500" />
              <div className="flex flex-wrap gap-2">{QUICK_AMOUNTS.map((value) => <button key={value} type="button" onClick={() => setStockModal((prev) => ({ ...prev, amount: String(value) }))} className="rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">{value}</button>)}</div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button type="button" onClick={closeStockModal} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={handleAdjustInventory} disabled={saving} className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {supplierModalOpen && (
        <SimpleModal title="Create Supplier" onClose={() => setSupplierModalOpen(false)} onSubmit={handleCreateSupplier} saving={saving}>
          <TwoColInput label="Code" value={supplierForm.code} onChange={(value) => setSupplierForm((prev) => ({ ...prev, code: value }))} />
          <TwoColInput label="Name" value={supplierForm.name} onChange={(value) => setSupplierForm((prev) => ({ ...prev, name: value }))} required />
          <TwoColInput label="Contact" value={supplierForm.contactPerson} onChange={(value) => setSupplierForm((prev) => ({ ...prev, contactPerson: value }))} />
          <TwoColInput label="Email" value={supplierForm.email} onChange={(value) => setSupplierForm((prev) => ({ ...prev, email: value }))} />
          <TwoColInput label="Phone" value={supplierForm.phone} onChange={(value) => setSupplierForm((prev) => ({ ...prev, phone: value }))} />
          <TwoColInput label="Payment Terms" value={supplierForm.paymentTerms} onChange={(value) => setSupplierForm((prev) => ({ ...prev, paymentTerms: value }))} />
        </SimpleModal>
      )}

      {purchaseOrderModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div><h3 className="text-lg font-bold text-gray-900">Create Purchase Order</h3><p className="text-sm text-gray-500">{selectedSupplier ? `${selectedSupplier.name} (${selectedSupplier.code})` : 'Select supplier first'}</p></div>
              <button type="button" onClick={() => setPurchaseOrderModalOpen(false)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <select value={purchaseOrderForm.supplierId} onChange={(event) => setPurchaseOrderForm((prev) => ({ ...prev, supplierId: event.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} ({supplier.code})</option>)}
              </select>
              {purchaseOrderForm.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 p-4 md:grid-cols-[1.5fr,120px,140px,auto]">
                  <select value={item.productId} onChange={(event) => setPurchaseOrderForm((prev) => ({ ...prev, items: prev.items.map((row, rowIndex) => rowIndex === index ? { ...row, productId: event.target.value } : row) }))} className="rounded-lg border border-gray-300 px-3 py-2">
                    <option value="">Select product</option>
                    {inventory.map((product) => <option key={product.id} value={product.id}>{product.productName}</option>)}
                  </select>
                  <input value={item.quantity} onChange={(event) => setPurchaseOrderForm((prev) => ({ ...prev, items: prev.items.map((row, rowIndex) => rowIndex === index ? { ...row, quantity: event.target.value } : row) }))} placeholder="Qty" className="rounded-lg border border-gray-300 px-3 py-2" />
                  <input value={item.unitCost} onChange={(event) => setPurchaseOrderForm((prev) => ({ ...prev, items: prev.items.map((row, rowIndex) => rowIndex === index ? { ...row, unitCost: event.target.value } : row) }))} placeholder="Unit Cost" className="rounded-lg border border-gray-300 px-3 py-2" />
                  <button type="button" onClick={() => setPurchaseOrderForm((prev) => ({ ...prev, items: prev.items.length === 1 ? prev.items : prev.items.filter((_, rowIndex) => rowIndex !== index) }))} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setPurchaseOrderForm((prev) => ({ ...prev, items: [...prev.items, { productId: '', quantity: '1', unitCost: '' }] }))} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">Add Item</button>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <input value={purchaseOrderForm.shippingCost} onChange={(event) => setPurchaseOrderForm((prev) => ({ ...prev, shippingCost: event.target.value }))} placeholder="Shipping cost" className="rounded-lg border border-gray-300 px-3 py-2" />
                <input value={purchaseOrderForm.taxAmount} onChange={(event) => setPurchaseOrderForm((prev) => ({ ...prev, taxAmount: event.target.value }))} placeholder="Tax amount" className="rounded-lg border border-gray-300 px-3 py-2" />
                <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800">Total {formatPrice(convertUSDtoBDT(purchaseOrderTotal))}</div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button type="button" onClick={() => setPurchaseOrderModalOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
              <button type="button" onClick={handleCreatePurchaseOrder} disabled={saving} className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700">{saving ? 'Saving...' : 'Create PO'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, value, tone = 'default' }: { title: string; value: string; tone?: 'default' | 'warning' | 'danger' | 'info' | 'accent' }) {
  const toneClass = tone === 'warning' ? 'text-yellow-600' : tone === 'danger' ? 'text-red-600' : tone === 'info' ? 'text-blue-600' : tone === 'accent' ? 'text-purple-600' : 'text-gray-900';
  return <div className="rounded-lg border border-gray-200 bg-white p-5"><p className="text-sm text-gray-600">{title}</p><p className={clsx('mt-2 text-2xl font-bold', toneClass)}>{value}</p></div>;
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-200 p-4"><p className="text-xs uppercase tracking-wide text-gray-500">{label}</p><p className="mt-2 font-semibold text-gray-900">{value}</p></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center"><Package className="mx-auto mb-3 h-10 w-10 text-gray-300" /><h3 className="font-semibold text-gray-900">{title}</h3><p className="mt-2 text-sm text-gray-500">{description}</p></div>;
}

function SimpleModal({
  title,
  children,
  onClose,
  onSubmit,
  saving,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">{children}</div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700">Cancel</button>
          <button type="button" onClick={onSubmit} disabled={saving} className="rounded-lg bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function TwoColInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-gray-700">{label}{required ? ' *' : ''}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2" />
    </label>
  );
}
