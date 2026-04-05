'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'overstocked';

export interface AdminInventoryItem {
  id: string;
  productName: string;
  sku: string;
  brand: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  maxStock: number;
  unitPrice: number;
  costPrice: number | null;
  marginPercent: number | null;
  totalValue: number;
  status: InventoryStatus;
  isActive: boolean;
  trackInventory: boolean;
  allowBackorder: boolean;
  updatedAt: string;
  shortlisted: boolean;
  shortlistNote: string | null;
  shortlistPriority: number;
  supplierCount: number;
  preferredSupplierName: string | null;
  lastSupplierName: string | null;
  lastPurchaseRate: number | null;
  lastPurchaseDate: string | null;
  lowestSupplierName: string | null;
  lowestPurchaseRate: number | null;
  lowestPurchaseDate: string | null;
}

export interface AdminInventoryShortlistItem {
  shortlistId: string;
  productId: string;
  productName: string;
  sku: string;
  brand: string;
  category: string;
  currentStock: number;
  reorderLevel: number;
  unitPrice: number;
  costPrice: number | null;
  note: string | null;
  priority: number;
  updatedAt: string | null;
  status: InventoryStatus;
}

export interface AdminInventorySupplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  paymentTerms: string | null;
  isActive: boolean;
  productCount: number;
  purchaseOrderCount: number;
  lastOrderAt: string | null;
}

export interface AdminInventoryPurchaseOrder {
  id: string;
  orderNumber: string;
  status: string;
  notes: string | null;
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  totalAmount: number;
  orderedAt: string | null;
  receivedAt: string | null;
  updatedAt: string | null;
  itemCount: number;
  receivedUnits: number;
  supplier: {
    id: string;
    name: string;
    code: string;
  };
}

interface InventoryStats {
  totalValue: number;
  totalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockedCount: number;
  shortlistCount: number;
}

interface InventoryFilters {
  search: string;
  status: string;
  category: string;
  sort: string;
}

interface AdjustInventoryInput {
  ids: string[];
  action: 'add' | 'remove' | 'set' | 'reorder';
  amount?: number;
  quantity?: number;
  reorderLevel?: number;
}

interface ShortlistInput {
  productId: string;
  note?: string;
  priority?: number;
  action?: 'toggle' | 'remove' | 'add';
}

interface SupplierInput {
  code?: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  paymentTerms?: string;
}

interface PurchaseOrderInput {
  supplierId: string;
  notes?: string;
  shippingCost?: number;
  taxAmount?: number;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: number;
    notes?: string;
  }>;
}

interface AdminInventoryContextType {
  inventory: AdminInventoryItem[];
  shortlist: AdminInventoryShortlistItem[];
  suppliers: AdminInventorySupplier[];
  purchaseOrders: AdminInventoryPurchaseOrder[];
  categories: string[];
  stats: InventoryStats;
  filters: InventoryFilters;
  setFilters: (updater: Partial<InventoryFilters>) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refreshWorkspace: (isRefresh?: boolean) => Promise<void>;
  adjustInventory: (input: AdjustInventoryInput) => Promise<void>;
  updateShortlist: (input: ShortlistInput) => Promise<void>;
  createSupplier: (input: SupplierInput) => Promise<void>;
  createPurchaseOrder: (input: PurchaseOrderInput) => Promise<void>;
  receivePurchaseOrder: (purchaseOrderId: string) => Promise<void>;
}

const DEFAULT_STATS: InventoryStats = {
  totalValue: 0,
  totalProducts: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  overstockedCount: 0,
  shortlistCount: 0,
};

const AdminInventoryContext = createContext<AdminInventoryContextType | undefined>(undefined);

export function AdminInventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<AdminInventoryItem[]>([]);
  const [shortlist, setShortlist] = useState<AdminInventoryShortlistItem[]>([]);
  const [suppliers, setSuppliers] = useState<AdminInventorySupplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<AdminInventoryPurchaseOrder[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<InventoryStats>(DEFAULT_STATS);
  const [filters, setFiltersState] = useState<InventoryFilters>({
    search: '',
    status: 'all',
    category: 'all',
    sort: 'stock',
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshWorkspace = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.category !== 'all') params.set('category', filters.category);
      params.set('sort', filters.sort);

      const res = await fetch(`/api/admin/inventory?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to fetch inventory workspace' }));
        throw new Error(data.error || 'Failed to fetch inventory workspace');
      }

      const data = await res.json();
      setInventory(data.inventory || []);
      setShortlist(data.shortlist || []);
      setSuppliers(data.suppliers || []);
      setPurchaseOrders(data.purchaseOrders || []);
      setCategories(data.categories || []);
      setStats(data.stats || DEFAULT_STATS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory workspace');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  const setFilters = useCallback((updater: Partial<InventoryFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...updater }));
  }, []);

  const mutateAndRefresh = useCallback(async (request: () => Promise<Response>) => {
    const res = await request();
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Inventory action failed' }));
      throw new Error(data.error || 'Inventory action failed');
    }
    await refreshWorkspace(true);
  }, [refreshWorkspace]);

  const adjustInventory = useCallback(async (input: AdjustInventoryInput) => {
    await mutateAndRefresh(() =>
      fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      })
    );
  }, [mutateAndRefresh]);

  const updateShortlist = useCallback(async (input: ShortlistInput) => {
    await mutateAndRefresh(() =>
      fetch('/api/admin/inventory/shortlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      })
    );
  }, [mutateAndRefresh]);

  const createSupplier = useCallback(async (input: SupplierInput) => {
    await mutateAndRefresh(() =>
      fetch('/api/admin/inventory/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      })
    );
  }, [mutateAndRefresh]);

  const createPurchaseOrder = useCallback(async (input: PurchaseOrderInput) => {
    await mutateAndRefresh(() =>
      fetch('/api/admin/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      })
    );
  }, [mutateAndRefresh]);

  const receivePurchaseOrder = useCallback(async (purchaseOrderId: string) => {
    await mutateAndRefresh(() =>
      fetch(`/api/admin/inventory/purchase-orders/${purchaseOrderId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
    );
  }, [mutateAndRefresh]);

  const value = useMemo<AdminInventoryContextType>(() => ({
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
  }), [
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
  ]);

  return (
    <AdminInventoryContext.Provider value={value}>
      {children}
    </AdminInventoryContext.Provider>
  );
}

export function useAdminInventory() {
  const context = useContext(AdminInventoryContext);
  if (!context) {
    throw new Error('useAdminInventory must be used within an AdminInventoryProvider');
  }
  return context;
}
