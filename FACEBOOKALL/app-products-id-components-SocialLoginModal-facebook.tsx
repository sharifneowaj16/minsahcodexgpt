'use client';

import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { X, Loader2 } from 'lucide-react';

interface SocialLoginModalProps {
  onSuccess: (userId: string, userName: string) => void;
  onClose: () => void;
  purpose: 'send_gift' | 'get_gift' | 'checkout';
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <defs>
      <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#FED373"/>
        <stop offset="25%" stopColor="#F15245"/>
        <stop offset="50%" stopColor="#D92E7F"/>
        <stop offset="75%" stopColor="#9B36B7"/>
        <stop offset="100%" stopColor="#515ECF"/>
      </linearGradient>
    </defs>
    <path fill="url(#ig)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

export default function SocialLoginModal({ onSuccess, onClose, purpose }: SocialLoginModalProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState<string | null>(null);

  // Already logged in — auto-proceed
  if (session?.user) {
    const userId = (session.user as any).id;
    const userName = session.user.name || session.user.email || 'User';
    setTimeout(() => onSuccess(userId, userName), 0);
    return null;
  }

  const handleLogin = async (provider: 'google' | 'facebook') => {
    setLoading(provider);
    try {
      const result = await signIn(provider, {
        redirect: false,
        callbackUrl: window.location.href,
      });

      if (result?.error) {
        console.error('Login error:', result.error);
        setLoading(null);
        return;
      }

      // Poll /api/auth/session until user id is present (max 8s)
      let attempts = 0;
      const poll = async () => {
        attempts++;
        const res = await fetch('/api/auth/session');
        const sess = await res.json();
        if (sess?.user?.id) {
          setLoading(null);
          onSuccess(sess.user.id, sess.user.name || sess.user.email || 'User');
        } else if (attempts < 8) {
          setTimeout(poll, 1000);
        } else {
          setLoading(null);
        }
      };
      setTimeout(poll, 800);
    } catch {
      setLoading(null);
    }
  };

  const purposeText = purpose === 'send_gift'
    ? 'Gift পাঠাতে login করুন'
    : purpose === 'get_gift'
    ? 'Gift request করতে login করুন'
    : 'Order দিতে login করুন';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-[#1A0D06]">{purposeText}</h3>
          <p className="text-xs text-[#8B5E3C] mt-0.5">একবার login করলে পরের বার লাগবে না</p>
        </div>
        <button onClick={onClose} className="text-[#8B5E3C] hover:text-[#3D1F0E]">
          <X size={18} />
        </button>
      </div>

      {/* Social buttons */}
      <div className="space-y-2.5">
        {/* Google */}
        <button
          onClick={() => handleLogin('google')}
          disabled={!!loading}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-[#D4B896] rounded-2xl text-sm font-medium text-[#1A0D06] hover:bg-[#F5E9DC] transition disabled:opacity-60 active:scale-95"
        >
          {loading === 'google'
            ? <Loader2 size={18} className="animate-spin text-[#8B5E3C]" />
            : <GoogleIcon />
          }
          Google দিয়ে continue করুন
        </button>

        {/* Facebook */}
        <button
          onClick={() => handleLogin('facebook')}
          disabled={!!loading}
          className="w-full flex items-center gap-3 px-4 py-3 bg-[#1877F2] rounded-2xl text-sm font-medium text-white hover:bg-[#1565D8] transition disabled:opacity-60 active:scale-95"
        >
          {loading === 'facebook'
            ? <Loader2 size={18} className="animate-spin text-white" />
            : <FacebookIcon />
          }
          Facebook দিয়ে continue করুন
        </button>

        {/* Instagram — same as Facebook */}
        <button
          onClick={() => handleLogin('facebook')}
          disabled={!!loading}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-[#D4B896] rounded-2xl text-sm font-medium text-[#1A0D06] hover:bg-[#F5E9DC] transition disabled:opacity-60 active:scale-95"
        >
          {loading === 'facebook' ? (
            <Loader2 size={18} className="animate-spin text-[#8B5E3C]" />
          ) : (
            <InstagramIcon />
          )}
          Instagram দিয়ে continue করুন
        </button>
      </div>

      <p className="text-[10px] text-[#A0856A] text-center mt-4 leading-relaxed">
        Login করলে Minsah Beauty-র{' '}
        <span className="underline cursor-pointer">Terms</span> এবং{' '}
        <span className="underline cursor-pointer">Privacy Policy</span> মেনে নিচ্ছেন
      </p>
    </div>
  );
}
// 'use client';

// import { useState, useEffect, useCallback } from 'react';
// import { useRouter } from 'next/navigation';
// import { useSession } from 'next-auth/react';
// import Link from 'next/link';
// import {
//   ArrowLeft, MapPin, Plus, ChevronRight,
//   ShoppingBag, Loader2, CreditCard, Banknote,
//   Smartphone, Check,
// } from 'lucide-react';
// import { useCart } from '@/contexts/CartContext';
// import { formatPrice, convertUSDtoBDT } from '@/utils/currency';
// import SocialLoginModal from '@/app/products/[id]/components/SocialLoginModal';

// // ── Types ─────────────────────────────────────────────────────────────────────
// type PaymentMethod = 'cod' | 'bkash' | 'nagad' | 'card';
// type CheckoutStep  = 'address' | 'payment' | 'review';

// // ── Helpers ───────────────────────────────────────────────────────────────────
// const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; sub: string; icon: React.ReactNode }[] = [
//   { id: 'cod',    label: 'Cash on Delivery', sub: 'পণ্য পেলে টাকা দিন',   icon: <Banknote size={20} /> },
//   { id: 'bkash',  label: 'bKash',            sub: 'Mobile Banking',        icon: <Smartphone size={20} /> },
//   { id: 'nagad',  label: 'Nagad',            sub: 'Mobile Banking',        icon: <Smartphone size={20} /> },
//   { id: 'card',   label: 'Card',             sub: 'Credit / Debit Card',   icon: <CreditCard size={20} /> },
// ];

// // ── Main Component ─────────────────────────────────────────────────────────────
// export default function CheckoutPage() {
//   const router                     = useRouter();
//   const { data: session, status }  = useSession();
//   const {
//     items, subtotal, shippingCost, tax, total, discount,
//     addresses, selectedAddress, setSelectedAddress, clearCart,
//   } = useCart();

//   // ── State ──────────────────────────────────────────────────────────────────
//   const [showLoginModal, setShowLoginModal]   = useState(false);
//   const [step, setStep]                       = useState<CheckoutStep>('address');
//   const [paymentMethod, setPaymentMethod]     = useState<PaymentMethod>('cod');
//   const [customerNote, setCustomerNote]       = useState('');
//   const [placing, setPlacing]                 = useState(false);
//   const [error, setError]                     = useState<string | null>(null);

//   // Show login modal if not logged in
//   useEffect(() => {
//     if (status === 'unauthenticated') setShowLoginModal(true);
//     else setShowLoginModal(false);
//   }, [status]);

//   // Redirect to cart if empty
//   useEffect(() => {
//     if (items.length === 0 && status !== 'loading') router.replace('/cart');
//   }, [items.length, status, router]);

//   // ── Handlers ───────────────────────────────────────────────────────────────
//   const handleLoginSuccess = useCallback(() => {
//     setShowLoginModal(false);
//   }, []);

//   const handlePlaceOrder = async () => {
//     if (!selectedAddress) { setError('ডেলিভারি ঠিকানা নির্বাচন করুন।'); return; }
//     if (items.length === 0) { setError('Cart খালি।'); return; }

//     setError(null);
//     setPlacing(true);

//     try {
//       const orderItems = items.map(item => ({
//         productId: item.productId ?? item.id,
//         variantId: item.variantId ?? undefined,
//         quantity:  item.quantity,
//       }));

//       const res = await fetch('/api/orders', {
//         method:  'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           items:         orderItems,
//           addressId:     selectedAddress.id,
//           addressData:   selectedAddress,   // fallback if id is local
//           paymentMethod,
//           shippingCost,
//           customerNote:  customerNote || undefined,
//         }),
//       });

//       const data = await res.json();

//       if (!res.ok) {
//         setError(data.error || 'Order দিতে সমস্যা হয়েছে।');
//         return;
//       }

//       // Clear cart and redirect
//       await clearCart();
//       router.push(`/checkout/order-confirmed?orderNumber=${data.orderNumber}`);

//     } catch {
//       setError('Network error। আবার চেষ্টা করুন।');
//     } finally {
//       setPlacing(false);
//     }
//   };

//   // ── Loading ────────────────────────────────────────────────────────────────
//   if (status === 'loading') {
//     return (
//       <div className="min-h-screen bg-[#FDF8F3] flex items-center justify-center">
//         <Loader2 size={32} className="animate-spin text-[#3D1F0E]" />
//       </div>
//     );
//   }

//   // ── Totals ─────────────────────────────────────────────────────────────────
//   const bdtSubtotal = convertUSDtoBDT(subtotal);
//   const bdtShipping = convertUSDtoBDT(shippingCost);
//   const bdtTax      = convertUSDtoBDT(tax);
//   const bdtDiscount = convertUSDtoBDT(discount);
//   const bdtTotal    = convertUSDtoBDT(total);

//   return (
//     <div className="min-h-screen bg-[#FDF8F3]">

//       {/* ── Login Modal ─────────────────────────────────────────── */}
//       {showLoginModal && (
//         <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
//           {/* Backdrop */}
//           <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
//           {/* Sheet */}
//           <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl">
//             <SocialLoginModal
//               purpose="checkout"
//               onSuccess={handleLoginSuccess}
//               onClose={() => router.back()}
//             />
//           </div>
//         </div>
//       )}

//       {/* ── Header ──────────────────────────────────────────────── */}
//       <header className="bg-[#3D1F0E] text-[#F5E6D3] sticky top-0 z-40 shadow-md">
//         <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
//           <Link href="/cart" className="p-2 hover:bg-[#2A1509] rounded-xl transition">
//             <ArrowLeft size={22} />
//           </Link>
//           <h1 className="text-lg font-semibold flex-1">Checkout</h1>
//           {session?.user && (
//             <span className="text-xs text-[#C9A882] truncate max-w-[140px]">
//               {session.user.name || session.user.email}
//             </span>
//           )}
//         </div>

//         {/* Step indicator */}
//         <div className="max-w-2xl mx-auto px-4 pb-3 flex gap-2">
//           {(['address', 'payment', 'review'] as CheckoutStep[]).map((s, i) => (
//             <button
//               key={s}
//               onClick={() => setStep(s)}
//               className={`flex-1 h-1 rounded-full transition-all ${
//                 step === s ? 'bg-[#F5E6D3]' :
//                 ['address', 'payment', 'review'].indexOf(step) > i ? 'bg-[#8B5E3C]' : 'bg-[#5C3320]'
//               }`}
//             />
//           ))}
//         </div>
//       </header>

//       <div className="max-w-2xl mx-auto px-4 py-4 pb-36 space-y-4">

//         {/* ── STEP 1: Address ──────────────────────────────────────── */}
//         {step === 'address' && (
//           <>
//             <h2 className="text-sm font-semibold text-[#3D1F0E] uppercase tracking-wide">
//               📍 ডেলিভারি ঠিকানা
//             </h2>

//             {addresses.length === 0 ? (
//               <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
//                 <MapPin size={32} className="text-[#C9A882] mx-auto mb-2" />
//                 <p className="text-sm text-[#8B5E3C] mb-4">কোনো ঠিকানা নেই</p>
//                 <Link
//                   href="/checkout/add-address"
//                   className="inline-flex items-center gap-2 bg-[#3D1F0E] text-[#F5E6D3] px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2A1509] transition"
//                 >
//                   <Plus size={16} /> নতুন ঠিকানা যোগ করুন
//                 </Link>
//               </div>
//             ) : (
//               <div className="space-y-3">
//                 {addresses.map(addr => (
//                   <button
//                     key={addr.id}
//                     onClick={() => setSelectedAddress(addr)}
//                     className={`w-full text-left p-4 rounded-2xl border-2 transition-all shadow-sm ${
//                       selectedAddress?.id === addr.id
//                         ? 'border-[#3D1F0E] bg-[#F5E9DC]'
//                         : 'border-[#E8D5C0] bg-white hover:border-[#3D1F0E]'
//                     }`}
//                   >
//                     <div className="flex items-start gap-3">
//                       <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${
//                         selectedAddress?.id === addr.id
//                           ? 'border-[#3D1F0E] bg-[#3D1F0E]'
//                           : 'border-[#C9A882]'
//                       }`}>
//                         {selectedAddress?.id === addr.id && <Check size={11} className="text-white" />}
//                       </div>
//                       <div className="flex-1">
//                         <p className="text-sm font-semibold text-[#1A0D06]">{addr.fullName}</p>
//                         <p className="text-xs text-[#8B5E3C] mt-0.5">{addr.phoneNumber}</p>
//                         <p className="text-xs text-[#6B4226] mt-1">
//                           {addr.address}, {addr.zone}, {addr.city}
//                         </p>
//                         {addr.isDefault && (
//                           <span className="inline-block mt-1 text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
//                             Default
//                           </span>
//                         )}
//                       </div>
//                     </div>
//                   </button>
//                 ))}

//                 <Link
//                   href="/checkout/add-address"
//                   className="flex items-center justify-center gap-2 w-full p-3.5 rounded-2xl border-2 border-dashed border-[#C9A882] text-[#6B4226] text-sm font-medium hover:border-[#3D1F0E] hover:bg-[#F5E9DC] transition"
//                 >
//                   <Plus size={16} /> নতুন ঠিকানা যোগ করুন
//                 </Link>
//               </div>
//             )}

//             <button
//               onClick={() => selectedAddress && setStep('payment')}
//               disabled={!selectedAddress}
//               className="w-full py-3.5 rounded-2xl bg-[#3D1F0E] text-[#F5E6D3] font-semibold text-sm disabled:opacity-40 hover:bg-[#2A1509] transition flex items-center justify-center gap-2"
//             >
//               পরবর্তী: Payment <ChevronRight size={16} />
//             </button>
//           </>
//         )}

//         {/* ── STEP 2: Payment ──────────────────────────────────────── */}
//         {step === 'payment' && (
//           <>
//             <h2 className="text-sm font-semibold text-[#3D1F0E] uppercase tracking-wide">
//               💳 পেমেন্ট পদ্ধতি
//             </h2>

//             <div className="space-y-2.5">
//               {PAYMENT_OPTIONS.map(opt => (
//                 <button
//                   key={opt.id}
//                   onClick={() => setPaymentMethod(opt.id)}
//                   className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all shadow-sm text-left ${
//                     paymentMethod === opt.id
//                       ? 'border-[#3D1F0E] bg-[#F5E9DC]'
//                       : 'border-[#E8D5C0] bg-white hover:border-[#3D1F0E]'
//                   }`}
//                 >
//                   <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
//                     paymentMethod === opt.id ? 'border-[#3D1F0E] bg-[#3D1F0E]' : 'border-[#C9A882]'
//                   }`}>
//                     {paymentMethod === opt.id && <Check size={11} className="text-white" />}
//                   </div>
//                   <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
//                     paymentMethod === opt.id ? 'bg-[#3D1F0E] text-[#F5E6D3]' : 'bg-[#F5E9DC] text-[#6B4226]'
//                   }`}>
//                     {opt.icon}
//                   </div>
//                   <div>
//                     <p className="text-sm font-semibold text-[#1A0D06]">{opt.label}</p>
//                     <p className="text-xs text-[#8B5E3C]">{opt.sub}</p>
//                   </div>
//                 </button>
//               ))}
//             </div>

//             {/* Customer note */}
//             <div className="bg-white rounded-2xl p-4 shadow-sm">
//               <label className="text-xs font-semibold text-[#3D1F0E] uppercase tracking-wide block mb-2">
//                 📝 বিশেষ নির্দেশনা (ঐচ্ছিক)
//               </label>
//               <textarea
//                 value={customerNote}
//                 onChange={e => setCustomerNote(e.target.value)}
//                 placeholder="যেমন: সন্ধ্যার পরে ডেলিভারি দিন..."
//                 rows={3}
//                 className="w-full text-sm text-[#1A0D06] placeholder-[#C9A882] bg-[#FDF8F3] rounded-xl px-3 py-2.5 border border-[#E8D5C0] focus:outline-none focus:border-[#3D1F0E] resize-none"
//               />
//             </div>

//             <div className="flex gap-3">
//               <button
//                 onClick={() => setStep('address')}
//                 className="flex-1 py-3.5 rounded-2xl border-2 border-[#E8D5C0] text-[#6B4226] font-semibold text-sm hover:border-[#3D1F0E] transition"
//               >
//                 ← পেছনে
//               </button>
//               <button
//                 onClick={() => setStep('review')}
//                 className="flex-1 py-3.5 rounded-2xl bg-[#3D1F0E] text-[#F5E6D3] font-semibold text-sm hover:bg-[#2A1509] transition flex items-center justify-center gap-2"
//               >
//                 Review করুন <ChevronRight size={16} />
//               </button>
//             </div>
//           </>
//         )}

//         {/* ── STEP 3: Review & Place Order ─────────────────────────── */}
//         {step === 'review' && (
//           <>
//             <h2 className="text-sm font-semibold text-[#3D1F0E] uppercase tracking-wide">
//               🧾 অর্ডার Review
//             </h2>

//             {/* Items */}
//             <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
//               <div className="px-4 py-3 border-b border-[#F5E9DC]">
//                 <p className="text-xs font-semibold text-[#8B5E3C] uppercase tracking-wide">পণ্য সমূহ</p>
//               </div>
//               {items.map(item => (
//                 <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#F5E9DC] last:border-0">
//                   <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#F5E9DC] flex-shrink-0">
//                     <img
//                       src={item.variantImage || item.image}
//                       alt={item.name}
//                       className="w-full h-full object-cover"
//                       onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
//                     />
//                   </div>
//                   <div className="flex-1 min-w-0">
//                     <p className="text-sm font-medium text-[#1A0D06] line-clamp-1">{item.name}</p>
//                     {item.variantName && (
//                       <p className="text-xs text-[#8B5E3C]">{item.variantName}</p>
//                     )}
//                     <p className="text-xs text-[#6B4226]">
//                       {formatPrice(convertUSDtoBDT(item.price))} × {item.quantity}
//                     </p>
//                   </div>
//                   <p className="text-sm font-bold text-[#1A0D06] flex-shrink-0">
//                     {formatPrice(convertUSDtoBDT(item.price * item.quantity))}
//                   </p>
//                 </div>
//               ))}
//             </div>

//             {/* Address summary */}
//             {selectedAddress && (
//               <div className="bg-white rounded-2xl p-4 shadow-sm">
//                 <div className="flex items-center justify-between mb-2">
//                   <p className="text-xs font-semibold text-[#8B5E3C] uppercase tracking-wide">ঠিকানা</p>
//                   <button onClick={() => setStep('address')} className="text-xs text-[#3D1F0E] underline">পরিবর্তন</button>
//                 </div>
//                 <p className="text-sm font-semibold text-[#1A0D06]">{selectedAddress.fullName}</p>
//                 <p className="text-xs text-[#6B4226] mt-0.5">
//                   {selectedAddress.address}, {selectedAddress.zone}, {selectedAddress.city}
//                 </p>
//                 <p className="text-xs text-[#8B5E3C] mt-0.5">{selectedAddress.phoneNumber}</p>
//               </div>
//             )}

//             {/* Payment summary */}
//             <div className="bg-white rounded-2xl p-4 shadow-sm">
//               <div className="flex items-center justify-between mb-2">
//                 <p className="text-xs font-semibold text-[#8B5E3C] uppercase tracking-wide">পেমেন্ট</p>
//                 <button onClick={() => setStep('payment')} className="text-xs text-[#3D1F0E] underline">পরিবর্তন</button>
//               </div>
//               <p className="text-sm font-semibold text-[#1A0D06] capitalize">
//                 {PAYMENT_OPTIONS.find(p => p.id === paymentMethod)?.label}
//               </p>
//             </div>

//             {/* Price breakdown */}
//             <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
//               <p className="text-xs font-semibold text-[#8B5E3C] uppercase tracking-wide mb-1">মূল্য বিবরণ</p>
//               {[
//                 { label: 'Subtotal',  value: formatPrice(bdtSubtotal) },
//                 { label: 'Shipping',  value: shippingCost === 0 ? 'FREE' : formatPrice(bdtShipping) },
//                 { label: 'Tax (5%)',  value: formatPrice(bdtTax) },
//                 ...(discount > 0 ? [{ label: 'Discount', value: `-${formatPrice(bdtDiscount)}` }] : []),
//               ].map(row => (
//                 <div key={row.label} className="flex justify-between text-sm">
//                   <span className="text-[#8B5E3C]">{row.label}</span>
//                   <span className={`font-medium ${row.label === 'Discount' ? 'text-green-600' : 'text-[#1A0D06]'}`}>
//                     {row.value}
//                   </span>
//                 </div>
//               ))}
//               <div className="border-t border-[#E8D5C0] pt-2 flex justify-between">
//                 <span className="font-bold text-[#1A0D06]">Total</span>
//                 <span className="font-bold text-[#3D1F0E] text-lg">{formatPrice(bdtTotal)}</span>
//               </div>
//             </div>

//             {/* Error */}
//             {error && (
//               <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-2xl">
//                 ⚠️ {error}
//               </div>
//             )}

//             <div className="flex gap-3">
//               <button
//                 onClick={() => setStep('payment')}
//                 className="flex-1 py-3.5 rounded-2xl border-2 border-[#E8D5C0] text-[#6B4226] font-semibold text-sm hover:border-[#3D1F0E] transition"
//               >
//                 ← পেছনে
//               </button>
//               <button
//                 onClick={handlePlaceOrder}
//                 disabled={placing}
//                 className="flex-1 py-3.5 rounded-2xl bg-[#3D1F0E] text-[#F5E6D3] font-bold text-sm hover:bg-[#2A1509] transition disabled:opacity-60 flex items-center justify-center gap-2 active:scale-95"
//               >
//                 {placing ? (
//                   <><Loader2 size={16} className="animate-spin" /> Processing...</>
//                 ) : (
//                   <><ShoppingBag size={16} /> অর্ডার দিন</>
//                 )}
//               </button>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// }
