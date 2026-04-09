'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, ShoppingBag } from 'lucide-react';
import { formatPrice } from '@/utils/currency';
import CartStepper from '@/components/cart/CartStepper';
import BuyNowModal from '@/components/cart/BuyNowModal';

interface ProductCardProps {
  id: string;
  name: string;
  slug?: string;
  price: number;
  originalPrice?: number;
  image: string;
  category?: string;
}

export default function ProductCard({
  id,
  name,
  slug,
  price,
  originalPrice,
  image,
  category,
}: ProductCardProps) {
  const [isBuyNowOpen, setIsBuyNowOpen] = useState(false);
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const productHref = `/products/${slug || id}`;

  return (
    <>
      <Link href={productHref} className="group">
        <div className="bg-white rounded-lg shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
          {/* ── Image ─────────────────────────────────────────────────── */}
          <div className="relative aspect-square bg-gray-100 overflow-hidden">
            {image ? (
              <img
                src={image}
                alt={name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center">
                <Package className="w-16 h-16 text-pink-400" />
              </div>
            )}

            {discount > 0 && (
              <div className="absolute top-2 right-2 bg-pink-600 text-white text-xs font-bold px-2 py-1 rounded">
                -{discount}%
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 transition-opacity" />

            {/* ── Circle cart button — bottom-right ───────────────────── */}
            <div
              className="absolute bottom-2.5 right-2.5 z-10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <CartStepper
                productId={id}
                productName={name}
                productImage={image}
                price={price}
                circleAdd={true}
              />
            </div>
          </div>

          {/* ── Card body ─────────────────────────────────────────────── */}
          <div className="p-4">
            {category && <p className="text-xs text-gray-500 mb-1">{category}</p>}
            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{name}</h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-bold text-pink-600">{formatPrice(price)}</span>
              {originalPrice && (
                <span className="text-sm text-gray-400 line-through">
                  {formatPrice(originalPrice)}
                </span>
              )}
            </div>

            {/* Buy Now */}
            <div onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}>
              <button
                type="button"
                onClick={() => setIsBuyNowOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#3D1F0E] px-4 py-2.5 text-sm font-semibold text-[#F5E6D3] transition-all duration-200 hover:bg-[#2A1509]"
              >
                <ShoppingBag size={15} />
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </Link>

      <BuyNowModal
        isOpen={isBuyNowOpen}
        productId={id}
        productName={name}
        productImage={image}
        basePrice={price}
        onClose={() => setIsBuyNowOpen(false)}
      />
    </>
  );
}
