'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Truck,
} from 'lucide-react';
import CartStepper from '@/components/cart/CartStepper';
import ProductGallery from './ProductGallery';
import { GiftRequestButton, ShareButton } from './GiftShareButtons';
import ProductStickyHeader from './ProductStickyHeader';
import VariantSelector from './VariantSelector';
import StickyBottomBar from './StickyBottomBar';
import ReviewSection from './ReviewSection';

interface ImageItem {
  url: string;
  alt?: string;
  isDefault?: boolean;
}

interface Variant {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  attributes: Record<string, string> | null;
  image?: string;
  weight?: number | null;
}

interface Review {
  id: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  verified: boolean;
  createdAt: string;
}

interface RatingData {
  average: number;
  total: number;
  distribution: Record<number, number>;
}

interface RelatedProduct {
  id: string;
  name: string;
  price: number;
  originalPrice: number | null;
  image: string;
  slug: string;
  stock: number;
  hasVariants: boolean;
}

interface FrequentlyBoughtProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number | null;
  image: string;
  stock: number;
  hasVariants: boolean;
  orderCount: number;
  totalUnits: number;
}

interface RecentlyViewedProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice: number | null;
  image: string;
  stock: number;
  hasVariants: boolean;
}

interface ProductClientProps {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    shortDescription: string;
    price: number;
    originalPrice: number | null;
    image: string;
    images: ImageItem[] | string[];
    sku: string;
    stock: number;
    category: string;
    categorySlug?: string;
    brand: string;
    rating: number;
    reviews: number;
    inStock: boolean;
    isNew: boolean;
    ingredients?: string;
    skinType?: string[];
    codAvailable?: boolean;
    returnEligible?: boolean;
    weight?: number | null;
    variants: Variant[];
  };
  reviews: Review[];
  rating: RatingData;
  relatedProducts: RelatedProduct[];
  frequentlyBoughtTogether: FrequentlyBoughtProduct[];
  productUrl: string;
}

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '8801700000000';

function DeliveryEstimate() {
  const now = new Date();
  const hour = now.getHours();
  const isWeekend = now.getDay() === 5 || now.getDay() === 6;
  const dhakaLabel = hour < 15 && !isWeekend ? 'আগামীকাল' : 'পরশু';
  const outsideLabel = hour < 15 && !isWeekend ? '২-৩ দিনের মধ্যে' : '৩-৪ দিনের মধ্যে';

  return (
    <div className="rounded-xl bg-[#F5E9DC] p-3 space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-[#3D1F0E]">
        <Truck size={12} /> ডেলিভারি সময়
      </p>
      <div className="flex gap-3">
        <div className="flex flex-1 items-start gap-1.5">
          <MapPin size={11} className="mt-0.5 flex-shrink-0 text-[#8B5E3C]" />
          <div>
            <p className="text-xs font-semibold text-[#1A0D06]">ঢাকায়</p>
            <p className="text-xs font-medium text-green-600">{dhakaLabel} পাবেন</p>
            <p className="text-[10px] text-[#8B5E3C]">বিনামূল্যে ডেলিভারি</p>
          </div>
        </div>
        <div className="w-px bg-[#E8D5C0]" />
        <div className="flex flex-1 items-start gap-1.5">
          <MapPin size={11} className="mt-0.5 flex-shrink-0 text-[#8B5E3C]" />
          <div>
            <p className="text-xs font-semibold text-[#1A0D06]">সারাদেশে</p>
            <p className="text-xs font-medium text-[#3D1F0E]">{outsideLabel}</p>
            <p className="text-[10px] text-[#8B5E3C]">৳120 ডেলিভারি চার্জ</p>
          </div>
        </div>
      </div>
      {hour < 15 && !isWeekend && (
        <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
          <Clock size={10} className="flex-shrink-0 text-amber-600" />
          <p className="text-[10px] font-medium text-amber-700">
            আজ বিকেল ৩টার আগে অর্ডার করলে দ্রুত dispatch হবে।
          </p>
        </div>
      )}
    </div>
  );
}

function StockUrgency({ stock, inStock }: { stock: number; inStock: boolean }) {
  if (!inStock) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-red-500" />
        <span className="text-sm font-medium text-red-600">স্টক শেষ</span>
      </div>
    );
  }

  if (stock <= 10) {
    const pct = Math.max(10, Math.round((stock / 10) * 100));
    return (
      <div className="space-y-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-red-600">মাত্র {stock}টি বাকি</span>
          <span className="text-[10px] font-medium text-red-400">দ্রুত শেষ হচ্ছে</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-red-100">
          <div
            className="h-full rounded-full bg-red-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-red-400">এখনই অর্ডার করুন, মিস করবেন না।</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
      <span className="text-sm font-medium text-green-600">স্টকে আছে</span>
    </div>
  );
}

export default function ProductClient({
  product,
  reviews,
  rating,
  relatedProducts,
  frequentlyBoughtTogether,
  productUrl,
}: ProductClientProps) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    product.variants.length === 1 ? product.variants[0].id : null
  );
  const [currentPrice, setCurrentPrice] = useState(product.price);
  const [quantity, setQuantity] = useState(1);
  const [expandIngredients, setExpandIngredients] = useState(false);
  const [variantImageOverride, setVariantImageOverride] = useState<string | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedProduct[]>([]);

  const selectedVariantObj = product.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const variantSize = selectedVariantObj?.attributes?.size ?? null;
  const variantColor = selectedVariantObj?.attributes?.color ?? null;
  const variantImage = selectedVariantObj?.image ?? null;
  const variantNameLabel = selectedVariantObj
    ? [variantSize, variantColor].filter(Boolean).join(' / ') || selectedVariantObj.name
    : null;

  const requiresVariantSelection = product.variants.length > 0 && !selectedVariantObj;
  const activeStock = selectedVariantObj ? selectedVariantObj.stock : requiresVariantSelection ? 0 : product.stock;
  const activeInStock = !requiresVariantSelection && activeStock > 0;
  const discountPct =
    product.originalPrice && product.originalPrice > currentPrice
      ? Math.round(((product.originalPrice - currentPrice) / product.originalPrice) * 100)
      : null;
  const totalPrice = currentPrice * quantity;
  const galleryImages = (product.images as Array<string | { url: string; alt?: string }>).map((img) =>
    typeof img === 'string' ? { url: img, alt: product.name } : img
  );

  const handleVariantChange = useCallback((variantId: string | null, price: number, qty: number) => {
    setSelectedVariantId(variantId);
    setCurrentPrice(price);
    setQuantity(qty);
  }, []);

  const handleVariantImageChange = useCallback((imageUrl: string | null) => {
    setVariantImageOverride(imageUrl);
  }, []);

  useEffect(() => {
    const storageKey = 'minsah_recently_viewed_products';

    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? (JSON.parse(saved) as RecentlyViewedProduct[]) : [];
      const filtered = parsed.filter((item) => item.id !== product.id);
      setRecentlyViewed(filtered.slice(0, 8));

      const currentProduct: RecentlyViewedProduct = {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        originalPrice: product.originalPrice,
        image: product.image,
        stock: product.stock,
        hasVariants: product.variants.length > 0,
      };

      localStorage.setItem(
        storageKey,
        JSON.stringify([currentProduct, ...filtered].slice(0, 12))
      );
    } catch {
      setRecentlyViewed([]);
    }
  }, [
    product.id,
    product.slug,
    product.name,
    product.price,
    product.originalPrice,
    product.image,
    product.stock,
    product.variants.length,
  ]);

  return (
    <>
      <ProductStickyHeader
        productName={product.name}
        price={currentPrice}
        variantName={variantNameLabel}
        requiresVariantSelection={requiresVariantSelection}
        stock={activeStock}
        inStock={activeInStock}
      />

      <div className="mx-auto max-w-2xl lg:max-w-6xl">
        <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
          <div className="lg:sticky lg:top-20">
            <ProductGallery
              images={galleryImages}
              productName={product.name}
              discountPct={discountPct}
              isNew={product.isNew}
              overrideImage={variantImageOverride}
            />
          </div>

          <div className="space-y-5 px-4 pt-4 pb-36 lg:px-0 lg:pt-0 lg:pb-8">
            {(product.brand || product.category) && (
              <div className="flex flex-wrap items-center gap-2">
                {product.brand && (
                  <span className="rounded-full bg-[#F5E9DC] px-2.5 py-1 text-xs font-medium text-[#6B4226]">
                    {product.brand}
                  </span>
                )}
                {product.category && (
                  <span className="rounded-full bg-[#F5E9DC] px-2.5 py-1 text-xs font-medium text-[#6B4226]">
                    {product.category}
                  </span>
                )}
              </div>
            )}

            <div>
              <h1 className="text-xl font-semibold leading-tight text-[#1A0D06] md:text-2xl lg:text-3xl">
                {product.name}
              </h1>
              {rating.total > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg key={star} width="13" height="13" viewBox="0 0 24 24">
                        <path
                          fill={star <= Math.round(rating.average) ? '#F59E0B' : '#E5E7EB'}
                          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                        />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-[#1A0D06]">{rating.average.toFixed(1)}</span>
                  <span className="text-sm text-[#8B5E3C]">({rating.total} রিভিউ)</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-semibold text-[#1A0D06] md:text-3xl">
                ৳{currentPrice.toLocaleString('bn-BD')}
              </span>
              {product.originalPrice && product.originalPrice > currentPrice && (
                <span className="text-lg text-[#A0856A] line-through">
                  ৳{product.originalPrice.toLocaleString('bn-BD')}
                </span>
              )}
              {discountPct && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600">
                  {discountPct}% সাশ্রয়
                </span>
              )}
            </div>

            {requiresVariantSelection ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">ভ্যারিয়েন্ট সিলেক্ট করুন</p>
                <p className="mt-1 text-xs text-amber-700">
                  Add to cart করার আগে সাইজ বা শেড বেছে নিতে হবে।
                </p>
              </div>
            ) : (
              <StockUrgency stock={activeStock} inStock={activeInStock} />
            )}

            {activeInStock && <DeliveryEstimate />}

            {product.shortDescription && (
              <p className="text-sm leading-relaxed text-[#4A2C1A]">{product.shortDescription}</p>
            )}

            <div className="h-px bg-[#E8D5C0]" />

            <VariantSelector
              variants={product.variants}
              basePrice={product.price}
              baseStock={product.stock}
              onVariantChange={handleVariantChange}
              onImageChange={handleVariantImageChange}
            />

            {selectedVariantObj && (
              <div className="rounded-2xl bg-[#F5E9DC] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#3D1F0E]">
                      Selected Option
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#1A0D06]">{variantNameLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#8B5E3C]">Available</p>
                    <p
                      className={`text-sm font-semibold ${
                        selectedVariantObj.stock > 0 ? 'text-green-700' : 'text-red-600'
                      }`}
                    >
                      {selectedVariantObj.stock > 0 ? `${selectedVariantObj.stock} pcs` : 'Out of stock'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <GiftRequestButton
                  productId={product.id}
                  productName={product.name}
                  variantId={selectedVariantId}
                />
              </div>
              <ShareButton productName={product.name} productUrl={productUrl} />
            </div>

            {product.skinType && product.skinType.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#3D1F0E]">
                  উপযুক্ত ত্বকের ধরন
                </p>
                <div className="flex flex-wrap gap-2">
                  {product.skinType.map((type) => (
                    <span
                      key={type}
                      className="rounded-full bg-[#F5E9DC] px-3 py-1 text-xs font-medium text-[#6B4226]"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="h-px bg-[#E8D5C0]" />

            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: Truck, label: 'Fast Delivery', sub: 'Nationwide' },
                { icon: ShieldCheck, label: '100% Original', sub: 'Guaranteed' },
                {
                  icon: RotateCcw,
                  label: product.returnEligible ? '7 Days' : 'No Return',
                  sub: product.returnEligible ? 'Return' : 'Final sale',
                },
                {
                  icon: Smartphone,
                  label: product.codAvailable ? 'bKash / COD' : 'Online Pay',
                  sub: 'Payment',
                },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="rounded-xl bg-[#F5E9DC] p-2.5 text-center">
                  <Icon size={16} className="mx-auto mb-1 text-[#3D1F0E]" />
                  <p className="text-[10px] font-semibold leading-tight text-[#1A0D06]">{label}</p>
                  <p className="mt-0.5 text-[9px] text-[#8B5E3C]">{sub}</p>
                </div>
              ))}
            </div>

            {product.description && product.description !== product.shortDescription && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#3D1F0E]">
                  বিস্তারিত
                </p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#4A2C1A]">
                  {product.description}
                </p>
              </div>
            )}

            {product.ingredients && (
              <div className="overflow-hidden rounded-2xl border border-[#E8D5C0]">
                <button
                  onClick={() => setExpandIngredients(!expandIngredients)}
                  className="flex w-full items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Package size={14} className="text-[#3D1F0E]" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-[#3D1F0E]">
                      উপাদান
                    </span>
                  </div>
                  {expandIngredients ? (
                    <ChevronUp size={14} className="text-[#8B5E3C]" />
                  ) : (
                    <ChevronDown size={14} className="text-[#8B5E3C]" />
                  )}
                </button>
                {expandIngredients && (
                  <div className="px-4 pb-4">
                    <p className="text-xs leading-relaxed text-[#4A2C1A]">{product.ingredients}</p>
                  </div>
                )}
              </div>
            )}

            {rating.total > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#3D1F0E]">
                  কাস্টমার রিভিউ
                </p>
                <ReviewSection reviews={reviews} rating={rating} />
              </div>
            )}

            {relatedProducts.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#3D1F0E]">
                  সম্পর্কিত পণ্য
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {relatedProducts.slice(0, 4).map((relatedProduct) => {
                    const relatedDiscount =
                      relatedProduct.originalPrice && relatedProduct.originalPrice > relatedProduct.price
                        ? Math.round(
                            ((relatedProduct.originalPrice - relatedProduct.price) /
                              relatedProduct.originalPrice) *
                              100
                          )
                        : null;

                    return (
                      <div
                        key={relatedProduct.id}
                        className="overflow-hidden rounded-2xl bg-[#F5E9DC] transition-shadow hover:shadow-md"
                      >
                        <Link
                          href={`/products/${relatedProduct.slug}`}
                          className="block"
                        >
                        <div className="relative aspect-square">
                          <img
                            src={relatedProduct.image}
                            alt={relatedProduct.name}
                            className="h-full w-full object-cover"
                            onError={(event) => {
                              (event.target as HTMLImageElement).src = `https://placehold.co/200x200/F5E9DC/8B5E3C?text=${encodeURIComponent(
                                relatedProduct.name.slice(0, 4)
                              )}`;
                            }}
                          />
                          {relatedDiscount && (
                            <span className="absolute top-2 right-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                              -{relatedDiscount}%
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="line-clamp-2 text-xs font-medium leading-tight text-[#1A0D06]">
                            {relatedProduct.name}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#3D1F0E]">
                            ৳{relatedProduct.price.toLocaleString('bn-BD')}
                          </p>
                        </div>
                        </Link>
                        <div className="px-2.5 pb-2.5">
                          <CartStepper
                            productId={relatedProduct.id}
                            productName={relatedProduct.name}
                            productImage={relatedProduct.image}
                            price={relatedProduct.price}
                            maxStock={relatedProduct.stock}
                            hasRequiredVariants={relatedProduct.hasVariants}
                            className="w-full"
                            disabled={relatedProduct.stock === 0}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {frequentlyBoughtTogether.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#3D1F0E]">
                      Frequently Bought Together
                    </p>
                    <p className="mt-1 text-[11px] text-[#8B5E3C]">
                      Real delivered order history থেকে popular pairings
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {frequentlyBoughtTogether.map((bundleProduct) => {
                    const bundleDiscount =
                      bundleProduct.originalPrice && bundleProduct.originalPrice > bundleProduct.price
                        ? Math.round(
                            ((bundleProduct.originalPrice - bundleProduct.price) /
                              bundleProduct.originalPrice) *
                              100
                          )
                        : null;

                    return (
                      <div
                        key={bundleProduct.id}
                        className="overflow-hidden rounded-2xl bg-[#F5E9DC] transition-shadow hover:shadow-md"
                      >
                        <Link href={`/products/${bundleProduct.slug}`} className="block">
                          <div className="relative aspect-square">
                            <img
                              src={bundleProduct.image}
                              alt={bundleProduct.name}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                (event.target as HTMLImageElement).src = `https://placehold.co/200x200/F5E9DC/8B5E3C?text=${encodeURIComponent(
                                  bundleProduct.name.slice(0, 4)
                                )}`;
                              }}
                            />
                            {bundleDiscount && (
                              <span className="absolute top-2 right-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                -{bundleDiscount}%
                              </span>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="line-clamp-2 text-xs font-medium leading-tight text-[#1A0D06]">
                              {bundleProduct.name}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#3D1F0E]">
                              ৳{bundleProduct.price.toLocaleString('bn-BD')}
                            </p>
                            <p className="mt-1 text-[10px] text-[#8B5E3C]">
                              {bundleProduct.orderCount} orders together • {bundleProduct.totalUnits} units
                            </p>
                          </div>
                        </Link>
                        <div className="px-2.5 pb-2.5">
                          <CartStepper
                            productId={bundleProduct.id}
                            productName={bundleProduct.name}
                            productImage={bundleProduct.image}
                            price={bundleProduct.price}
                            maxStock={bundleProduct.stock}
                            hasRequiredVariants={bundleProduct.hasVariants}
                            className="w-full"
                            disabled={bundleProduct.stock === 0}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {recentlyViewed.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#3D1F0E]">
                  Recently Viewed
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {recentlyViewed.slice(0, 4).map((recentProduct) => {
                    const recentDiscount =
                      recentProduct.originalPrice && recentProduct.originalPrice > recentProduct.price
                        ? Math.round(
                            ((recentProduct.originalPrice - recentProduct.price) /
                              recentProduct.originalPrice) *
                              100
                          )
                        : null;

                    return (
                      <div
                        key={recentProduct.id}
                        className="overflow-hidden rounded-2xl bg-[#F5E9DC] transition-shadow hover:shadow-md"
                      >
                        <Link href={`/products/${recentProduct.slug}`} className="block">
                          <div className="relative aspect-square">
                            <img
                              src={recentProduct.image}
                              alt={recentProduct.name}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                (event.target as HTMLImageElement).src = `https://placehold.co/200x200/F5E9DC/8B5E3C?text=${encodeURIComponent(
                                  recentProduct.name.slice(0, 4)
                                )}`;
                              }}
                            />
                            {recentDiscount && (
                              <span className="absolute top-2 right-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                -{recentDiscount}%
                              </span>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="line-clamp-2 text-xs font-medium leading-tight text-[#1A0D06]">
                              {recentProduct.name}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#3D1F0E]">
                              ৳{recentProduct.price.toLocaleString('bn-BD')}
                            </p>
                          </div>
                        </Link>
                        <div className="px-2.5 pb-2.5">
                          <CartStepper
                            productId={recentProduct.id}
                            productName={recentProduct.name}
                            productImage={recentProduct.image}
                            price={recentProduct.price}
                            maxStock={recentProduct.stock}
                            hasRequiredVariants={recentProduct.hasVariants}
                            className="w-full"
                            disabled={recentProduct.stock === 0}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <StickyBottomBar
        productId={product.id}
        productName={product.name}
        productImage={product.image}
        price={totalPrice}
        unitPrice={currentPrice}
        weightKg={product.weight ?? null}
        variantId={selectedVariantId}
        variantName={variantNameLabel}
        size={variantSize}
        color={variantColor}
        variantImage={variantImage}
        variants={product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          price: variant.price,
          stock: variant.stock,
          image: variant.image ?? null,
          weight: variant.weight ?? product.weight ?? null,
          attributes: (variant.attributes ?? {}) as Record<string, string>,
        }))}
        quantity={quantity}
        maxStock={activeStock}
        inStock={activeInStock}
        requiresVariantSelection={requiresVariantSelection}
        whatsappNumber={WHATSAPP_NUMBER}
      />
    </>
  );
}
