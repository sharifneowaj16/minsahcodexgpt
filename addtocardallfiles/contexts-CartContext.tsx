'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

// ── Types ──────────────────────────────────────────────────────────────────
export interface CartItem {
  id: string;          // variantId ?? productId  (used as React key & local lookup)
  cartItemId?: string; // DB CartItem.id          (used for PATCH/DELETE /api/cart/:id)
  productId?: string;  // DB Product.id           (MUST be sent to /api/orders)
  variantId?: string | null;
  name: string;
  price: number;
  quantity: number;
  image: string;
  sku?: string;
  variantName?: string | null;
  size?: string | null;
  color?: string | null;
  variantImage?: string | null;
}

export interface Address {
  id: string;
  fullName: string;
  phoneNumber: string;
  landmark?: string;
  provinceRegion: string;
  city: string;
  zone: string;
  address: string;
  type: 'home' | 'office';
  isDefault: boolean;
  coordinates?: { lat: number; lng: number };
}

export interface PaymentMethod {
  id: string;
  type: 'cod' | 'bkash' | 'nagad' | 'rocket' | 'gpay' | 'card';
  name: string;
  icon?: string;
  details?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  promoCode: string;
  setPromoCode: (code: string) => void;
  applyPromoCode: () => void;
  discount: number;
  addresses: Address[];
  selectedAddress: Address | null;
  setSelectedAddress: (address: Address | null) => void;
  addAddress: (address: Omit<Address, 'id'>) => void;
  updateAddress: (id: string, address: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  paymentMethods: PaymentMethod[];
  selectedPaymentMethod: PaymentMethod | null;
  setSelectedPaymentMethod: (method: PaymentMethod | null) => void;
  cartLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// ── Map API response item → CartItem ──────────────────────────────────────
// IMPORTANT:
//   item.id        = variantId ?? productId  (local key only)
//   item.productId = always the real Product.id  ← order API needs this
function mapApiItem(apiItem: {
  id: string;           // DB CartItem.id
  productId: string;    // DB Product.id
  variantId: string | null;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    image: string | null;
    brand: string | null;
    stock: number;
    slug: string;
  };
  variant: {
    id: string;
    name: string;
    price: number;
    stock: number;
    attributes: Record<string, string> | null;
  } | null;
}): CartItem {
  const price  = apiItem.variant?.price ?? apiItem.product.price;
  const attrs  = apiItem.variant?.attributes ?? {};
  const size   = attrs.size  ?? null;
  const color  = attrs.color ?? null;

  const variantParts = [size, color].filter(Boolean);
  const variantName  = apiItem.variant
    ? (variantParts.length > 0 ? variantParts.join(' / ') : apiItem.variant.name)
    : null;

  return {
    // Local lookup key: prefer variantId so same product with different
    // variants are distinct in the cart list.
    id:         apiItem.variantId ?? apiItem.productId,

    // DB IDs — kept separate so order placement always has the right value
    cartItemId: apiItem.id,
    productId:  apiItem.productId,   // ← never null/undefined
    variantId:  apiItem.variantId,   // ← null when no variant

    name:     apiItem.product.name,
    price,
    quantity: apiItem.quantity,
    image:    apiItem.product.image ?? '',
    variantName,
    size,
    color,
  };
}

// ── Provider ───────────────────────────────────────────────────────────────
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [items, setItems]             = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(false);
  const [promoCode, setPromoCode]     = useState('');
  const [discount, setDiscount]       = useState(0);
  const [addresses, setAddresses]     = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

  const paymentMethods: PaymentMethod[] = [
    { id: '1', type: 'cod',    name: 'Cash on Delivery',  icon: '💵' },
    { id: '2', type: 'bkash',  name: 'bKash',             icon: '💳' },
    { id: '3', type: 'nagad',  name: 'Nagad',             icon: '💰' },
    { id: '4', type: 'rocket', name: 'Rocket',            icon: '🚀' },
    { id: '5', type: 'gpay',   name: 'GPay',              icon: '📱' },
    { id: '6', type: 'card',   name: 'Credit/Debit Card', icon: '💳' },
  ];
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod | null>(paymentMethods[0]);

  const subtotal     = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const shippingCost = 0;
  const tax          = subtotal * 0.05;
  const total        = subtotal + shippingCost + tax - discount;

  // ── DB helpers ─────────────────────────────────────────────────

  const fetchCartFromDB = useCallback(async () => {
    setCartLoading(true);
    try {
      const res = await fetch('/api/cart', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const mapped: CartItem[] = (data.items ?? []).map(mapApiItem);
      setItems(mapped);
      localStorage.setItem('minsah_cart', JSON.stringify(mapped));
    } catch {
      try {
        const saved = localStorage.getItem('minsah_cart');
        if (saved) setItems(JSON.parse(saved));
      } catch { /* ignore */ }
    } finally {
      setCartLoading(false);
    }
  }, []);

  const mergeGuestCartToDB = useCallback(async (guestItems: CartItem[]) => {
    for (const item of guestItems) {
      try {
        await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            // Always prefer explicit productId; fall back to id only as last resort
            productId: item.productId ?? item.id,
            variantId: item.variantId ?? null,
            quantity:  item.quantity,
          }),
        });
      } catch { /* ignore */ }
    }
  }, []);

  // ── Load cart on auth change ────────────────────────────────────

  useEffect(() => {
    if (user) {
      const guestCart = (() => {
        try {
          const saved = localStorage.getItem('minsah_cart');
          return saved ? (JSON.parse(saved) as CartItem[]) : [];
        } catch { return []; }
      })();

      const init = async () => {
        if (guestCart.length > 0) {
          await mergeGuestCartToDB(guestCart);
          localStorage.removeItem('minsah_cart');
        }
        await fetchCartFromDB();
      };
      init();
    } else {
      try {
        const saved = localStorage.getItem('minsah_cart');
        if (saved) setItems(JSON.parse(saved));
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Address helpers ─────────────────────────────────────────────

  const dbToCartAddress = (db: {
    id: string;
    firstName: string;
    phone: string | null;
    street1: string;
    street2: string | null;
    state: string;
    company: string | null;
    city: string;
    isDefault: boolean;
  }): Address => ({
    id:             db.id,
    fullName:       db.firstName,
    phoneNumber:    db.phone        ?? '',
    address:        db.street1,
    zone:           db.street2      ?? '',
    provinceRegion: db.state,
    landmark:       db.company      ?? '',
    city:           db.city,
    isDefault:      db.isDefault,
    type:           'home',
  });

  const fetchAddressesFromDB = useCallback(async () => {
    try {
      const res = await fetch('/api/addresses', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const parsed: Address[] = (data.addresses ?? []).map(dbToCartAddress);
      setAddresses(parsed);
      setSelectedAddress(parsed.find((a) => a.isDefault) || parsed[0] || null);
      localStorage.setItem('minsah_addresses', JSON.stringify(parsed));
    } catch {
      try {
        const saved = localStorage.getItem('minsah_addresses');
        if (saved) {
          const parsed: Address[] = JSON.parse(saved);
          setAddresses(parsed);
          setSelectedAddress(parsed.find((a) => a.isDefault) || parsed[0] || null);
        }
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user) {
      fetchAddressesFromDB();
    } else {
      try {
        const saved = localStorage.getItem('minsah_addresses');
        if (saved) {
          const parsed: Address[] = JSON.parse(saved);
          setAddresses(parsed);
          setSelectedAddress(parsed.find((a) => a.isDefault) || parsed[0] || null);
        }
      } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!user) localStorage.setItem('minsah_addresses', JSON.stringify(addresses));
  }, [addresses, user]);

  // ── Cart CRUD ───────────────────────────────────────────────────

  const addItem = useCallback(
    async (item: CartItem) => {
      if (user) {
        // Optimistic update
        setItems((prev) => {
          const existing = prev.find((i) => i.id === item.id);
          if (existing) {
            return prev.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
            );
          }
          return [...prev, item];
        });

        try {
          await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              productId: item.productId ?? item.id,
              variantId: item.variantId ?? null,
              quantity:  item.quantity,
            }),
          });
          await fetchCartFromDB(); // sync to get cartItemId + correct quantity
        } catch { /* keep optimistic */ }
      } else {
        setItems((prev) => {
          const existing = prev.find((i) => i.id === item.id);
          if (existing) {
            return prev.map((i) =>
              i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
            );
          }
          return [...prev, item];
        });
      }
    },
    [user, fetchCartFromDB]
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (user) {
        const target = items.find((i) => i.id === itemId);
        setItems((prev) => prev.filter((i) => i.id !== itemId));
        if (target?.cartItemId) {
          try {
            await fetch(`/api/cart/${target.cartItemId}`, {
              method: 'DELETE',
              credentials: 'include',
            });
          } catch {
            await fetchCartFromDB();
          }
        }
      } else {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      }
    },
    [user, items, fetchCartFromDB]
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(itemId);
        return;
      }

      if (user) {
        const target = items.find((i) => i.id === itemId);
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
        );
        if (target?.cartItemId) {
          try {
            await fetch(`/api/cart/${target.cartItemId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ quantity }),
            });
          } catch {
            await fetchCartFromDB();
          }
        }
      } else {
        setItems((prev) =>
          prev.map((i) => (i.id === itemId ? { ...i, quantity } : i))
        );
      }
    },
    [user, items, removeItem, fetchCartFromDB]
  );

  const clearCart = useCallback(async () => {
    setItems([]);
    setPromoCode('');
    setDiscount(0);
    if (user) {
      try {
        await fetch('/api/cart', { method: 'DELETE', credentials: 'include' });
      } catch { /* ignore */ }
    } else {
      localStorage.setItem('minsah_cart', JSON.stringify([]));
    }
  }, [user]);

  useEffect(() => {
    if (!user) localStorage.setItem('minsah_cart', JSON.stringify(items));
  }, [items, user]);

  // ── Promo code ──────────────────────────────────────────────────

  const applyPromoCode = () => {
    const valid: Record<string, number> = {
      SAVE10:  subtotal * 0.1,
      SAVE20:  subtotal * 0.2,
      FIRST50: 50,
    };
    if (valid[promoCode.toUpperCase()]) {
      setDiscount(valid[promoCode.toUpperCase()]);
    } else {
      alert('Invalid promo code');
    }
  };

  // ── Address CRUD ────────────────────────────────────────────────

  const addAddress = useCallback(
    async (address: Omit<Address, 'id'>) => {
      if (user) {
        try {
          const res = await fetch('/api/addresses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              firstName: address.fullName,
              phone:     address.phoneNumber,
              street1:   address.address,
              street2:   address.zone,
              state:     address.provinceRegion,
              company:   address.landmark,
              city:      address.city,
              isDefault: address.isDefault,
              type:      'SHIPPING',
            }),
          });
          if (res.ok) await fetchAddressesFromDB();
        } catch {
          const na: Address = { ...address, id: Date.now().toString() };
          setAddresses((prev) => [...prev, na]);
          if (address.isDefault) setSelectedAddress(na);
        }
      } else {
        const na: Address = { ...address, id: Date.now().toString() };
        setAddresses((prev) => [...prev, na]);
        if (address.isDefault) setSelectedAddress(na);
      }
    },
    [user, fetchAddressesFromDB]
  );

  const updateAddress = useCallback(
    async (id: string, updates: Partial<Address>) => {
      if (user) {
        try {
          const b: Record<string, unknown> = {};
          if (updates.fullName       !== undefined) b.firstName = updates.fullName;
          if (updates.phoneNumber    !== undefined) b.phone     = updates.phoneNumber;
          if (updates.address        !== undefined) b.street1   = updates.address;
          if (updates.zone           !== undefined) b.street2   = updates.zone;
          if (updates.provinceRegion !== undefined) b.state     = updates.provinceRegion;
          if (updates.landmark       !== undefined) b.company   = updates.landmark;
          if (updates.city           !== undefined) b.city      = updates.city;
          if (updates.isDefault      !== undefined) b.isDefault = updates.isDefault;
          await fetch(`/api/addresses/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(b),
          });
          await fetchAddressesFromDB();
        } catch {
          setAddresses((prev) =>
            prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
          );
        }
      } else {
        setAddresses((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
        );
      }
    },
    [user, fetchAddressesFromDB]
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      if (user) {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        if (selectedAddress?.id === id)
          setSelectedAddress(addresses.find((a) => a.id !== id) || null);
        try {
          await fetch(`/api/addresses/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          });
        } catch {
          await fetchAddressesFromDB();
        }
      } else {
        setAddresses((prev) => prev.filter((a) => a.id !== id));
        if (selectedAddress?.id === id)
          setSelectedAddress(addresses.find((a) => a.id !== id) || null);
      }
    },
    [user, addresses, selectedAddress, fetchAddressesFromDB]
  );

  // ── Render ──────────────────────────────────────────────────────

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        subtotal,
        shippingCost,
        tax,
        total,
        promoCode,
        setPromoCode,
        applyPromoCode,
        discount,
        addresses,
        selectedAddress,
        setSelectedAddress,
        addAddress,
        updateAddress,
        deleteAddress,
        paymentMethods,
        selectedPaymentMethod,
        setSelectedPaymentMethod,
        cartLoading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
// 'use client';

// import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
// import { useAuth } from './AuthContext';

// // Types
// export interface CartItem {
//   id: string;
//   cartItemId?: string;       // DB cart item ID (only for logged-in users)
//   productId?: string;        // actual product ID (for API calls)
//   variantId?: string | null;
//   name: string;
//   price: number;
//   quantity: number;
//   image: string;
//   sku?: string;
//   // variant display info
//   variantName?: string | null;  // e.g. "30ml / White"
//   size?: string | null;
//   color?: string | null;
//   variantImage?: string | null; // variant-specific image
// }

// export interface Address {
//   id: string;
//   fullName: string;
//   phoneNumber: string;
//   landmark?: string;
//   provinceRegion: string;
//   city: string;
//   zone: string;
//   address: string;
//   type: 'home' | 'office';
//   isDefault: boolean;
//   coordinates?: { lat: number; lng: number };
// }

// export interface PaymentMethod {
//   id: string;
//   type: 'cod' | 'bkash' | 'nagad' | 'rocket' | 'gpay' | 'card';
//   name: string;
//   icon?: string;
//   details?: string;
// }

// interface CartContextType {
//   items: CartItem[];
//   addItem: (item: CartItem) => void;
//   removeItem: (itemId: string) => void;
//   updateQuantity: (itemId: string, quantity: number) => void;
//   clearCart: () => void;
//   subtotal: number;
//   shippingCost: number;
//   tax: number;
//   total: number;
//   promoCode: string;
//   setPromoCode: (code: string) => void;
//   applyPromoCode: () => void;
//   discount: number;
//   addresses: Address[];
//   selectedAddress: Address | null;
//   setSelectedAddress: (address: Address | null) => void;
//   addAddress: (address: Omit<Address, 'id'>) => void;
//   updateAddress: (id: string, address: Partial<Address>) => void;
//   deleteAddress: (id: string) => void;
//   paymentMethods: PaymentMethod[];
//   selectedPaymentMethod: PaymentMethod | null;
//   setSelectedPaymentMethod: (method: PaymentMethod | null) => void;
//   cartLoading: boolean;
// }

// const CartContext = createContext<CartContextType | undefined>(undefined);

// // ── Map API response item → CartItem ─────────────────────────────────────
// function mapApiItem(apiItem: {
//   id: string;
//   productId: string;
//   variantId: string | null;
//   quantity: number;
//   product: { id: string; name: string; price: number; image: string | null };
//   variant: {
//     id: string;
//     name: string;
//     price: number;
//     attributes: Record<string, string> | null;
//   } | null;
// }): CartItem {
//   const price = apiItem.variant?.price ?? apiItem.product.price;
//   const attrs = apiItem.variant?.attributes ?? {};
//   const size  = attrs.size  ?? null;
//   const color = attrs.color ?? null;

//   // Build human-readable variant label e.g. "30ml / White"
//   const variantParts = [size, color].filter(Boolean);
//   const variantName  = apiItem.variant
//     ? (variantParts.length > 0 ? variantParts.join(' / ') : apiItem.variant.name)
//     : null;

//   return {
//     id:          apiItem.variantId ?? apiItem.productId,
//     cartItemId:  apiItem.id,
//     productId:   apiItem.productId,
//     variantId:   apiItem.variantId,
//     name:        apiItem.product.name,
//     price,
//     quantity:    apiItem.quantity,
//     image:       apiItem.product.image ?? '',
//     variantName,
//     size,
//     color,
//   };
// }

// export function CartProvider({ children }: { children: ReactNode }) {
//   const { user } = useAuth();

//   const [items, setItems]               = useState<CartItem[]>([]);
//   const [cartLoading, setCartLoading]   = useState(false);
//   const [promoCode, setPromoCode]       = useState('');
//   const [discount, setDiscount]         = useState(0);
//   const [addresses, setAddresses]       = useState<Address[]>([]);
//   const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);

//   const paymentMethods: PaymentMethod[] = [
//     { id: '1', type: 'cod',    name: 'Cash on Delivery',  icon: '💵' },
//     { id: '2', type: 'bkash',  name: 'bKash',             icon: '💳' },
//     { id: '3', type: 'nagad',  name: 'Nagad',             icon: '💰' },
//     { id: '4', type: 'rocket', name: 'Rocket',            icon: '🚀' },
//     { id: '5', type: 'gpay',   name: 'GPay',              icon: '📱' },
//     { id: '6', type: 'card',   name: 'Credit/Debit Card', icon: '💳' },
//   ];
//   const [selectedPaymentMethod, setSelectedPaymentMethod] =
//     useState<PaymentMethod | null>(paymentMethods[0]);

//   const subtotal     = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
//   const shippingCost = 0;
//   const tax          = subtotal * 0.05;
//   const total        = subtotal + shippingCost + tax - discount;

//   // ─── DB helpers ───────────────────────────────────────────────

//   const fetchCartFromDB = useCallback(async () => {
//     setCartLoading(true);
//     try {
//       const res = await fetch('/api/cart', { credentials: 'include' });
//       if (!res.ok) return;
//       const data = await res.json();
//       // FIX: map API shape → CartItem (was setItems(data.items) before)
//       const mapped: CartItem[] = (data.items ?? []).map(mapApiItem);
//       setItems(mapped);
//       localStorage.setItem('minsah_cart', JSON.stringify(mapped));
//     } catch {
//       try {
//         const saved = localStorage.getItem('minsah_cart');
//         if (saved) setItems(JSON.parse(saved));
//       } catch { /* ignore */ }
//     } finally {
//       setCartLoading(false);
//     }
//   }, []);

//   const mergeGuestCartToDB = useCallback(async (guestItems: CartItem[]) => {
//     for (const item of guestItems) {
//       try {
//         await fetch('/api/cart', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           credentials: 'include',
//           body: JSON.stringify({
//             productId: item.productId ?? item.id,
//             variantId: item.variantId ?? null,
//             quantity:  item.quantity,
//           }),
//         });
//       } catch { /* ignore */ }
//     }
//   }, []);

//   // ─── Load cart ────────────────────────────────────────────────

//   useEffect(() => {
//     if (user) {
//       const guestCart = (() => {
//         try {
//           const saved = localStorage.getItem('minsah_cart');
//           return saved ? (JSON.parse(saved) as CartItem[]) : [];
//         } catch { return []; }
//       })();

//       const init = async () => {
//         if (guestCart.length > 0) {
//           await mergeGuestCartToDB(guestCart);
//           localStorage.removeItem('minsah_cart');
//         }
//         await fetchCartFromDB();
//       };
//       init();
//     } else {
//       try {
//         const saved = localStorage.getItem('minsah_cart');
//         if (saved) setItems(JSON.parse(saved));
//       } catch { /* ignore */ }
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [user?.id]);

//   // ─── Address helpers ──────────────────────────────────────────

//   const dbToCartAddress = (db: {
//     id: string; firstName: string; phone: string | null;
//     street1: string; street2: string | null; state: string;
//     company: string | null; city: string; isDefault: boolean;
//   }): Address => ({
//     id: db.id, fullName: db.firstName, phoneNumber: db.phone ?? '',
//     address: db.street1, zone: db.street2 ?? '', provinceRegion: db.state,
//     landmark: db.company ?? '', city: db.city, isDefault: db.isDefault, type: 'home',
//   });

//   const fetchAddressesFromDB = useCallback(async () => {
//     try {
//       const res = await fetch('/api/addresses', { credentials: 'include' });
//       if (!res.ok) return;
//       const data = await res.json();
//       const parsed: Address[] = (data.addresses ?? []).map(dbToCartAddress);
//       setAddresses(parsed);
//       setSelectedAddress(parsed.find(a => a.isDefault) || parsed[0] || null);
//       localStorage.setItem('minsah_addresses', JSON.stringify(parsed));
//     } catch {
//       try {
//         const saved = localStorage.getItem('minsah_addresses');
//         if (saved) {
//           const parsed: Address[] = JSON.parse(saved);
//           setAddresses(parsed);
//           setSelectedAddress(parsed.find(a => a.isDefault) || parsed[0] || null);
//         }
//       } catch { /* ignore */ }
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     if (user) { fetchAddressesFromDB(); }
//     else {
//       try {
//         const saved = localStorage.getItem('minsah_addresses');
//         if (saved) {
//           const parsed: Address[] = JSON.parse(saved);
//           setAddresses(parsed);
//           setSelectedAddress(parsed.find(a => a.isDefault) || parsed[0] || null);
//         }
//       } catch { /* ignore */ }
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [user?.id]);

//   useEffect(() => {
//     if (!user) localStorage.setItem('minsah_addresses', JSON.stringify(addresses));
//   }, [addresses, user]);

//   // ─── Cart functions ────────────────────────────────────────────

//   const addItem = useCallback(async (item: CartItem) => {
//     if (user) {
//       // Optimistic update
//       setItems(prev => {
//         const existing = prev.find(i => i.id === item.id);
//         if (existing) {
//           return prev.map(i => i.id === item.id
//             ? { ...i, quantity: i.quantity + item.quantity } : i);
//         }
//         return [...prev, item];
//       });

//       try {
//         // FIX: always send productId + variantId separately (not merged item.id)
//         await fetch('/api/cart', {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           credentials: 'include',
//           body: JSON.stringify({
//             productId: item.productId ?? item.id,
//             variantId: item.variantId ?? null,
//             quantity:  item.quantity,
//           }),
//         });
//         await fetchCartFromDB(); // sync to get cartItemId + correct quantity
//       } catch { /* keep optimistic */ }
//     } else {
//       setItems(prev => {
//         const existing = prev.find(i => i.id === item.id);
//         if (existing) {
//           return prev.map(i => i.id === item.id
//             ? { ...i, quantity: i.quantity + item.quantity } : i);
//         }
//         return [...prev, item];
//       });
//     }
//   }, [user, fetchCartFromDB]);

//   const removeItem = useCallback(async (itemId: string) => {
//     if (user) {
//       const target = items.find(i => i.id === itemId);
//       setItems(prev => prev.filter(i => i.id !== itemId));
//       if (target?.cartItemId) {
//         try {
//           await fetch(`/api/cart/${target.cartItemId}`, {
//             method: 'DELETE', credentials: 'include',
//           });
//         } catch { await fetchCartFromDB(); }
//       }
//     } else {
//       setItems(prev => prev.filter(i => i.id !== itemId));
//     }
//   }, [user, items, fetchCartFromDB]);

//   const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
//     if (quantity <= 0) { removeItem(itemId); return; }

//     if (user) {
//       const target = items.find(i => i.id === itemId);
//       setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity } : i));
//       if (target?.cartItemId) {
//         try {
//           await fetch(`/api/cart/${target.cartItemId}`, {
//             method: 'PATCH',
//             headers: { 'Content-Type': 'application/json' },
//             credentials: 'include',
//             body: JSON.stringify({ quantity }),
//           });
//         } catch { await fetchCartFromDB(); }
//       }
//     } else {
//       setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity } : i));
//     }
//   }, [user, items, removeItem, fetchCartFromDB]);

//   const clearCart = useCallback(async () => {
//     setItems([]); setPromoCode(''); setDiscount(0);
//     if (user) {
//       try {
//         await fetch('/api/cart', { method: 'DELETE', credentials: 'include' });
//       } catch { /* ignore */ }
//     } else {
//       localStorage.setItem('minsah_cart', JSON.stringify([]));
//     }
//   }, [user]);

//   useEffect(() => {
//     if (!user) localStorage.setItem('minsah_cart', JSON.stringify(items));
//   }, [items, user]);

//   // ─── Promo code ────────────────────────────────────────────────

//   const applyPromoCode = () => {
//     const valid: Record<string, number> = {
//       'SAVE10': subtotal * 0.1, 'SAVE20': subtotal * 0.2, 'FIRST50': 50,
//     };
//     if (valid[promoCode.toUpperCase()]) {
//       setDiscount(valid[promoCode.toUpperCase()]);
//     } else {
//       alert('Invalid promo code');
//     }
//   };

//   // ─── Address functions ─────────────────────────────────────────

//   const addAddress = useCallback(async (address: Omit<Address, 'id'>) => {
//     if (user) {
//       try {
//         const res = await fetch('/api/addresses', {
//           method: 'POST', headers: { 'Content-Type': 'application/json' },
//           credentials: 'include',
//           body: JSON.stringify({
//             firstName: address.fullName, phone: address.phoneNumber,
//             street1: address.address, street2: address.zone,
//             state: address.provinceRegion, company: address.landmark,
//             city: address.city, isDefault: address.isDefault, type: 'SHIPPING',
//           }),
//         });
//         if (res.ok) await fetchAddressesFromDB();
//       } catch {
//         const na: Address = { ...address, id: Date.now().toString() };
//         setAddresses(prev => [...prev, na]);
//         if (address.isDefault) setSelectedAddress(na);
//       }
//     } else {
//       const na: Address = { ...address, id: Date.now().toString() };
//       setAddresses(prev => [...prev, na]);
//       if (address.isDefault) setSelectedAddress(na);
//     }
//   }, [user, fetchAddressesFromDB]);

//   const updateAddress = useCallback(async (id: string, updates: Partial<Address>) => {
//     if (user) {
//       try {
//         const b: Record<string, unknown> = {};
//         if (updates.fullName       !== undefined) b.firstName = updates.fullName;
//         if (updates.phoneNumber    !== undefined) b.phone     = updates.phoneNumber;
//         if (updates.address        !== undefined) b.street1   = updates.address;
//         if (updates.zone           !== undefined) b.street2   = updates.zone;
//         if (updates.provinceRegion !== undefined) b.state     = updates.provinceRegion;
//         if (updates.landmark       !== undefined) b.company   = updates.landmark;
//         if (updates.city           !== undefined) b.city      = updates.city;
//         if (updates.isDefault      !== undefined) b.isDefault = updates.isDefault;
//         await fetch(`/api/addresses/${id}`, {
//           method: 'PATCH', headers: { 'Content-Type': 'application/json' },
//           credentials: 'include', body: JSON.stringify(b),
//         });
//         await fetchAddressesFromDB();
//       } catch {
//         setAddresses(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
//       }
//     } else {
//       setAddresses(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
//     }
//   }, [user, fetchAddressesFromDB]);

//   const deleteAddress = useCallback(async (id: string) => {
//     if (user) {
//       setAddresses(prev => prev.filter(a => a.id !== id));
//       if (selectedAddress?.id === id)
//         setSelectedAddress(addresses.find(a => a.id !== id) || null);
//       try {
//         await fetch(`/api/addresses/${id}`, { method: 'DELETE', credentials: 'include' });
//       } catch { await fetchAddressesFromDB(); }
//     } else {
//       setAddresses(prev => prev.filter(a => a.id !== id));
//       if (selectedAddress?.id === id)
//         setSelectedAddress(addresses.find(a => a.id !== id) || null);
//     }
//   }, [user, addresses, selectedAddress, fetchAddressesFromDB]);

//   return (
//     <CartContext.Provider value={{
//       items, addItem, removeItem, updateQuantity, clearCart,
//       subtotal, shippingCost, tax, total,
//       promoCode, setPromoCode, applyPromoCode, discount,
//       addresses, selectedAddress, setSelectedAddress,
//       addAddress, updateAddress, deleteAddress,
//       paymentMethods, selectedPaymentMethod, setSelectedPaymentMethod,
//       cartLoading,
//     }}>
//       {children}
//     </CartContext.Provider>
//   );
// }

// export function useCart() {
//   const context = useContext(CartContext);
//   if (context === undefined) {
//     throw new Error('useCart must be used within a CartProvider');
//   }
//   return context;
// }
