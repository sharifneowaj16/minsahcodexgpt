'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react';
import CardBuyNowActionRow from '@/components/cart/CardBuyNowActionRow';
import { useCart } from '@/contexts/CartContext';
import { useProducts } from '@/contexts/ProductsContext';
import { formatPrice } from '@/utils/currency';

interface Suggestion {
  text: string;
  slug?: string;
  productName?: string;
  price?: number;
  image?: string;
}

interface HomeCategory {
  id: string;
  name: string;
  slug: string;
  href: string;
  icon?: string;
  productCount?: number;
}

interface HomeCardProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  stock: number;
  rating: number;
  reviews: number;
  hasVariants: boolean;
  urlSlug?: string;
}

const categoryBackgrounds = [
  'from-rose-100 to-orange-50',
  'from-amber-100 to-stone-50',
  'from-orange-100 to-rose-50',
  'from-stone-100 to-amber-50',
  'from-red-100 to-orange-50',
  'from-yellow-100 to-amber-50',
];

function toSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function isImageSource(value?: string) {
  return Boolean(value) && (
    value!.startsWith('/') ||
    value!.startsWith('http') ||
    value!.startsWith('data:')
  );
}

function productHref(product: { id: string; urlSlug?: string }) {
  return `/products/${product.urlSlug || product.id}`;
}

function ProductMedia({ src, alt }: { src: string; alt: string }) {
  if (isImageSource(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-full w-full object-cover" />;
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-minsah-accent to-white">
      {src ? (
        <span className="px-4 text-center text-2xl font-semibold text-minsah-primary">{src}</span>
      ) : (
        <Package className="h-10 w-10 text-minsah-secondary/50" />
      )}
    </div>
  );
}

function SectionHeader({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-minsah-secondary">
          Minsah Beauty
        </p>
        <h2 className="text-2xl font-bold text-minsah-dark sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-minsah-secondary sm:text-base">
          {description}
        </p>
      </div>
      {href && label && (
        <Link
          href={href}
          className="inline-flex items-center gap-2 self-start rounded-full border border-minsah-primary/15 bg-white px-4 py-2 text-sm font-semibold text-minsah-primary transition hover:border-minsah-primary/35 hover:bg-minsah-accent/40"
        >
          {label}
          <ChevronRight size={16} />
        </Link>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: HomeCardProduct }) {
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="rounded-[1.6rem] border border-white/70 bg-white p-4 shadow-[0_18px_48px_-36px_rgba(66,28,0,0.65)]">
      <Link href={productHref(product)} className="group block">
        <div className="relative overflow-hidden rounded-[1.3rem] bg-minsah-light">
          <div className="aspect-[4/4.2] overflow-hidden">
            <ProductMedia src={product.image} alt={product.name} />
          </div>
          {discount > 0 && (
            <span className="absolute left-3 top-3 rounded-full bg-[#8E1F15] px-3 py-1 text-xs font-bold text-white">
              Save {discount}%
            </span>
          )}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-minsah-secondary">
          {product.brand || product.category}
        </p>
        <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-minsah-dark transition group-hover:text-minsah-primary">
          {product.name}
        </h3>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-xl font-bold text-minsah-primary">{formatPrice(product.price)}</span>
          {product.originalPrice && product.originalPrice > product.price && (
            <span className="pb-0.5 text-sm text-minsah-secondary/70 line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-minsah-secondary">
          <span className="inline-flex items-center gap-1">
            <Star size={12} className="fill-amber-400 text-amber-400" />
            {product.rating.toFixed(1)}
          </span>
          <span>{product.reviews} reviews</span>
        </div>
      </Link>

      <div className="mt-4">
        <CardBuyNowActionRow
          productId={product.id}
          productName={product.name}
          productImage={product.image}
          price={product.price}
          maxStock={product.stock}
          hasRequiredVariants={product.hasVariants}
          className="w-full"
          stepperClassName="min-w-0 flex-1"
          buttonClassName="min-w-0 flex-1 px-2"
          disabled={product.stock < 1}
        />
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="rounded-[1.6rem] border border-white/70 bg-white p-4 shadow-[0_18px_48px_-36px_rgba(66,28,0,0.65)]">
      <div className="aspect-[4/4.2] animate-pulse rounded-[1.3rem] bg-minsah-accent/70" />
      <div className="mt-4 space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-minsah-accent/70" />
        <div className="h-5 w-full animate-pulse rounded bg-minsah-accent/60" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-minsah-accent/60" />
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { items } = useCart();
  const { products, loading } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categories, setCategories] = useState<HomeCategory[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  const handleSearch = useCallback((query = searchQuery) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setShowSuggestions(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [router, searchQuery]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(trimmed)}&limit=6`);
        if (!response.ok) return;
        const data = await response.json();
        const next = Array.isArray(data.suggestions) ? data.suggestions : [];
        setSuggestions(next);
        setShowSuggestions(next.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/api/categories?activeOnly=true')
      .then((response) => response.json())
      .then((data) => {
        if (!mounted || !Array.isArray(data.categories)) return;
        setCategories(data.categories.map((category: {
          id: string;
          name: string;
          slug: string;
          href?: string;
          icon?: string;
          productCount?: number;
        }) => ({
          id: category.id,
          name: category.name,
          slug: category.slug,
          href: category.href || `/shop?category=${encodeURIComponent(category.slug)}`,
          icon: category.icon,
          productCount: category.productCount,
        })));
      })
      .catch(() => setCategories([]));

    return () => {
      mounted = false;
    };
  }, []);

  const activeProducts = useMemo(
    () => products.filter((product) => product.status === 'active'),
    [products]
  );

  const fallbackCategories = useMemo<HomeCategory[]>(
    () =>
      [...new Set(activeProducts.map((product) => product.category).filter(Boolean))]
        .slice(0, 6)
        .map((name, index) => ({
          id: `fallback-${index}-${name}`,
          name,
          slug: toSlug(name),
          href: `/shop?category=${encodeURIComponent(name)}`,
          icon: undefined,
          productCount: activeProducts.filter((product) => product.category === name).length,
        })),
    [activeProducts]
  );

  const displayCategories = categories.length > 0 ? categories : fallbackCategories;

  const mapProduct = useCallback((product: (typeof activeProducts)[number]): HomeCardProduct => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
    originalPrice: product.originalPrice,
    image: product.image,
    stock: product.stock,
    rating: product.rating || 0,
    reviews: product.reviews || 0,
    hasVariants: Boolean(product.variants?.length),
    urlSlug: product.urlSlug,
  }), []);

  const featuredProducts = useMemo(
    () => [...activeProducts]
      .sort((a, b) => (Number(b.featured) - Number(a.featured)) || b.rating - a.rating || b.reviews - a.reviews)
      .slice(0, 4)
      .map(mapProduct),
    [activeProducts, mapProduct]
  );

  const newArrivals = useMemo(
    () => [...activeProducts]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 2)
      .map(mapProduct),
    [activeProducts, mapProduct]
  );

  const dealProducts = useMemo(
    () => [...activeProducts]
      .filter((product) => product.originalPrice != null && product.originalPrice > product.price)
      .sort((a, b) => (((b.originalPrice || b.price) - b.price) / (b.originalPrice || b.price)) - (((a.originalPrice || a.price) - a.price) / (a.originalPrice || a.price)))
      .slice(0, 2)
      .map(mapProduct),
    [activeProducts, mapProduct]
  );

  const topRated = useMemo(
    () => [...activeProducts]
      .sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
      .slice(0, 4)
      .map(mapProduct),
    [activeProducts, mapProduct]
  );

  const topBrands = useMemo(
    () => Object.values(activeProducts.reduce<Record<string, { name: string; slug: string; count: number }>>((acc, product) => {
      if (!product.brand) return acc;
      const slug = toSlug(product.brand);
      if (!acc[slug]) acc[slug] = { name: product.brand, slug, count: 0 };
      acc[slug].count += 1;
      return acc;
    }, {})).sort((a, b) => b.count - a.count).slice(0, 6),
    [activeProducts]
  );

  const heroProducts = featuredProducts.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#fff9f4] text-minsah-dark">
      <div className="border-b border-minsah-primary/10 bg-[#f7e6d6] px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.22em] text-minsah-dark sm:text-sm">
        Fresh arrivals, better discovery, and stronger product merchandising from the first scroll.
      </div>

      <header className="sticky top-0 z-40 border-b border-white/60 bg-[#fff9f4]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-minsah-dark text-sm font-bold uppercase tracking-[0.22em] text-white">
              MB
            </div>
            <div>
              <p className="font-[var(--font-tenor-sans)] text-xl tracking-[0.16em]">Minsah</p>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-minsah-secondary">Beauty House</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-minsah-secondary lg:flex">
            <Link href="/shop" className="transition hover:text-minsah-primary">Shop</Link>
            <Link href="/categories" className="transition hover:text-minsah-primary">Categories</Link>
            <Link href="/brands" className="transition hover:text-minsah-primary">Brands</Link>
            <Link href="/search" className="transition hover:text-minsah-primary">Search</Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/wishlist" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-minsah-primary/10 bg-white text-minsah-dark transition hover:border-minsah-primary/30 hover:text-minsah-primary">
              <Heart size={18} />
            </Link>
            <Link href="/cart" className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-minsah-primary/10 bg-white text-minsah-dark transition hover:border-minsah-primary/30 hover:text-minsah-primary">
              <ShoppingCart size={18} />
              {items.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#8E1F15] px-1 text-[10px] font-bold text-white">
                  {items.length}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-gradient-to-br from-[#fff3e8] via-[#f7e2d2] to-[#efcfb8] shadow-[0_36px_90px_-48px_rgba(66,28,0,0.55)]">
            <div className="absolute -left-20 top-12 h-48 w-48 rounded-full bg-white/35 blur-3xl" />
            <div className="absolute bottom-0 right-8 h-40 w-40 rounded-full bg-[#c8895b]/20 blur-3xl" />
            <div className="relative grid gap-10 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-12">
              <div className="max-w-2xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-minsah-secondary">
                  <Sparkles size={14} />
                  Homepage refresh
                </span>
                <h1 className="mt-6 font-[var(--font-tenor-sans)] text-4xl leading-tight sm:text-5xl lg:text-6xl">
                  Beauty discovery that feels curated, not crowded.
                </h1>
                <p className="mt-5 max-w-xl text-base leading-7 text-minsah-secondary sm:text-lg">
                  Stronger search, cleaner category entry points, sharper product cards, and a layout that works on mobile and desktop.
                </p>

                <div ref={searchRef} className="relative mt-8 max-w-2xl">
                  <div className="flex flex-col gap-3 rounded-[1.6rem] border border-white/80 bg-white/90 p-3 shadow-[0_20px_50px_-34px_rgba(66,28,0,0.55)] sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-[#fff9f4] px-4 py-3">
                      <Search size={18} className="text-minsah-secondary" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setSearchQuery(nextValue);
                          if (nextValue.trim().length < 2) {
                            setSuggestions([]);
                            setShowSuggestions(false);
                          }
                        }}
                        onKeyDown={(event) => event.key === 'Enter' && handleSearch()}
                        onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                        placeholder="Search by product, brand, or routine"
                        className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-minsah-secondary/80 focus:outline-none sm:text-base"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSearch()}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-minsah-dark px-6 py-3 text-sm font-semibold text-white transition hover:bg-minsah-primary"
                    >
                      Find products
                      <ArrowRight size={16} />
                    </button>
                  </div>

                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-3 overflow-hidden rounded-[1.3rem] border border-minsah-primary/10 bg-white shadow-[0_22px_60px_-32px_rgba(66,28,0,0.55)]">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={`${suggestion.slug || suggestion.text}-${index}`}
                          type="button"
                          onClick={() => suggestion.slug ? router.push(`/products/${suggestion.slug}`) : handleSearch(suggestion.text)}
                          className="flex w-full items-center gap-3 border-b border-stone-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-minsah-accent/35"
                        >
                          <div className="h-11 w-11 overflow-hidden rounded-xl bg-minsah-light">
                            <ProductMedia src={suggestion.image || ''} alt={suggestion.productName || suggestion.text} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-minsah-dark">
                              {suggestion.productName || suggestion.text}
                            </p>
                            {typeof suggestion.price === 'number' && suggestion.price > 0 && (
                              <p className="mt-1 text-xs font-medium text-minsah-secondary">{formatPrice(suggestion.price)}</p>
                            )}
                          </div>
                          <ChevronRight size={16} className="text-minsah-secondary" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {displayCategories.slice(0, 4).map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleSearch(category.name)}
                      className="rounded-full border border-white/80 bg-white/70 px-4 py-2 text-sm font-medium transition hover:border-minsah-primary/25 hover:bg-white"
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                <div className="mt-10 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[1.4rem] border border-white/80 bg-white/70 p-4">
                    <Truck size={18} className="text-minsah-primary" />
                    <p className="mt-3 text-sm font-semibold">Fast dispatch</p>
                    <p className="mt-2 text-sm leading-6 text-minsah-secondary">Clear paths into ready-to-ship products.</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/80 bg-white/70 p-4">
                    <ShieldCheck size={18} className="text-minsah-primary" />
                    <p className="mt-3 text-sm font-semibold">Trusted checkout</p>
                    <p className="mt-2 text-sm leading-6 text-minsah-secondary">Visible stock, pricing, and cart actions.</p>
                  </div>
                  <div className="rounded-[1.4rem] border border-white/80 bg-white/70 p-4">
                    <Sparkles size={18} className="text-minsah-primary" />
                    <p className="mt-3 text-sm font-semibold">Curated edits</p>
                    <p className="mt-2 text-sm leading-6 text-minsah-secondary">Featured, discounted, and top-rated blocks.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 self-end lg:pl-6">
                <div className="relative overflow-hidden rounded-[1.8rem] border border-white/70 bg-[#f7e4d5] p-4 shadow-[0_24px_60px_-36px_rgba(66,28,0,0.55)]">
                  <div className="overflow-hidden rounded-[1.3rem]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/hero-image.jpg" alt="Minsah Beauty hero" className="h-[340px] w-full object-cover sm:h-[420px]" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {heroProducts.map((product) => (
                    <Link key={product.id} href={productHref(product)} className="rounded-[1.3rem] border border-white/80 bg-white/80 p-3 transition hover:-translate-y-1 hover:bg-white">
                      <div className="overflow-hidden rounded-[1rem] bg-minsah-light">
                        <div className="aspect-square">
                          <ProductMedia src={product.image} alt={product.name} />
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-semibold leading-5">{product.name}</p>
                      <p className="mt-1 text-sm font-bold text-minsah-primary">{formatPrice(product.price)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeader
            title="Shop by category"
            description="Clean category cards make the homepage easier to scan and give shoppers direct entry points into the catalog."
            href="/categories"
            label="Browse categories"
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {displayCategories.slice(0, 6).map((category, index) => (
              <Link
                key={category.id}
                href={category.href}
                className={`group rounded-[1.6rem] border border-white/70 bg-gradient-to-br ${categoryBackgrounds[index % categoryBackgrounds.length]} p-5 shadow-[0_20px_45px_-35px_rgba(66,28,0,0.6)] transition duration-300 hover:-translate-y-1`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/80 ring-1 ring-minsah-primary/10">
                    {isImageSource(category.icon) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={category.icon} alt={category.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-lg font-semibold uppercase tracking-[0.12em] text-minsah-primary">
                        {category.name.slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-minsah-secondary">
                    {category.productCount ?? 0}+ items
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{category.name}</h3>
                <p className="mt-2 text-sm text-minsah-secondary">Explore curated picks, essentials, and best-sellers.</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-minsah-primary">
                  Shop this category
                  <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <SectionHeader
            title="Featured products"
            description="The homepage now leads with real merchandisable product cards instead of static placeholder sections."
            href="/shop"
            label="See all products"
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {loading && Array.from({ length: 4 }).map((_, index) => <HomeSkeleton key={index} />)}
            {!loading && featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <SectionHeader
                title="Best deals"
                description="Discounted items are surfaced in a polished grid instead of being buried behind a generic banner."
                href="/flash-sale"
                label="Go to flash sale"
              />
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {loading && Array.from({ length: 2 }).map((_, index) => <HomeSkeleton key={`deal-${index}`} />)}
                {!loading && dealProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
                {!loading && dealProducts.length === 0 && (
                  <div className="rounded-[1.6rem] border border-dashed border-minsah-primary/20 bg-white p-6 text-sm leading-7 text-minsah-secondary sm:col-span-2">
                    Discounted products will appear here automatically once compare-at pricing is available in the catalog.
                  </div>
                )}
              </div>
            </div>

            <div>
              <SectionHeader
                title="New arrivals"
                description="Fresh products stay visible without making the homepage feel cluttered."
                href="/new-arrivals"
                label="View new arrivals"
              />
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {loading && Array.from({ length: 2 }).map((_, index) => <HomeSkeleton key={`arrival-${index}`} />)}
                {!loading && newArrivals.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <SectionHeader
            title="Top-rated formulas"
            description="Ratings and review count now support a dedicated trust-building section."
            href="/recommendations"
            label="Browse recommendations"
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {loading && Array.from({ length: 4 }).map((_, index) => <HomeSkeleton key={`rated-${index}`} />)}
            {!loading && topRated.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:pb-16">
          <div className="overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#3b1f11] via-[#5d3215] to-[#7a4419] p-8 text-white shadow-[0_28px_70px_-40px_rgba(66,28,0,0.85)] sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/65">Brand spotlight</p>
                <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Built for discovery, with room to scale.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/80 sm:text-base">
                  The homepage now has a clearer visual hierarchy and enough structure to plug in promotions, admin-driven sections, or seasonal campaigns later.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 lg:justify-end">
                {topBrands.map((brand) => (
                  <Link
                    key={brand.slug}
                    href={`/shop?brand=${encodeURIComponent(brand.slug)}`}
                    className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    {brand.name}
                    <span className="ml-2 text-white/60">({brand.count})</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}



// 'use client';

// import { useCart } from '@/contexts/CartContext';
// import { useProducts } from '@/contexts/ProductsContext';
// import Link from 'next/link';
// import { useRouter } from 'next/navigation';
// import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// import { Search, Heart, ShoppingCart, Home as HomeIcon, User, ChevronRight, Flame } from 'lucide-react';
// import { formatPrice } from '@/utils/currency';
// import CardBuyNowActionRow from '@/components/cart/CardBuyNowActionRow';

// // Helper: render a real image URL or fall back to emoji text
// function ProductImage({ src, alt }: { src: string; alt: string }) {
//   const isUrl = src.startsWith('/') || src.startsWith('http') || src.startsWith('data:');
//   if (isUrl) {
//     return <img src={src} alt={alt} className="w-full h-full object-cover rounded-inherit" />;
//   }
//   return <span className="text-4xl">{src}</span>;
// }

// const brands = [
//   { name: 'MAC', logo: 'MAC' },
//   { name: 'Dior', logo: 'Dior' },
//   { name: 'Fenty Beauty', logo: 'FENTY\nBEAUTY' },
//   { name: 'Chanel', logo: 'CHANEL' },
// ];

// const CATEGORY_COLORS = [
//   'bg-pink-100',
//   'bg-blue-100',
//   'bg-purple-100',
//   'bg-yellow-100',
//   'bg-green-100',
//   'bg-orange-100',
//   'bg-red-100',
//   'bg-teal-100',
// ];

// const DEFAULT_CATEGORY_ICON = '🏷️';


// const comboSlides = [
//   {
//     title: 'Best Value Combos',
//     description: 'Save More with Our Curated Sets',
//     gradient: 'from-minsah-primary via-minsah-secondary to-minsah-dark',
//     image: '🎁'
//   },
//   {
//     title: 'Premium Combo Deals',
//     description: 'Luxury Beauty at Great Prices',
//     gradient: 'from-purple-600 via-pink-500 to-orange-400',
//     image: '💎'
//   },
//   {
//     title: 'Complete Care Sets',
//     description: 'Everything You Need in One Box',
//     gradient: 'from-blue-500 via-teal-400 to-green-400',
//     image: '✨'
//   },
// ];

// interface Suggestion {
//   text: string;
//   slug: string;
//   productName: string;
//   price: number;
//   image?: string;
// }

// interface HomeProductCardItem {
//   id: string;
//   name: string;
//   price: number;
//   image: string;
//   stock: number;
//   hasVariants: boolean;
// }

// export default function HomePage() {
//   const router = useRouter();
//   const { items } = useCart();
//   const { products } = useProducts();
//   const [searchQuery, setSearchQuery] = useState('');
//   const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
//   const [showSuggestions, setShowSuggestions] = useState(false);
//   const searchRef = useRef<HTMLDivElement>(null);

//   const handleSearch = useCallback(() => {
//     const q = searchQuery.trim();
//     if (q) {
//       setShowSuggestions(false);
//       router.push(`/shop?q=${encodeURIComponent(q)}`);
//     }
//   }, [searchQuery, router]);

//   // Fetch suggestions with debounce
//   useEffect(() => {
//     const q = searchQuery.trim();
//     if (q.length < 2) {
//       setSuggestions([]);
//       setShowSuggestions(false);
//       return;
//     }
//     const timer = setTimeout(async () => {
//       try {
//         const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}&limit=6`);
//         if (!res.ok) return;
//         const data = await res.json();
//         setSuggestions(data.suggestions ?? []);
//         setShowSuggestions(true);
//       } catch {
//         // silently ignore
//       }
//     }, 300);
//     return () => clearTimeout(timer);
//   }, [searchQuery]);

//   // Close dropdown when clicking outside
//   useEffect(() => {
//     const handleClickOutside = (e: MouseEvent) => {
//       if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
//         setShowSuggestions(false);
//       }
//     };
//     document.addEventListener('mousedown', handleClickOutside);
//     return () => document.removeEventListener('mousedown', handleClickOutside);
//   }, []);
//   const [currentSlide, setCurrentSlide] = useState(0);
//   const [currentComboSlide, setCurrentComboSlide] = useState(0);
//   const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 7, minutes: 33, seconds: 28 });
//   const [categories, setCategories] = useState<{ id: string; name: string; slug: string; icon: string; color: string }[]>([]);

//   const activeProducts = useMemo(
//     () => products.filter(p => p.status === 'active'),
//     [products]
//   );

//   // New Arrivals: most recently added active products
//   const newArrivals = useMemo(
//     () =>
//       [...activeProducts]
//         .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
//         .slice(0, 8)
//         .map(p => ({
//           id: p.id,
//           name: p.name,
//           price: p.price,
//           image: p.image,
//           sku: p.category,
//           stock: p.stock,
//           hasVariants: Boolean(p.variants?.length),
//         })),
//     [activeProducts]
//   );

//   // For You: first 6 active products
//   const forYouProducts = useMemo(
//     () =>
//       activeProducts.slice(0, 6).map(p => ({
//         id: p.id,
//         name: p.name,
//         price: p.price,
//         image: p.image,
//         stock: p.stock,
//         hasVariants: Boolean(p.variants?.length),
//       })),
//     [activeProducts]
//   );

//   // Recommendations: highest-rated active products
//   const recommendations = useMemo(
//     () =>
//       [...activeProducts]
//         .sort((a, b) => b.rating - a.rating)
//         .slice(0, 6)
//         .map(p => ({
//           id: p.id,
//           name: p.name,
//           price: p.price,
//           rating: Math.round(p.rating),
//           reviews: p.reviews,
//           image: p.image,
//           stock: p.stock,
//           hasVariants: Boolean(p.variants?.length),
//         })),
//     [activeProducts]
//   );

//   // Favourites: featured active products, fallback to any active
//   const favourites = useMemo(
//     () =>
//       [...activeProducts]
//         .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
//         .slice(0, 6)
//         .map(p => ({
//           id: p.id,
//           name: p.name,
//           price: p.price,
//           rating: Math.round(p.rating),
//           reviews: p.reviews,
//           image: p.image,
//           stock: p.stock,
//           hasVariants: Boolean(p.variants?.length),
//         })),
//     [activeProducts]
//   );

//   // Flash Sale: active products that have a lower price than originalPrice
//   const flashSaleProducts = useMemo(
//     () =>
//       activeProducts
//         .filter(p => p.originalPrice != null && p.originalPrice > p.price)
//         .slice(0, 4)
//         .map(p => ({
//           id: p.id,
//           name: p.name,
//           price: p.price,
//           originalPrice: p.originalPrice as number,
//           discount: Math.round(((p.originalPrice as number - p.price) / (p.originalPrice as number)) * 100),
//           image: p.image,
//           stock: p.stock,
//           hasVariants: Boolean(p.variants?.length),
//         })),
//     [activeProducts]
//   );

//   const renderHomeCartAction = (product: HomeProductCardItem, className: string) => {
//     return (
//       <CardBuyNowActionRow
//         productId={product.id}
//         productName={product.name}
//         productImage={product.image}
//         price={product.price}
//         maxStock={product.stock}
//         hasRequiredVariants={product.hasVariants}
//         className={className}
//         stepperClassName="min-w-0 flex-1"
//         buttonClassName="min-w-0 flex-1 px-2 text-xs"
//         disabled={product.stock === 0}
//       />
//     );
//   };

//   // Fetch categories from API
//   useEffect(() => {
//     fetch('/api/categories?activeOnly=true')
//       .then(res => res.json())
//       .then(data => {
//         if (data.categories) {
//           const mapped = data.categories.map((cat: { id: string; name: string; slug: string; icon?: string }, index: number) => ({
//             id: cat.id,
//             name: cat.name,
//             slug: cat.slug,
//             icon: cat.icon || DEFAULT_CATEGORY_ICON,
//             color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
//           }));
//           setCategories(mapped);
//         }
//       })
//       .catch(() => {
//         // keep empty array on error
//       });
//   }, []);

//   // Countdown timer
//   useEffect(() => {
//     const timer = setInterval(() => {
//       setTimeLeft(prev => {
//         if (prev.seconds > 0) {
//           return { ...prev, seconds: prev.seconds - 1 };
//         } else if (prev.minutes > 0) {
//           return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
//         } else if (prev.hours > 0) {
//           return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
//         }
//         return prev;
//       });
//     }, 1000);

//     return () => clearInterval(timer);
//   }, []);

//   // Auto-slide promotion
//   useEffect(() => {
//     const slideTimer = setInterval(() => {
//       setCurrentSlide(prev => (prev + 1) % 2);
//     }, 5000);

//     return () => clearInterval(slideTimer);
//   }, []);

//   // Auto-slide combos
//   useEffect(() => {
//     const comboSlideTimer = setInterval(() => {
//       setCurrentComboSlide(prev => (prev + 1) % 3);
//     }, 5000);

//     return () => clearInterval(comboSlideTimer);
//   }, []);

//   return (
//     <div className="min-h-screen bg-minsah-light pb-20">
//       {/* Header */}
//       <header className="bg-minsah-dark text-minsah-light sticky top-0 z-50 shadow-md">
//         <div className="px-4 py-3">
//           <div className="flex items-center justify-between mb-3">
//             <div className="flex items-center gap-2">
//               <span className="text-xs">9:41</span>
//             </div>
//             <h1 className="text-xl font-bold font-[\'Tenor_Sans\']">Home</h1>
//             <div className="w-12"></div>
//           </div>

//           {/* Search Bar */}
//           <div ref={searchRef} className="relative">
//             <button
//               onClick={handleSearch}
//               className="absolute left-3 top-1/2 -translate-y-1/2 text-minsah-secondary z-10"
//               aria-label="Search"
//             >
//               <Search size={20} />
//             </button>
//             <input
//               type="text"
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
//               onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
//               placeholder="Search here"
//               className="w-full pl-10 pr-4 py-2.5 bg-minsah-accent text-minsah-dark placeholder:text-minsah-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-minsah-primary"
//             />
//             {showSuggestions && suggestions.length > 0 && (
//               <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-minsah-accent rounded-lg shadow-lg z-50 overflow-hidden">
//                 {suggestions.map((s, i) => (
//                   <li key={i}>
//                     <Link
//                       href={s.slug ? `/products/${s.slug}` : `/shop?q=${encodeURIComponent(s.text)}`}
//                       onClick={() => setShowSuggestions(false)}
//                       className="flex items-center gap-3 px-4 py-2.5 hover:bg-minsah-accent/50 transition-colors"
//                     >
//                       {s.image && (
//                         <img src={s.image} alt={s.productName} className="w-9 h-9 object-cover rounded" />
//                       )}
//                       <div className="flex-1 min-w-0">
//                         <p className="text-sm font-medium text-minsah-dark truncate">{s.productName || s.text}</p>
//                         {s.price > 0 && (
//                           <p className="text-xs text-minsah-secondary">৳{s.price.toLocaleString()}</p>
//                         )}
//                       </div>
//                       <Search size={14} className="text-minsah-secondary flex-shrink-0" />
//                     </Link>
//                   </li>
//                 ))}
//                 <li>
//                   <button
//                     onClick={handleSearch}
//                     className="w-full text-left px-4 py-2.5 text-sm text-minsah-primary font-medium hover:bg-minsah-accent/50 transition-colors border-t border-minsah-accent"
//                   >
//                     See all results for &ldquo;{searchQuery}&rdquo;
//                   </button>
//                 </li>
//               </ul>
//             )}
//           </div>
//         </div>
//       </header>

//       {/* Browse by Categories */}
//       <section className="px-4 py-6 bg-white">
//         <h2 className="text-lg font-bold text-minsah-dark mb-4">Browse by Categories</h2>
//         <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
//           {categories.map((category) => (
//             <Link
//               key={category.id ?? category.name}
//               href={`/categories/${category.slug ?? category.name.toLowerCase().replace(/\s+/g, '-')}`}
//               className="flex flex-col items-center gap-2 flex-shrink-0"
//             >
//               <div className={`w-16 h-16 ${category.color} rounded-full flex items-center justify-center text-3xl overflow-hidden`}>
//                 {category.icon && (category.icon.startsWith('/') || category.icon.startsWith('http'))
//                   ? <img src={category.icon} alt={category.name} className="w-full h-full object-cover" />
//                   : (category.icon || DEFAULT_CATEGORY_ICON)
//                 }
//               </div>
//               <span className="text-xs text-minsah-dark font-medium text-center">{category.name}</span>
//             </Link>
//           ))}
//         </div>
//       </section>

//       {/* Promotion Section */}
//       <section className="px-4 py-6">
//         <h2 className="text-lg font-bold text-minsah-dark mb-4">Promotion Section</h2>
//         <div className="relative">
//           {/* Carousel */}
//           <div className="bg-gradient-to-br from-pink-500 via-pink-400 to-orange-400 rounded-3xl p-6 min-h-[200px] flex items-center justify-between overflow-hidden">
//             <div className="text-white z-10">
//               <h3 className="text-2xl font-bold mb-2">Exclusive<br/>Winter<br/>2022-23</h3>
//             </div>
//             <div className="flex gap-2 items-center">
//               <div className="w-16 h-16 bg-white/30 rounded-full"></div>
//               <div className="w-20 h-20 bg-white/40 rounded-full"></div>
//               <div className="w-16 h-16 bg-white/30 rounded-full"></div>
//             </div>
//           </div>

//           {/* Slide Indicators */}
//           <div className="flex justify-center gap-1.5 mt-3">
//             <div className={`h-1.5 rounded-full transition-all ${currentSlide === 0 ? 'w-6 bg-minsah-primary' : 'w-1.5 bg-minsah-secondary'}`}></div>
//             <div className={`h-1.5 rounded-full transition-all ${currentSlide === 1 ? 'w-6 bg-minsah-primary' : 'w-1.5 bg-minsah-secondary'}`}></div>
//           </div>
//         </div>
//       </section>

//       {/* Browse by Combos */}
//       <section className="px-4 py-6 bg-white">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-lg font-bold text-minsah-dark">Browse by Combos</h2>
//           <Link href="/combos" className="text-sm text-minsah-primary font-semibold flex items-center gap-1">
//             View all <ChevronRight size={16} />
//           </Link>
//         </div>
//         <div className="relative">
//           {/* Combo Carousel */}
//           <Link href="/combos" className="block">
//             <div className={`bg-gradient-to-br ${comboSlides[currentComboSlide].gradient} rounded-3xl p-6 min-h-[200px] flex items-center justify-between overflow-hidden transition-all duration-500`}>
//               <div className="text-white z-10 flex-1">
//                 <h3 className="text-2xl font-bold mb-2">{comboSlides[currentComboSlide].title}</h3>
//                 <p className="text-sm opacity-90">{comboSlides[currentComboSlide].description}</p>
//               </div>
//               <div className="text-7xl opacity-20">
//                 {comboSlides[currentComboSlide].image}
//               </div>
//             </div>
//           </Link>

//           {/* Slide Indicators */}
//           <div className="flex justify-center gap-1.5 mt-3">
//             <div className={`h-1.5 rounded-full transition-all ${currentComboSlide === 0 ? 'w-6 bg-minsah-primary' : 'w-1.5 bg-minsah-secondary'}`}></div>
//             <div className={`h-1.5 rounded-full transition-all ${currentComboSlide === 1 ? 'w-6 bg-minsah-primary' : 'w-1.5 bg-minsah-secondary'}`}></div>
//             <div className={`h-1.5 rounded-full transition-all ${currentComboSlide === 2 ? 'w-6 bg-minsah-primary' : 'w-1.5 bg-minsah-secondary'}`}></div>
//           </div>
//         </div>

//         {/* Combo Categories Preview */}
//         <div className="mt-6 grid grid-cols-2 gap-3">
//           <Link href="/combos" className="bg-minsah-accent rounded-xl p-4 flex items-center gap-3">
//             <div className="text-3xl">💄</div>
//             <div>
//               <h4 className="font-semibold text-sm text-minsah-dark">Makeup Combos</h4>
//               <p className="text-xs text-minsah-secondary">From Tk 1001</p>
//             </div>
//           </Link>
//           <Link href="/combos" className="bg-minsah-accent rounded-xl p-4 flex items-center gap-3">
//             <div className="text-3xl">✨</div>
//             <div>
//               <h4 className="font-semibold text-sm text-minsah-dark">Skincare Sets</h4>
//               <p className="text-xs text-minsah-secondary">From Tk 1001</p>
//             </div>
//           </Link>
//         </div>
//       </section>

//       {/* Flash Sale */}
//       <section className="px-4 py-6 bg-gradient-to-br from-amber-50 to-orange-50">
//         <div className="flex items-center justify-between mb-4">
//           <div className="flex items-center gap-2">
//             <Flame className="text-orange-500" size={24} />
//             <h2 className="text-lg font-bold text-minsah-dark">Flash Sale</h2>
//           </div>
//           <Link href="/flash-sale" className="text-sm text-minsah-primary font-semibold">
//             Shop Now
//           </Link>
//         </div>

//         {/* Countdown */}
//         <div className="flex items-center gap-2 mb-4">
//           <span className="text-sm text-minsah-secondary">Ends in:</span>
//           <div className="flex gap-1">
//             <div className="bg-minsah-primary text-white px-2 py-1 rounded text-xs font-bold min-w-[24px] text-center">
//               {String(timeLeft.days).padStart(2, '0')}
//             </div>
//             <span className="text-minsah-dark">:</span>
//             <div className="bg-minsah-primary text-white px-2 py-1 rounded text-xs font-bold min-w-[24px] text-center">
//               {String(timeLeft.hours).padStart(2, '0')}
//             </div>
//             <span className="text-minsah-dark">:</span>
//             <div className="bg-minsah-primary text-white px-2 py-1 rounded text-xs font-bold min-w-[24px] text-center">
//               {String(timeLeft.minutes).padStart(2, '0')}
//             </div>
//             <span className="text-minsah-dark">:</span>
//             <div className="bg-minsah-primary text-white px-2 py-1 rounded text-xs font-bold min-w-[24px] text-center">
//               {String(timeLeft.seconds).padStart(2, '0')}
//             </div>
//           </div>
//         </div>

//         {/* Flash Sale Products */}
//         <div className="grid grid-cols-2 gap-3">
//           {flashSaleProducts.map((product) => (
//             <div key={product.id} className="bg-white rounded-xl p-3 shadow-sm relative">
//               <Link href={`/products/${product.id}`}>
//                 <div className="relative mb-2">
//                   <div className="w-full aspect-square bg-minsah-accent rounded-lg flex items-center justify-center overflow-hidden mb-2">
//                     <ProductImage src={product.image} alt={product.name} />
//                   </div>
//                   <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
//                     {product.discount}%
//                   </div>
//                 </div>
//                 <h3 className="text-xs font-semibold text-minsah-dark mb-1 line-clamp-2">{product.name}</h3>
//                 <div className="flex items-center gap-2 mb-2">
//                   <span className="text-sm font-bold text-minsah-primary">
//                     {formatPrice(product.price)}
//                   </span>
//                   <span className="text-xs text-minsah-secondary line-through">
//                     {formatPrice(product.originalPrice)}
//                   </span>
//                 </div>
//               </Link>
//               {renderHomeCartAction(product, 'w-full')}
//             </div>
//           ))}
//         </div>
//       </section>

//       {/* New Arrival */}
//       <section className="px-4 py-6 bg-white">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-lg font-bold text-minsah-dark">New Arrival</h2>
//           <Link href="/new-arrivals" className="text-sm text-minsah-primary font-semibold flex items-center gap-1">
//             View all <ChevronRight size={16} />
//           </Link>
//         </div>

//         <div className="grid grid-cols-2 gap-3">
//           {newArrivals.slice(0, 4).map((product) => (
//             <div key={product.id} className="bg-minsah-accent rounded-2xl p-3">
//               <Link href={`/products/${product.id}`}>
//                 <div className="relative mb-2">
//                   <div className="w-full aspect-square bg-white rounded-xl flex items-center justify-center overflow-hidden mb-2">
//                     <ProductImage src={product.image} alt={product.name} />
//                   </div>
//                   <div className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
//                     <Heart size={16} className="text-minsah-secondary" />
//                   </div>
//                 </div>
//                 <h3 className="text-xs font-semibold text-minsah-dark mb-1 line-clamp-2">{product.name}</h3>
//                 <p className="text-xs text-minsah-secondary mb-1">{product.sku}</p>
//                 <span className="text-sm font-bold text-minsah-primary mb-2 block">
//                   {formatPrice(product.price)}
//                 </span>
//               </Link>
//               {renderHomeCartAction(product, 'w-full')}
//             </div>
//           ))}
//         </div>
//       </section>

//       {/* For You */}
//       <section className="px-4 py-6 bg-minsah-light">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-lg font-bold text-minsah-dark">For You</h2>
//           <Link href="/for-you" className="text-sm text-minsah-primary font-semibold flex items-center gap-1">
//             View all <ChevronRight size={16} />
//           </Link>
//         </div>

//         <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
//           {forYouProducts.map((product) => (
//             <div key={product.id} className="bg-white rounded-2xl p-3 flex-shrink-0 w-36">
//               <Link href={`/products/${product.id}`}>
//                 <div className="relative mb-2">
//                   <div className="w-full aspect-square bg-minsah-accent rounded-xl flex items-center justify-center overflow-hidden mb-2">
//                     <ProductImage src={product.image} alt={product.name} />
//                   </div>
//                   <div className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm">
//                     <Heart size={14} className="text-minsah-secondary" />
//                   </div>
//                 </div>
//                 <h3 className="text-xs font-semibold text-minsah-dark mb-1 line-clamp-2">{product.name}</h3>
//                 <span className="text-sm font-bold text-minsah-primary block mb-2">
//                   {formatPrice(product.price)}
//                 </span>
//               </Link>
//               {renderHomeCartAction(product, 'w-full')}
//             </div>
//           ))}
//         </div>
//       </section>

//       {/* Recommendation */}
//       <section className="px-4 py-6 bg-white">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-lg font-bold text-minsah-dark">Recommendation</h2>
//           <Link href="/recommendations" className="text-sm text-minsah-primary font-semibold flex items-center gap-1">
//             View all <ChevronRight size={16} />
//           </Link>
//         </div>

//         <div className="grid grid-cols-3 gap-2">
//           {recommendations.slice(0, 6).map((product) => (
//             <div key={product.id} className="bg-minsah-accent rounded-xl p-2">
//               <Link href={`/products/${product.id}`}>
//                 <div className="relative mb-2">
//                   <div className="w-full aspect-square bg-white rounded-lg flex items-center justify-center overflow-hidden mb-1">
//                     <ProductImage src={product.image} alt={product.name} />
//                   </div>
//                   <div className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
//                     <Heart size={12} className="text-minsah-secondary" />
//                   </div>
//                 </div>
//                 <h3 className="text-[10px] font-semibold text-minsah-dark mb-1 line-clamp-2">{product.name}</h3>
//                 <div className="flex items-center gap-1 mb-1">
//                   <span className="text-xs font-bold text-minsah-primary">
//                     {formatPrice(product.price)}
//                   </span>
//                 </div>
//                 <div className="flex items-center gap-1 mb-2">
//                   <div className="flex text-yellow-400 text-[10px]">
//                     {'★'.repeat(product.rating)}{'☆'.repeat(5 - product.rating)}
//                   </div>
//                   <span className="text-[8px] text-minsah-secondary">({product.reviews})</span>
//                 </div>
//               </Link>
//               {renderHomeCartAction(product, 'w-full')}
//             </div>
//           ))}
//         </div>
//       </section>

//       {/* Favourite */}
//       <section className="px-4 py-6 bg-minsah-light">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-lg font-bold text-minsah-dark">Favourite</h2>
//           <Link href="/favourites" className="text-sm text-minsah-primary font-semibold flex items-center gap-1">
//             View all <ChevronRight size={16} />
//           </Link>
//         </div>

//         <div className="grid grid-cols-3 gap-2">
//           {favourites.slice(0, 6).map((product) => (
//             <div key={product.id} className="bg-white rounded-xl p-2">
//               <Link href={`/products/${product.id}`}>
//                 <div className="relative mb-2">
//                   <div className="w-full aspect-square bg-minsah-accent rounded-lg flex items-center justify-center overflow-hidden mb-1">
//                     <ProductImage src={product.image} alt={product.name} />
//                   </div>
//                   <div className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
//                     <Heart size={12} className="text-red-500 fill-red-500" />
//                   </div>
//                 </div>
//                 <h3 className="text-[10px] font-semibold text-minsah-dark mb-1 line-clamp-2">{product.name}</h3>
//                 <span className="text-xs font-bold text-minsah-primary block mb-2">
//                   {formatPrice(product.price)}
//                 </span>
//               </Link>
//               {renderHomeCartAction(product, 'w-full')}
//             </div>
//           ))}
//         </div>
//       </section>

//       {/* Browse Popular Brand */}
//       <section className="px-4 py-6 bg-white">
//         <div className="flex items-center justify-between mb-4">
//           <h2 className="text-lg font-bold text-minsah-dark">Browse Popular Brand</h2>
//           <Link href="/brands" className="text-sm text-minsah-primary font-semibold flex items-center gap-1">
//             View all <ChevronRight size={16} />
//           </Link>
//         </div>

//         <div className="grid grid-cols-4 gap-3">
//           {brands.map((brand) => (
//             <Link
//               key={brand.name}
//               href={`/brands/${brand.name.toLowerCase().replace(' ', '-')}`}
//               className="bg-white border-2 border-minsah-accent rounded-full aspect-square flex items-center justify-center p-2 hover:border-minsah-primary transition"
//             >
//               <span className="text-xs font-bold text-minsah-dark text-center whitespace-pre-line">
//                 {brand.logo}
//               </span>
//             </Link>
//           ))}
//         </div>
//       </section>

//       {/* Bottom Navigation */}
//       <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-minsah-accent shadow-lg z-50">
//         <div className="flex items-center justify-around py-3">
//           <Link href="/" className="flex flex-col items-center gap-1 text-minsah-primary">
//             <HomeIcon size={24} />
//             <span className="text-xs font-semibold">Home</span>
//           </Link>
//           <Link href="/search" className="flex flex-col items-center gap-1 text-minsah-secondary hover:text-minsah-primary transition">
//             <Search size={24} />
//             <span className="text-xs">Search</span>
//           </Link>
//           <Link href="/wishlist" className="flex flex-col items-center gap-1 text-minsah-secondary hover:text-minsah-primary transition">
//             <Heart size={24} />
//             <span className="text-xs">Wishlist</span>
//           </Link>
//           <Link href="/cart" className="flex flex-col items-center gap-1 text-minsah-secondary hover:text-minsah-primary transition relative">
//             <ShoppingCart size={24} />
//             {items.length > 0 && (
//               <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
//                 {items.length}
//               </span>
//             )}
//             <span className="text-xs">Cart</span>
//           </Link>
//           <Link href="/login" className="flex flex-col items-center gap-1 text-minsah-secondary hover:text-minsah-primary transition">
//             <User size={24} />
//             <span className="text-xs">Account</span>
//           </Link>
//         </div>
//       </nav>

//       <style jsx global>{`
//         .scrollbar-hide::-webkit-scrollbar {
//           display: none;
//         }
//         .scrollbar-hide {
//           -ms-overflow-style: none;
//           scrollbar-width: none;
//         }
//       `}</style>
//     </div>
//   );
// }
