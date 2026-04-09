'use client';

import { useCart } from '@/contexts/CartContext';
import Link from 'next/link';
import { Minus, Plus, Trash2, ArrowLeft, ShoppingCart, Heart, Home } from 'lucide-react';
import { formatPrice, convertUSDtoBDT } from '@/utils/currency';

export default function CartPage() {
  const {
    items,
    updateQuantity,
    removeItem,
    subtotal,
    shippingCost,
    tax,
    total,
    promoCode,
    setPromoCode,
    applyPromoCode,
    discount,
  } = useCart();

  const handleQuantityChange = (itemId: string, delta: number) => {
    const item = items.find(i => i.id === itemId);
    if (item) updateQuantity(itemId, item.quantity + delta);
  };

  const bdtSubtotal = convertUSDtoBDT(subtotal);
  const bdtShipping = convertUSDtoBDT(shippingCost);
  const bdtTax      = convertUSDtoBDT(tax);
  const bdtTotal    = convertUSDtoBDT(total);

  return (
    <div className="min-h-screen bg-[#FDF8F3]">
      {/* Header */}
      <header className="bg-[#3D1F0E] text-[#F5E6D3] sticky top-0 z-50 shadow-md">
        <div className="px-4 py-4 flex items-center justify-between">
          <Link href="/shop" className="p-2 hover:bg-[#2A1509] rounded-lg transition">
            <ArrowLeft size={24} />
          </Link>
          <h1 className="text-xl font-semibold">Cart</h1>
          <Link href="/cart" className="p-2 relative">
            <ShoppingCart size={24} />
            {items.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#F5E6D3] text-[#3D1F0E] text-xs w-5 h-5 flex items-center justify-center rounded-full font-bold">
                {items.length}
              </span>
            )}
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
          <div className="bg-[#F5E9DC] rounded-full p-8 mb-6">
            <ShoppingCart size={64} className="text-[#3D1F0E]" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A0D06] mb-2">Your cart is empty</h2>
          <p className="text-[#8B5E3C] mb-6 text-center">Add some beautiful products to get started!</p>
          <Link href="/shop" className="bg-[#3D1F0E] text-[#F5E6D3] px-8 py-3 rounded-lg font-semibold hover:bg-[#2A1509] transition">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="pb-36">

          {/* Cart Items */}
          <div className="px-4 py-4 space-y-3">
            {items.map((item) => {
              const displayImage = item.variantImage || item.image;
              const itemTotal    = item.price * item.quantity;

              return (
                <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex gap-3">

                    {/* Image */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-[#F5E9DC]">
                      {displayImage ? (
                        <img src={displayImage} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">✨</div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      {/* Product name */}
                      <h3 className="font-semibold text-[#1A0D06] text-sm leading-snug line-clamp-2">
                        {item.name}
                      </h3>

                      {/* Variant badges */}
                      {(item.size || item.color || item.variantName) && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {item.size && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-[#F5E9DC] text-[#6B4226] px-2 py-0.5 rounded-full">
                              📏 {item.size}
                            </span>
                          )}
                          {item.color && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-[#F5E9DC] text-[#6B4226] px-2 py-0.5 rounded-full">
                              🎨 {item.color}
                            </span>
                          )}
                          {/* fallback: show variantName if no size/color */}
                          {!item.size && !item.color && item.variantName && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-[#F5E9DC] text-[#6B4226] px-2 py-0.5 rounded-full">
                              {item.variantName}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Price per unit */}
                      <p className="text-sm font-bold text-[#3D1F0E] mt-1.5">
                        {formatPrice(convertUSDtoBDT(item.price))}
                        <span className="text-[10px] font-normal text-[#8B5E3C] ml-1">/ পিস</span>
                      </p>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0 self-start"
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Quantity + subtotal row */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#F5E9DC]">

                    {/* Quantity stepper */}
                    <div className="flex items-center h-9 rounded-xl border-2 border-[#3D1F0E] overflow-hidden">
                      <button
                        onClick={() => handleQuantityChange(item.id, -1)}
                        className="w-9 h-full flex items-center justify-center text-[#3D1F0E] hover:bg-[#F5E9DC] transition"
                        aria-label="Decrease"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-9 text-center text-sm font-bold text-[#1A0D06]">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.id, 1)}
                        className="w-9 h-full flex items-center justify-center text-[#3D1F0E] hover:bg-[#F5E9DC] transition"
                        aria-label="Increase"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    {/* Line total */}
                    <div className="text-right">
                      <p className="text-[10px] text-[#8B5E3C]">
                        {formatPrice(convertUSDtoBDT(item.price))} × {item.quantity}
                      </p>
                      <p className="text-base font-bold text-[#1A0D06]">
                        {formatPrice(convertUSDtoBDT(itemTotal))}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Promo Code */}
          <div className="px-4 mb-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="font-semibold text-[#1A0D06] mb-3 text-sm">Promo code</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Enter code"
                  className="flex-1 px-4 py-2 border border-[#E8D5C0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3D1F0E]"
                />
                <button
                  onClick={applyPromoCode}
                  className="bg-[#3D1F0E] text-[#F5E6D3] px-5 py-2 rounded-lg font-semibold text-sm hover:bg-[#2A1509] transition whitespace-nowrap"
                >
                  Apply Code
                </button>
              </div>
              {discount > 0 && (
                <p className="text-green-600 text-xs mt-2">
                  ✓ Promo applied! Saved {formatPrice(convertUSDtoBDT(discount))}
                </p>
              )}
            </div>
          </div>

          {/* Order Summary */}
          <div className="px-4 mb-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2.5">
              <h3 className="font-semibold text-[#1A0D06] text-sm mb-1">অর্ডার সারসংক্ষেপ</h3>

              {/* Per-item summary */}
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-[#6B4226]">
                  <span className="flex-1 pr-2 truncate">
                    {item.name}
                    {item.variantName && (
                      <span className="text-[#8B5E3C]"> ({item.variantName})</span>
                    )}
                    {' '}× {item.quantity}
                  </span>
                  <span className="font-medium flex-shrink-0">
                    {formatPrice(convertUSDtoBDT(item.price * item.quantity))}
                  </span>
                </div>
              ))}

              <div className="border-t border-[#F5E9DC] pt-2 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#8B5E3C]">Subtotal</span>
                  <span className="font-semibold text-[#1A0D06]">{formatPrice(bdtSubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#8B5E3C]">Shipping</span>
                  <span className="font-semibold text-[#1A0D06]">
                    {shippingCost === 0 ? 'FREE' : formatPrice(bdtShipping)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#8B5E3C]">Tax (5%)</span>
                  <span className="font-semibold text-[#1A0D06]">{formatPrice(bdtTax)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span className="font-semibold">-{formatPrice(convertUSDtoBDT(discount))}</span>
                  </div>
                )}
                <div className="border-t border-[#E8D5C0] pt-2 flex justify-between">
                  <span className="font-bold text-[#1A0D06]">Total</span>
                  <span className="font-bold text-[#3D1F0E] text-lg">{formatPrice(bdtTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checkout + Bottom Nav */}
      {items.length > 0 && (
        <>
          <div className="fixed bottom-16 left-0 right-0 px-4 pb-3 bg-gradient-to-t from-[#FDF8F3] via-[#FDF8F3] to-transparent pt-4">
            <Link
              href="/checkout"
              className="block w-full bg-[#3D1F0E] text-[#F5E6D3] text-center py-4 rounded-2xl font-bold text-base shadow-lg hover:bg-[#2A1509] transition"
            >
              Checkout
            </Link>
          </div>

          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8D5C0] shadow-lg">
            <div className="flex items-center justify-around py-3">
              <Link href="/" className="flex flex-col items-center gap-1 text-[#8B5E3C] hover:text-[#3D1F0E] transition">
                <Home size={22} /><span className="text-xs">Home</span>
              </Link>
              <Link href="/wishlist" className="flex flex-col items-center gap-1 text-[#8B5E3C] hover:text-[#3D1F0E] transition">
                <Heart size={22} /><span className="text-xs">Wishlist</span>
              </Link>
              <Link href="/cart" className="flex flex-col items-center gap-1 text-[#3D1F0E]">
                <ShoppingCart size={22} /><span className="text-xs font-semibold">Cart</span>
              </Link>
              <Link href="/login" className="flex flex-col items-center gap-1 text-[#8B5E3C] hover:text-[#3D1F0E] transition">
                <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs">Account</span>
              </Link>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
